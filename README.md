# French Learning for World

A free, open-source platform for learning French — built around spaced
repetition, with content that anyone is legally free to use, share and improve.

**Status: early, but usable.** The study app runs: flashcards with spaced
repetition, meanings and example sentences in Persian and English, and a study
timer. The content set is small — 22 cards — and grows from here.

## Try it

No installation, no dependencies, no build step:

```bash
git clone https://github.com/shahinamani/french-learning-for-world
cd french-learning-for-world
python3 -m http.server 8000      # or any static file server
```

Then open <http://localhost:8000>. Deployment is described in
[`docs/deploying.md`](docs/deploying.md).

## Why

Most good French-learning material is either locked behind a subscription or
copied from textbooks that were never licensed for it. This project takes the
slower path: every card, sentence and recording is either original work or
comes from an openly licensed source, recorded per item so anyone can check.

## What works today

- **Flashcards** for verbs and nouns. The front shows the French word, its CEFR
  level, its type, a noun's gender, and the preposition a verb governs — all of
  it part of what has to be recalled. Tap, click, Enter or Space to flip.
- **Behind the card:** the meaning, then one past-tense and one future-tense
  example sentence, each translated, with the form being taught highlighted.
- **Meanings in Persian or English**, chosen independently of the interface
  language — a Persian meaning under an English interface is a normal thing to
  want.
- **Spaced repetition** (FSRS). Four ratings, each showing when the card will
  return. Nothing to triage by hand.
- **Study timer**, 10 minutes to 1 hour, with a chime synthesised in the
  browser. It is drift-proof: it survives a locked phone, a throttled
  background tab and a full reload, and says so if it finished while you were
  away.
- **Examination sections** for DELF, DALF, TCF and TEF. Each one opens to its
  CEFR levels, the cards available at those levels, and free practice material
  for all four tested skills — listening, reading, writing and speaking —
  linked on the examination body's own site and on public broadcasters.
  Nothing is copied from them; the links lead to their pages.
- **Interface in English, فارسی, français and العربية**, with full
  right-to-left layout. Card meanings in all four, so a Persian or Arabic
  meaning can sit under an English interface — and a French definition is
  available for monolingual study.
- **Works offline** once visited, and installs to a phone home screen.
- **Your progress is yours**: stored only in your browser, exportable to a
  file, importable on another device. Nothing is sent anywhere.

Run the tests with `node --test tests/*.test.js` — no dependencies required.
Check the outbound links with `./scripts/check-links.sh`.

> **On the examination links.** They point at other organisations' websites and
> were written from knowledge, not verified from the machine that generated
> them — `checkedOn` in `content/exams.json` is therefore `null`, not a date.
> Run `./scripts/check-links.sh --write` to verify them and stamp it honestly.
> The exam body's own page is always the authoritative source for format,
> dates and fees.

## Goals

- **Spaced repetition at the centre.** Scheduling with
  [FSRS](https://github.com/open-spaced-repetition) — the learner is shown
  what they are about to forget, not a list they page through.
- **CEFR A1 → C2**, useful preparation for the DELF, DALF, TCF and TEF
  examinations — see the independence notice below.
- **Free and anonymous first.** Study immediately; no account required. An
  account only ever syncs progress across devices.
- **Openly licensed content**, with provenance recorded per item.
- **Native-speaker audio** from open corpora, with browser speech synthesis
  only as a fallback.
- **Works on a phone, works offline.** A commute is the natural study slot.

## Independence and scope

This is an **independent, free study tool**. It is **not affiliated with,
endorsed by, sponsored by or connected to** France Éducation international,
the Chambre de commerce et d'industrie de Paris Île-de-France, the French
Ministry of National Education, or any other examination body.

*DELF*, *DALF*, *TCF* and *TEF* are trademarks of their respective owners.
They are named here only to describe what learners are studying for — no
affiliation is claimed or implied.

**This project does not issue, sell, award or help anyone obtain any
certificate, diploma or test result, and gives no immigration, visa or legal
advice of any kind.** It teaches French. Nothing more.

CEFR levels shown here are a judgement applied consistently across the
content set, based on corpus frequency — not an official alignment with any
examination syllabus. See [`docs/content-provenance.md`](docs/content-provenance.md).

## Licensing

- **Code** — [MIT](LICENSE).
- **Learning content** — [CC BY-SA 4.0](LICENSE-CONTENT).
Every item also records its own source and licence, so the question "may we
publish this?" is a query rather than an audit. Every source in use and every
source approved for future use is listed, with its licence, in
[`docs/02-content-licences.md`](docs/02-content-licences.md).

**No third-party copyrighted material** — no textbook text, no commercial
word list, no scraped course content — enters this repository. Everything
here today is original work written for this project.

## Contributing

The most useful contribution right now is **content**: more cards, and
meanings in more languages. Card meanings are locale-keyed, so adding Arabic,
Turkish or Spanish is data, not code. [CONTRIBUTING.md](CONTRIBUTING.md)
has the rules — the most important being that this repository is public and
nothing secret or third-party-licensed may ever be committed to it.

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability privately.
