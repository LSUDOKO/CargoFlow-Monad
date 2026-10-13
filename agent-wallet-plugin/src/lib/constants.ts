import type { Address } from "viem";

/** Monad Testnet: the chain every CargoFlow contract lives on. */
export const CHAIN_ID = 10143;

export const MARKET: Address = "0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d";
export const CONTROLLER: Address = "0x172f8B86a9368ef729fa76c773ECA03d166DEB4d";
export const VAULT: Address = "0x5298dCdBDf6EC799475B09c2Ecd0f089bD4D6902";
export const USDC: Address = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
export const USDC_DECIMALS = 6;

export const RPC_URL = process.env.CARGOFLOW_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const API_URL = (process.env.CARGOFLOW_API_URL ?? "https://cargoflow-monad-api.onrender.com").replace(/\/+$/, "");
export const APP_URL = "https://cargoflow-monad.vercel.app";
export const EXPLORER_TX = "https://testnet.monadvision.com/tx/";

/** The API runs on a free tier that sleeps; a cold start takes up to about a minute. */
export const API_TIMEOUT_MS = Number(process.env.CARGOFLOW_API_TIMEOUT_MS ?? 90_000);
