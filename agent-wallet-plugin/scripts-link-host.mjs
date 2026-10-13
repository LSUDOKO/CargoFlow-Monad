// Points node_modules/@metamask/agent-wallet at the globally installed `mm` CLI, so a plugin installed from this
// directory (`mm plugins install file:$PWD`, which symlinks it) loads the host's own copy of the SDK. With a second
// copy, a signed-in `mm` fails with "window.addEventListener is not a function" (two auth stacks, one browser shim).
import { execSync } from "node:child_process";
import { existsSync, lstatSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { join } from "node:path";

let root;
try {
  root = execSync("npm root -g", { encoding: "utf8" }).trim();
} catch {
  process.exit(0);
}
const host = join(root, "@metamask", "agent-wallet");
const local = join("node_modules", "@metamask", "agent-wallet");
if (!existsSync(host)) {
  console.log("link-host: no global @metamask/agent-wallet; keeping the local copy (fine for build and tests)");
  process.exit(0);
}
if (existsSync(local) && lstatSync(local).isSymbolicLink() && realpathSync(local) === realpathSync(host)) process.exit(0);
rmSync(local, { recursive: true, force: true });
symlinkSync(realpathSync(host), local);
console.log(`link-host: node_modules/@metamask/agent-wallet -> ${realpathSync(host)}`);
