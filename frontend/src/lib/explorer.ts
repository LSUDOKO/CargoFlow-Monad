export const MONAD_TESTNET_ID = 10143;
export const LOCAL_CHAIN_ID = 31337;
export const MONAD_EXPLORER = "https://testnet.monadvision.com";

const explorers: Record<number, string> = { [MONAD_TESTNET_ID]: MONAD_EXPLORER };

/** Explorer URL for a transaction, or null on chains without an explorer (local anvil). */
export function explorerTx(chainId: number | undefined, hash: string): string | null {
  const base = chainId ? explorers[chainId] : undefined;
  return base ? `${base}/tx/${hash}` : null;
}

/** Explorer URL for an address or contract. */
export function explorerAddress(chainId: number | undefined, address: string): string | null {
  const base = chainId ? explorers[chainId] : undefined;
  return base ? `${base}/address/${address}` : null;
}

export function chainName(chainId: number | undefined): string {
  if (chainId === MONAD_TESTNET_ID) return "Monad Testnet";
  if (chainId === LOCAL_CHAIN_ID) return "Local chain";
  return chainId ? `Chain ${chainId}` : "Unknown chain";
}
