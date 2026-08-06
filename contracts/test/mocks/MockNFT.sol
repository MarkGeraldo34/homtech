// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Minimal ERC721 standing in for a borrower's collateral NFT in tests.
contract MockNFT is ERC721 {
    uint256 public nextTokenId = 1;

    constructor() ERC721("Mock Collateral NFT", "MCNFT") {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }
}
