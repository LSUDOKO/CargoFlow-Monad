import { API_TIMEOUT_MS, API_URL } from "./constants.js";

export type ApiShipment = { id: string; externalRef?: string; status?: string; invoiceValue?: string };

export class ApiUnavailableError extends Error {}

/** Live shipments from the CargoFlow API. The chain stays the source of truth for prices and status. */
export async function fetchLiveShipments(statuses = "FINANCED,ACTIVE,PAUSED,DELIVERED"): Promise<ApiShipment[]> {
  const url = `${API_URL}/v1/shipments?status=${encodeURIComponent(statuses)}&limit=200`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS), headers: { accept: "application/json" } });
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? `timed out after ${Math.round(API_TIMEOUT_MS / 1000)}s` : String(e instanceof Error ? e.message : e);
    throw new ApiUnavailableError(`CargoFlow API ${API_URL} unreachable (${reason}).`);
  }
  if (!res.ok) throw new ApiUnavailableError(`CargoFlow API answered HTTP ${res.status}.`);
  const body = (await res.json()) as { shipments?: ApiShipment[] };
  return (body.shipments ?? []).filter((s) => typeof s.id === "string" && /^0x[0-9a-fA-F]{64}$/.test(s.id));
}
