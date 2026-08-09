# Arc Rent Lending

NFT-collateralized "rent" lending on [Arc Testnet](https://docs.arc.network) (Circle's
stablecoin-native L1, chain ID `5042002`, USDC as native gas). Borrowers draw a fixed monthly
loan ($200/$300/$400/$500/$600) gated by real cross-chain wallet activity and an owned
Ethereum-mainnet NFT — that same NFT is locked as collateral, currently on Ethereum Sepolia while
Arc itself is still testnet. Lenders fund a shared pool per tier and earn a streaming `RENT`
reward token until the backing loans are repaid.

## How it fits together

```
contracts/        Foundry project
  LendingPool.sol      Arc Testnet — tier pools, borrow/repay/default, reward accrual
  RewardToken.sol       Arc Testnet — ERC-20 minted by LendingPool
  CollateralVault.sol   Ethereum Sepolia (for now) — lock/unlock/seize the collateral NFT

oracle-service/    Node/TypeScript
  eligibility/         real off-chain checks: cross-chain wallet volume (Covalent/GoldRush),
                       mainnet NFT ownership + current value (Alchemy), and a 6-month
                       sustained floor-value check (CoinGecko) — no NFT hold-duration requirement
  attestation.ts       signs the EIP-712 attestation LendingPool.claimLoan verifies
  relayer.ts            watches Arc for LoanRepaid/LoanDefaulted, relays to the Sepolia vault
  server.ts             HTTP API the frontend calls (eligibility check + attestation request)

frontend/          Next.js (wagmi/viem)
  /lend                deposit USDC per tier, watch RENT accrue, claim, withdraw
  /borrow              run eligibility, lock collateral, claim loan, repay
```

Flow: borrower locks their NFT (the same one checked for eligibility) in `CollateralVault` →
oracle-service verifies eligibility from real data and signs an attestation → borrower submits it
+ 15% upfront interest to `LendingPool` on Arc → pool releases the tier amount → 30-day term,
reward streaming to that tier's lenders → borrower repays on Arc (relayer unlocks the NFT) **or**
defaults after day 30 (relayer seizes the NFT to that tier's pool treasury, borrower blacklisted
on Arc).

## Sepolia now, mainnet later

Both Arc and this app are testnet-stage, so `CollateralVault` is deployed on Ethereum **Sepolia**
for now (`DeploySepolia.s.sol`) — the same contract, locking the exact same NFT
contract/tokenId the borrower proved eligibility with, exactly like it will on mainnet. There's
no separate stand-in asset; this is a real end-to-end dry run of the actual design, just on a
chain with no real-asset risk while Arc itself matures.

`DeployMainnet.s.sol` deploys the identical contract to Ethereum mainnet and is ready for when
Arc goes live — but since it would then custody borrowers' real NFTs with real seizure risk,
**do not run it against real user funds before an independent security audit.**

## Prerequisites

