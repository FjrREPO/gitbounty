// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

/// @title EthSignedMessage
/// @notice EIP-191 ("Ethereum Signed Message") digest construction and ECDSA
///         recovery for 65-byte `r||s||v` signatures.
library EthSignedMessage {
    /// @notice Recovers the signer of `innerHash` wrapped in the EIP-191
    ///         prefix, or address(0) for malformed signatures.
    function recover(bytes32 innerHash, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash));
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        return ecrecover(digest, v, r, s);
    }
}
