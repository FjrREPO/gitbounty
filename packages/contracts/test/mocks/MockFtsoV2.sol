// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

contract MockFtsoV2 {
    uint256 public price;

    function setPrice(uint256 priceWei) external {
        price = priceWei;
    }

    function getFeedByIdInWei(bytes21) external payable returns (uint256, uint64) {
        return (price, uint64(block.timestamp));
    }
}
