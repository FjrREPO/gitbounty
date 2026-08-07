// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IGitBountyEscrow} from "./interfaces/IGitBountyEscrow.sol";
import {EnclaveAttestation} from "./libraries/EnclaveAttestation.sol";
import {EthSignedMessage} from "./libraries/EthSignedMessage.sol";
import {FtsoRewardMath} from "./libraries/FtsoRewardMath.sol";
import {GitHubApi} from "./libraries/GitHubApi.sol";

/// @title GitBountyEscrow
/// @notice Escrows FLR rewards for GitHub issues. A bounty is paid out when a
///         pull request fixing the issue is proven merged through one of two
///         trustless paths:
///         - FDC Web2Json attestation of the GitHub API (public repos);
///         - a signature from the TEE verifier running in Confidential Space
///           (private repos / pseudonymous contributors).
///         Rewards may be denominated in USD; the FLR owed is computed at
///         payout time from the FTSOv2 FLR/USD feed, with any surplus
///         refunded to the funder.
/// @dev    UUPS upgradeable with ERC-7201 namespaced storage.
contract GitBountyEscrow is IGitBountyEscrow, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using FtsoRewardMath for FtsoV2Interface;

    /// @custom:storage-location erc7201:gitbounty.storage.Escrow
    struct EscrowStorage {
        FtsoV2Interface ftsoV2;
        IWeb2JsonVerification fdcVerification;
        address teeSigner;
        uint256 nextBountyId;
        mapping(uint256 bountyId => Bounty) bounties;
        mapping(uint256 bountyId => mapping(address claimant => Claim)) claims;
        // Attestation policy: which signing key and which enclave image are
        // trusted to nominate `teeSigner`.
        bytes attestationModulus;
        bytes attestationExponent;
        string enclaveImageDigest;
    }

    // keccak256(abi.encode(uint256(keccak256("gitbounty.storage.Escrow")) - 1))
    //   & ~bytes32(uint256(0xff))
    bytes32 private constant ESCROW_STORAGE_LOCATION =
        0xc604cee9f5357e050c59656a9ceae59d074a2c1a92b4870f7d3b414e41a68300;

    function _storage() private pure returns (EscrowStorage storage $) {
        assembly {
            $.slot := ESCROW_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        FtsoV2Interface ftsoV2_,
        IWeb2JsonVerification fdcVerification_,
        address teeSigner_,
        address owner_
    ) external initializer {
        __Ownable_init(owner_);

        EscrowStorage storage $ = _storage();
        $.ftsoV2 = ftsoV2_;
        $.fdcVerification = fdcVerification_;
        $.teeSigner = teeSigner_;
        $.nextBountyId = 1;
    }

    // -- bounty lifecycle --------------------------------------------------

    /// @inheritdoc IGitBountyEscrow
    function createBounty(string calldata repo, uint64 issueNumber, uint128 rewardUsdCents, uint64 expiresAt)
        external
        payable
        returns (uint256 id)
    {
        if (msg.value == 0) revert ZeroReward();
        if (expiresAt <= block.timestamp) revert PastExpiry();

        EscrowStorage storage $ = _storage();
        id = $.nextBountyId++;
        $.bounties[id] = Bounty({
            funder: msg.sender,
            issueNumber: issueNumber,
            expiresAt: expiresAt,
            status: Status.Open,
            rewardUsdCents: rewardUsdCents,
            amount: msg.value,
            repo: repo
        });
        emit BountyCreated(id, msg.sender, repo, issueNumber, msg.value, rewardUsdCents, expiresAt);
    }

    /// @inheritdoc IGitBountyEscrow
    function registerClaim(uint256 bountyId, uint256 prNumber, bytes32 githubLoginHash) external {
        EscrowStorage storage $ = _storage();
        if ($.bounties[bountyId].status != Status.Open) revert NotOpen();
        $.claims[bountyId][msg.sender] = Claim({prNumber: prNumber, githubLoginHash: githubLoginHash});
        emit ClaimRegistered(bountyId, msg.sender, prNumber, githubLoginHash);
    }

    /// @inheritdoc IGitBountyEscrow
    function claimWithFdcProof(uint256 bountyId, IWeb2Json.Proof calldata proof) external {
        EscrowStorage storage $ = _storage();
        Bounty storage bounty = _openBounty($, bountyId);

        Claim memory claim = $.claims[bountyId][msg.sender];
        if (claim.githubLoginHash == bytes32(0)) revert NoClaim();

        if (!$.fdcVerification.verifyWeb2Json(proof)) revert InvalidProof();

        // Bind the attestation to this bounty's repository and registered PR:
        // the attested URL must be exactly the GitHub API endpoint for them.
        string memory expectedUrl = GitHubApi.pullRequestUrl(bounty.repo, claim.prNumber);
        if (keccak256(bytes(proof.data.requestBody.url)) != keccak256(bytes(expectedUrl))) {
            revert UrlMismatch();
        }

        PrMergeData memory pr = abi.decode(proof.data.responseBody.abiEncodedData, (PrMergeData));
        if (!pr.merged) revert PrNotMerged();
        if (keccak256(bytes(pr.author)) != claim.githubLoginHash) revert AuthorMismatch();

        _payout($, bountyId, bounty, msg.sender);
    }

    /// @inheritdoc IGitBountyEscrow
    function claimWithTeeProof(uint256 bountyId, address recipient, bytes calldata signature) external {
        EscrowStorage storage $ = _storage();
        Bounty storage bounty = _openBounty($, bountyId);

        bytes32 innerHash = keccak256(abi.encode(block.chainid, address(this), bountyId, recipient));
        if (EthSignedMessage.recover(innerHash, signature) != $.teeSigner) {
            revert InvalidSignature();
        }

        _payout($, bountyId, bounty, recipient);
    }

    /// @inheritdoc IGitBountyEscrow
    function reclaim(uint256 bountyId) external {
        EscrowStorage storage $ = _storage();
        Bounty storage bounty = _openBounty($, bountyId);
        if (msg.sender != bounty.funder) revert NotFunder();
        if (block.timestamp < bounty.expiresAt) revert NotExpired();

        bounty.status = Status.Reclaimed;
        _transfer(bounty.funder, bounty.amount);
        emit BountyReclaimed(bountyId);
    }

    // -- administration ----------------------------------------------------

    /// @notice Sets the attestation policy: Google's Confidential Space signing
    ///         key and the enclave image digest allowed to nominate a signer.
    /// @dev The modulus is publicly checkable against Google's JWKS, so this
    ///      is a falsifiable commitment rather than a trusted one.
    function setAttestationPolicy(bytes calldata modulus, bytes calldata exponent, string calldata imageDigest)
        external
        onlyOwner
    {
        EscrowStorage storage $ = _storage();
        $.attestationModulus = modulus;
        $.attestationExponent = exponent;
        $.enclaveImageDigest = imageDigest;
        emit AttestationPolicySet(keccak256(modulus), imageDigest);
    }

    /// @inheritdoc IGitBountyEscrow
    /// @dev Permissionless: anyone holding a fresh attestation from the approved
    ///      image can rotate the signer, so the owner cannot quietly install a
    ///      key of their own.
    function registerEnclaveSigner(bytes calldata token) external {
        EscrowStorage storage $ = _storage();
        if ($.attestationModulus.length == 0) revert NoAttestationPolicy();

        bytes memory payload = EnclaveAttestation.verify(token, $.attestationModulus, $.attestationExponent);

        // `image_digest` is the only claim that gates which workload may
        // nominate a signer, and a workload controls earlier fields such as
        // `eat_nonce`. Read it from inside `submods`, where only Google writes.
        uint256 submods = EnclaveAttestation.offsetOf(payload, '"submods"');

        // The token must come from a Confidential Space enclave running the
        // approved image, and be addressed to this escrow.
        if (
            keccak256(EnclaveAttestation.claim(payload, "hwmodel")) != keccak256("GCP_INTEL_TDX")
                || keccak256(EnclaveAttestation.claim(payload, "swname")) != keccak256("CONFIDENTIAL_SPACE")
                || keccak256(EnclaveAttestation.claim(payload, "image_digest", submods))
                    != keccak256(bytes($.enclaveImageDigest))
                || keccak256(EnclaveAttestation.claim(payload, "aud"))
                    != keccak256(bytes(Strings.toHexString(address(this))))
        ) {
            revert UnexpectedEnclave();
        }

        // A stale token must not be replayable.
        if (block.timestamp >= EnclaveAttestation.claimNumber(payload, "exp")) {
            revert AttestationExpired();
        }

        address newSigner = EnclaveAttestation.toAddress(EnclaveAttestation.claim(payload, "eat_nonce"));
        emit TeeSignerUpdated($.teeSigner, newSigner);
        $.teeSigner = newSigner;
    }

    /// @notice Rotates the TEE verifier's enclave key without an attestation.
    /// @dev Kept for bootstrap and emergencies; prefer registerEnclaveSigner.
    function setTeeSigner(address newSigner) external onlyOwner {
        EscrowStorage storage $ = _storage();
        emit TeeSignerUpdated($.teeSigner, newSigner);
        $.teeSigner = newSigner;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // -- views -------------------------------------------------------------

    /// @inheritdoc IGitBountyEscrow
    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return _storage().bounties[bountyId];
    }

    /// @inheritdoc IGitBountyEscrow
    function getClaim(uint256 bountyId, address claimant) external view returns (Claim memory) {
        return _storage().claims[bountyId][claimant];
    }

    /// @inheritdoc IGitBountyEscrow
    function nextBountyId() external view returns (uint256) {
        return _storage().nextBountyId;
    }

    /// @inheritdoc IGitBountyEscrow
    function teeSigner() external view returns (address) {
        return _storage().teeSigner;
    }

    function ftsoV2() external view returns (FtsoV2Interface) {
        return _storage().ftsoV2;
    }

    function fdcVerification() external view returns (IWeb2JsonVerification) {
        return _storage().fdcVerification;
    }

    // -- internals ---------------------------------------------------------

    function _openBounty(EscrowStorage storage $, uint256 bountyId) private view returns (Bounty storage bounty) {
        bounty = $.bounties[bountyId];
        if (bounty.status != Status.Open) revert NotOpen();
    }

    /// @dev Pays the reward. USD-denominated bounties convert at the live
    ///      FTSOv2 FLR/USD price; any surplus goes back to the funder.
    function _payout(EscrowStorage storage $, uint256 bountyId, Bounty storage bounty, address recipient) private {
        bounty.status = Status.Paid;

        uint256 paid = bounty.amount;
        uint256 refund = 0;
        if (bounty.rewardUsdCents > 0) {
            uint256 owed = $.ftsoV2.usdCentsToFlrWei(bounty.rewardUsdCents);
            if (owed < paid) {
                refund = paid - owed;
                paid = owed;
            }
        }

        _transfer(recipient, paid);
        if (refund > 0) {
            _transfer(bounty.funder, refund);
        }
        emit BountyPaid(bountyId, recipient, paid, refund);
    }

    function _transfer(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
