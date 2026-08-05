export const collateralVaultAbi = [
  {
    type: "event",
    name: "Locked",
    inputs: [
      { name: "depositId", type: "bytes32", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "nftContract", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "arcLoanRef", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "function",
    name: "unlockCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "depositId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "seizeCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "depositId", type: "bytes32" },
      { name: "treasury", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "deposits",
    stateMutability: "view",
    inputs: [{ name: "depositId", type: "bytes32" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "arcLoanRef", type: "bytes32" },
      { name: "locked", type: "bool" },
    ],
  },
] as const;
