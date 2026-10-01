# 02 — Content sources and licences

**Status:** current as of 2026-09-30. **Swept against the build 2026-09-30** — corrections marked **[corrected 2026-09-30]**, full sweep in `docs/07`. This file is the register the brief requires: **every** item of content in the platform has a source and a licence recorded here, and anything whose licence cannot be established does not ship.

---

## The hard rule

> No content is copied, adapted, translated or "rephrased" from any commercial textbook, paid course, proprietary word list, or another learning app.

Rephrasing is not a loophole. A *selection* of vocabulary is its compiler's own work even when none of their sentences are reproduced, and in the EU a compiled database carries the *sui generis* database right independently of copyright. If provenance cannot be stated, the item is left out rather than guessed at.

**The blocker named in the brief does not affect this repository.** Content credited to *Les mots de l'info B1-B2* (Stéphane Wattier) and *Vite et Bien 1* lives in a **different, earlier codebase**. I checked every content file and the full git history here: nothing from those books, or from any textbook, has ever been committed to this repository.

---

## What is in the platform today

| Content | Count | Source | Licence | Verified |
|---|---|---|---|---|
| A1 flashcards — French headword, English/Persian/Arabic meanings, French definition, one past-tense and one future-tense example sentence each, all translated | 22 cards, 44 sentences | **Original work written for this project** | Project content licence (see below) | Yes — every card carries `provenance: original` in `content/fr-core-a1.json`, and a test asserts no card is attributed to a textbook, course or app |
| Examination descriptions — DELF, DALF, TCF, TEF: full names, CEFR levels, administering body | 4 entries | **Factual statements**, written here | Facts are not copyrightable | Yes |
| Outbound practice links | 22 distinct URLs | France Éducation international, Le français des affaires, TV5MONDE, RFI, Le Point du FLE, Wikisource, Council of Europe | **Not applicable — links, not copies.** No material from these sites is reproduced, mirrored or embedded | URLs recorded in `content/exams.json`; `checkedOn` is `null` because this environment cannot reach those hosts |
| Interface strings | **109 keys × 4 languages** *(written as 92; re-counted 2026-09-30)* | **Original**, written here | Project content licence | Yes |
| Verb conjugations | 14 verbs × 6 tenses × 6 persons = **504 forms**, plus participles and 12 imperatives | **Derived by rule and checked by hand for this project** — imparfait from the *nous* stem, conditional from the future stem; no table copied from any source | Project content licence | Yes — `provenance` and `licence` on every verb, asserted by a test |
| Concept taxonomy | 297 concepts (261 leaves, 4 roots), A1–C2 *(224 A1–B2; C1 and C2 added 2026-10-01)* | **Original**, written here | Project content licence | Yes |

**Nothing else exists yet.** Every row above is either our own writing or a fact.

---

## Fonts — self-hosted, and why

| Asset | Licence | Source | Shipped |
|---|---|---|---|
| **Newsreader** (variable) | **OFL-1.1** | `@fontsource-variable/newsreader@5.3.0` | `public/fonts/newsreader-latin.woff2`, `-latin-ext.woff2` |
| **Vazirmatn** (variable) | **OFL-1.1** | `@fontsource-variable/vazirmatn@5.3.0` | `public/fonts/vazirmatn-latin.woff2`, `-latin-ext.woff2`, `-arabic.woff2` |

Both licences are committed beside the files as `LICENSE-Newsreader.txt` and
`LICENSE-Vazirmatn.txt`. OFL permits redistribution and web embedding; it
requires the licence to travel with the files, which is why it is there.

**Served from our own origin, not a font host.** Three reasons, and a
third-party host fails all three: a cross-origin font is not in our
service-worker cache, so offline falls back to a system face; every visitor's
IP reaches the host, which a German court has held to breach the GDPR; and
some networks block the host outright, including the one this was built on.

Variable fonts, so one file covers every weight — no per-weight request and no
faux-bold. `unicode-range` means a Latin page never downloads the Arabic
subset: a French page fetches **92 608 bytes (90.4 KiB)** of the **197 020 bytes (192.4 KiB)** shipped. Re-measured 2026-09-30.

**[added 2026-09-30]** `font-display` is **`optional`**, not `swap`. That was changed in step 5 for LCP: with `swap` the first paint waited on the font, and on a simulated 400 kbps connection that cost seconds. `optional` means a first-time visitor on a slow connection sees the fallback face for that visit and the designed face from the next one. It is a deliberate trade of first-visit typography for first-visit speed.

---

## Sources approved for future use, with the licence checked

Each carries a real obligation. They are listed with what that obligation actually costs us.

