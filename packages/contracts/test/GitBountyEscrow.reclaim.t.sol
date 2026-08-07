// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {IGitBountyEscrow} from "../src/interfaces/IGitBountyEscrow.sol";
import {EscrowTestBase} from "./utils/EscrowTestBase.sol";

contract GitBountyEscrowReclaimTest is EscrowTestBase {
    function test_returnsFundsAfterExpiry() public {
        uint256 id = createBounty(0, 3 ether);
        uint256 before = funder.balance;
        vm.warp(block.timestamp + 8 days);
        vm.prank(funder);
        escrow.reclaim(id);
        assertEq(funder.balance, before + 3 ether);
        assertEq(uint8(escrow.getBounty(id).status), uint8(IGitBountyEscrow.Status.Reclaimed));
    }

    function test_revertsBeforeExpiry() public {
        uint256 id = createBounty(0, 3 ether);
        vm.prank(funder);
        vm.expectRevert(IGitBountyEscrow.NotExpired.selector);
        escrow.reclaim(id);
    }

    function test_revertsForNonFunder() public {
        uint256 id = createBounty(0, 3 ether);
        vm.warp(block.timestamp + 8 days);
        vm.prank(dev);
        vm.expectRevert(IGitBountyEscrow.NotFunder.selector);
        escrow.reclaim(id);
    }

    function test_revertsAfterPayout() public {
        uint256 id = createBounty(0, 3 ether);
        vm.prank(dev);
        escrow.claimWithTeeProof(id, dev, teeSignature(id, dev));

        vm.warp(block.timestamp + 8 days);
        vm.prank(funder);
        vm.expectRevert(IGitBountyEscrow.NotOpen.selector);
        escrow.reclaim(id);
    }
}
