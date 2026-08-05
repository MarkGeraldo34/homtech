// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RewardToken} from "../src/RewardToken.sol";

contract RewardTokenTest is Test {
    RewardToken internal token;
    address internal owner = address(this);
    address internal minter = address(0x1111);
    address internal user = address(0x2222);

    function setUp() public {
        token = new RewardToken(owner);
    }

    function test_metadata() public view {
        assertEq(token.name(), "RentPoints");
        assertEq(token.symbol(), "RENT");
        assertEq(token.decimals(), 18);
    }

    function test_onlyOwnerCanSetMinter() public {
        vm.prank(user);
        vm.expectRevert();
        token.setMinter(minter);

        token.setMinter(minter);
        assertEq(token.minter(), minter);
    }

    function test_onlyMinterCanMint() public {
        token.setMinter(minter);

        vm.prank(user);
        vm.expectRevert(RewardToken.NotMinter.selector);
        token.mint(user, 100e18);

        vm.prank(minter);
        token.mint(user, 100e18);
        assertEq(token.balanceOf(user), 100e18);
    }
}
