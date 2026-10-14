// Footage for the sponsor videos. Part 1 records the Envio end-to-end moment for real: while /notes is on screen,
// the deployer raises its bid on the paused note through CargoNoteMarket.placeBid; we time the tx, the indexer
// (HyperSync → HyperIndex → GraphQL) and the page's "Market activity" row. Part 2 takes the stills the videos need.
//   node scripts-capture-sponsors.mjs [e2e] [stills]
import { chromium } from "/home/arpit/Desktop/hackathon_projects/CargoFlow-Monad/frontend/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("./public/live/", import.meta.url).pathname;
const PROOFS = new URL("./proofs/sponsors/", import.meta.url).pathname;
const SITE = "https://cargoflow-monad.vercel.app";
const GQL = "https://indexer.dev.hyperindex.xyz/bc5a6d2/v1/graphql";
const RPC = "https://testnet-rpc.monad.xyz";
const MARKET = "0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d";
const NOTE = "0xe27855155eae78aeb39aca53e5f50a861f503e0e7cd87730add2bf093f27e7dc";
const CAST = `${process.env.HOME}/.config/.foundry/bin/cast`;
const args = process.argv.slice(2);
const want = (k) => args.length === 0 || args.includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT + "rec-sponsors", { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);
const key = `0x${env.private_key.replace(/^0x/, "")}`;

async function gql(query) {
  const r = await fetch(GQL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
  return r.json();
}

const browser = await chromium.launch();
await fetch("https://cargoflow-monad-api.onrender.com/v1/health").catch(() => {});

if (want("e2e")) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: OUT + "rec-sponsors", size: { width: 1600, height: 900 } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const mark = (k) => ((Date.now() - t0) / 1000).toFixed(2);
  const timings = {};
  await page.goto(SITE + "/notes", { waitUntil: "domcontentloaded" });
  await page.getByText("Position moved").first().waitFor({ timeout: 90000 });
  await sleep(2500);
  // bring "Market activity" under the sticky header
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("Market activity"));
    window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
  });
  await sleep(4000);
  timings.feedVisible = mark();
  // the new on-chain action: raise the deployer's escrowed bid on the paused note from 2.36704 to 2.40 USDC
  timings.sendStart = mark();
  const out = execFileSync(CAST, ["send", MARKET, "placeBid(bytes32,uint256)", NOTE, "2400000", "--private-key", key, "--rpc-url", RPC, "--gas-price", "102gwei", "--json"], { encoding: "utf8" });
  const rcpt = JSON.parse(out);
  timings.mined = mark();
  timings.tx = rcpt.transactionHash;
  timings.block = parseInt(rcpt.blockNumber, 16);
  console.log("tx", rcpt.status, rcpt.transactionHash, "block", timings.block, "at", timings.mined);
  // indexer: poll GraphQL until the BidPlaced row with this tx is there
  let gqlRow = null;
  for (let i = 0; i < 120 && !gqlRow; i++) {
    const r = await gql(`{ OrderEvent(where:{txHash:{_eq:"${rcpt.transactionHash}"}}) { id kind note_id account price mark timestamp txHash } chain_metadata { latest_processed_block } }`);
    gqlRow = r.data?.OrderEvent?.[0] ?? null;
    if (!gqlRow) await sleep(250);
    else timings.indexed = mark(), timings.indexedBlock = r.data.chain_metadata[0].latest_processed_block, (timings.gqlRow = gqlRow);
  }
  console.log("indexed at", timings.indexed, gqlRow);
  // UI: wait for the row to appear in the feed (react-query refreshes every 4 s)
  const short = `${rcpt.transactionHash.slice(0, 6)}…${rcpt.transactionHash.slice(-4)}`;
  try {
    await page.getByText(short, { exact: false }).first().waitFor({ timeout: 30000 });
    timings.ui = mark();
  } catch {
    timings.ui = "not seen";
  }
  console.log("ui at", timings.ui, short);
  await sleep(6000);
  timings.end = mark();
  await ctx.close();
  const vid = await page.video().path();
  timings.video = vid;
  writeFileSync(PROOFS + "envio-e2e.json", JSON.stringify(timings, null, 2));
  // the GraphQL answer, verbatim, for the terminal card
  const ans = await gql(`{ OrderEvent(order_by:{blockNumber:desc}, limit:1) { kind note_id account price mark txHash } MarketStats { trades volume asks bids } chain_metadata { latest_processed_block } }`);
  writeFileSync(PROOFS + "envio-gql-after.json", JSON.stringify(ans, null, 2));
  console.log("e2e done", timings);
}

if (want("stills")) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
  const page = await ctx.newPage();
  const shots = [
    ["tx-mm-approve", "https://testnet.monadvision.com/tx/0x10c178413612c177dffba0e71e12ca3cb8941c53b61b515de30504c80060519c", 9000],
    ["tx-mm-buy", "https://testnet.monadvision.com/tx/0x55a0bf9840c9d028848cd0136e8a8cf0218c96aee1732b4cd0554f01e2ae357c", 9000],
  ];
  const e2e = (() => {
    try {
      return JSON.parse(readFileSync(PROOFS + "envio-e2e.json", "utf8"));
    } catch {
      return null;
    }
  })();
  if (e2e?.tx) shots.push(["tx-envio-bid", `https://testnet.monadvision.com/tx/${e2e.tx}`, 9000]);
  for (const [name, url, wait] of shots) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(wait);
      await page.screenshot({ path: `${OUT}${name}.png` });
      console.log("shot", name);
    } catch (e) {
      console.log("FAIL", name, e.message);
    }
  }
  // /notes: order book + trading panel on the note the agent bought, then the activity feed
  await page.goto(SITE + "/notes", { waitUntil: "domcontentloaded" });
  await page.getByText("Position moved").first().waitFor({ timeout: 90000 }).catch(() => {});
  await sleep(4000);
  await page.getByText("CF-LIVE-1791912900798").first().click().catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: `${OUT}notes-agent-holder.png` });
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("Market activity"));
    window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90);
  });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}notes-activity.png` });
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.includes("Cargo Notes on Kuru"));
    window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 90);
  });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}notes-kuru.png` });
  // shipment dashboard tabs, served by the API that runs on Alchemy
  await page.goto(SITE + "/track/0x0353f55d82eb48314a58c34eab518cfe88999aaf6885e9cc41c9d10a042ac58e", { waitUntil: "domcontentloaded" });
  await page.getByText("Settled").first().waitFor({ timeout: 90000 }).catch(() => {});
  await sleep(5000);
  await page.screenshot({ path: `${OUT}track-overview.png` });
  await page.getByText("Audit trail", { exact: true }).first().click().catch(() => {});
  await sleep(4000);
  await page.screenshot({ path: `${OUT}track-audit2.png` });
  await page.goto(SITE + "/", { waitUntil: "domcontentloaded" });
  await sleep(6000);
  await page.screenshot({ path: `${OUT}landing2.png` });
  await ctx.close();
}
await browser.close();
console.log("done");
