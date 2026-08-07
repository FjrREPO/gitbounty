// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {Test} from "forge-std/Test.sol";
import {EnclaveAttestation} from "../src/libraries/EnclaveAttestation.sol";

contract EnclaveAttestationTest is Test {
    /// Shaped like a real Confidential Space payload: the workload picks
    /// `eat_nonce`, Google fills in everything under `submods`.
    bytes internal constant PAYLOAD =
        '{"aud":"0xescrow","eat_nonce":"0xaDF1","exp":1786129484,"submods":{"container":{"image_digest":"sha256:real"}}}';

    /// The same, with a forged image_digest smuggled into the field the
    /// workload controls — this is what an attacker running their own
    /// Confidential Space image would try.
    bytes internal constant SPOOFED =
        '{"aud":"0xescrow","eat_nonce":"0xbad","image_digest":"sha256:real","exp":1786129484,"submods":{"container":{"image_digest":"sha256:attacker"}}}';

    function test_readsAClaim() public pure {
        assertEq(string(EnclaveAttestation.claim(PAYLOAD, "eat_nonce")), "0xaDF1");
        assertEq(string(EnclaveAttestation.claim(PAYLOAD, "image_digest")), "sha256:real");
        assertEq(string(EnclaveAttestation.claim(PAYLOAD, "absent")), "");
    }

    function test_readsANumericClaim() public pure {
        assertEq(EnclaveAttestation.claimNumber(PAYLOAD, "exp"), 1786129484);
        assertEq(EnclaveAttestation.claimNumber(PAYLOAD, "absent"), 0);
    }

    // Regression: reading a trusted claim from offset 0 lets a workload forge
    // it in a field it controls, because those fields come first. Scoping the
    // read to `submods` is what makes the image check meaningful.
    function test_scopedReadIgnoresAForgedClaim() public pure {
        assertEq(string(EnclaveAttestation.claim(SPOOFED, "image_digest")), "sha256:real");

        uint256 submods = EnclaveAttestation.offsetOf(SPOOFED, '"submods"');
        assertEq(string(EnclaveAttestation.claim(SPOOFED, "image_digest", submods)), "sha256:attacker");
    }

    function test_offsetOfRevertsWhenTheMarkerIsAbsent() public {
        vm.expectRevert(EnclaveAttestation.MalformedToken.selector);
        this.offsetOf(PAYLOAD, '"nope"');
    }

    function offsetOf(bytes calldata payload, bytes calldata marker) external pure returns (uint256) {
        return EnclaveAttestation.offsetOf(payload, marker);
    }

    function test_parsesAddresses() public {
        assertEq(
            EnclaveAttestation.toAddress("0xaDF1f9d1E0f6Ce433Fd2C13eD99230565257FB67"),
            0xaDF1f9d1E0f6Ce433Fd2C13eD99230565257FB67
        );
        vm.expectRevert(EnclaveAttestation.MalformedToken.selector);
        this.toAddress("0xtooshort");
        vm.expectRevert(EnclaveAttestation.MalformedToken.selector);
        this.toAddress("0xZZF1f9d1E0f6Ce433Fd2C13eD99230565257FB67");
    }

    function toAddress(bytes calldata hexString) external pure returns (address) {
        return EnclaveAttestation.toAddress(hexString);
    }
}
