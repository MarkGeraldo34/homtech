// Minimal ABI subset the oracle-service needs: the events the relayer watches,
// plus a couple of read functions used for status reporting.
export const lendingPoolAbi = [
  {
    type: "event",
    name: "LoanClaimed",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "tierIndex", type: "uint8", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "upfrontInterest", type: "uint256", indexed: false },
      { name: "dueTs", type: "uint256", indexed: false },
      { name: "sepoliaDepositId", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanRepaid",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "LoanDefaulted",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: false },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "sepoliaDepositId", type: "bytes32", indexed: false },
      { name: "treasury", type: "address", indexed: false },
    ],
  },
  {
    type: "function",
    name: "loans",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "tierIndex", type: "uint8" },
      { name: "principal", type: "uint256" },
      { name: "startTs", type: "uint256" },
      { name: "dueTs", type: "uint256" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "sepoliaDepositId", type: "bytes32" },
      { name: "active", type: "bool" },
      { name: "repaid", type: "bool" },
      { name: "defaulted", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "blacklisted",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;
