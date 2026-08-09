// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Streaming reward token minted to lenders as loans backed by their tier pool accrue.
/// @dev Mint-only, single authorized minter (the LendingPool).
contract RewardToken is ERC20, Ownable {
    address public minter;

    event MinterUpdated(address indexed minter);

    error NotMinter();

    constructor(address initialOwner) ERC20("HomTech Rent", "RENT") Ownable(initialOwner) {}

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
        emit MinterUpdated(_minter);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
