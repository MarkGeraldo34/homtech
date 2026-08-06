import express from "express";
import { isAddress, type Hex } from "viem";
import { ATTESTOR_ADDRESS, signEligibilityAttestation } from "./attestation.js";
import { config } from "./config.js";
import { checkTierEligibility } from "./eligibility/index.js";
import { startRelayer, RELAYER_ADDRESS } from "./relayer.js";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, attestor: ATTESTOR_ADDRESS, relayer: RELAYER_ADDRESS });
});

app.post("/api/eligibility", async (req, res) => {
  try {
    const { borrower, tierIndex, nftContract, tokenId } = req.body ?? {};
    validateEligibilityInput(borrower, tierIndex, nftContract, tokenId);

    const result = await checkTierEligibility(borrower, tierIndex, nftContract, String(tokenId));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * Re-runs eligibility, and if it passes, signs the EIP-712 attestation the borrower submits to
 * LendingPool.claimLoan. Requires the borrower to have already locked that same NFT as
 * collateral in CollateralVault (Ethereum Sepolia for now) and pass the resulting depositId in
 * `sepoliaDepositId`.
 */
app.post("/api/attestation", async (req, res) => {
  try {
    const { borrower, tierIndex, nftContract, tokenId, sepoliaDepositId } = req.body ?? {};
    validateEligibilityInput(borrower, tierIndex, nftContract, tokenId);
    if (typeof sepoliaDepositId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(sepoliaDepositId)) {
      throw new Error("sepoliaDepositId must be a 32-byte hex string (the depositId from CollateralVault.lockCollateral)");
    }

    const eligibility = await checkTierEligibility(borrower, tierIndex, nftContract, String(tokenId));
    if (!eligibility.eligible) {
      res.status(403).json({ eligible: false, reasons: eligibility.reasons });
      return;
    }

    const { message, signature } = await signEligibilityAttestation({
      borrower,
      tierIndex,
      nftContract,
      tokenId: BigInt(tokenId),
      sepoliaDepositId: sepoliaDepositId as Hex,
    });

    res.json({
      eligible: true,
      attestation: {
        borrower: message.borrower,
        tierIndex: message.tierIndex,
        nftContract: message.nftContract,
        tokenId: message.tokenId.toString(),
        sepoliaDepositId: message.sepoliaDepositId,
        nonce: message.nonce.toString(),
        expiry: message.expiry.toString(),
      },
      signature,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

function validateEligibilityInput(borrower: unknown, tierIndex: unknown, nftContract: unknown, tokenId: unknown) {
  if (typeof borrower !== "string" || !isAddress(borrower)) throw new Error("borrower must be a valid address");
  if (typeof tierIndex !== "number" || tierIndex < 0 || tierIndex > 4) throw new Error("tierIndex must be 0..4");
  if (typeof nftContract !== "string" || !isAddress(nftContract)) throw new Error("nftContract must be a valid address");
  if (tokenId === undefined || tokenId === null || tokenId === "") throw new Error("tokenId is required");
}

app.listen(config.port, () => {
  console.log(`[server] oracle-service listening on :${config.port}`);
  console.log(`[server] attestor address: ${ATTESTOR_ADDRESS}`);
});

startRelayer().catch((err) => {
  console.error("[relayer] fatal error:", err);
});
