// Bundle once, then render sample frames of a composition to out/chk/<id>-<frame>.png and a contact sheet.
//   node scripts-stills.mjs <CompositionId> <frame> [frame...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id });
for (const fr of frames.map(Number)) {
  await renderStill({ composition, serveUrl, frame: fr, output: `out/chk/${id}-${fr}.png`, scale: 0.5 });
  console.log("still", fr);
}
