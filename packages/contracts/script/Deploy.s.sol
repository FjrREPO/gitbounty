// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IWeb2JsonVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2JsonVerification.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Script} from "forge-std/Script.sol";
import {GitBountyEscrow} from "../src/GitBountyEscrow.sol";

/// @notice Deploys the GitBountyEscrow implementation behind a UUPS proxy on
///         Coston2, resolving FtsoV2 and FdcVerification through the
///         FlareContractRegistry. The broadcaster becomes the proxy owner.
/// @dev    Usage:
///         TEE_SIGNER=0x... forge script script/Deploy.s.sol \
///           --rpc-url coston2 --broadcast --private-key $DEPLOYER_KEY
contract Deploy is Script {
    function run() external returns (GitBountyEscrow escrow, address implementation) {
        address teeSigner = vm.envAddress("TEE_SIGNER");
        (, address broadcaster,) = vm.readCallers();

        vm.startBroadcast();
        GitBountyEscrow impl = new GitBountyEscrow();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(
                GitBountyEscrow.initialize,
                (
                    ContractRegistry.getFtsoV2(),
                    IWeb2JsonVerification(address(ContractRegistry.getFdcVerification())),
                    teeSigner,
                    broadcaster
                )
            )
        );
        vm.stopBroadcast();

        escrow = GitBountyEscrow(address(proxy));
        implementation = address(impl);
    }
}
