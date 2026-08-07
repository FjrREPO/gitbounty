// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {IGitBountyEscrow} from "../src/interfaces/IGitBountyEscrow.sol";
import {EscrowTestBase} from "./utils/EscrowTestBase.sol";

contract GitBountyEscrowFdcClaimTest is EscrowTestBase {
    function test_paysFixedFlrBounty() public {
        uint256 id = createBounty(0, 10 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();
        assertEq(dev.balance, 10 ether);
    }

    function test_convertsUsdRewardViaFtso() public {
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

    function test_capsPayoutAtLockedAmount() public {
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

    function test_revertsWithoutRegisteredClaim() public {
        uint256 id = createBounty(0, 1 ether);
        vm.prank(dev);
        vm.expectRevert(IGitBountyEscrow.NoClaim.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
    }

    function test_revertsOnInvalidProof() public {
        uint256 id = createBounty(0, 1 ether);
        verifier.setOk(false);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(IGitBountyEscrow.InvalidProof.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();
    }

    function test_revertsOnUnmergedPr() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(IGitBountyEscrow.PrNotMerged.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), false, "octocat"));
        vm.stopPrank();
    }

    // Regression: a merged PR by a different author must not drain the escrow.
    function test_revertsOnAuthorMismatch() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(IGitBountyEscrow.AuthorMismatch.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "someone-else"));
        vm.stopPrank();
    }

    // Regression: a proof for another repo/PR must not satisfy this bounty.
    function test_revertsOnUrlMismatch() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        vm.expectRevert(IGitBountyEscrow.UrlMismatch.selector);
        escrow.claimWithFdcProof(id, mergedProof("https://api.github.com/repos/evil/repo/pulls/7", true, "octocat"));
        vm.stopPrank();
    }

    function test_revertsOnDoubleClaim() public {
        uint256 id = createBounty(0, 1 ether);
        vm.startPrank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.expectRevert(IGitBountyEscrow.NotOpen.selector);
        escrow.claimWithFdcProof(id, mergedProof(prUrl(), true, "octocat"));
        vm.stopPrank();
    }
}
