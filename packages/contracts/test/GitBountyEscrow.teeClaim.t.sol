// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {IGitBountyEscrow} from "../src/interfaces/IGitBountyEscrow.sol";
import {EscrowTestBase} from "./utils/EscrowTestBase.sol";

contract GitBountyEscrowTeeClaimTest is EscrowTestBase {
    function test_paysAuthorizedRecipient() public {
        uint256 id = createBounty(0, 5 ether);
        vm.prank(dev);
        escrow.claimWithTeeProof(id, dev, teeSignature(id, dev));
        assertEq(dev.balance, 5 ether);
    }

    // Regression: a signature from any key but the enclave's must fail.
    function test_revertsOnWrongSigner() public {
        uint256 id = createBounty(0, 5 ether);
        (, uint256 impostorKey) = makeAddrAndKey("impostor");
        bytes memory sig = signClaim(impostorKey, id, dev);
        vm.prank(dev);
        vm.expectRevert(IGitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, dev, sig);
    }

    // Regression: a signature for one recipient must not pay another.
    function test_revertsWhenRecipientSwapped() public {
        uint256 id = createBounty(0, 5 ether);
        bytes memory sig = teeSignature(id, dev);
        address thief = makeAddr("thief");
        vm.prank(thief);
        vm.expectRevert(IGitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, thief, sig);
    }

    function test_revertsOnMalformedSignature() public {
        uint256 id = createBounty(0, 5 ether);
        vm.prank(dev);
        vm.expectRevert(IGitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, dev, hex"deadbeef");
    }

    function test_rotatedSignerAuthorizesClaims() public {
        uint256 id = createBounty(0, 5 ether);
        (, uint256 newKey) = makeAddrAndKey("new-tee");
        address newSigner = vm.addr(newKey);

        vm.prank(owner);
        escrow.setTeeSigner(newSigner);
        assertEq(escrow.teeSigner(), newSigner);

        // Old key no longer authorizes; new key does.
        vm.prank(dev);
        vm.expectRevert(IGitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, dev, teeSignature(id, dev));

        vm.prank(dev);
        escrow.claimWithTeeProof(id, dev, signClaim(newKey, id, dev));
        assertEq(dev.balance, 5 ether);
    }
}
