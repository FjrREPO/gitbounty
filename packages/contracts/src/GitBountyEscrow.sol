// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";

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
contract GitBountyEscrow {
    enum Status {
        None,
        Open,
        Paid,
        Reclaimed
    }

    struct Bounty {
        address funder;
        uint64 issueNumber;
        uint64 expiresAt;
        Status status;
        /// @dev 0 means a fixed-FLR bounty: the full locked amount is paid.
        uint128 rewardUsdCents;
        uint256 amount;
        /// @dev "owner/name", used to bind FDC proofs to this repository.
        string repo;
    }

    /// @dev Mirrors the Web2Json abiSignature used by the off-chain stack.
    struct PrMergeData {
        bool merged;
        string author;
        uint256 prNumber;
    }

    struct Claim {
        uint256 prNumber;
        bytes32 githubLoginHash;
    }

    event BountyCreated(
        uint256 indexed id,
        address indexed funder,
        string repo,
        uint64 issueNumber,
        uint256 amount,
        uint128 rewardUsdCents,
        uint64 expiresAt
    );
    event ClaimRegistered(
        uint256 indexed id, address indexed claimant, uint256 prNumber, bytes32 githubLoginHash
    );
    event BountyPaid(uint256 indexed id, address indexed recipient, uint256 paid, uint256 refunded);
    event BountyReclaimed(uint256 indexed id);

    error ZeroReward();
    error PastExpiry();
    error NotOpen();
    error NoClaim();
    error InvalidProof();
    error UrlMismatch();
    error PrNotMerged();
    error AuthorMismatch();
    error InvalidSignature();
    error NotFunder();
    error NotExpired();
    error TransferFailed();

    /// @notice FTSOv2 feed id for FLR/USD (category 0x01 + ASCII "FLR/USD").
    bytes21 public constant FLR_USD_FEED = 0x01464c522f55534400000000000000000000000000;

    FtsoV2Interface public immutable ftsoV2;
    IWeb2JsonVerification public immutable fdcVerification;
    /// @notice Address derived from the enclave key of the TEE verifier.
    address public immutable teeSigner;

    uint256 public nextBountyId = 1;
    mapping(uint256 bountyId => Bounty) public bounties;
    mapping(uint256 bountyId => mapping(address claimant => Claim)) public claims;

    constructor(FtsoV2Interface _ftsoV2, IWeb2JsonVerification _fdcVerification, address _teeSigner) {
        ftsoV2 = _ftsoV2;
        fdcVerification = _fdcVerification;
        teeSigner = _teeSigner;
    }

    /// @notice Locks `msg.value` FLR as the reward for a GitHub issue.
    /// @param repo Repository as "owner/name".
    /// @param issueNumber The GitHub issue the bounty is attached to.
    /// @param rewardUsdCents USD-denominated reward in cents; 0 pays the full
    ///        locked amount without FTSO conversion.
    /// @param expiresAt Unix time after which the funder can reclaim.
    function createBounty(
        string calldata repo,
        uint64 issueNumber,
        uint128 rewardUsdCents,
        uint64 expiresAt
    ) external payable returns (uint256 id) {
        if (msg.value == 0) revert ZeroReward();
        if (expiresAt <= block.timestamp) revert PastExpiry();

        id = nextBountyId++;
        bounties[id] = Bounty({
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

    /// @notice Links the caller's wallet to a GitHub login and the PR expected
    ///         to resolve the bounty. Required before an FDC claim so the
    ///         attested PR author can be matched to a payout address.
    function registerClaim(uint256 bountyId, uint256 prNumber, bytes32 githubLoginHash) external {
        if (bounties[bountyId].status != Status.Open) revert NotOpen();
        claims[bountyId][msg.sender] = Claim({prNumber: prNumber, githubLoginHash: githubLoginHash});
        emit ClaimRegistered(bountyId, msg.sender, prNumber, githubLoginHash);
    }

    /// @notice Claims a bounty with an FDC Web2Json attestation proving the
    ///         registered PR is merged and authored by the registered login.
    function claimWithFdcProof(uint256 bountyId, IWeb2Json.Proof calldata proof) external {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != Status.Open) revert NotOpen();

        Claim memory claim = claims[bountyId][msg.sender];
        if (claim.githubLoginHash == bytes32(0)) revert NoClaim();

        if (!fdcVerification.verifyWeb2Json(proof)) revert InvalidProof();

        // Bind the attestation to this bounty's repository and registered PR:
        // the attested URL must be exactly the GitHub API endpoint for them.
        string memory expectedUrl = string.concat(
            "https://api.github.com/repos/", bounty.repo, "/pulls/", _toString(claim.prNumber)
        );
        if (keccak256(bytes(proof.data.requestBody.url)) != keccak256(bytes(expectedUrl))) {
            revert UrlMismatch();
        }

        PrMergeData memory pr =
            abi.decode(proof.data.responseBody.abiEncodedData, (PrMergeData));
        if (!pr.merged) revert PrNotMerged();
        if (keccak256(bytes(pr.author)) != claim.githubLoginHash) revert AuthorMismatch();

        _payout(bountyId, bounty, msg.sender);
    }

    /// @notice Claims a bounty with a payout authorization signed inside the
    ///         TEE. The enclave has already verified the merge and the
    ///         contributor's identity; nothing sensitive appears on-chain.
    function claimWithTeeProof(uint256 bountyId, address recipient, bytes calldata signature)
        external
    {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != Status.Open) revert NotOpen();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(this), bountyId, recipient))
            )
        );
        if (_recover(digest, signature) != teeSigner) revert InvalidSignature();

        _payout(bountyId, bounty, recipient);
    }

    /// @notice Returns the escrow to the funder once the bounty has expired.
    function reclaim(uint256 bountyId) external {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.status != Status.Open) revert NotOpen();
        if (msg.sender != bounty.funder) revert NotFunder();
        if (block.timestamp < bounty.expiresAt) revert NotExpired();

        bounty.status = Status.Reclaimed;
        _transfer(bounty.funder, bounty.amount);
        emit BountyReclaimed(bountyId);
    }

    /// @dev Pays the reward. USD-denominated bounties convert at the live
    ///      FTSOv2 FLR/USD price; any surplus goes back to the funder.
    function _payout(uint256 bountyId, Bounty storage bounty, address recipient) private {
        bounty.status = Status.Paid;

        uint256 paid = bounty.amount;
        uint256 refund = 0;
        if (bounty.rewardUsdCents > 0) {
            (uint256 priceWei,) = ftsoV2.getFeedByIdInWei(FLR_USD_FEED);
            // priceWei is USD per FLR with 18 decimals; cents scale by 1e16.
            uint256 owed = (uint256(bounty.rewardUsdCents) * 1e16 * 1e18) / priceWei;
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

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidSignature();
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
        return signer;
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
