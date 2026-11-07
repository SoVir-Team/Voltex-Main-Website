"""Render Volta's voice lines for the Student Lab with KittenTTS (female preset), offline.

Setup (once, outside the repo):
    py -3.13 -m venv D:/workspace/tts-voltex
    D:/workspace/tts-voltex/Scripts/pip install soundfile numpy \
        https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl
Run from the repository root:
    D:/workspace/tts-voltex/Scripts/python scripts/voice/generate_lab_voice.py [--only id1,id2]

Writes frontend/public/lab/voice/<id>.mp3 (or .ogg if this libsndfile has no MP3 encoder) and manifest.json.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
LINES = ROOT / "frontend/src/components/lab/mascot/lines.json"
OUT = ROOT / "frontend/public/lab/voice"
MODEL = "hexgrad/Kokoro-82M"
VOICE = "af_heart,af_bella"
RATE = 24000


def tidy(wav: np.ndarray, max_pause: float = 0.32) -> np.ndarray:
    """Trim the ends, shorten long pauses between chunks, and normalise the peak to -1 dBFS."""
    wav = np.asarray(wav, dtype=np.float32).flatten()
    frame = int(0.02 * RATE)
    keep = []
    quiet = 0
    for i in range(0, len(wav), frame):
        chunk = wav[i : i + frame]
        silent = float(np.sqrt(np.mean(chunk**2))) < 0.012
        quiet = quiet + 1 if silent else 0
        if not silent or quiet * 0.02 <= max_pause:
            keep.append(chunk)
    wav = np.concatenate(keep) if keep else wav
    loud = np.flatnonzero(np.abs(wav) > 0.01)
    if loud.size:
        pad = int(0.06 * RATE)
        wav = wav[max(0, loud[0] - pad) : loud[-1] + pad]
    peak = float(np.max(np.abs(wav))) or 1.0
    return wav * (0.89 / peak)


def write(path_stem: Path, wav: np.ndarray) -> str:
    try:
        sf.write(path_stem.with_suffix(".mp3"), wav, RATE, format="MP3", bitrate_mode="CONSTANT", compression_level=0.0)
        return ".mp3"
    except Exception:
        sf.write(path_stem.with_suffix(".ogg"), wav, RATE, format="OGG", subtype="VORBIS")
        return ".ogg"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="", help="comma-separated line ids")
    parser.add_argument("--speed", type=float, default=1.0)
    args = parser.parse_args()

    from kokoro import KPipeline

    lines = json.loads(LINES.read_text(encoding="utf-8"))
    only = {s for s in args.only.split(",") if s}
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    pipe = KPipeline(lang_code="a", repo_id=MODEL)
    for line in lines:
        if only and line["id"] not in only:
            continue
        parts = [audio.numpy() if hasattr(audio, "numpy") else audio for _, _, audio in pipe(line["text"], voice=VOICE, speed=args.speed)]
        wav = tidy(np.concatenate(parts))
        ext = write(OUT / line["id"], wav)
        manifest[line["id"]] = {"file": f"{line['id']}{ext}", "duration": round(len(wav) / RATE, 2)}
        print(f"{line['id']}{ext}  {manifest[line['id']]['duration']}s")

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(manifest)} clips to {OUT}")


if __name__ == "__main__":
    main()
