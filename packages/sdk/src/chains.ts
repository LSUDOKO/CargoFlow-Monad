import { defineChain } from "viem";

export const MONAD_TESTNET_ID = 10143;
export const MONAD_EXPLORER = "https://testnet.monadvision.com";

/** Monad Testnet, where CargoFlow is deployed. */
export const monadTestnet = defineChain({
  id: MONAD_TESTNET_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadVision", url: MONAD_EXPLORER } },
  testnet: true,
});

/** The live CargoFlow API and web app. */
export const DEFAULT_API_URL = "https://cargoflow-monad-api.onrender.com";
export const DEFAULT_APP_URL = "https://cargoflow-monad.vercel.app";

/** Explorer links, or null on chains without a known explorer (a local anvil). */
export function explorerTx(chainId: number, hash: string): string | null {
  return chainId === MONAD_TESTNET_ID ? `${MONAD_EXPLORER}/tx/${hash}` : null;
}
export function explorerAddress(chainId: number, address: string): string | null {
  return chainId === MONAD_TESTNET_ID ? `${MONAD_EXPLORER}/address/${address}` : null;
}
