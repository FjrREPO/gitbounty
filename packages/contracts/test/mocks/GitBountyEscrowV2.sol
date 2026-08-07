// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {GitBountyEscrow} from "../../src/GitBountyEscrow.sol";

/// @dev Upgrade-target fixture: same storage, one new function.
contract GitBountyEscrowV2 is GitBountyEscrow {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
