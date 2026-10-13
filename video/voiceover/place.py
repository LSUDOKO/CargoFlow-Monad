#!/usr/bin/env python3
"""Lay the Monad film's VO cues out scene by scene; write the VO wav, absolute word timings and the scene plan.

  .venv/bin/python place.py
Outputs: ../public/audio/monad-vo.wav, ../public/audio/monad.words.json, ../src/monad/plan.json
Clip scenes (pre-rendered explainer scenes) get a playback speed so the clip spans its narration.
"""
import json, os
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw-monad")
FPS = 30
cues = json.load(open(os.path.join(HERE, "..", "captions-monad.json")))
# scene id, kind, clip id, clip seconds
PLAN = [("A", "clip", "S00", 10.5), ("B", "clip", "S02", 27.0), ("C", "clip", "S04", 12.0),
        ("D1", "clip", "S05a", 15.0), ("D2", "clip", "S05b", 19.0), ("D3", "clip", "S05d", 19.0),
        ("D4", "clip", "S05e", 17.0), ("D5", "clip", "S05f", 19.0),
        ("E", "notes", None, 0), ("F", "demo", None, 0), ("G", "proofs", None, 0), ("H", "outro", None, 0)]
LEAD, GAP, TAIL = 0.30, 0.28, 0.45
TAILS = {"E": 0.8, "F": 0.9, "G": 0.9, "H": 3.0}
SR = 24000
t = 0.0
audio = []
words = []
scenes = []
for sid, kind, clip, clen in PLAN:
    sc = [c for c in cues if c["scene"] == sid]
    start = t
    cur = start + LEAD
    out_cues = []
    for c in sc:
        meta = json.load(open(os.path.join(RAW, f"{c['id']}.words.json")))
        dur = meta["durationMs"] / 1000
        out_cues.append({"id": c["id"], "text": c["text"], "start": round(cur * FPS), "end": round((cur + dur) * FPS)})
        for w in meta["words"]:
            words.append({"word": w["text"], "startMs": int((cur + w["start"]) * 1000), "endMs": int((cur + w["end"]) * 1000), "cue": c["id"]})
        audio.append((cur, os.path.join(RAW, f"{c['id']}.wav")))
        cur += dur + GAP
    cur += -GAP + TAILS.get(sid, TAIL)
    if kind == "clip":  # never play an explainer clip faster than 1.8x: let the scene breathe instead
        cur = max(cur, start + clen / 1.8)
    dur = cur - start
    speed = 1.0
    if kind == "clip":
        speed = clen / dur
        if speed < 1.0:  # narration longer than the clip: hold the last frame rather than slow below 0.9
            speed = max(speed, 0.9)
    scenes.append({"id": sid, "kind": kind, "clip": clip, "from": round(start * FPS), "frames": round(dur * FPS), "speed": round(speed, 4), "cues": out_cues})
    t = cur
total = round(t * FPS)
buf = np.zeros(int(t * SR) + SR, dtype=np.float32)
for at, path in audio:
    a, sr = sf.read(path, dtype="float32")
    assert sr == SR, sr
    i = int(at * SR)
    buf[i:i + len(a)] += a
sf.write(os.path.join(HERE, "..", "public", "audio", "monad-vo.wav"), buf[: int(t * SR)], SR, subtype="PCM_16")
json.dump(words, open(os.path.join(HERE, "..", "public", "audio", "monad.words.json"), "w"), indent=0)
json.dump({"fps": FPS, "totalFrames": total, "scenes": scenes}, open(os.path.join(HERE, "..", "src", "monad", "plan.json"), "w"), indent=1)
print(f"total {t:.1f}s = {total} frames")
for s in scenes:
    print(f"  {s['id']:3} {s['kind']:6} {s['from']/FPS:6.1f}s  {s['frames']/FPS:5.1f}s  speed {s['speed']}")
