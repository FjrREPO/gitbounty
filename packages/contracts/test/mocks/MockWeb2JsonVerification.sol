// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {IWeb2Json} from "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";

contract MockWeb2JsonVerification {
    bool public ok = true;

    function setOk(bool value) external {
        ok = value;
    }

    function verifyWeb2Json(IWeb2Json.Proof calldata) external view returns (bool) {
        return ok;
    }
}
