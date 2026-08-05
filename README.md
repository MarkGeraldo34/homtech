# Arc Rent Lending

NFT-collateralized "rent" lending on [Arc Testnet](https://docs.arc.network) (Circle's
stablecoin-native L1, chain ID `5042002`, USDC as native gas). Borrowers draw a fixed monthly
loan ($200/$300/$400/$500/$600) gated by real cross-chain wallet activity and an owned
Ethereum-mainnet NFT, collateralized by a matching NFT locked on Ethereum Sepolia. Lenders fund a
shared pool per tier and earn a streaming `RENT` reward token until the backing loans are repaid.

## How it fits together

```
contracts/        Foundry project
  LendingPool.sol      Arc Testnet — tier pools, borrow/repay/default, reward accrual
  RewardToken.sol       Arc Testnet — ERC-20 minted by LendingPool
  CollateralVault.sol   Ethereum Sepolia — lock/unlock/seize the collateral NFT

oracle-service/    Node/TypeScript
  eligibility/         real off-chain checks: cross-chain wallet volume (Covalent/GoldRush),
                       mainnet NFT ownership/value/hold-duration (Alchemy)
  attestation.ts       signs the EIP-712 attestation LendingPool.claimLoan verifies
  relayer.ts            watches Arc for LoanRepaid/LoanDefaulted, relays to the Sepolia vault
  server.ts             HTTP API the frontend calls (eligibility check + attestation request)

frontend/          Next.js (wagmi/viem)
  /lend                deposit USDC per tier, watch RENT accrue, claim, withdraw
  /borrow              run eligibility, lock collateral, claim loan, repay
```

Flow: borrower locks an NFT on Sepolia → oracle-service verifies eligibility from real data and
signs an attestation → borrower submits it + 15% upfront interest to `LendingPool` on Arc →
pool releases the tier amount → 30-day term, reward streaming to that tier's lenders → borrower
repays on Arc (relayer unlocks the Sepolia NFT) **or** defaults after day 30 (relayer seizes the
NFT to that tier's pool treasury on Sepolia, borrower blacklisted on Arc).

## Why Sepolia, not real Ethereum mainnet, for collateral custody

Seizing an NFT on default requires it to actually be locked in a vault contract on whichever
chain it lives on. Deploying that vault on real Ethereum mainnet would mean real gas costs and
real custody risk from a freshly-written, unaudited contract holding real users' NFTs. Since this
is an Arc **testnet** platform, the vault is deployed on Ethereum **Sepolia** instead — the
eligibility check still reads the borrower's real mainnet NFT (ownership, floor-price-derived
value, hold-duration) read-only, but the NFT that's actually locked and seizable is a Sepolia
stand-in the borrower separately owns. Point `CollateralVault` at real mainnet only after an
independent security audit.

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
# note the CollateralVault address it prints
```

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
  eligibility check, lock a Sepolia NFT you own as collateral, request the attestation, pay the
  15% upfront interest and claim the loan, then repay before the 30-day due date.

## Notes and limitations

- **"33 EVM chains"** — the volume check queries whichever chains Covalent/GoldRush supports by
  default (see `oracle-service/src/config.ts`); pass an exact list via `VOLUME_CHECK_CHAINS` if
  you have one.
- **Seized NFTs** land in a per-tier pool treasury address (lenders share a pool, so an NFT can't
  be split pro-rata). Auctioning it and crediting proceeds back to lenders is a manual step, not
  automated here.
- **Relayer persistence** — `oracle-service`'s relayer tracks its last-processed block in memory
  only; a restart could reprocess a small range. The vault's `onlyRelayer` + already-unlocked
  guard makes a duplicate call revert harmlessly rather than double-act.
- Arc Testnet may be unstable per Circle's own docs — expect occasional RPC hiccups.
