// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {GitBountyEscrowV2} from "./mocks/GitBountyEscrowV2.sol";
import {EscrowTestBase} from "./utils/EscrowTestBase.sol";

contract GitBountyEscrowUpgradeTest is EscrowTestBase {
    function test_ownerCanUpgrade_andStateSurvives() public {
        uint256 id = createBounty(0, 2 ether);

        address implV2 = address(new GitBountyEscrowV2());
        vm.prank(owner);
        escrow.upgradeToAndCall(implV2, "");

        assertEq(GitBountyEscrowV2(address(escrow)).version(), "v2");
        // Pre-upgrade state is intact and the escrow still functions.
        assertEq(escrow.getBounty(id).amount, 2 ether);
        vm.prank(dev);
        escrow.claimWithTeeProof(id, dev, teeSignature(id, dev));
        assertEq(dev.balance, 2 ether);
    }

    function test_nonOwnerCannotUpgrade() public {
        address impl = address(new GitBountyEscrowV2());
        vm.prank(dev);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, dev));
        escrow.upgradeToAndCall(impl, "");
    }

    function test_initializeCannotRunTwice() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        escrow.initialize(FtsoV2Interface(address(ftso)), IWeb2JsonVerification(address(verifier)), teeSigner, owner);
    }

    function test_nonOwnerCannotRotateTeeSigner() public {
        vm.prank(dev);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, dev));
        escrow.setTeeSigner(dev);
    }
}
