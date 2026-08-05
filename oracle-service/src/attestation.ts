import { randomBytes } from "node:crypto";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { config } from "./config.js";

const attestorAccount = privateKeyToAccount(config.attestorPrivateKey);

const attestorClient = createWalletClient({
  account: attestorAccount,
  chain: arcTestnet,
  transport: http(config.arcTestnetRpcUrl),
});

const domain = {
  name: "ArcRentLendingPool",
  version: "1",
  chainId: arcTestnet.id,
  verifyingContract: config.lendingPoolAddress,
} as const;

const types = {
  Attestation: [
    { name: "borrower", type: "address" },
    { name: "tierIndex", type: "uint8" },
    { name: "nftContract", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "sepoliaDepositId", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

export interface AttestationMessage {
  borrower: `0x${string}`;
  tierIndex: number;
  nftContract: `0x${string}`;
  tokenId: bigint;
  sepoliaDepositId: Hex;
  nonce: bigint;
  expiry: bigint;
}

export const ATTESTOR_ADDRESS = attestorAccount.address;

/** Short-lived attestation window — the borrower must submit claimLoan before this passes. */
export const ATTESTATION_TTL_SECONDS = 15n * 60n;

function randomNonce(): bigint {
  return BigInt("0x" + randomBytes(16).toString("hex"));
}

export async function signEligibilityAttestation(params: {
  borrower: `0x${string}`;
  tierIndex: number;
  nftContract: `0x${string}`;
  tokenId: bigint;
  sepoliaDepositId: Hex;
}): Promise<{ message: AttestationMessage; signature: Hex }> {
  const message: AttestationMessage = {
    borrower: params.borrower,
    tierIndex: params.tierIndex,
    nftContract: params.nftContract,
    tokenId: params.tokenId,
    sepoliaDepositId: params.sepoliaDepositId,
    nonce: randomNonce(),
    expiry: BigInt(Math.floor(Date.now() / 1000)) + ATTESTATION_TTL_SECONDS,
  };

  const signature = await attestorClient.signTypedData({
    domain,
    types,
    primaryType: "Attestation",
    message,
  });

  return { message, signature };
}
