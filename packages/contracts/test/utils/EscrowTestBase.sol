// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Test} from "forge-std/Test.sol";
import {GitBountyEscrow} from "../../src/GitBountyEscrow.sol";
import {IGitBountyEscrow} from "../../src/interfaces/IGitBountyEscrow.sol";
import {MockFtsoV2} from "../mocks/MockFtsoV2.sol";
import {MockWeb2JsonVerification} from "../mocks/MockWeb2JsonVerification.sol";

/// @dev Shared fixture: deploys the escrow behind an ERC1967 proxy with
///      mocked Flare dependencies, plus helpers used by every suite.
abstract contract EscrowTestBase is Test {
    GitBountyEscrow internal escrow;
    MockFtsoV2 internal ftso;
    MockWeb2JsonVerification internal verifier;

    address internal owner = makeAddr("owner");
    address internal funder = makeAddr("funder");
    address internal dev = makeAddr("dev");
    address internal teeSigner;
    uint256 internal teeKey;

    string internal constant REPO = "acme/demo";
    uint64 internal constant ISSUE = 42;
    uint256 internal constant PR = 7;
    bytes32 internal constant AUTHOR_HASH = keccak256("octocat");

    function setUp() public virtual {
        (teeSigner, teeKey) = makeAddrAndKey("tee");
        ftso = new MockFtsoV2();
        verifier = new MockWeb2JsonVerification();

        GitBountyEscrow implementation = new GitBountyEscrow();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                GitBountyEscrow.initialize,
                (FtsoV2Interface(address(ftso)), IWeb2JsonVerification(address(verifier)), teeSigner, owner)
            )
        );
        escrow = GitBountyEscrow(address(proxy));
        vm.deal(funder, 100_000 ether);
    }

    function createBounty(uint128 usdCents, uint256 amount) internal returns (uint256) {
        vm.prank(funder);
        return escrow.createBounty{value: amount}(REPO, ISSUE, usdCents, uint64(block.timestamp + 7 days));
    }

    function mergedProof(string memory url, bool merged, string memory author)
        internal
        pure
        returns (IWeb2Json.Proof memory proof)
    {
        proof.data.requestBody.url = url;
        proof.data.responseBody.abiEncodedData =
            abi.encode(IGitBountyEscrow.PrMergeData({merged: merged, author: author, prNumber: PR}));
    }

    function prUrl() internal pure returns (string memory) {
        return "https://api.github.com/repos/acme/demo/pulls/7";
    }

    function teeSignature(uint256 bountyId, address recipient) internal view returns (bytes memory) {
        return signClaim(teeKey, bountyId, recipient);
    }

    function signClaim(uint256 key, uint256 bountyId, address recipient) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(escrow), bountyId, recipient))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
