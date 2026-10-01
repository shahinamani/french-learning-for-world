#!/usr/bin/env python3
"""A second oracle: French Wiktionary conjugation tables.

Lexique attests roughly 19 of a verb's ~45 forms, because it is a corpus and
only holds what someone actually said or wrote. The other ~26 — passé simple
throughout, subjonctif imparfait, the rarer persons — are verified by nothing,
and those are precisely the forms a C-level reader meets in a literary text.
A generator checked against one source that is silent on more than half its
output is a generator with a blind spot exactly where mistakes hide.

So: `Conjugaison:français/<verbe>` on fr.wiktionary.org, which carries complete
paradigms, is CC BY-SA (compatible with this project's content licence, with
attribution), and is maintained by people who care about French morphology.

**Two independent sources disagreeing is a finding. One source silent is a
blind spot.** This closes the blind spot; `conjugate.py` reports the
disagreements.

Wiktionary is a wiki, so it is not authority — it is a second opinion. Where it
and Lexique and the generator all agree, confidence is high. Where Wiktionary
alone disagrees, a human decides, and the decision is recorded in
`conjugation_exceptions.py` like every other.

Politeness: one request at a time, a descriptive User-Agent, `maxlag`, and a
local cache so a re-run costs nothing.
"""
from __future__ import annotations

import argparse
import html
import json
import pathlib
import re
import sys
import time
import urllib.parse
import subprocess
import urllib.request

UA = ("french-learning-for-world/0.1 (open-source CC BY-SA French learning "
      "project; https://github.com/shahinamani/french-learning-for-world)")
API = "https://fr.wiktionary.org/w/api.php"

# Wiktionary's mood headings, in page order, and the tense names under each.
SLOT_OF = {
    ("Indicatif", "Présent"): "ind:pre",
    ("Indicatif", "Imparfait"): "ind:imp",
    ("Indicatif", "Passé simple"): "ind:pas",
    ("Indicatif", "Futur simple"): "ind:fut",
    ("Subjonctif", "Présent"): "sub:pre",
    ("Subjonctif", "Imparfait"): "sub:imp",
    ("Conditionnel", "Présent"): "cnd:pre",
}
PRONOUN_ORDER = ["je", "tu", "il", "nous", "vous", "ils"]

# « que je », « qu’il », « qu'elles ». Wiktionary uses the TYPOGRAPHIC
# apostrophe; a straight-apostrophe pattern matched none of the subjunctive
# rows and silently dropped every subjunctive slot — the one this harvest
# exists to verify. docs/lessons.md #11, in a new file on the same day.
QUE = re.compile(r"^(que |qu['’’])\s*")
unprefix = lambda pron: QUE.sub("", pron)


class FetchFailed(Exception):
    """The network or the API failed. NOT the same as 'this verb has no page'.

    The first version returned None for both, so three SSL failures were
    reported as three verbs without conjugation tables — a transport fault
    disguised as a finding about French. Exactly the shape this project keeps
    catching: the measurement failing and reporting about the thing measured.
    """


