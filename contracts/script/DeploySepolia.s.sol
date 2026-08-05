// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CollateralVault} from "../src/CollateralVault.sol";

/// @notice Deploys CollateralVault to Ethereum Sepolia.
/// Required env vars: PRIVATE_KEY, TRUSTED_RELAYER_ADDRESS.
contract DeploySepolia is Script {
    function run() external returns (CollateralVault vault) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address relayer = vm.envAddress("TRUSTED_RELAYER_ADDRESS");

        vm.startBroadcast(deployerKey);
        vault = new CollateralVault(deployer, relayer);
        vm.stopBroadcast();

        console.log("CollateralVault deployed at:", address(vault));
    }
}
