import React from "react";
import { P } from "../assets/palette";
import { F } from "../theme";
import {
  Browser, Chip, CodeCard, CoBrand, EndCard, Img, Lower, OffthreadVideo, Paper, Scene, Sequence, Shot, SponsorFilm, TC, Terminal,
  TitleCard, TLine, cueAt, cueEnd, fadeIn, rise, spring, staticFile, useCurrentFrame, useVideoConfig, SHADOW, interpolate, ease,
} from "./kit";
import plan from "./plan-en.json";
import words from "../../public/audio/sp-en.words.json";
import { envioConfig, envioHandler, envioSchema } from "./snippets";
import e2e from "../../proofs/sponsors/envio-e2e.json";

/**
 * Envio HyperIndex + HyperSync, end to end. The middle of the film is a real-time recording: with /notes open, the
 * deployer raised its bid on the paused note (tx 0x7cced6e9…571c); the timeline chips use the measured times from
 * proofs/sponsors/envio-e2e.json (send → mined → indexed via GraphQL → visible in the page's feed).
 */

const STEPS = 5;
const step = (n: number) => `${String(n).padStart(2, "0")} / ${STEPS}`;
const shortTx = `${e2e.tx.slice(0, 10)}…${e2e.tx.slice(-4)}`;
const T = { send: Number(e2e.sendStart), mined: Number(e2e.mined), indexed: Number(e2e.indexed), ui: Number(e2e.ui) };

const IntroScene: React.FC<{ s: Scene }> = () => (
  <TitleCard
    sponsor="Envio"
    kicker="Best Use of Envio · HyperIndex + HyperSync"
    title={<>Every order on the <span style={{ color: P.signal }}>Cargo Note</span> market, indexed live from Monad</>}
    sub="HyperIndex on Envio Cloud, reading Monad Testnet through HyperSync, powering the market activity feed on /notes."
    chips={["10143.hypersync.xyz", "3 contracts · 9 events", "Envio Cloud · public GraphQL"]}
  />
);

const ConfigScene: React.FC<{ s: Scene }> = ({ s }) => (
  <Paper>
    <CoBrand sponsor="Envio" />
    <Lower step={step(1)} title="One config, three contracts" sub="indexer/config.yaml · chain 10143 · from the deployment block · HyperSync first" />
    <CodeCard path={envioConfig.path} code={envioConfig.code} firstLine={envioConfig.first} lang="yaml" at={8} fontSize={19} rows={22} marks={[{ from: 8, to: 14, at: 40 }, { from: 15, to: 19, at: 90 }, { from: 20, to: 22, at: 130 }, { from: 24, to: 26, at: 170 }]} scrollTo={{ line: 9, at: 160, d: 50 }} />
  </Paper>
);

const SchemaScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <CoBrand sponsor="Envio" />
    <Lower step={step(2)} title="Events → entities" sub="Note · Trade · OrderEvent · Epoch · MarketStats" />
    <CodeCard path={envioSchema.path} code={envioSchema.code} firstLine={envioSchema.first} lang="graphql" at={8} x={96} y={170} width={820} fontSize={21} marks={[{ from: 34, to: 34, at: 70 }]} />
    <CodeCard path={envioHandler.path} code={envioHandler.code} firstLine={envioHandler.first} lang="ts" at={40} x={950} y={170} width={880} fontSize={18} marks={[{ from: 20, to: 20, at: 80 }, { from: 24, to: 25, at: 140 }]} />
  </Paper>
);

const CLOUD: TLine[] = [
  { cmd: "envio-cloud indexer get cargoflow-monad --org lsudoko" },
  { t: "INDEXER: cargoflow-monad" },
  { t: "ORGANIZATION: lsudoko" },
  { t: "DEPLOYMENTS (2):", c: TC.yellow },
  { t: "CREATED      STATUS     TIER          COMMIT     QUERY ENDPOINT", dim: true },
  { t: "2026-10-13   none       development   dc07398    https://indexer.dev.hyperindex.xyz/4116ace/v1/graphql" },
  { t: "2026-10-13   none       development   c49454f    https://indexer.dev.hyperindex.xyz/bc5a6d2/v1/graphql", c: TC.green },
  { cmd: "curl -s https://indexer.dev.hyperindex.xyz/bc5a6d2/v1/graphql -d '{ chain_metadata { latest_processed_block } }'" },
  { t: `{"data":{"chain_metadata":[{"latest_processed_block":${e2e.indexedBlock}}]}}`, c: TC.blue },
];

const CloudScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <CoBrand sponsor="Envio" />
    <Lower step={step(3)} title="Deployed on Envio Cloud" sub="auto-deploys from the repo's envio branch · synced to the chain head" />
    <Terminal title="envio-cloud · Monad Testnet" lines={CLOUD} at={8} cps={70} rows={10} fontSize={19} marks={[{ line: 6, at: 80 }, { line: 8, at: 170 }]} />
  </Paper>
);

const SEND_CMD = "cast send $MARKET 'placeBid(bytes32,uint256)' $NOTE 2400000 --json";
const SEND: TLine[] = [
  { cmd: SEND_CMD },
  { t: `"status": "0x1", "transactionHash": "${shortTx}"`, c: TC.green },
];

/** Recording in a browser at 0.72 scale, the measured timeline on the right, the GraphQL answer and the new row. */
const E2EScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sendAt = cueEnd(s, 0) + 4; // the bid is sent as the first line ends
  const recFrom = Math.round(T.send * 30) - sendAt; // recording frame shown at scene frame 0
  const recLen = Math.round(41.4 * 30) - recFrom; // scene frames the recording covers before its last frame holds
  const at = (sec: number) => sendAt + Math.round((sec - T.send) * 30);
  const K = 0.72;
  const t3 = cueAt(s, 2), t4 = cueAt(s, 3);
  // punch into the feed's top rows while the narration points at the page
  const zk = interpolate(f, [t4 - 4, t4 + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const Z = K * (1 + 0.55 * zk);
  const tx = (576 - 690 * Z) * zk, ty = (250 - 260 * Z) * zk;
  const stamps = [
    { at: sendAt, k: "T+0.00 s", t: "placeBid sent", d: "deployer raises its escrowed bid to 2.40 USDC", tone: "ink" as const },
    { at: at(T.mined), k: `T+${(T.mined - T.send).toFixed(2)} s`, t: "Mined on Monad", d: `block ${e2e.block.toLocaleString("en-US")} · BidPlaced log`, tone: "ink" as const },
    { at: at(T.indexed), k: `T+${(T.indexed - T.send).toFixed(2)} s`, t: "Indexed by HyperIndex", d: "HyperSync → handler → OrderEvent, in GraphQL", tone: "lime" as const },
    { at: at(T.ui), k: `T+${(T.ui - T.send).toFixed(2)} s`, t: "On /notes", d: "the Market activity feed shows the new bid", tone: "green" as const },
  ];
  const rowK = spring({ frame: f - at(T.ui) - 4, fps, config: { damping: 15 } });
  return (
    <Paper>
      <CoBrand sponsor="Envio" />
      <Lower step={step(4)} title="End to end, in real time" sub="one new on-chain bid · Monad → HyperSync → HyperIndex → GraphQL → the page" />
      <Browser url="cargoflow-monad.vercel.app/notes · Market activity" x={80} y={160} w={1152} h={648}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1600, height: 900, transform: `translate(${tx}px, ${ty}px) scale(${Z})`, transformOrigin: "0 0" }}>
          <Sequence from={0} durationInFrames={recLen} layout="none">
            <OffthreadVideo src={staticFile("live/rec-sponsors/envio-e2e.mp4")} startFrom={recFrom} muted style={{ position: "absolute", width: 1600, height: 900 }} />
          </Sequence>
          {f >= recLen ? <Img src={staticFile("live/rec-sponsors/envio-e2e-last.png")} style={{ position: "absolute", width: 1600, height: 900 }} /> : null}
          {f >= at(T.ui) + 4 ? (
            <>
              <div style={{ position: "absolute", left: 194, top: 252, width: 1212, height: 44, borderRadius: 8, border: `5px solid ${P.signal}`, background: `rgba(198,244,50,${0.16 * rowK})`, opacity: rowK }} />
              <div style={{ position: "absolute", left: 462, top: 178, width: 52, height: 22, borderRadius: 6, border: `4px solid ${P.signal}`, opacity: rowK }} />
            </>
          ) : null}
        </div>
      </Browser>
      <div style={{ position: "absolute", left: 1262, top: 312, width: 590, display: "flex", flexDirection: "column", gap: 12 }}>
        {stamps.map((st) => (
          <div key={st.t} style={{ padding: "13px 18px", borderRadius: 18, background: P.white, boxShadow: SHADOW, opacity: fadeIn(f, st.at, 8), transform: `translateX(${(1 - fadeIn(f, st.at, 10)) * 30}px)`, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <Chip text={st.k} tone={st.tone} size={20} />
            <div>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 26, color: P.ink }}>{st.t}</div>
              <div style={{ fontFamily: F.body, fontSize: 19, color: P.slate, marginTop: 2 }}>{st.d}</div>
            </div>
          </div>
        ))}
      </div>
      <Terminal title="foundry · cast (the deployer)" lines={SEND} at={sendAt - 60} cps={60} think={at(T.mined) - (sendAt - 54 + Math.ceil((SEND_CMD.length / 60) * 30))} x={1262} y={160} width={590} rows={2} fontSize={14} />
      {f >= t3 - 6 && f < t4 + 6 ? (
        <Terminal
          title="GraphQL · indexer.dev.hyperindex.xyz/bc5a6d2"
          at={t3 - 6}
          cps={90}
          x={110}
          y={520}
          width={760}
          rows={7}
          fontSize={17}
          lines={[
            { cmd: `{ OrderEvent(where:{txHash:{_eq:"${e2e.tx.slice(0, 8)}…"}}) {…} }` },
            { t: `"kind": "${e2e.gqlRow.kind}",`, c: TC.green, b: true },
            { t: `"note_id": "0xe2785515…e7dc",` },
            { t: `"account": "0xa6c05ec6…911b",` },
            { t: `"price": "${e2e.gqlRow.price}",`, c: TC.blue },
            { t: `"mark": "${e2e.gqlRow.mark}",`, c: TC.blue },
            { t: `"txHash": "${shortTx}"` },
          ]}
        />
      ) : null}
    </Paper>
  );
};

const ExplorerScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <Browser url={`testnet.monadvision.com/tx/${shortTx}`} at={0}>
      <Shot src="tx-envio-bid.png" zooms={[{ at: 12, cx: 640, cy: 540, scale: 1.25 }]} rings={[{ x: 392, y: 378, w: 156, h: 28, at: 28, label: "PlaceBid · Success", tone: "green" }]} />
    </Browser>
    <Lower step={step(5)} title="The same transaction on MonadVision" sub={`CargoNoteMarket.placeBid · block ${e2e.block.toLocaleString("en-US")} · 0.03296 USDC more escrowed`} />
  </Paper>
);

const OutroScene: React.FC<{ s: Scene }> = () => (
  <EndCard
    sponsor="Envio"
    line={<>Every note&apos;s history, <span style={{ color: P.signal }}>live from Monad</span></>}
    links={["cargoflow-monad.vercel.app/notes", "indexer.dev.hyperindex.xyz/bc5a6d2/v1/graphql", "github.com/LSUDOKO/CargoFlow-Monad · indexer/"]}
  />
);

export const EN_FRAMES = plan.totalFrames;
export const EnvioFilm: React.FC<{ captions?: boolean }> = ({ captions = true }) => (
  <SponsorFilm plan={plan} words={words} vo="audio/sp-en-vo.wav" captions={captions} scenes={{ intro: IntroScene, config: ConfigScene, schema: SchemaScene, cloud: CloudScene, e2e: E2EScene, explorer: ExplorerScene, outro: OutroScene }} />
);

export { rise };