def fetch(verb: str, cache: pathlib.Path) -> str | None:
    """Page HTML, None if the verb genuinely has no page, raises on failure."""
    f = cache / f"{urllib.parse.quote(verb, safe='')}.html"
    if f.exists():
        return f.read_text(encoding="utf-8") or None
    params = urllib.parse.urlencode({
        "action": "parse", "page": f"Conjugaison:français/{verb}",
        "prop": "text", "format": "json", "formatversion": "2", "maxlag": "5",
    })
    url = f"{API}?{params}"
    try:
        out = subprocess.run(
            ["curl", "-sS", "--fail-with-body", "--max-time", "60",
             "-A", UA, url],
            capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        raise FetchFailed(f"{verb}: curl failed — {e.stderr.strip()[:120]}") from e
    try:
        d = json.loads(out)
    except json.JSONDecodeError as e:
        raise FetchFailed(f"{verb}: response was not JSON") from e
    if "error" in d:
        code = d["error"].get("code", "")
        if code in ("missingtitle", "nosuchpageid"):
            cache.joinpath(f"{urllib.parse.quote(verb, safe='')}.html").write_text("", encoding="utf-8")
            return None                          # genuinely no conjugation page
        raise FetchFailed(f"{verb}: API error {code}")
    text = d["parse"]["text"]
    f.write_text(text, encoding="utf-8")
    time.sleep(0.34)                             # be a good citizen
    return text


def strip(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).replace("\xa0", " ").strip()


def parse(page: str) -> dict[str, list[str]]:
    """Forms by slot, from the ACTIVE voice table only.

    The page carries an active and a pronominal paradigm. Taking the first
    occurrence of each tense gives the active one, which is what we generate.
    """
    # Split the page into mood regions by its headings.
    moods: list[tuple[str, int]] = []
    for m in re.finditer(r"<h[234][^>]*>(.*?)</h[234]>", page, re.S):
        name = strip(m.group(1))
        if name in ("Indicatif", "Subjonctif", "Conditionnel", "Impératif",
                    "Modes impersonnels"):
            moods.append((name, m.start()))

    def mood_at(pos: int) -> str:
        current = ""
        for name, start in moods:
            if start <= pos:
                current = name
            else:
                break
        return current

    out: dict[str, list[str]] = {}
    for m in re.finditer(r'<th[^>]*>(.*?)</th>(.*?)</table>', page, re.S):
        tense = strip(m.group(1))
        slot = SLOT_OF.get((mood_at(m.start()), tense))
        if not slot or slot in out:              # first occurrence = active
            continue
        rows = re.findall(
            r'<td[^>]*align="right"[^>]*>(.*?)</td>\s*<td[^>]*align="left"[^>]*>(.*?)</td>',
            m.group(2), re.S)
        forms: dict[str, str] = {}
        for pron_raw, form_raw in rows:
            pron, form = strip(pron_raw), strip(form_raw)
            if not form or "API" in form_raw and "prononciation" in form_raw:
                continue
            key = None
            # je/j', il/elle, ils/elles — match on the first two letters, but
            # keep nous and vous apart from one another.
            bare = unprefix(pron)
            if bare.startswith("nous"):
                key = "nous"
            elif bare.startswith("vous"):
                key = "vous"
            elif unprefix(pron).startswith(("ils", "elles")):
                key = "ils"
            elif unprefix(pron).startswith(("il", "elle", "on")):
                key = "il"
            elif unprefix(pron).startswith(("tu", "t'")):
                key = "tu"
            elif unprefix(pron).startswith(("je", "j'")):
                key = "je"
            if key and key not in forms:
                # Wiktionary prefixes the form with the elided pronoun in some
                # templates; keep only the last word.
                forms[key] = form.split()[-1] if form.split() else form
        if len(forms) == 6:
            out[slot] = [forms[p] for p in PRONOUN_ORDER]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbs", required=True, help="file with one lemma per line")
    ap.add_argument("--cache", default=".wiktionary-cache")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cache = pathlib.Path(args.cache)
    cache.mkdir(exist_ok=True)
    verbs = [l.strip() for l in pathlib.Path(args.verbs).read_text().splitlines() if l.strip()]
    if not verbs:
        print("refusing: no verbs given — an empty harvest is a failure, not a pass.",
              file=sys.stderr)
        return 2

    harvested, missing, thin, failed = {}, [], [], []
    for i, v in enumerate(verbs, 1):
        try:
            page = fetch(v, cache)
        except FetchFailed as e:
            failed.append(str(e))
            continue
        if page is None:
            missing.append(v)
            continue
        forms = parse(page)
        if len(forms) < 5:
            thin.append(f"{v} ({len(forms)} slots)")
            continue
        harvested[v] = forms
        if i % 25 == 0:
            print(f"  {i}/{len(verbs)} …", file=sys.stderr)

    pathlib.Path(args.out).write_text(
        json.dumps({"source": "fr.wiktionary.org Conjugaison:français/*",
                    "licence": "CC BY-SA",
                    "verbs": harvested}, ensure_ascii=False, indent=1) + "\n")
    slots = sum(len(f) for f in harvested.values())
    forms = sum(len(x) for f in harvested.values() for x in f.values())
    print(f"harvested {len(harvested)} verbs, {slots} tense slots, {forms} forms")
    if missing:
        print(f"  no conjugation page: {len(missing)} — {', '.join(missing[:8])}")
    if thin:
        print(f"  too few slots to use: {len(thin)} — {', '.join(thin[:8])}")
    if failed:
        # A transport failure is not a finding about French. Say so loudly and
        # exit non-zero, so a half-harvest can never be mistaken for a result.
        print(f"\n  FETCH FAILURES: {len(failed)}", file=sys.stderr)
        for line in failed[:10]:
            print(f"    {line}", file=sys.stderr)
        print("  The harvest is incomplete. Re-run; the cache keeps what succeeded.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
