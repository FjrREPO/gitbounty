// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

/// @title IGitBountyEscrow
/// @notice External API, data model, events, and errors of the GitBounty escrow.
interface IGitBountyEscrow {
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
    event ClaimRegistered(uint256 indexed id, address indexed claimant, uint256 prNumber, bytes32 githubLoginHash);
    event BountyPaid(uint256 indexed id, address indexed recipient, uint256 paid, uint256 refunded);
    event BountyReclaimed(uint256 indexed id);
    event TeeSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event AttestationPolicySet(bytes32 indexed modulusHash, string imageDigest);

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
    error NoAttestationPolicy();
    error UnexpectedEnclave();
    error AttestationExpired();

    function createBounty(string calldata repo, uint64 issueNumber, uint128 rewardUsdCents, uint64 expiresAt)
        external
        payable
        returns (uint256 id);

    function registerClaim(uint256 bountyId, uint256 prNumber, bytes32 githubLoginHash) external;

    function claimWithFdcProof(uint256 bountyId, IWeb2Json.Proof calldata proof) external;

    function claimWithTeeProof(uint256 bountyId, address recipient, bytes calldata signature) external;

    function reclaim(uint256 bountyId) external;

    /// @notice Points `teeSigner` at the key inside an attested enclave.
    /// @param token Confidential Space attestation JWT naming the key as its nonce.
    function registerEnclaveSigner(bytes calldata token) external;

    function getBounty(uint256 bountyId) external view returns (Bounty memory);

    function getClaim(uint256 bountyId, address claimant) external view returns (Claim memory);

    function nextBountyId() external view returns (uint256);

    function teeSigner() external view returns (address);
}
