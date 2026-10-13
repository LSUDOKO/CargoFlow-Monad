// Captures fresh footage of the live Monad build for the Metropolis film (screenshots + one real-time recording).
import { chromium } from "/home/arpit/Desktop/hackathon_projects/CargoFlow-Monad/frontend/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
const OUT = new URL("./public/live/", import.meta.url).pathname;
const SITE = "https://cargoflow-monad.vercel.app";
const settle = (p, ms) => p.waitForTimeout(ms);
const shots = [
  ["landing", "/", 6000, null],
  ["fleet", "/shipments", 9000, null],
  ["track", "/track/0x0353f55d82eb48314a58c34eab518cfe88999aaf6885e9cc41c9d10a042ac58e", 12000, null],
  ["notes", "/notes", 12000, null],
  ["deployments", "/deployments", 7000, null],
  ["tx-recovery", "https://testnet.monadvision.com/tx/0x0c2afd1ccafcd8ff7ea120c5ed9b9114e4dcdf963dc76f613a755312388b3e62", 9000, null],
  ["tx-agentbuy", "https://testnet.monadvision.com/tx/0x55a0bf9840c9d028848cd0136e8a8cf0218c96aee1732b4cd0554f01e2ae357c", 9000, null],
  ["tx-kuru", "https://testnet.monadvision.com/tx/0xade132a7524680c7e3b9270923ccbb61be845c026173d5e1f0cd13753bf4c01b", 9000, null],
  ["contract-market", "https://testnet.monadvision.com/address/0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d", 9000, null],
];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2 });
const page = await ctx.newPage();
await fetch("https://cargoflow-monad-api.onrender.com/v1/health").catch(() => {});
for (const [name, path, wait] of shots) {
  const url = path.startsWith("http") ? path : SITE + path;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await settle(page, wait);
    await page.screenshot({ path: `${OUT}${name}.png` });
    await page.screenshot({ path: `${OUT}${name}-full.png`, fullPage: true });
    console.log("shot", name);
  } catch (e) { console.log("FAIL", name, e.message); }
}
// track page tabs: Evidence and Audit trail
for (const tab of ["Evidence", "Money", "Audit trail"]) {
  try {
    await page.goto(SITE + "/track/0x0353f55d82eb48314a58c34eab518cfe88999aaf6885e9cc41c9d10a042ac58e", { waitUntil: "domcontentloaded" });
    await settle(page, 9000);
    await page.getByRole("tab", { name: tab }).first().click({ timeout: 8000 }).catch(() => page.getByText(tab, { exact: true }).first().click());
    await settle(page, 5000);
    await page.screenshot({ path: `${OUT}track-${tab.split(" ")[0].toLowerCase()}.png` });
    console.log("tab", tab);
  } catch (e) { console.log("FAIL tab", tab, e.message); }
}
await ctx.close();
// real-time recording of /notes (block counter ticking, scroll through book, Kuru and Envio sections)
const rctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: OUT + "rec", size: { width: 1600, height: 900 } } });
const rp = await rctx.newPage();
await rp.goto(SITE + "/notes", { waitUntil: "domcontentloaded" });
await settle(rp, 14000);
for (let y = 0; y <= 1500; y += 30) { await rp.mouse.wheel(0, 30); await settle(rp, 60); }
await settle(rp, 4000);
for (let y = 0; y <= 900; y += 30) { await rp.mouse.wheel(0, 30); await settle(rp, 60); }
await settle(rp, 4000);
await rctx.close();
await browser.close();
console.log("done");
