// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {CollateralVault} from "../src/CollateralVault.sol";
import {MockNFT} from "./mocks/MockNFT.sol";

contract CollateralVaultTest is Test {
    CollateralVault internal vault;
    MockNFT internal nft;

    address internal owner = address(this);
    address internal relayer = address(0xAAAA);
    address internal borrower = address(0xB0B);
    address internal treasury = address(0xFEED);

    function setUp() public {
        vault = new CollateralVault(owner, relayer);
        nft = new MockNFT();
    }

    function _lock() internal returns (uint256 tokenId, bytes32 depositId) {
        tokenId = nft.mint(borrower);
        vm.prank(borrower);
        nft.approve(address(vault), tokenId);
        vm.prank(borrower);
        depositId = vault.lockCollateral(address(nft), tokenId, keccak256("loan-1"));
    }

    function test_lockCollateral_transfersNftIntoVault() public {
        (uint256 tokenId,) = _lock();
        assertEq(nft.ownerOf(tokenId), address(vault));
    }

    function test_lockCollateral_revertsIfAlreadyLocked() public {
        (uint256 tokenId,) = _lock();

        vm.prank(borrower);
        vm.expectRevert(CollateralVault.AlreadyLocked.selector);
        vault.lockCollateral(address(nft), tokenId, keccak256("loan-2"));
    }

    function test_unlockCollateral_returnsNftToBorrower() public {
        (uint256 tokenId, bytes32 depositId) = _lock();

        vm.prank(relayer);
        vault.unlockCollateral(depositId);

        assertEq(nft.ownerOf(tokenId), borrower);
    }

    function test_unlockCollateral_revertsForNonRelayer() public {
        (, bytes32 depositId) = _lock();

        vm.prank(borrower);
        vm.expectRevert(CollateralVault.NotRelayer.selector);
        vault.unlockCollateral(depositId);
    }

    function test_seizeCollateral_sendsNftToTreasury() public {
        (uint256 tokenId, bytes32 depositId) = _lock();

        vm.prank(relayer);
        vault.seizeCollateral(depositId, treasury);

        assertEq(nft.ownerOf(tokenId), treasury);
    }

    function test_seizeCollateral_revertsIfAlreadyUnlocked() public {
        (, bytes32 depositId) = _lock();

        vm.prank(relayer);
        vault.unlockCollateral(depositId);

        vm.prank(relayer);
        vm.expectRevert(CollateralVault.NotLocked.selector);
        vault.seizeCollateral(depositId, treasury);
    }

    function test_setTrustedRelayer_onlyOwner() public {
        vm.prank(borrower);
        vm.expectRevert();
        vault.setTrustedRelayer(borrower);

        vault.setTrustedRelayer(borrower);
        assertEq(vault.trustedRelayer(), borrower);
    }
}
