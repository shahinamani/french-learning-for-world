#!/usr/bin/env python3
"""Pre-generate pronunciation audio with Piper, from our own content.

Why this exists rather than a cloud call from the browser:

  - No third party sees a learner's IP. Nothing is fetched from anywhere but
    our own origin, so there is no request to a TTS vendor carrying an address
    and a sentence a learner is studying.
  - It works offline, because the files are ordinary assets the service worker
    can cache.
  - It costs nothing per learner.

And why Piper specifically: the engine is MIT, and the French voices carry
dataset licences that permit redistributing the generated audio in a CC BY-SA
project — CC BY 4.0 for siwis and mls, CC BY-SA 4.0 for upmc, CC0 for gilles.
`fr_FR-tom` is excluded: its dataset is AGPLv3, which is not a fight worth
having over a voice we do not need. See docs/02-content-licences.md.

**Filenames are content hashes.** `audio/fr-FR/siwis/3f2a9c1e4b7d8a06.opus` is
the audio of one exact string in one exact voice. Identical text is never
generated twice; changed text produces a new name and the old file simply stops
being referenced. That means a rebuild is cheap, and it means the manifest can
be diffed to see what actually changed.

Usage:
    python3 scripts/generate-audio.py --voice fr_FR-siwis-medium --out audio/
    python3 scripts/generate-audio.py --sample          # ten files to listen to
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Voices whose dataset licence permits redistributing the audio they generate.
# fr_FR-tom-medium is deliberately absent: AGPLv3 dataset.
ALLOWED_VOICES = {
    "fr_FR-siwis-medium": "CC BY 4.0",
    "fr_FR-mls-medium": "CC BY 4.0",
    "fr_FR-upmc-medium": "CC BY-SA 4.0",
    "fr_FR-gilles-low": "CC0",
}

# Opus at 24 kbps mono. Measured on real French speech: 3,013 bytes per second,
# ~2.5 words per second, so a seven-word sentence is about 9.5 KB.
BITRATE = "24k"


def content_hash(text: str, voice: str) -> str:
    """Stable name for one string in one voice. 16 hex characters is ample."""
    return hashlib.sha256(f"{voice}\n{text}".encode("utf-8")).hexdigest()[:16]


def collect_units() -> list[dict]:
    """Every distinct string the product needs spoken, with what it belongs to.

    Deduplicated by text: « je suis » is one file however many cards point at
    it, which is also why the hash is of the text rather than of a card id.
    """
    units: dict[str, dict] = {}

    def add(text: str, kind: str, source: str) -> None:
        text = text.strip()
        if not text:
            return
        units.setdefault(text, {"text": text, "kind": kind, "sources": []})
        units[text]["sources"].append(source)

    verbs = json.loads((ROOT / "content/verbs.json").read_text())["verbs"]
    for v in verbs:
        add(v["infinitive"], "verb", v["key"])
        for t in v["tenses"]:
            for i, form in enumerate(t["forms"]):
                # The pronoun is included: a learner hearing "suis" alone has to
                # guess the liaison, and « je suis » is what they will say.
                add(f"{v['persons'][i]} {form}", "form", f"{v['key']}:{t['id']}:{i}")
        for part in v.get("participles", {}).values():
            add(part, "participle", v["key"])
        for imp in (v.get("imperative") or []):
            add(imp, "imperative", v["key"])

    deck = json.loads((ROOT / "content/fr-core-a1.json").read_text())
    for card in deck["cards"]:
        add(card["fr"], "headword", card["key"])
        for ex in card.get("examples", []):
            add(ex["fr"], "sentence", card["key"])

    return sorted(units.values(), key=lambda u: (u["kind"], u["text"]))


def synthesize(voice_path: pathlib.Path, text: str, wav_path: pathlib.Path) -> None:
    from piper import PiperVoice  # imported late so --list works without it

    voice = PiperVoice.load(str(voice_path))
    with wave.open(str(wav_path), "wb") as w:
        voice.synthesize_wav(text, w)


def encode(wav_path: pathlib.Path, opus_path: pathlib.Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
         "-c:a", "libopus", "-b:a", BITRATE, "-ac", "1", "-application", "voip",
         str(opus_path)],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="fr_FR-siwis-medium")
    ap.add_argument("--model-dir", default=".", help="where the .onnx lives")
    ap.add_argument("--out", default="audio")
    ap.add_argument("--sample", action="store_true",
                    help="generate ten representative files and stop")
    ap.add_argument("--list", action="store_true", help="count the work and stop")
    args = ap.parse_args()

    if args.voice not in ALLOWED_VOICES:
        print(f"refusing: {args.voice} is not on the licence-checked list.", file=sys.stderr)
        print(f"allowed: {', '.join(sorted(ALLOWED_VOICES))}", file=sys.stderr)
        print("A voice whose dataset forbids redistribution is not a candidate,", file=sys.stderr)
        print("however good it sounds. See docs/02-content-licences.md.", file=sys.stderr)
        return 2

    units = collect_units()
    if not units:
        print("refusing: no units collected — nothing to generate is a failure, not a pass.",
              file=sys.stderr)
        return 2

    kinds: dict[str, int] = {}
    for u in units:
        kinds[u["kind"]] = kinds.get(u["kind"], 0) + 1
    print(f"{len(units)} distinct strings: " + ", ".join(f"{k} {n}" for k, n in sorted(kinds.items())))

    if args.sample:
        # One of each kind, plus the longest sentence — enough to judge the
        # voice on, at ten files rather than twelve thousand.
        picked, seen = [], set()
        for u in units:
            if u["kind"] not in seen:
                picked.append(u); seen.add(u["kind"])
        longest = max((u for u in units if u["kind"] == "sentence"),
                      key=lambda u: len(u["text"]), default=None)
        if longest and longest not in picked:
            picked.append(longest)
        units = picked[:10]
        print(f"sample mode: {len(units)} files")

    if args.list:
        return 0

    if not shutil.which("ffmpeg"):
        print("refusing: ffmpeg is not on PATH.", file=sys.stderr)
        return 2

    model = pathlib.Path(args.model_dir) / f"{args.voice}.onnx"
    if not model.exists():
        print(f"refusing: {model} not found. Download it with:", file=sys.stderr)
        print(f"  python3 -m piper.download_voices {args.voice}", file=sys.stderr)
        return 2

    out = ROOT / args.out / "fr-FR" / args.voice.split("-")[1]
    out.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / ".audio-tmp"
    tmp.mkdir(exist_ok=True)

    manifest, generated, reused, total_bytes = {}, 0, 0, 0
    for u in units:
        h = content_hash(u["text"], args.voice)
        opus = out / f"{h}.opus"
        if not opus.exists():
            wav = tmp / f"{h}.wav"
            synthesize(model, u["text"], wav)
            encode(wav, opus)
            wav.unlink(missing_ok=True)
            generated += 1
        else:
            reused += 1
        size = opus.stat().st_size
        total_bytes += size
        manifest[h] = {"text": u["text"], "kind": u["kind"], "bytes": size,
                       "sources": u["sources"]}

    shutil.rmtree(tmp, ignore_errors=True)
    (ROOT / args.out / "manifest.json").write_text(
        json.dumps({"voice": args.voice, "licence": ALLOWED_VOICES[args.voice],
                    "bitrate": BITRATE, "files": manifest},
                   ensure_ascii=False, indent=2) + "\n")

    # Read the number, not the verdict.
    print(f"generated {generated}, reused {reused}, {len(manifest)} files, "
          f"{total_bytes} bytes = {total_bytes / 1024 / 1024:.2f} MiB")
    if manifest:
        avg = total_bytes / len(manifest)
        print(f"average {avg:.0f} bytes/file")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
