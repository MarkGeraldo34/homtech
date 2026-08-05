export const collateralVaultAbi = [
  {
    type: "function",
    name: "lockCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "arcLoanRef", type: "bytes32" },
    ],
    outputs: [{ name: "depositId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "activeDepositOf",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "deposits",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "nftContract", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "arcLoanRef", type: "bytes32" },
      { name: "locked", type: "bool" },
    ],
  },
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
] as const;
