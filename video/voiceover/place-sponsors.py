#!/usr/bin/env python3
"""Lay out the sponsor videos' VO cues scene by scene.

  .venv/bin/python place-sponsors.py
For each video (mm, en, al, pr) writes ../public/audio/sp-<v>-vo.wav, ../public/audio/sp-<v>.words.json and
../src/sponsors/plan-<v>.json ({fps, totalFrames, scenes:[{id, from, frames, cues:[{id,text,start,end}]}]}).
Scenes get at least their minimum length (seconds) so footage and terminals can breathe; the promo uses fixed slots.
"""
import json, os
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw-sponsors")
FPS, SR = 30, 24000
cues = json.load(open(os.path.join(HERE, "..", "sponsors-cues.json")))
# (scene, min seconds, tail seconds)
VIDEOS = {
    "mm": [("intro", 9, 0.8), ("install", 7, 1.2), ("list", 10, 1.2), ("quote", 0, 1.4), ("refuse", 0, 1.2), ("scan", 0, 1.2),
           ("buy", 13, 1.2), ("chain", 8, 0.9), ("holder", 0, 1.0), ("safety", 0, 1.0), ("skill", 0, 1.0), ("outro", 7, 2.5)],
    "en": [("intro", 7, 0.8), ("config", 0, 1.4), ("schema", 0, 1.4), ("cloud", 0, 1.4), ("e2e", 24, 1.2), ("explorer", 5, 0.8), ("outro", 6, 2.5)],
    "al": [("intro", 7, 0.8), ("health", 0, 1.4), ("failover", 0, 1.4), ("window", 0, 1.4), ("runs", 0, 1.4), ("product", 0, 1.2), ("outro", 6, 2.5)],
}
PROMO = [("hook", 0.0, 7.0, 0.7), ("evidence", 7.0, 7.0, 1.2), ("trades", 14.0, 10.0, 0.9), ("end", 24.0, 6.0, 1.0)]  # id, at, len, cue lead
LEAD, GAP = 0.35, 0.3


def meta(cid):
    return json.load(open(os.path.join(RAW, f"{cid}.words.json")))


def write(v, scenes, words, audio, total_s):
    buf = np.zeros(int(total_s * SR) + SR, dtype=np.float32)
    for at, path in audio:
        a, sr = sf.read(path, dtype="float32")
        assert sr == SR
        i = int(at * SR)
        buf[i:i + len(a)] += a
    buf = buf[: int(total_s * SR)]
    peak = float(np.max(np.abs(buf))) or 1.0
    buf *= min(1.0, 0.70 / peak)  # VO peaks at about -3 dBFS; music sits under it
    sf.write(os.path.join(HERE, "..", "public", "audio", f"sp-{v}-vo.wav"), buf, SR, subtype="PCM_16")
    json.dump(words, open(os.path.join(HERE, "..", "public", "audio", f"sp-{v}.words.json"), "w"), indent=0)
    os.makedirs(os.path.join(HERE, "..", "src", "sponsors"), exist_ok=True)
    total = round(total_s * FPS)
    json.dump({"fps": FPS, "totalFrames": total, "scenes": scenes}, open(os.path.join(HERE, "..", "src", "sponsors", f"plan-{v}.json"), "w"), indent=1)
    print(f"{v}: {total_s:.1f}s = {total} frames")
    for s in scenes:
        print(f"   {s['id']:9} {s['from']/FPS:6.1f}s  {s['frames']/FPS:5.1f}s  cues {[c['id'] for c in s['cues']]}")


for v, plan in VIDEOS.items():
    t, audio, words, scenes = 0.0, [], [], []
    for sid, min_s, tail in plan:
        start, cur, out = t, t + LEAD, []
        for c in [c for c in cues if c["video"] == v and c["scene"] == sid]:
            m = meta(c["id"])
            d = m["durationMs"] / 1000
            out.append({"id": c["id"], "text": c["text"], "start": round(cur * FPS), "end": round((cur + d) * FPS)})
            words += [{"word": w["text"], "startMs": int((cur + w["start"]) * 1000), "endMs": int((cur + w["end"]) * 1000), "cue": c["id"]} for w in m["words"]]
            audio.append((cur, os.path.join(RAW, f"{c['id']}.wav")))
            cur += d + GAP
        cur = max(cur - GAP + tail, start + min_s)
        scenes.append({"id": sid, "from": round(start * FPS), "frames": round(cur * FPS) - round(start * FPS), "cues": out})
        t = cur
    write(v, scenes, words, audio, t)

audio, words, scenes = [], [], []
for sid, at, ln, lead in PROMO:
    out = []
    for c in [c for c in cues if c["video"] == "pr" and c["scene"] == sid]:
        m = meta(c["id"])
        cur = at + lead
        d = m["durationMs"] / 1000
        out.append({"id": c["id"], "text": c["text"], "start": round(cur * FPS), "end": round((cur + d) * FPS)})
        words += [{"word": w["text"], "startMs": int((cur + w["start"]) * 1000), "endMs": int((cur + w["end"]) * 1000), "cue": c["id"]} for w in m["words"]]
        audio.append((cur, os.path.join(RAW, f"{c['id']}.wav")))
    scenes.append({"id": sid, "from": round(at * FPS), "frames": round(ln * FPS), "cues": out})
write("pr", scenes, words, audio, 30.0)
