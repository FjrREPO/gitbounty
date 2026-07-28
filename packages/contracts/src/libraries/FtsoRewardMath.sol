// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {FtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/FtsoV2Interface.sol";

/// @title FtsoRewardMath
/// @notice Converts USD-denominated rewards into FLR at the live FTSOv2 price.
library FtsoRewardMath {
    /// @notice FTSOv2 feed id for FLR/USD (category 0x01 + ASCII "FLR/USD").
    bytes21 internal constant FLR_USD_FEED = 0x01464c522f55534400000000000000000000000000;

    /// @notice Returns the FLR (wei) owed for a reward of `usdCents`,
    ///         using the current FLR/USD feed value.
    function usdCentsToFlrWei(FtsoV2Interface ftsoV2, uint256 usdCents) internal returns (uint256) {
        (uint256 priceWei,) = ftsoV2.getFeedByIdInWei(FLR_USD_FEED);
        // priceWei is USD per FLR with 18 decimals; cents scale by 1e16.
        return (usdCents * 1e16 * 1e18) / priceWei;
    }
}
