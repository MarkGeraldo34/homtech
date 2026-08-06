// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CollateralVault} from "../src/CollateralVault.sol";

/// @notice Future production deploy of CollateralVault to Ethereum mainnet, where it will
///         custody real NFTs. Not the current target — Arc itself is still testnet, so
///         DeploySepolia.s.sol is what's actually used for now (same contract, same single-NFT
///         flow, just on a chain with no real-asset risk while iterating).
/// Required env vars: PRIVATE_KEY, TRUSTED_RELAYER_ADDRESS.
///
/// This spends real ETH gas from PRIVATE_KEY's wallet and, once live, the vault holds real
/// borrower NFTs at real seizure risk on default. Do not run this against an unaudited version
/// of CollateralVault — get an independent security audit first. This script only prepares the
/// deployment; running `forge script ... --broadcast` is a deliberate, funded action the
/// deployer takes themselves.
contract DeployMainnet is Script {
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