- [Foundry](https://getfoundry.sh) (`forge`, `cast`) — installed via `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node.js 20+
- A wallet funded with:
  - Arc Testnet USDC (gas + loans) — [faucet.circle.com](https://faucet.circle.com), select Arc Testnet
  - Sepolia ETH (gas for locking/unlocking collateral) — any Sepolia faucet
- API keys (all have free tiers):
  - [Covalent/GoldRush](https://goldrush.dev) — cross-chain wallet volume
  - [Alchemy](https://www.alchemy.com) — Sepolia RPC + Ethereum-mainnet NFT data
  - [WalletConnect Cloud](https://cloud.walletconnect.com) — only needed if you later swap the
    frontend's plain injected-wallet button for a WalletConnect-based connector

## 1. Deploy the contracts

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-git
cp .env.example .env
# fill in PRIVATE_KEY, ARC_USDC_ADDRESS (see Arc's contract-addresses reference),
# TRUSTED_ATTESTOR_ADDRESS (the address for ATTESTOR_PRIVATE_KEY you'll set in oracle-service/.env)
source .env

forge test                       # 29 tests, all chains mocked — no network needed

forge script script/DeployArc.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast
# note the LendingPool and RewardToken addresses it prints

# fill in TRUSTED_RELAYER_ADDRESS (the address for RELAYER_PRIVATE_KEY you'll set in oracle-service/.env)
forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
# Once Arc is live and CollateralVault has been audited, the production deploy is:
#   forge script script/DeployMainnet.s.sol --rpc-url $ETH_MAINNET_RPC_URL --broadcast
# note the CollateralVault address it prints
```

### Deployed addresses

| Contract | Chain | Address |
| --- | --- | --- |
| `LendingPool` | Arc Testnet | [`0x46dDbEEC16De40edDb9D8800266Eac50aa16aC3D`](https://testnet.arcscan.app/address/0x46dDbEEC16De40edDb9D8800266Eac50aa16aC3D) |
| `RewardToken` (`$RENT`) | Arc Testnet | [`0xCb65b8F04e0135CF059066b8e571357146cb39AB`](https://testnet.arcscan.app/address/0xCb65b8F04e0135CF059066b8e571357146cb39AB) |
| `CollateralVault` | Ethereum Sepolia | [`0x46dDbEEC16De40edDb9D8800266Eac50aa16aC3D`](https://sepolia.etherscan.io/address/0x46dDbEEC16De40edDb9D8800266Eac50aa16aC3D) |

## 2. Run the oracle-service

```bash
cd oracle-service
cp .env.example .env
# fill in LENDING_POOL_ADDRESS / COLLATERAL_VAULT_ADDRESS from step 1,
# ATTESTOR_PRIVATE_KEY / RELAYER_PRIVATE_KEY (fresh testnet-only keys),
# COVALENT_API_KEY, ALCHEMY_API_KEY

npm install
npm run dev        # serves the eligibility/attestation API and runs the relayer loop together
```

`GET /api/health` should return the attestor and relayer addresses once it's up.

## 3. Run the frontend

```bash
cd frontend
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_LENDING_POOL_ADDRESS / NEXT_PUBLIC_COLLATERAL_VAULT_ADDRESS /
# NEXT_PUBLIC_ARC_USDC_ADDRESS from step 1

npm install
npm run dev         # http://localhost:3000
```

Connect a browser wallet (MetaMask, Rabby, etc.), fund it from the faucets above, and:

- **Lend**: pick a tier, deposit USDC, watch `RENT` accrue live, claim, withdraw idle liquidity.
- **Borrow**: pick a tier, enter the real mainnet NFT you're proving eligibility with, run the
  eligibility check, lock that same NFT as collateral, request the attestation, pay the 15%
  upfront interest and claim the loan, then repay before the 30-day due date.

## Notes and limitations

- **"33 EVM chains"** — the volume check queries whichever chains Covalent/GoldRush supports by
  default (see `oracle-service/src/config.ts`); pass an exact list via `VOLUME_CHECK_CHAINS` if
  you have one.
- **NFT collateral value** must currently be worth more than the tier amount *and* the
  collection's floor price must not have dropped to or below that amount at any point in the
  trailing 6 months (`NFT_VALUE_LOOKBACK_DAYS` in `oracle-service/src/eligibility/nft.ts`, via
  CoinGecko's NFT floor-price history). There is no minimum hold-duration on the token itself —
  a recently-acquired NFT from a collection with a stable 6-month floor price is eligible.
- **Seized NFTs** land in a per-tier pool treasury address (lenders share a pool, so an NFT can't
  be split pro-rata). Auctioning it and crediting proceeds back to lenders is a manual step, not
  automated here.
- **Relayer persistence** — `oracle-service`'s relayer tracks its last-processed block in memory
  only; a restart could reprocess a small range. The vault's `onlyRelayer` + already-unlocked
  guard makes a duplicate call revert harmlessly rather than double-act.
- Arc Testnet may be unstable per Circle's own docs — expect occasional RPC hiccups.
