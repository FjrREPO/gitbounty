// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {RSA} from "@openzeppelin/contracts/utils/cryptography/RSA.sol";

/// @title EnclaveAttestation
/// @notice Verifies the RS256 attestation tokens Google Confidential Space
///         issues, so a contract can trust a TEE without trusting whoever
///         deployed it. Only the claims the escrow checks are extracted —
///         this is not a general JSON parser.
library EnclaveAttestation {
    error MalformedToken();
    error BadSignature();
    error DuplicateClaim();

    /// @notice Verifies `token` against an RSA public key and returns its payload.
    /// @param token The compact JWT: base64url(header).base64url(payload).base64url(sig)
    /// @param modulus RSA modulus of the signing key (Google's JWKS `n`).
    /// @param exponent RSA exponent (`e`, normally 0x010001).
    function verify(bytes memory token, bytes memory modulus, bytes memory exponent)
        internal
        view
        returns (bytes memory payload)
    {
        (uint256 firstDot, uint256 secondDot) = _dots(token);

        // RS256 signs the raw "header.payload" bytes.
        bytes memory signed = _slice(token, 0, secondDot);
        bytes memory signature = Base64.decode(_urlToStandard(_slice(token, secondDot + 1, token.length)));
        if (!RSA.pkcs1Sha256(sha256(signed), signature, exponent, modulus)) {
            revert BadSignature();
        }

        payload = Base64.decode(_urlToStandard(_slice(token, firstDot + 1, secondDot)));
    }

    /// @notice Returns the string value of a `"key":"value"` claim, or an empty
    ///         string when the claim is absent.
    function claim(bytes memory payload, bytes memory key) internal pure returns (bytes memory) {
        return claim(payload, key, 0);
    }

    /// @notice Same, but rejects the token when the claim appears twice.
    /// @dev A workload picks its own `aud` and `eat_nonce`, so it can write a
    ///      second copy of a claim inside one of those values. Position cannot
    ///      decide which copy is genuine — the escaping that separates them
    ///      belongs to Google's encoder, not to this parser — so for the two
    ///      claims that decide *who* gets the signer slot and *which* escrow
    ///      the token is good for, a duplicate rejects the whole token.
    ///      Costs a full scan of the payload, so it is not the default.
    function claimUnique(bytes memory payload, bytes memory key) internal pure returns (bytes memory) {
        bytes memory needle = abi.encodePacked('"', key, '":"');
        int256 at = _indexOf(payload, needle, 0);
        if (at < 0) {
            return "";
        }
        if (_indexOf(payload, needle, uint256(at) + 1) >= 0) {
            revert DuplicateClaim();
        }
        return _value(payload, uint256(at) + needle.length);
    }

    /// @notice Same, but reading the first match at or after `from`.
    /// @dev For a claim nested under an object only the issuer writes, where a
    ///      duplicate elsewhere in the document is not this read's concern.
    function claim(bytes memory payload, bytes memory key, uint256 from) internal pure returns (bytes memory) {
        bytes memory needle = abi.encodePacked('"', key, '":"');
        int256 at = _indexOf(payload, needle, from);
        if (at < 0) {
            return "";
        }
        return _value(payload, uint256(at) + needle.length);
    }

    /// @notice Offset of `marker` in `payload`; reverts when it is absent.
    function offsetOf(bytes memory payload, bytes memory marker) internal pure returns (uint256) {
        int256 at = _indexOf(payload, marker, 0);
        if (at < 0) {
            revert MalformedToken();
        }
        return uint256(at);
    }

    /// @notice Returns the numeric value of a top-level `"key":123` claim.
    function claimNumber(bytes memory payload, bytes memory key) internal pure returns (uint256) {
        bytes memory needle = abi.encodePacked('"', key, '":');
        int256 at = _indexOf(payload, needle, 0);
        if (at < 0) {
            return 0;
        }
        uint256 i = uint256(at) + needle.length;
        uint256 value;
        while (i < payload.length && payload[i] >= "0" && payload[i] <= "9") {
            value = value * 10 + (uint8(payload[i]) - 48);
            i++;
        }
        return value;
    }

    /// @notice Parses a `0x`-prefixed 20-byte hex string into an address.
    function toAddress(bytes memory hexString) internal pure returns (address) {
        if (hexString.length != 42 || hexString[0] != "0" || (hexString[1] != "x" && hexString[1] != "X")) {
            revert MalformedToken();
        }
        uint160 result;
        for (uint256 i = 2; i < 42; i++) {
            result = result * 16 + uint160(_hexDigit(uint8(hexString[i])));
        }
        return address(result);
    }

    // -- internals ---------------------------------------------------------

    function _dots(bytes memory token) private pure returns (uint256 first, uint256 second) {
        bool foundFirst;
        for (uint256 i = 0; i < token.length; i++) {
            if (token[i] != ".") {
                continue;
            }
            if (!foundFirst) {
                first = i;
                foundFirst = true;
            } else {
                return (first, i);
            }
        }
        revert MalformedToken();
    }

    /// @dev JWTs use the base64url alphabet; Base64.decode expects standard.
    function _urlToStandard(bytes memory input) private pure returns (string memory) {
        for (uint256 i = 0; i < input.length; i++) {
            if (input[i] == "-") {
                input[i] = "+";
            } else if (input[i] == "_") {
                input[i] = "/";
            }
        }
        return string(input);
    }

    /// @dev Reads a JSON string value starting at `start`, up to its quote.
    function _value(bytes memory payload, uint256 start) private pure returns (bytes memory) {
        uint256 end = start;
        while (end < payload.length && payload[end] != '"') {
            end++;
        }
        return _slice(payload, start, end);
    }

    function _slice(bytes memory data, uint256 start, uint256 end) private pure returns (bytes memory out) {
        out = new bytes(end - start);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = data[start + i];
        }
    }

    function _indexOf(bytes memory haystack, bytes memory needle, uint256 from) private pure returns (int256) {
        if (needle.length == 0 || haystack.length < needle.length) {
            return -1;
        }
        for (uint256 i = from; i <= haystack.length - needle.length; i++) {
            bool hit = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    hit = false;
                    break;
                }
            }
            if (hit) {
                return int256(i);
            }
        }
        return -1;
    }

    function _hexDigit(uint8 char) private pure returns (uint8) {
        if (char >= 48 && char <= 57) return char - 48;
        if (char >= 97 && char <= 102) return char - 87;
        if (char >= 65 && char <= 70) return char - 55;
        revert MalformedToken();
    }
}
