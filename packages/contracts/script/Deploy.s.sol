// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {Script} from "forge-std/Script.sol";
import {GitBountyEscrow} from "../src/GitBountyEscrow.sol";

/// @notice Deploys GitBountyEscrow on Coston2, resolving FtsoV2 and
///         FdcVerification through the FlareContractRegistry.
/// @dev    Usage:
///         TEE_SIGNER=0x... forge script script/Deploy.s.sol \
///           --rpc-url coston2 --broadcast --private-key $DEPLOYER_KEY
contract Deploy is Script {
    function run() external returns (GitBountyEscrow escrow) {
        address teeSigner = vm.envAddress("TEE_SIGNER");

        vm.startBroadcast();
        escrow = new GitBountyEscrow(
            ContractRegistry.getFtsoV2(),
            IWeb2JsonVerification(address(ContractRegistry.getFdcVerification())),
            teeSigner
        );
        vm.stopBroadcast();
    }
}
