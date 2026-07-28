// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {IGitBountyEscrow} from "../src/interfaces/IGitBountyEscrow.sol";
import {EscrowTestBase} from "./utils/EscrowTestBase.sol";

contract GitBountyEscrowCreateTest is EscrowTestBase {
    function test_createBounty_storesAndLocksFunds() public {
        uint256 id = createBounty(5000, 10 ether);
        assertEq(id, 1);
        assertEq(address(escrow).balance, 10 ether);

        IGitBountyEscrow.Bounty memory bounty = escrow.getBounty(id);
        assertEq(bounty.funder, funder);
        assertEq(bounty.issueNumber, ISSUE);
        assertEq(bounty.rewardUsdCents, 5000);
        assertEq(bounty.amount, 10 ether);
        assertEq(bounty.repo, REPO);
        assertEq(uint8(bounty.status), uint8(IGitBountyEscrow.Status.Open));
        assertEq(escrow.nextBountyId(), 2);
    }

    function test_createBounty_revertsWithoutValue() public {
        vm.prank(funder);
        vm.expectRevert(IGitBountyEscrow.ZeroReward.selector);
        escrow.createBounty(REPO, ISSUE, 0, uint64(block.timestamp + 1 days));
    }

    function test_createBounty_revertsOnPastExpiry() public {
        vm.prank(funder);
        vm.expectRevert(IGitBountyEscrow.PastExpiry.selector);
        escrow.createBounty{value: 1 ether}(REPO, ISSUE, 0, uint64(block.timestamp));
    }

    function test_registerClaim_storesClaim() public {
        uint256 id = createBounty(0, 1 ether);
        vm.prank(dev);
        escrow.registerClaim(id, PR, AUTHOR_HASH);

        IGitBountyEscrow.Claim memory claim = escrow.getClaim(id, dev);
        assertEq(claim.prNumber, PR);
        assertEq(claim.githubLoginHash, AUTHOR_HASH);
    }

    function test_registerClaim_revertsForUnknownBounty() public {
        vm.prank(dev);
        vm.expectRevert(IGitBountyEscrow.NotOpen.selector);
        escrow.registerClaim(99, PR, AUTHOR_HASH);
    }
}
