// SPDX-License-Identifier: MIT
pragma solidity ^0.8.36;

/// @title GitHubApi
/// @notice Builds the canonical GitHub API URLs that FDC attestations must
///         match, so a proof can only satisfy the bounty it was made for.
library GitHubApi {
    /// @notice Returns `https://api.github.com/repos/{repo}/pulls/{prNumber}`.
    function pullRequestUrl(string memory repo, uint256 prNumber) internal pure returns (string memory) {
        return string.concat("https://api.github.com/repos/", repo, "/pulls/", toString(prNumber));
    }

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
