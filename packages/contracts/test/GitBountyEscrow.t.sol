// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {Test} from "forge-std/Test.sol";
import {GitBountyEscrow} from "../src/GitBountyEscrow.sol";

contract MockFtsoV2 {
    uint256 public price;

    function setPrice(uint256 priceWei) external {
        price = priceWei;
    }

    function getFeedByIdInWei(bytes21) external payable returns (uint256, uint64) {
        return (price, uint64(block.timestamp));
    }
}

contract MockWeb2JsonVerification {
    bool public ok = true;

    function setOk(bool value) external {
        ok = value;
    }

    function verifyWeb2Json(IWeb2Json.Proof calldata) external view returns (bool) {
        return ok;
    }
}

contract GitBountyEscrowTest is Test {
    GitBountyEscrow internal escrow;
    MockFtsoV2 internal ftso;
    MockWeb2JsonVerification internal verifier;

    address internal funder = makeAddr("funder");
    address internal dev = makeAddr("dev");
    address internal teeSigner;
    uint256 internal teeKey;

    string internal constant REPO = "acme/demo";
    uint64 internal constant ISSUE = 42;
    uint256 internal constant PR = 7;
    bytes32 internal constant AUTHOR_HASH = keccak256("octocat");

    function setUp() public {
        (teeSigner, teeKey) = makeAddrAndKey("tee");
        ftso = new MockFtsoV2();
        verifier = new MockWeb2JsonVerification();
        escrow = new GitBountyEscrow(
            FtsoV2Interface(address(ftso)),
            IWeb2JsonVerification(address(verifier)),
            teeSigner
        );
        vm.deal(funder, 100_000 ether);
    }

    function createBounty(uint128 usdCents, uint256 amount) internal returns (uint256) {
        vm.prank(funder);
        return escrow.createBounty{value: amount}(
            REPO, ISSUE, usdCents, uint64(block.timestamp + 7 days)
        );
    }

    function mergedProof(string memory url, bool merged, string memory author)
        internal
        pure
        returns (IWeb2Json.Proof memory proof)
    {
        proof.data.requestBody.url = url;
        proof.data.responseBody.abiEncodedData =
            abi.encode(GitBountyEscrow.PrMergeData({merged: merged, author: author, prNumber: PR}));
    }

    function prUrl() internal pure returns (string memory) {
        return "https://api.github.com/repos/acme/demo/pulls/7";
    }

    // -- creation ----------------------------------------------------------

    function test_createBounty_storesAndLocksFunds() public {
        uint256 id = createBounty(5000, 10 ether);
        assertEq(id, 1);
        assertEq(address(escrow).balance, 10 ether);
        (address storedFunder,,, GitBountyEscrow.Status status,,,) = escrow.bounties(id);
        assertEq(storedFunder, funder);
        assertEq(uint8(status), uint8(GitBountyEscrow.Status.Open));
    }

    function test_createBounty_revertsWithoutValue() public {
        vm.prank(funder);
        vm.expectRevert(GitBountyEscrow.ZeroReward.selector);
        escrow.createBounty(REPO, ISSUE, 0, uint64(block.timestamp + 1 days));
    }

    function test_createBounty_revertsOnPastExpiry() public {
        vm.prank(funder);
        vm.expectRevert(GitBountyEscrow.PastExpiry.selector);
        escrow.createBounty{value: 1 ether}(REPO, ISSUE, 0, uint64(block.timestamp));
    }

    // -- FDC claim path ----------------------------------------------------

    function test_fdcClaim_paysFixedFlrBounty() public {
        uint256 id = createBounty(0, 10 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();
        assertEq(dev.balance, 10 ether);
    }

    function test_fdcClaim_convertsUsdRewardViaFtso() public {
        // $50 bounty, FLR at $0.02 -> 2500 FLR owed, surplus refunded.
        ftso.setPrice(0.02 ether);
        uint256 id = createBounty(5000, 4000 ether);
        uint256 funderBefore = funder.balance;

        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();

        assertEq(dev.balance, 2500 ether);
        assertEq(funder.balance, funderBefore + 1500 ether);
    }

    function test_fdcClaim_capsPayoutAtLockedAmount() public {
        // $50 owed at $0.02 = 2500 FLR but only 1000 locked -> pay everything.
        ftso.setPrice(0.02 ether);
        uint256 id = createBounty(5000, 1000 ether);

        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();

        assertEq(dev.balance, 1000 ether);
        assertEq(address(escrow).balance, 0);
    }

    function test_fdcClaim_revertsWithoutRegisteredClaim() public {
        uint256 id = createBounty(0, 1 ether);
        vm.prank(dev);
        vm.expectRevert(GitBountyEscrow.NoClaim.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
    }

    function test_fdcClaim_revertsOnInvalidProof() public {
        uint256 id = createBounty(0, 1 ether);
        verifier.setOk(false);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(GitBountyEscrow.InvalidProof.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();
    }

    function test_fdcClaim_revertsOnUnmergedPr() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(GitBountyEscrow.PrNotMerged.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), false, "octocat"));
        vm.stopPrank();
    }

    // Regression: a merged PR by a different author must not drain the escrow.
    function test_fdcClaim_revertsOnAuthorMismatch() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(GitBountyEscrow.AuthorMismatch.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "someone-else"));
        vm.stopPrank();
    }

    // Regression: a proof for another repo/PR must not satisfy this bounty.
    function test_fdcClaim_revertsOnUrlMismatch() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(GitBountyEscrow.UrlMismatch.selector);
        escrow.claimWithFdcProof(
            id, mergedProof("https://api.github.com/repos/evil/repo/pulls/7", true, "octocat")
        );
        vm.stopPrank();
    }

    function test_fdcClaim_revertsOnDoubleClaim() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.expectRevert(GitBountyEscrow.NotOpen.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();
    }

    // -- TEE claim path ----------------------------------------------------

    function teeSignature(uint256 bountyId, address recipient)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(escrow), bountyId, recipient))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teeKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_teeClaim_paysAuthorizedRecipient() public {
        uint256 id = createBounty(0, 5 ether);
        vm.prank(dev);
        escrow.claimWithTeeProof(id, dev, teeSignature(id, dev));
        assertEq(dev.balance, 5 ether);
    }

    // Regression: a signature from any key but the enclave's must fail.
    function test_teeClaim_revertsOnWrongSigner() public {
        uint256 id = createBounty(0, 5 ether);
        (, uint256 impostorKey) = makeAddrAndKey("impostor");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(escrow), id, dev))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(impostorKey, digest);
        vm.prank(dev);
        vm.expectRevert(GitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, dev, abi.encodePacked(r, s, v));
    }

    // Regression: a signature for one recipient must not pay another.
    function test_teeClaim_revertsWhenRecipientSwapped() public {
        uint256 id = createBounty(0, 5 ether);
        bytes memory sig = teeSignature(id, dev);
        address thief = makeAddr("thief");
        vm.prank(thief);
        vm.expectRevert(GitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, thief, sig);
    }

    // -- reclaim -----------------------------------------------------------

    function test_reclaim_returnsFundsAfterExpiry() public {
        uint256 id = createBounty(0, 3 ether);
        uint256 before = funder.balance;
        vm.warp(block.timestamp + 8 days);
        vm.prank(funder);
        escrow.reclaim(id);
        assertEq(funder.balance, before + 3 ether);
    }

    function test_reclaim_revertsBeforeExpiry() public {
        uint256 id = createBounty(0, 3 ether);
        vm.prank(funder);
        vm.expectRevert(GitBountyEscrow.NotExpired.selector);
        escrow.reclaim(id);
    }

    function test_reclaim_revertsForNonFunder() public {
        uint256 id = createBounty(0, 3 ether);
        vm.warp(block.timestamp + 8 days);
        vm.prank(dev);
        vm.expectRevert(GitBountyEscrow.NotFunder.selector);
        escrow.reclaim(id);
    }
}
