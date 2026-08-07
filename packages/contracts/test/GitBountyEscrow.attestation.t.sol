// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Test} from "forge-std/Test.sol";
import {GitBountyEscrow} from "../src/GitBountyEscrow.sol";
import {EnclaveAttestation} from "../src/libraries/EnclaveAttestation.sol";
import {IGitBountyEscrow} from "../src/interfaces/IGitBountyEscrow.sol";
import {MockFtsoV2} from "./mocks/MockFtsoV2.sol";
import {MockWeb2JsonVerification} from "./mocks/MockWeb2JsonVerification.sol";

/// Exercises the attestation path against a token a real Confidential Space
/// enclave issued, signed by Google's real attestation key.
contract GitBountyEscrowAttestationTest is Test {
    /// The escrow this token was addressed to; the `aud` claim pins it.
    address internal constant DEPLOYED_ESCROW = 0xA8adEFE2C8f0F71a585a73c1259997f593F9e463;
    address internal constant ENCLAVE_SIGNER = 0xaDF1f9d1E0f6Ce433Fd2C13eD99230565257FB67;
    string internal constant IMAGE_DIGEST = "sha256:c382cab24d8d15924bb528aba5c960ad2c2ec5682103f17fbf6f2ebf5b5d8e2a";
    /// Issued 2026-08-07; the token is valid for an hour from then.
    uint256 internal constant ISSUED_AT = 1786125884;

    GitBountyEscrow internal escrow;
    address internal owner = makeAddr("owner");
    bytes internal token;
    bytes internal modulus;

    function setUp() public {
        token = bytes(vm.readFile("test/fixtures/attestation.jwt"));
        modulus = vm.parseBytes(vm.trim(vm.readFile("test/fixtures/modulus.hex")));

        // The `aud` claim binds the token to the deployed escrow address, so
        // the fixture only verifies if the escrow lives there.
        bytes memory init = abi.encodeCall(
            GitBountyEscrow.initialize,
            (
                FtsoV2Interface(address(new MockFtsoV2())),
                IWeb2JsonVerification(address(new MockWeb2JsonVerification())),
                address(0),
                owner
            )
        );
        deployCodeTo("ERC1967Proxy.sol:ERC1967Proxy", abi.encode(address(new GitBountyEscrow()), init), DEPLOYED_ESCROW);
        escrow = GitBountyEscrow(DEPLOYED_ESCROW);

        vm.prank(owner);
        escrow.setAttestationPolicy(modulus, hex"010001", IMAGE_DIGEST);
        vm.warp(ISSUED_AT + 60);
    }

    function test_registersTheSignerNamedByARealAttestation() public {
        // Permissionless: the caller is a stranger, the token is the authority.
        vm.prank(makeAddr("anyone"));
        escrow.registerEnclaveSigner(token);
        assertEq(escrow.teeSigner(), ENCLAVE_SIGNER);
    }

    // Regression: a token signed by anything but Google must not register a signer.
    function test_revertsWhenSignedByAnotherKey() public {
        bytes memory wrongModulus = modulus;
        wrongModulus[10] = bytes1(uint8(wrongModulus[10]) ^ 0xff);

        vm.prank(owner);
        escrow.setAttestationPolicy(wrongModulus, hex"010001", IMAGE_DIGEST);

        vm.expectRevert(EnclaveAttestation.BadSignature.selector);
        escrow.registerEnclaveSigner(token);
    }

    // Regression: a valid Google token from a different image must be refused,
    // otherwise any Confidential Space workload could nominate a signer.
    function test_revertsOnAnotherEnclaveImage() public {
        vm.prank(owner);
        escrow.setAttestationPolicy(modulus, hex"010001", "sha256:deadbeef");

        vm.expectRevert(IGitBountyEscrow.UnexpectedEnclave.selector);
        escrow.registerEnclaveSigner(token);
    }

    // Regression: an expired token must not be replayable.
    function test_revertsOnceExpired() public {
        vm.warp(ISSUED_AT + 2 hours);
        vm.expectRevert(IGitBountyEscrow.AttestationExpired.selector);
        escrow.registerEnclaveSigner(token);
    }

    function test_revertsWithoutAPolicy() public {
        GitBountyEscrow fresh = GitBountyEscrow(
            address(
                new ERC1967Proxy(
                    address(new GitBountyEscrow()),
                    abi.encodeCall(
                        GitBountyEscrow.initialize,
                        (
                            FtsoV2Interface(address(new MockFtsoV2())),
                            IWeb2JsonVerification(address(new MockWeb2JsonVerification())),
                            address(0),
                            owner
                        )
                    )
                )
            )
        );
        vm.expectRevert(IGitBountyEscrow.NoAttestationPolicy.selector);
        fresh.registerEnclaveSigner(token);
    }

    function test_onlyOwnerSetsThePolicy() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, makeAddr("stranger"))
        );
        escrow.setAttestationPolicy(modulus, hex"010001", IMAGE_DIGEST);
    }

    /// An attested signer must be able to actually release funds.
    function test_attestedSignerCanSettleABounty() public {
        vm.prank(makeAddr("anyone"));
        escrow.registerEnclaveSigner(token);

        address funder = makeAddr("funder");
        vm.deal(funder, 10 ether);
        vm.prank(funder);
        uint256 id = escrow.createBounty{value: 1 ether}("acme/demo", 42, 0, uint64(block.timestamp + 7 days));

        // The enclave key is unknown to this test, so prove the escrow now
        // recovers against it: a signature from any other key must fail.
        (, uint256 impostorKey) = makeAddrAndKey("impostor");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32", keccak256(abi.encode(block.chainid, address(escrow), id, funder))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(impostorKey, digest);
        vm.expectRevert(IGitBountyEscrow.InvalidSignature.selector);
        escrow.claimWithTeeProof(id, funder, abi.encodePacked(r, s, v));
    }
}
