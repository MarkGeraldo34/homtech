// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {LendingPool} from "../src/LendingPool.sol";

/// @notice Deploys LendingPool (and its RewardToken) to Arc Testnet.
/// Required env vars: PRIVATE_KEY, ARC_USDC_ADDRESS, TRUSTED_ATTESTOR_ADDRESS.
/// Optional: ESCROW_WALLET_ADDRESS (defaults to the deployer), TIER_TREASURY_0..4
/// (defaults to the deployer for all 5 tiers — these are just references handed to the
/// relayer/off-chain service and can be updated later via setTierTreasury).
contract DeployArc is Script {
    function run() external returns (LendingPool pool) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address attestor = vm.envAddress("TRUSTED_ATTESTOR_ADDRESS");
        address escrow = vm.envOr("ESCROW_WALLET_ADDRESS", deployer);

        address[5] memory treasuries;
        treasuries[0] = vm.envOr("TIER_TREASURY_0", deployer);
        treasuries[1] = vm.envOr("TIER_TREASURY_1", deployer);
        treasuries[2] = vm.envOr("TIER_TREASURY_2", deployer);
        treasuries[3] = vm.envOr("TIER_TREASURY_3", deployer);
        treasuries[4] = vm.envOr("TIER_TREASURY_4", deployer);

        vm.startBroadcast(deployerKey);
        pool = new LendingPool(deployer, usdc, attestor, escrow, treasuries);
        pool.rewardToken().setMinter(address(pool));
        vm.stopBroadcast();

        console.log("LendingPool deployed at:", address(pool));
        console.log("RewardToken deployed at:", address(pool.rewardToken()));
    }
}
