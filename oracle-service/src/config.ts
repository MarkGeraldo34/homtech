import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(optional("PORT", "8787")),

  arcTestnetRpcUrl: optional("ARC_TESTNET_RPC_URL", "https://rpc.testnet.arc.io"),
  sepoliaRpcUrl: required("SEPOLIA_RPC_URL"),
  ethMainnetRpcUrl: required("ETH_MAINNET_RPC_URL"),

  lendingPoolAddress: required("LENDING_POOL_ADDRESS") as `0x${string}`,
  collateralVaultAddress: required("COLLATERAL_VAULT_ADDRESS") as `0x${string}`,

  attestorPrivateKey: required("ATTESTOR_PRIVATE_KEY") as `0x${string}`,
  relayerPrivateKey: required("RELAYER_PRIVATE_KEY") as `0x${string}`,

  covalentApiKey: optional("COVALENT_API_KEY", ""),
  volumeCheckChains: optional(
    "VOLUME_CHECK_CHAINS",
    // Representative default set of GoldRush-supported EVM chains. Swap in the exact
    // 33-chain list via VOLUME_CHECK_CHAINS (comma-separated Covalent chain names) if you
    // have a specific one — see https://goldrush.dev for the full supported-chain list.
    [
      "eth-mainnet",
      "matic-mainnet",
      "arbitrum-mainnet",
      "optimism-mainnet",
      "base-mainnet",
      "bsc-mainnet",
      "avalanche-mainnet",
      "linea-mainnet",
      "scroll-mainnet",
      "zksync-mainnet",
    ].join(",")
  ).split(",").filter(Boolean),

  alchemyApiKey: optional("ALCHEMY_API_KEY", ""),
};