| Source | Licence | What we may take | The obligation |
|---|---|---|---|
| **Tatoeba** | CC BY 2.0 FR | Example sentences and their translations, including French↔Persian and French↔Arabic pairs | Credit Tatoeba and the sentence contributors. **No share-alike** — our own content stays under whatever licence we choose |
| **Wiktionary (fr)** | CC BY-SA 3.0 / 4.0 | Definitions, gender, conjugation tables | **Share-alike.** Anything derived from it must be released under a compatible licence. This is the source that constrains our choice |
| **Wikidata lexemes** | CC0 | Lemma and form data | None |
| **Lexique 3** | CC BY-SA 4.0 | Frequency, lemma, part of speech | Share-alike — but *frequency itself is a fact*, and a word list derived from frequency is not a copy of Lexique's selection |
| **Mozilla Common Voice** | CC0 | Recorded speech | None. **Caveat:** contributors are volunteers of varying accent and fluency, not pedagogical voice actors — it is real speech, not model speech, and should be labelled as such |
| **Lingua Libre** | CC BY-SA | Single-word recordings by named speakers | Share-alike, plus speaker attribution |
| **Universal Dependencies (French)** | CC BY-SA | Annotated syntax, for grammar exercises | Share-alike |
| **Project Gutenberg / Wikisource** | Public domain | Reading passages | None, but the register is C1–C2 and the language is often archaic. Useful for advanced reading only |
| **OPUS** | Varies per corpus | Parallel FR↔EN text | **Must be checked per corpus.** Some sub-corpora are not freely licensed. Not usable as a blanket source |

**Not approved, and not to be revisited:** anything from Duolingo, Babbel, Busuu, Memrise, Clozemaster, Kwiziq, Lawless French, shared Anki decks of unknown origin, or any textbook.

**TV5MONDE and RFI:** their material may be **linked**, never copied. Their terms permit viewing on their own pages, not redistribution.

---

## The structured licence field

Adopted from LibreLingo's course format — the idea, not the code. Every content file carries its licence as data, so "may we publish this?" is a query rather than an audit:

```json
{
  "id": "fr-core-a1",
  "licence": { "name": "…", "shortName": "…", "url": "…" },
  "cards": [
    { "key": "v:etre", "provenance": "original", "licence": "…",
      "sourceRef": null, "attribution": null }
  ]
}
```

`provenance` and `licence` sit on **every card**, not only the deck, because a deck will eventually mix original writing with Tatoeba sentences, and the attribution page must be generated from the data rather than maintained by hand. `sourceRef` holds the upstream identifier (a Tatoeba sentence id, a Wiktionary revision) so a claim can be traced back.

A test enforces that every card has both fields and that none is attributed to a forbidden source.

---

## Which licence this project should carry — recommendation

The brief asks which I recommend and why. **Two licences, because code and content are different things and conflating them is a common and expensive mistake.**

### Code — **MIT** (already in place, keep it)

Short, universally understood, and permissive. Anyone may reuse the platform, including commercially, provided the copyright notice travels with it. For a project whose purpose is to be useful to as many people as possible, the permissive choice is the one that removes obstacles. `LICENSE` already contains verbatim MIT, copyright Shahin Amani.

### Content — **CC BY-SA 4.0**. Decided 2026-09-30, knowingly and permanently.

**This decision was taken with its consequences stated and accepted.** It is
recorded here rather than in a commit message because it cannot be undone for
anything already published, and whoever reads this file in two years needs to
know it was a choice and not a default.

**What it forecloses, permanently:**

- **Content already published under it cannot be relicensed.** Every card,
  sentence and translation released stays CC BY-SA. A later decision to go
  permissive applies only to content written after it.
- **Permissively-licensed projects cannot absorb our content.** An MIT or
  CC BY project cannot take our sentences without becoming share-alike itself.
  We are choosing to be unusable by them.
- **Nor can a proprietary product** — which is the point, but it is the same
  fact seen from the other side.
- **Every contributor is bound by it.** Anyone writing a card is releasing it
  under share-alike, and must be told so before they contribute.
- **Mixing rules become a real constraint.** CC BY (Tatoeba) and CC0
  (Wikidata, Common Voice) flow *into* CC BY-SA. Nothing flows back out.

**Why it was chosen anyway:** if the platform uses anything Wiktionary-derived
— and conjugation tables and definitions realistically come from there —
share-alike is not a preference but an obligation. And it matches what the
platform is for: free to learn from, free to build on, impossible to enclose.

The reasoning in full:

1. **It is the only option compatible with Wiktionary and Lexique**, both CC BY-SA, both on the approved list. Choosing CC BY or CC0 now would silently rule them out later — and Wiktionary is where conjugation tables and definitions realistically come from.
2. **Share-alike keeps the content free.** Under CC BY or CC0 a commercial app could take the entire body of work, wrap it in a subscription, and owe nothing back. CC BY-SA does not prevent commercial use — it requires that whatever they build from it stays as free as what they took.
3. **CC BY-SA 4.0 is one-way compatible with CC BY 2.0**, so Tatoeba sentences can be incorporated; and CC0 material (Wikidata, Common Voice) can be incorporated by anyone into anything.

**The cost, stated plainly:** share-alike is permanent and viral. Once content ships under CC BY-SA, that decision cannot be reversed for anything already published, and derivative works are bound by it. Someone who wants to take our sentences into a permissively-licensed project will not be able to. **This is the single most consequential irreversible decision in the project**, which is why it belongs to Shahin and not to me.

**The alternative**, if the priority is maximum reuse over keeping derivatives free: **CC BY 4.0** — attribution only. It costs us Wiktionary and Lexique as sources, which is a real loss for conjugation and frequency data, and allows anyone to enclose the work.

---

## Attribution, as it will appear

Once content arrives from an outside source, the platform needs a generated credits page listing each source, its licence and a link — built from the `licence` and `sourceRef` fields, never hand-maintained. CC BY and CC BY-SA both require this; it is the condition on which the material is free.

Today there is nothing to attribute, because everything is ours.
