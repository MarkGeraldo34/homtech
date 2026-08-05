import { createConfig, http } from "wagmi";
import { arcTestnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// viem/wagmi's built-in `arcTestnet` chain definition currently points its default RPC at
// rpc.testnet.arc.network, while Arc's own docs (and the working endpoint we've verified)
// use rpc.testnet.arc.io. Force the transport to the documented URL explicitly rather than
// trusting the chain's default so this keeps working regardless of which one is stale.
const arcTestnetRpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.io";
const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || sepolia.rpcUrls.default.http[0];

export const wagmiConfig = createConfig({
  chains: [arcTestnet, sepolia],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(arcTestnetRpcUrl),
    [sepolia.id]: http(sepoliaRpcUrl),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
