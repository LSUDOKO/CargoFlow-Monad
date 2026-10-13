// Fragments copied from contracts/out/*.json (only what the plugin calls).

export const marketAbi = [
  { type: "function", name: "asks", stateMutability: "view", inputs: [{ name: "shipmentId", type: "bytes32" }], outputs: [{ name: "seller", type: "address" }, { name: "price", type: "uint256" }] },
  { type: "function", name: "bestBid", stateMutability: "view", inputs: [{ name: "shipmentId", type: "bytes32" }], outputs: [{ name: "bidder", type: "address" }, { name: "price", type: "uint256" }] },
  { type: "function", name: "bids", stateMutability: "view", inputs: [{ name: "shipmentId", type: "bytes32" }, { name: "bidder", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "claimValue", stateMutability: "view", inputs: [{ name: "shipmentId", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "evidenceScore", stateMutability: "view", inputs: [{ name: "shipmentId", type: "bytes32" }], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "markPrice", stateMutability: "view", inputs: [{ name: "shipmentId", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "shipmentId", type: "bytes32" }, { name: "maxPrice", type: "uint256" }], outputs: [] },
  { type: "function", name: "placeBid", stateMutability: "nonpayable", inputs: [{ name: "shipmentId", type: "bytes32" }, { name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "cancelBid", stateMutability: "nonpayable", inputs: [{ name: "shipmentId", type: "bytes32" }], outputs: [] },
] as const;

export const controllerAbi = [
  {
    type: "function",
    name: "getFacility",
    stateMutability: "view",
    inputs: [{ name: "shipmentId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "exporter", type: "address" },
          { name: "financier", type: "address" },
          { name: "buyer", type: "address" },
          { name: "committed", type: "uint256" },
          { name: "feeBps", type: "uint16" },
          { name: "milestoneCount", type: "uint8" },
          { name: "nextMilestone", type: "uint8" },
          { name: "pauseReason", type: "bytes32" },
          { name: "pausedAt", type: "uint64" },
          { name: "pauseCount", type: "uint32" },
        ],
      },
    ],
  },
] as const;

export const vaultAbi = [
  {
    type: "function",
    name: "getFacility",
    stateMutability: "view",
    inputs: [{ name: "shipmentId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "financier", type: "address" },
          { name: "supplier", type: "address" },
          { name: "payer", type: "address" },
          { name: "committed", type: "uint256" },
          { name: "drawn", type: "uint256" },
          { name: "invoiceValue", type: "uint256" },
          { name: "feeBps", type: "uint16" },
          { name: "funded", type: "bool" },
          { name: "paused", type: "bool" },
          { name: "closed", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;
