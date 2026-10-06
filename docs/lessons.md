# Lessons — the checks that could not fail

**What this is:** a running list of verification faults found on this project.
Not bugs in the product — bugs in the things that are supposed to catch bugs.
They share one shape: **something reported success without having checked.**

Numbering follows Shahin's list, which spans more than this repository.

---

## Two questions that found more than any check on this project

Everything below is an instance of one of these. Read them before writing a
test, and before saying a piece of work is finished.

### Before anything else: am I comparing the right two things?

Eleven checks of mine accused correct data in one week. **Ten of the eleven
compared the wrong two things.** Only one was a wrong idea about the data — a rule
requiring a three-letter word, which rejected « to go ».

| the check | what it compared | what it should have compared |
|:--|:--|:--|
| counting senses by splitting on `"; "` (twice) | a joined string | the sense list |
| `checkAnswer(alternate, form)` | a two-argument call | the drill's three-argument call |
| `/\bsuicide$/` | the end of the string | the trailing list item |
| the sort-key regex | up to the first `)` | the whole line |
| the pace check | marks | questions |
| `/not been verified/` | my paraphrase of the text | the text |
| a positional line comparison | line *i* to line *i* | a diff |
| `git diff` in the applier test | the file and the last commit | the file before and after the applier |
| the keyboard drive looking for an item | the page's PROSE for an id | the id, read from its own element — it matched a sibling LIST containing that id and walked to the wrong item |
| the answer-position guard | nothing — it was right, and found the fault in two papers nobody had written | — |

So the first question when writing a check is not "is my rule right?" —
**it is "am I comparing the right two things?"** Name the two things, out loud,
before writing the assertion: *the forms the harvest produced* against *the
forms the corpus attests*; *the total the page shows* against *the total the
content holds*; *the number of lines a diff reports* against *a bound*.

Most of these failures came from comparing a convenient thing to the right
thing. The joined string was to hand; the sense list needed loading. The marks
were in the file; the question count was not published. **Convenience chooses
one of the two things for you, and it is almost always the wrong one.**

Then, and only then, the rule below: name the wrong implementation your check
rules out, and watch it fail against that.

### "What can this shape not express?" — not "is this right?"

« souvenir » sat in the content as a bare infinitive with a conjugation table
reading « je souviens », « tu souviens », « il souvient ». Six rows of French
that does not exist, on a verb in the first hundred.

Guarding it at the time: 2,392 verbs checked against two independent corpora
agreeing on 134,000 forms, 251 unit tests, a 199-check browser walk that opened
that very page, and a rule that every tense have six non-empty persons — which
it did.

**None of it could catch this, because the verb record had no field in which to
say "this verb needs a pronoun".** A wrong value is something a test can
disagree with. A missing field has no value to disagree with. Review reads what
is there; the fact was not there to be read.

Asking what the shape cannot express is the only question that finds this class.
For a verb record the answers were: that it is pronominal, that it is defective,
that its register differs by sense, that its meaning has been reviewed by a
human. Four fields that did not exist, each of them a fact the product needed
to state and could not. **I do not know what else is missing, and that is the
honest state of every schema here.**

### A guard you have not seen fail is a guess about what it does

Not a slogan — the strongest finding on this project came from spending thirty
seconds breaking a check on purpose.

After « souvenir » had been fixed on five separate surfaces, each found by hand
after I had declared the work done, I wrote a source-level check: no component
may print a verb's bare `.infinitive` where a learner reads it. Then I reverted
the verb list to the defect to watch the check fail.

**It passed.** The reverted line was:

```jsx
<span data-testid={`row-${v.infinitive}`}>{frText(v.infinitive)}</span>
```

The check excused any *line* containing a legitimate use of the identifier, and
`data-testid` is one. **The attribute added so the browser check could find the
row is what made the source check blind to the defect beside it. One safeguard
disabled another, and only reverting the fix on purpose revealed it.**

A line is not the unit of meaning; an expression is.

---

## How entries are written, from 2026-10-02

**Stop numbering.** Four agents append to this file concurrently and the numbers
collide — three did so on 2026-10-02 alone. Every new entry is **dated and
titled**, and is referred to by its title:

    ### 2026-10-02 — a comment claiming two things agree is the reason nobody checks

Cross-reference by title, never by number. The numbered entries below are left
exactly as they are: renumbering them would break every reference already
written, and the numbers were never the point.


### 2026-10-02 — a handoff document decays faster than the code, because nothing fails when it goes stale

`docs/99-handoff.md` exists to orient somebody with none of the conversation
that produced the work. Directly under the warning that nobody had checked its
claims, it said: *"Pull request #1 is merged. The work is on `main` at
`698c550`. Current branch: `feat/translations`."* Nineteen pull requests out of
date. That branch no longer existed.

The warning and the wrong facts were on the same screen, and **the wrong facts
were more specific.** A commit hash and a branch name read as something checked;
a paragraph of caution reads as a disclaimer. A reader would have trusted the
hash and discounted the warning, which is the exact opposite of what was true.

Code that goes stale fails: a test breaks, a build stops, a type stops matching.
A document that goes stale does nothing at all, and keeps being read.

Two cheap defences, both now in place:

* **`last updated <date>` in the title of every document of this kind.** It
  costs one line and tells a reader how much to trust the rest.
* **Put the unverified-work warning FIRST, before any claim the document
  makes.** A reader who learns at the end that nobody checked this has already
  believed the middle.

The same decay had reached the code, where it is quieter still: the comment at
the top of `web/src/lib/verbs.ts` stated the verb index was "26 KiB gzipped".
It was 71. The number had been right when it was written, glosses were added,
and nothing re-measured it. A comment stating a measurement is a claim, and a
claim nothing checks is a claim that will be wrong later. There is now a check
that fails when the index passes 90 KiB.

### 2026-10-02 — a label describes the French word, not the English text we are about to print

`venir` shipped "to come …; **to cum, to come, to orgasm**" — on the verb every
A1 course teaches in week one. en.wiktionary records that sense and labels it
`{{lb|fr|Anglicism|vulgar}}`; our harvest stripped every `{{lb|...}}` as noise
before anything could read it. The label existed in the source and was thrown
away one line before the decision that needed it.

**Read the metadata before you strip the markup.** The fix was to move label
extraction above `clean()`, not to add a word blocklist. A blocklist fails
twice: it misses what it has not heard of, and it censors the innocent —
« baiser » is "to kiss" and also carries vulgar senses, one word with two
registers, and only the label can separate them.

But the label does not answer the question we were actually asking.
Wiktionary's `vulgar` describes the register of the **French** word. It says
nothing about the English text we are about to print:

* « gueuler » → "to yell, to scream" — dropped. Clean translation, coarse French.
* « démerder » → "to manage, to get by" — dropped. Same.
* « enculer », « chier » — dropped, and here the English is explicit too.

**Shahin's ruling, the same day: show the meaning, show the register.** A
learner needs to know that « gueuler » means "to yell" AND that it is coarse.
Hiding it teaches nothing and leaves them able to use it in a DELF oral without
knowing what they have said.

So the rule changed to ask the question we were actually asking: **is this
sentence printable?** — checked on our own English output, which is a narrow and
defensible use of a word list because it is applied to what we are about to
publish rather than to someone else's language. The register is appended, so
« gueuler » now reads `to yell, to scream (slang)`.

The line still falls where it should. `chier`, `enculer`, `merder`, `pisser`
and `masturber` are silent, because their English is coarse too. Five verbs
instead of seven, and the two that lost a clean translation got it back.

Two refinements the change needed, each found by reading the output rather than
by reasoning about it:

* **Dropping only the explicit alternatives, not the sense around them.**
  « entuber » is "to shaft, to fuck over, dupe, swindle, fool"; refusing the
  whole sense cost four printable translations. Splitting on separators outside
  parentheses keeps "to put on/in (quickly), to shove" intact.
* **But if the LEADING translation is unprintable, the whole sense goes, and if
  the verb's FIRST sense goes, the verb is silenced.** Without that, « enculer »
  came back as "to beat up" — its fourth sense, listed, real, and not what the
  word means. Dropping a trailing synonym edits a list; keeping a later sense
  when the first is refused substitutes a different word.

Where a verb is silenced the page now says so, in four languages. A blank field
looks like a bug and teaches nothing; "every sense Wiktionary records for this
verb is marked vulgar" is the single most useful fact about « enculer ».

Three parsing faults surfaced in the same pass, each already shipping:

* **An HTML comment can span two lines, and `<[^>]+>` matches neither half.**
  « chier » shipped a Wiktionary editor's aside — "not sure I believe the next
  one" — as part of its meaning.
* **Templates nest, and one non-recursive pass cannot see that.**
  `{{ng|... {{m|en|would}} or {{m|en|should}} ...}}` stripped as two separate
  matches leaves the text between them. « vouloir » shipped a sense whose entire
  content was the word **"or"**.
* **A gloss inlined bare welds two clauses into a third meaning.** « venir »
  read "to come to move from one place to another that is nearer the speaker".

And one fault I introduced and caught in the same hour: `usable()` required a
three-letter word, which rejected « aller »'s primary sense, **"to go"** — no
word in it reaches three letters. aller would have shipped with "to attend
(school, church regularly)" as its first meaning, on the most taught verb in the
language. A filter written to protect learners silently damaged the one entry it
was most important to get right. The check now asserts aller reads "to go".

A fourth, in `build-verbs.py`: I named my set of withheld verbs `withheld`, and
a line further down already said `index, shards, withheld = [], {...}, []`. The
set was emptied before it was read, every verb reported "not withheld", and the
build printed `0 withheld` — a wrong answer that looked exactly like a right
one. Nothing failed. The only reason it was caught is that **0 was a number I
had a reason to expect to be 7.** A count you cannot predict in advance is a
count that cannot catch this.


### 2026-10-02 — a filter written to protect learners damaged the one entry it most mattered to get right

Dropping Wiktionary's vulgar senses needed a rule for "is this cleaned line a
usable gloss". I wrote one: it must contain a word of three letters or more.

It rejected **"to go"**.

« aller » would have shipped with "to attend (school, church regularly)" as its
first meaning — the most taught verb in French, with its primary sense deleted,
by a filter whose entire purpose was to make the glosses safer. The rule was not
wrong about anything it was designed for. It was wrong about the shortest
correct answer in the language, and short correct answers are exactly what a
good gloss looks like.

**A filter's blast radius is not where you are looking.** I was reading
`venir`, `chier`, `baiser` — the entries I expected to be interesting — and the
damage landed on `aller`, which I had no reason to open. The check that caught
it was a deliberate spot-check of the most common verbs, not the test suite,
because the suite only knew what I had thought to assert.

What now stops it: `tests/glosses.test.js` asserts that aller reads "to go",
by name. Not "aller has a gloss" — the exact text. A guard on the most ordinary
case is worth more than a guard on the exotic one, because the exotic one is
the one you will remember to check by hand.

See also [[2026-10-02 — a label describes the French word, not the English text
we are about to print]], the change that introduced this.

### 2026-10-02 — a count you cannot predict in advance cannot catch anything

In `build-verbs.py` I added a set of verbs whose glosses were withheld:

```python
gloss_withheld: set[str] = set()      # what I wrote, after the fix
withheld: set[str] = set()            # what I wrote first
```

Seventeen lines further down, already there and older than my change:

```python
index, shards, withheld = [], {lvl: [] for lvl, _, _ in BANDS}, []
```

My set was emptied before it was ever read. Every verb came out
`glossWithheld: null`, the content was silently wrong, and the build printed:

```
A1: 200 verbs  351.1 KiB  200 with a gloss, 0 withheld
```

**`0 withheld` is a wrong answer that is indistinguishable from a right one.**
Nothing failed. No test broke, because the tests I had written at that point
asserted the glosses were clean, and they were. A verb that should have carried
a reason for its silence carried nothing instead, which renders as a blank
field — and a blank field is what the whole change existed to remove.

It was caught for one reason: **0 was a number I had a reason to expect to be
7.** I had just run the harvest and read "verbs left with NO gloss: 7 — chier,
emmerder, gueuler…". So the build's 0 was not a plausible number, it was a
contradiction with something I had read two minutes earlier.

The general form: a printed count protects you only if you know what it should
say before you read it. `0`, `null`, `[]` and "no results" are the values a
broken pipeline produces most often, and they are also legitimate answers, so
they are the ones a reader accepts without friction. **Print counts you can
predict, next to the number they must agree with, and make the test assert the
agreement** — `tests/glosses.test.js` now declares the five silenced verbs by
name and `deepEqual`s them, so an empty set fails instead of reporting zero.

See also [[2026-10-02 — a handoff document decays faster than the code, because
nothing fails when it goes stale]]: both are failures that produce no signal at
all, which is the only kind that survives.


### 2026-10-02 — a missing field is a fact nothing can assert and no test can miss

« souvenir » was in the content as a bare infinitive, glossed "to remember",
with a conjugation table reading « je souviens », « tu souviens », « il
souvient ». Six rows of French that does not exist, on a verb in the first
hundred. A learner studying that table writes it in an exam and learned it from
us.

The content had 2,392 verbs, 251 tests, two corpora agreeing on 134,000 forms,
and a browser walk that opened the verb page. None of it could have caught
this, for one reason: **the data had no field in which to say "this verb needs
a pronoun", so the fact went unsaid for all 51.**

A wrong value is a thing a test can disagree with. A missing *field* is not
wrong — it is absent, and absence has no value to compare against. Every guard
on this project checks that the data says something true. None of them could
check that the data was silent about something it had to say.

This is the failure mode that survives the most careful review, because review
reads what is there. The question that finds it is not "is this right?" but
**"what can this shape not express?"** — and the answer for a verb record was
"that it is pronominal, that it is defective, that it needs an auxiliary other
than the one we assumed, that its meaning differs by register". Three of those
four are now expressible. The fourth is not, and I do not know what else is
missing, which is the honest state.

The mirror defect is the harder half, and it was one disjunction away: «
transporter » carries `{{lb|fr|transitive|or|pronominal}}`, and reading that as
"pronominal" marked five verbs pronominal-only that are not. **Breaking five
verbs that were already right while fixing 51 that were wrong would have been a
net loss nobody would have spotted** — the 51 were visibly broken, the five
would have become quietly broken.

### 2026-10-02 — the guard was blinded by the attribute that made it testable

« se souvenir » was fixed five times, on five surfaces, each found by hand
after I had said the work was done: the detail heading, the drill prompt, then
the list, then the table caption, then the stored history record. The fix was
applied at call sites, and a call site nobody has listed is a call site that
keeps the defect.

So I wrote a source-level check: no component may print `.infinitive` where a
learner reads it; go through `verbLabel()`. Then I tested it the way everything
here gets tested — reverted the list to the bare infinitive and ran it.

**It passed.**

The reverted line was:

```jsx
<span data-testid={`row-${v.infinitive}`}>{frText(v.infinitive)}</span>
```

My allow-list excused any LINE containing an allowed use of the identifier — a
route, a React key, a test id — and `data-testid` is an allowed use. The
attribute I had added so the *browser* check could find the row is what made
the *source* check blind to the defect on the same line.

Two things in that:

* **A line is not the unit of meaning; an expression is.** The check now
  removes each legitimate use together with its argument before looking for a
  bare render, so one allowed token on a line no longer pardons the rest of it.
* **A guard that has never been seen failing is a guess about what it does.**
  This one was written carefully, read correctly, and did nothing. The thirty
  seconds of reverting one line is the whole difference between a check and a
  comment claiming there is a check.

See also [[2026-10-02 — a filter written to protect learners damaged the one
entry it most mattered to get right]], which ends on the same point from the
other side: a guard on the most ordinary case is worth more than one on the
exotic case you will remember to check by hand.


### 2026-10-03 — every content defect on this project has been a shape problem, not a value problem

Three weeks of content work, three serious defects, and they are the same
defect:

| what shipped | what was inexpressible |
|:--|:--|
| « je souviens » on an A1 verb, six rows of non-French | that a verb needs a reflexive pronoun |
| « porter » glossed "to carry" with no "to wear" | that a verb has four meanings that matter |
| « complaire » glossed "to get stuck in" | that a source's sense ORDER is its opinion, not our data |

**In none of them was a value wrong.** Every field held what the pipeline put
there, every pipeline did what it was written to do, and both corpora agreed
throughout. What was missing was a place to put a fact:

* The verb record had no `pronominal` field, so 51 verbs could not say they
  needed a pronoun.
* The gloss had a `MAX_SENSES` count, which can express "at most two" and
  cannot express "this verb has four meanings a learner meets in week one".
* There was no table of corrections, so "Wiktionary is wrong here" had nowhere
  to be written down.

**An inexpressible fact cannot be asserted, so it cannot be tested, so it is
not noticed.** This is why the three defects survived 2,392 verbs, two corpora
agreeing on 134,000 forms, 251 tests and a browser walk: all of those check
that the values present are right. None of them can check that a value is
absent, because absence has no shape to compare against.

The practical consequence, and the reason this is its own entry rather than a
remark on the others: **when a defect is found, the first question is not "what
is the fix" but "what could this shape not say".** Fixing « souvenir » as a
value — hard-coding one verb — would have left 50. Fixing the shape found all
51 and, because the shape then existed, made the mirror defect visible too
(five verbs wrongly marked, which a value fix would never have surfaced).

See [[2026-10-03 — faithfulness to a source that is itself a judgement is not
accuracy]] and [[2026-10-03 — a decision with no place to live expires when the
session does]], which are the second and third rows of that table.

### 2026-10-03 — faithfulness to a source that is itself a judgement is not accuracy

« complaire » shipped glossed **"to get stuck in, to get caught in"**. The verb
means to revel in something.

The parser was not wrong. en.wiktionary lists three senses for it, in this
order:

```
1. to get stuck in, to get caught in      <- taken
2. to take pleasure in, to bask in        <- taken
3. to wallow, to revel in                 <- the right one, discarded by the cap
```

The harvest took the first two faithfully. **Sense order on Wiktionary is an
editor's opinion about which meaning is primary, and the harvest was reading
position as meaning.** Nobody wrote that rule down; it arrived by default, in
the act of looping over the lines in the order they appear.

This is not a parsing bug and it cannot be fixed by parsing more carefully. A
more faithful parser would reproduce the editorial judgement more exactly. The
only answers are to take more of the senses — which is what the character
budget does, and `complaire`'s correct sense is third, inside the new budget —
and to have somewhere to overrule the source, which is the entry below.

The general form: **when you consume a source, separate what it has measured
from what it has decided.** Lexique's frequency counts are measurements; its
corpus's gaps are not claims. Wiktionary's forms are attested; its sense order,
its labels and its choice of what to include are judgements. Treating a
judgement as data makes you precisely as wrong as the judgement, with none of
the signals that you are relying on one.

### 2026-10-03 — a decision with no place to live expires when the session does

Shahin read 51 verbs and ruled on six. Three were not pronominal-only;
« complaire » and « tapir » had wrong glosses; « fier » needed a homograph note.

Until that afternoon **there was nowhere in the repository to write any of
it.** The conjugator has had `scripts/conjugation_exceptions.py` since the
beginning — `ORACLES_DISAGREE`, `KNOWN_WRONG`, `CORPUS_NOISE` — because two
corpora disagreeing was anticipated from the start. The glosses had no
equivalent, so a human ruling had nowhere to go but my memory of a
conversation, which is to say: it had until the end of the session.

Everything else was in place. 2,375 glosses, a provenance field, a licence
note, a browser check that the page says the meanings are unreviewed. The one
thing missing was a row that says "a person looked at this and the source was
wrong", and so the review Shahin had just done could not be recorded, only
acted on once.

Two properties the table needed, beyond existing:

* **The reasoning, not only the ruling.** « cabrer » is not pronominal-only
  because « cabrer un avion » is ordinary aviation French. Without the reason
  the next person can only defer to it or overturn it blindly.
* **A refusal when a correction corrects nothing.** The build now exits 2 if a
  correction names a verb that is not in the content, seen failing on purpose:

  ```
  refusing: TEACHER_GLOSS names verbs that are not in the content: ['tapirr']
  ```

  A recorded ruling with a typo in it is worse than no ruling, because
  everybody — including the person who wrote it — believes the correction is
  live.

Four meanings out of 2,375 now carry `glossProvenance: "teacher"`, and the page
stops calling those unreviewed while continuing to say it of the rest. That is
a small number and it is the first human review in the product; the point of
the table is that the next forty-eight have somewhere to land.


### 2026-10-03 — a filter you remove has been doing two jobs, and the measurement only counted one

The two-sense cap was measured carefully and removed for good reasons: 767
verbs were losing a sense that said something the kept ones did not, and the
losses were core meanings — « porter » with no "to wear", « marcher » with no
"to work, to function".

Every number in that measurement counted **what the cap was costing**. None of
them counted **what it was suppressing**. A cap that keeps two senses out of
five does not discriminate: it withholds the good third sense and the mangled
fourth one with equal indifference, and removing it admits both.

Found the same hour, by reading 48 lines rather than by any check:

```
s'envoler  to take off, to take flight; to blow away; to fly (of time);
           to vanish, disappear, walk (to be stolen) (colloquial)
```

"Walk (to be stolen)" is English slang glossing a figurative sense. It is
useless to a learner, it was never visible before, and **it is damage from my
own change** — not a pre-existing defect the widening revealed.

So I measured the other half. Of the 1,084 senses the budget newly admits,
**15 are mechanically defective — 1.4%, against 1.0% on the senses already
shown.** Fifteen bad against 1,069 sound.

**The worry was right in form and wrong in size.** The cap was not sitting on a
reservoir of rubbish; it was suppressing good and bad at roughly the rate they
occur. Had the number come back at the one-in-five my reading suggested, the
budget would have been the wrong fix and a per-sense quality filter the right
one. I did not know which until I counted, and I had already shipped.

Two things to carry:

* **When you remove a filter, measure what it was holding back as well as what
  it was costing.** Both halves, before shipping, not after somebody asks.
* **A biased sample reads as a rate.** My one-in-five came from reading verbs I
  had already flagged as suspicious. That is not a sample of the population, it
  is a sample of my suspicions, and quoting it as a rate would have been wrong
  in exactly the direction that justified more work.

And one about the check itself: my first version of the defect detector flagged
36 glosses for ending on a connector, and 35 of them were correct — « sentir »
is "to smell of, taste of", « rentrer » is "to bring in, to get in". A detector
with a 97% false-positive rate reported 4.8% and the real figure was 1.4%.
**A measurement is only as honest as its worst check**, and the way to find out
is to read what it flagged rather than the number it produced.


### 2026-10-03 — a pull request whose base is not main can report success and deliver nothing

PR #27 was stacked on PR #26's branch to save a rebuild. The sequence:

```
08:3x   #26  fix/sense-budget      -> main          MERGED
08:40   #27  fix/alternates-guards -> fix/sense-budget   MERGED
```

The second merge is into a branch that had already been merged and was no
longer going anywhere. GitHub reported #27 as `MERGED`, which is true, and its
commit reached `main` never. Both of us believed it had landed; the user said
"#26 and #27 merged" and I agreed.

**Every signal said success.** CI green on #27. The merge UI said merged. The
branch was deleted. `git log` on the branch showed the commit. The only place
the truth was visible was `git log main`, which neither of us read, because
there was no reason to doubt a merge.

It surfaced a day later for an unrelated reason: Shahin asked for a list to be
printed again, and five glosses in the output still read the way they had read
before his corrections. **The defect was found by reading the product, not by
any check** — and what was missing included the corrections themselves and the
test file meant to guard them.

The general shape: **a success signal that reports on the wrong object.** #27's
"merged" was accurate about #27 and said nothing about `main`. The same family
as a comment claiming a size it no longer has, or a build printing "0 withheld"
from an emptied set — the reading is correct and the thing it refers to is not
what the reader thinks.

What now stops it: do not stack. Branch from `main`, rebase when `main` moves.
The saving was one rebuild of a 4 MiB content directory; the cost was a day of
`main` quietly missing a teacher's corrections.

And the generally useful habit, which would have caught it in ten seconds:
**after a merge, verify on `main`, not on the branch.** `git log --oneline -5
main` names the pull requests that actually landed.


### 2026-10-03 — a check that restates a number goes stale exactly like a comment

Three verbs left the product today, so 2,392 became 2,389. The browser walk had
this in it:

```js
ok('the page states the total',
   /2392|2,392/.test(await page.locator('[data-testid="verb-count"]').innerText()));
```

**A correct product would have failed that assertion.** The page would have
said 2,389, which is right, and the check would have called it a regression.

The lesson already written about a stale comment — the verb index saying "26
KiB gzipped" when it measured 71 — treated comments as the vulnerable thing and
checks as the defence. They are the same thing. A literal in an assertion is a
claim about the world written down at one moment, and the only difference is
that a wrong comment misleads a reader while a wrong assertion blocks a
correct change and sends somebody looking for a defect that is not there.

The walk now reads the number instead of restating it:

```js
const shippedVerbs = await page.evaluate(async () =>
  (await (await fetch('./content/verbs-index.json')).json()).verbs.length);
ok(`the total shown is the number actually shipped (${shippedVerbs})`, ...);
```

That is a weaker assertion — it no longer notices if the content itself loses a
thousand verbs — and a separate check already covers that (`tests/verbs.test.js`
requires at least 2,000). **Each check should assert one thing against a source
of truth, not restate a fact two sources already agree on.**

The general rule, which also covers the index-size guard that says `< 90 KiB`
rather than `=== 82.5`: **a check may assert a bound, a relationship or an
invariant. It should not assert a current value, because a current value is
news and not a rule.**


### 2026-10-03 — sorting a set is not sorting, and the guard that caught it was watching a document

Levels moved from a frequency sum to a spoken/written split. The new code built
its candidate list like this:

```python
lemmas = set(spoken) | set(written)
pool = sorted(lemmas, key=lambda l: -total[l])[:2400]
```

Thousands of verbs share a frequency, the key is a float, and ties therefore
fell out in the iteration order of a **set** — which Python randomises per
process. **Two builds from identical inputs produced different content.** Every
rebuild made a diff in 4.5 MiB of JSON, and the level of any verb tied with
another was whatever that run happened to decide.

The code it replaced was deterministic by accident: it sorted a `dict`, whose
order is insertion order, which follows the order of rows in the TSV. Replacing
a dict with a set looked like a clarification.

**What caught it was a staleness check written for documents.** The review
sheets are generated from the content, and `tests/review-sheets.test.js` asserts
every verb they name sits at the level they claim. After a rebuild that changed
no input, three sheets failed. I had rebuilt only to pick up a new field.

Two things worth keeping:

* **A sort whose key can tie is not an ordering until the tie is broken.** Every
  sort in that file now ends `, l)`, and a check reads the source and fails on
  one that does not — because the property is invisible in a single run. One
  build cannot tell you it was arbitrary; only two can, and nothing runs two.
* **A guard aimed at one thing can be the only witness to another.** The
  staleness check exists because a teacher ruling on a stale sheet rules on
  nothing. It found a content bug instead, by being the only thing in the
  project that compared two derived artefacts to each other rather than each to
  its own expectations.

And the fourth pattern-matching mistake of the week, in the check for this very
fault: I read the sort keys with `key=lambda l: ([^)]*)\)`, which stops at the
first `)` — the one inside `get(l, 0.0)` — so a correctly tied sort read as
untied and the check accused working code. [[2026-10-03 — a count you cannot
predict in advance cannot catch anything]] has the same shape from the other
side. **When an assertion accuses the data, suspect the assertion first.**


### 2026-10-04 — a check that cries wolf gets ignored, and the real alarm goes with it

Five checks of mine in one week accused data that was correct:

| the check | what it got wrong |
|:--|:--|
| counting senses by splitting on `"; "` | one Wiktionary sense contains semicolons — twice, having learned it once |
| `checkAnswer(alternate, form)` | the third argument was missing, so rejection was the function working |
| `/\bsuicide$/` | matched "to commit suicide", the correct gloss |
| `key=lambda l: ([^)]*)\)` | stopped at the `)` inside `get(l, 0.0)`, so a tied sort read as untied |
| a pace check using marks as items | 25 marks on a DELF reading paper is four exercises, not 25 questions |
| `/not been verified/` | the text it checked says "none **has** been verified" |
| a positional line comparison | an inserted line shifts every line after it; one added `note` reported 323 differences |
| `git diff` in the applier test | compared the file to **HEAD**, so every uncommitted change counted as the applier's work: 936 lines for a four-line write |

**Running total: nine distinct faults, eleven occurrences** — and at ten, the pattern is above, in "am I comparing the right two things?". Nine of the ten compared the wrong two things; one was a wrong idea about the data. — the semicolon split
happened twice, having been learned once. Shahin's standing instruction: when
this table reaches ten, stop and look at what they have in common, because by
then it is a pattern about how the checks are written and not about any one of
them.

Each was found within minutes, each was my error, and none reached `main`. The
cost is not the minutes. **Shahin's reason is the one that matters: a check that
cries wolf gets ignored, and then the real alarm gets ignored with it.** A suite
where failures are usually the suite's fault trains everybody to read `not ok`
as noise — and the failure that found the TCF pace defect looked exactly like
the five that found nothing.

**The rule: run every new check against the whole existing corpus before it
lands, and adjudicate every accusation it raises.** A check that has never been
run against known-good data is not finished — it is a hypothesis with a test
runner attached.

Adjudication has exactly three outcomes, and naming which one applies is the
work:

1. **The data is wrong.** Fix the data. This is the outcome everybody expects
   and, this week, the rarest.
2. **The check is wrong.** Fix the check. All five above.
3. **The check is right and the data is a legitimate exception.** The exception
   goes into the DATA as an explicit field — never into the check as a loosened
   rule.

The third is the one that needs discipline. Adding three listed-only TCF
variants fired six existing guards demanding a body link, four skills and real
CEFR levels. Every one of those guards was right about an exam the portal offers
preparation for. The temptation was to make them skip exams without resources,
which would have let a real exam ship with no writing material and no
complaint. Instead a `preparationOffered` field went into the data and the
guards were scoped to it: the distinction became a fact about the exam rather
than a hole in the rule.

See also [[suspect-the-assertion-first]] — the same point at the moment a single
failure appears, where this entry is about the habit that prevents the pile.


### 2026-10-04 — drafting is minutes; the review that makes it safe to teach is the cost

One B2 grammar concept was costed properly, on Shahin's instruction, to replace
two people guessing. Eight multiple-choice items on
`gram.subjunctive.vs-indicative`, written to the standard that nothing false is
taught: four subjunctive answers and four indicative so the set is not
guessable, each explanation naming why every distractor is wrong, in three
languages.

**My wall clock: 291 seconds.** That number is worthless, and the four reasons
are the finding:

1. **The French was not verified** against a reference grammar or a native
   speaker. Eight grammatical claims, written from a machine's own knowledge.
   One — `après que` taking the indicative — is prescriptively right and widely
   violated in speech, and I hedged it in the explanation. **Nobody has checked
   the other seven.**
2. **The Persian is mine and unreviewed.**
3. **There is no Arabic at all**, in these or in any of the 36 exercises in the
   product, against a four-language claim.
4. **I chose eight distinctions I already knew cleanly.** The next 142 include
   cases where the right answer is contested, and those are the expensive ones.

**So: 15–25 hours of teacher review for 150 items** — six to ten minutes each to
check the French, the distractors and the explanation — on top of drafting that
takes an afternoon.

**This is the sentence that should have governed the verb work.** 2,389 verbs
were conjugated, validated against two corpora, glossed, sharded and shipped,
and **nine of their 2,375 meanings have been read by a human.** The drafting was
cheap and done; the review was expensive and skipped, and the project called the
result finished. 99.8% of every exercise in the product is a verb form, which is
the same fact from the other end: we built what was cheap to build.

The general rule: **when estimating generated content, estimate the review, not
the generation.** The generation is the part you can see happening and the part
that feels like progress. The review is the part that decides whether what you
made is true.

And the corollary, which is Shahin's: **draft in batches of twenty, not a
hundred and fifty.** If the first batch shows a systematic fault in how the
items are written, it is found after twenty. The verb work found its systematic
faults — the suffix bug, the sense-order fault, the missing pronominal field —
after two thousand.


### 2026-10-04 — the tool wrote that a person had reviewed something they had never seen

Building the content review tool, I applied a test decision to check the
round trip. It worked. `content/exam-papers.json` then said:

```json
"review": { "state": "approved", "by": "Shahin Amani",
            "at": "2026-10-04T12:00:00.000Z" }
```

for two items he had never opened.

**In the one project whose central claim is that it says what has and has not
been checked.** Every gloss carries an unreviewed marker, the exercises had just
been given one that morning, the handoff opens with a warning that nobody has
verified its own contents — and the first thing the review tool did was forge a
review.

It was reverted within the minute, by me noticing, which is the part that is not
good enough. So:

* `tests/apply-review.test.js` asserts that **nobody is recorded as having
  reviewed anything**, and that `data/review-decisions.json` is empty. When that
  fails because a review has happened, the reviewer gets named in the check.
* Every other test that plants a decision restores both files in a `finally`,
  so a test cannot leave a verdict behind. `web/e2e/review-tool.mjs`, which
  drives the tool with a real keyboard, restores `data/review-decisions.json`
  in a `finally` for the same reason — after it ran, the file had 0 decisions
  and no item named a reviewer, which is checked rather than assumed.

**And Shahin found the same fault arriving by accident rather than by test.**
A reviewer pressing keys for two hours will mis-key, and a mistaken `A` records
an approval **with their name on it** against an item they did not read. The
`←` key returned to an item but could not change what was recorded for it. Now
it shows the recorded verdict and its note, `A`/`R`/`S` overwrite it, and `C`
clears it outright. A tool that can forge by accident is the same tool.

The general shape, which is not about review tools: **a tool that writes
attribution can forge attribution, and testing it writes real attribution into
real files — in the one project whose central claim is knowing what has been
checked.** The test fixture and the production record were the same file.
Anything that records who-did-what needs its test data kept somewhere the record
is not.

And the smaller lesson, costing nothing: the applier is Python because the file
is written by a Python serialiser. A Node round-trip would have reformatted all
2,400 lines and buried every review in a diff nobody could read. **One file, one
serialiser** — two is how two sources of truth begin.


### 2026-10-04 — flagging is blind to confident error

Three items in batch one are flagged `uncertain`, with the kind of doubt and why.
That system works, and it cannot see the thing that matters most.

`b1-agr-1` to `b1-agr-4` all rest on one claim: that a pronominal verb's
participle agrees when the reflexive pronoun is the direct object and not when
it is indirect. **If « se parler » and « se rencontrer » are the wrong way
round, all four items are wrong together — and not one of them carries a flag,
because I am not unsure. I am confident.**

Shahin's framing: **confidence is exactly where the flagging system is blind.**
A flag records what the writer knows they do not know. The expensive failures
are the ones they do not know they do not know, and those arrive in groups,
because a writer with one wrong rule writes several items from it.

So every drafted item now records the single rule it rests on, and the review
tool reads them: **rejecting an item offers every other item resting on the same
rule immediately.** Rejecting `b1-agr-2` jumps to `b1-agr-3`, not to the next
item in paper order, and the banner names what else is affected — including
items outside the current batch.

Three rules in 28 items carry more than one item: the agreement rule carries
four, « on » for an unknown agent carries three, negative word order carries
two. **Those three rules are where a correlated failure lives**, and naming them
turns one wrong rule into one review session rather than three discoveries
months apart.

The general shape: **a flag is a confession, and confessions are selective.**
Where work rests on shared premises, record the premises — not because the
writer doubts them, but because the reader will one day disprove one and need to
know what else falls with it. The verb work had no such record: when the
suffix-matching bug was found, eleven verbs were wrong and finding the eleventh
took a separate search each time.


### 2026-10-06 — a distractor the spelling fold cannot tell from the answer

Batch two of the structure items tested the circumflex. « Nous dansâmes » had
« dansames » as the wrong option, and « il fut » had « fût ». Both pairs are
real distinctions in French spelling. Both failed `tests/alternates.test.js`,
which asks whether a distractor is the answer once accents are folded.

The fold exists so a learner who types « espèrerai » for « espérerai » is not
marked wrong. Applied to a multiple-choice paper it says the opposite thing
with the same mechanism: two options the fold cannot separate are one option,
and marking one of them wrong punishes a difference the rest of the product
accepts. The circumflex is exactly such a difference. The items were rewritten
to « dansèrent » and « furent », which the fold can tell apart, and the
circumflex pairs are not offered.

The rule, which is the same shape as comparing the wrong two things: before
writing a wrong option, run it through the function that decides what counts as
the same word. A distinction the folder deletes is not a distinction an exam
can mark.


## The checklist

### #1 — A suite that prints FAIL and exits 0

The browser walk printed failures and returned success, so CI (and I) read it as
green. A check that cannot fail the build is decoration.

**Rule:** every suite exits non-zero on any failure, **and** exits non-zero when
zero checks ran. Prove both by planting a failure.

### #2 — A check that passes on an empty input

`check-links.sh` extracted URLs, got none, checked all zero of them and reported
success. `contrast-check.mjs` had the same shape until it was given an explicit
`exit 2` for "no checks ran".

**Rule:** "nothing to check" is a failure, not a pass.

### #3 — A pipeline whose exit status is not the one you care about

`git log … | grep …` — if `git` fails, the stream is empty, `grep` finds
nothing, and the scan reports "clean" without having read anything. Same family:
`grep … | head -3 || echo ABSENT`, where `head` always succeeds so the `||`
branch is unreachable, and `git diff --stat` (exits 0 regardless) used where
`git diff --quiet` was meant.

**Rule:** in any pipeline, ask which command's exit status you are reading. If
it is not the one that matters, dump to a file first, assert the file is
plausible, then check it. Use `set -o pipefail` where a shell allows it.

*This one recurs. It is the most common of the family.*

### #4 — An assertion that cannot match what the browser produces

The `prefers-reduced-motion` check compared a computed duration as a **string**
against `/^0\.0001s|0s/`. The CSS sets `0.01ms`, which computes to `0.00001s` —
a string that pattern can never match. It reported the CSS as broken while the
CSS was correct, which is the same fault wearing the opposite face.

**Rule:** parse values into a comparable type. Never regex a computed style.

### #5 — An assertion the broken state also satisfies

The timer check asserted the pill matched `/\d:\d\d/`. The **un-adopted
default** is `15:00`, which matches — so it passed while the pill and the
session were showing different times.

**Rule:** before trusting a check, ask what the *broken* state looks like and
confirm the assertion excludes it. Where there is a control arm to be had, take
it: the reduced-motion check now measures with the preference **off** as well,
because "nothing moves" proves nothing if nothing moved to begin with.

### #6 — When a test passes, confirm it is looking at the thing it names

**Named by Shahin, 2026-10-01.**

The conjugation tests used `?verb=etre`. The infinitive is `être`. The drill was
rendering its **not-found** state, and the assertions passed against it. Worse,
the axe accessibility scan carried the same wrong URL in its screen list — so an
entire screen was being scanned under the name "Conjugation", and it was the
wrong screen.

Fixing the URL immediately surfaced a real, serious defect the wrong URL had
been hiding: the drill's progress bar had no accessible name.

**Rule:** a passing check must assert something only the *named* screen could
satisfy — a heading, a control, a piece of its content. "The page rendered" is
not evidence that the right page rendered. Applies doubly to any list of routes
fed to a scanner, where a typo silently substitutes one screen for another.

**Same family as #3:** in both, the thing reporting success was not looking at
the thing under test.

**Swept the whole suite for this shape, 2026-10-01, and it was systemic.**
**Every single import in `tests/` pointed at `app/`, the vanilla portal, and
none at `web/`, which is what a learner loads.** Forty-two of ninety-seven tests
exercised code that is not in the build — including twelve for a hand-written
FSRS implementation that `ts-fsrs` replaced in step 4, and twelve for a timer
the React app does not use. `typography.test.js` did read the right file, but as
**text**: it asserted the source *mentions* guillemets and an apostrophe, which
a completely broken formatter also satisfies (#5).

Node 22 strips TypeScript types, so the tests now import the real modules and
call the real functions, through a resolver hook that only ever appends `.ts` to
a relative specifier (Vite allows extensionless imports; Node does not — that
friction is part of why this drifted).

**The first run of those tests found a real bug in shipped code.** The
typographic-apostrophe rule was `/(\w)'(\w)/g`, and `\w` is `[A-Za-z0-9_]`,
which does not match an accented letter. So the rule failed on precisely the
French it exists for: `l'élève`, `l'école`, `d'être`, `j'étais` all kept their
prime, while `qu'il` was corrected. 22 strings in shipped content were affected.
Fixed with `/(\p{L})'(\p{L})/gu`, and every one of the 22 now renders correctly.

That bug survived a test file dedicated to French typography, because the file
read the source instead of running it.

### #7 — An ASCII character class in a product about an accented language

**Named after the `\w` bug, swept deliberately 2026-10-01.**

`\w`, `\b`, `[a-z]` and `[A-Za-z]` all silently exclude `é à ç ê œ`. In a
French product that is not a style question — it is a correctness class. The
apostrophe bug was found by accident; the rest were found on purpose, by running
every candidate site against accented and ligatured input rather than reading it.

| Site | Accented input | Verdict |
|---|---|---|
| `fold`/`norm` in search, verb filter, answer checking | `être`, `ÊTRE`, `etre` | ✅ folded symmetrically |
| the same, with `œ`/`æ` | `soeur` vs `sœur` | ❌ **broken** — NFD does not decompose a ligature |
| number grouping `/\b(\d{1,3})…/` | `été 1240` | ✅ digits only; accents nearby are irrelevant |
| spacing rules `;!?:«»` | `Écoute !`, `« cœur »` | ✅ punctuation classes, not letter classes |
| CEFR level `.toLowerCase()`, `[abc][12]` | `B1` | ✅ ASCII by definition |
| example-sentence highlighting | all 44 sentences | ⚠️ passes today, by exact accent match only |
| locale tag parsing, key handlers, numeric sorts | — | ✅ no letters involved |

**The second real bug: `checkAnswer('soeur', 'sœur')` returned WRONG.** `œ` and
`æ` are letters, not letter-plus-accent, so `normalize('NFD')` leaves them
alone. A learner on a keyboard with no `œ` key was marked wrong for spelling
`sœur` the only way they could — and `docs/04` specifies an accent bar for
exactly this, which is not built. `cœur, sœur, œuf, œil, bœuf, vœu, nœud` are
ordinary words.

Three near-copies of the folding function had drifted apart; there is now one,
`web/src/lib/fold.ts`, which expands ligatures before decomposing. The
highlighter no longer depends on an exact accent match either.

**Rule:** in this codebase, a character class that touches learner or content
text uses `\p{L}` with the `u` flag, or folds through `fold()`. Any such site
needs a test containing a real accented word and a real ligature.

### #8 — A default that writes into permanent public history

**2026-10-01. The most expensive lesson on this project, and the cheapest to have prevented.**

A tool-attribution trailer was appended to commit messages by default. Nobody
chose it; it simply arrived. It reached a public repository, where the
Contributors panel then listed a second name on Shahin's own project.

The removal is where it got expensive:

1. **Rewriting the messages** took a `filter-repo` pass over every branch. That
   part worked — author names, emails and author dates all preserved, every tree
   hash identical.
2. **The rewrite closed the pull request.** Force-pushing `main`, a PR's *base*
   branch, auto-closes it, and GitHub then **refuses to reopen** a PR whose head
   was force-pushed. The page, its description and its history were gone for good.
3. **The pull-request ref kept the commit alive anyway.** `refs/pull/1/head`
   still pointed into the pre-rewrite history, and the trailered commit was its
   ancestor. **GitHub keeps `refs/pull/*` permanently and offers no way to delete
   them.** No rewrite, no branch deletion, no gc could reach it.
4. **So the repository had to be deleted and rebuilt.** A settings snapshot, a
   verified bundle, a hard stop for authorisation, a fresh repository, both
   branches pushed by name, and ten verification checks — to remove one line that
   was never wanted.

**What it cost:** a rebuild, a lost pull request, and a session spent on it.
**What prevention would have cost:** not adding the line.

**Settled 2026-10-01, and not to be re-opened: the address in `c279308` stays.**

The pre-push sweep caught an email address in a tracked file — `docs/99-handoff.md`
reintroduced one that commit `069185d` had removed. The address was taken out of
the working tree, and the commit that already carries it was **deliberately left
alone.** Shahin's reasoning, recorded here so nobody re-derives it:

- The address is in the **author field of every commit** on this repository
  already. That is where it belongs and it is not removable without rewriting
  every commit. Stripping it from one document changes nothing real.
- Rewriting history on a pull request's **base** branch closed the last pull
  request permanently, and `refs/pull/*` kept the old commit reachable anyway.
  The cure cost a repository rebuild. The disease here is one line of prose.

**The distinction that makes this consistent rather than an exception:** a
*credential* is removed whatever it costs, because it is live and abusable. A
*published author address* is already public by the design of git, so the
rewrite buys nothing and the PR is a real loss. The sweep stays exactly as it
is — it was right to stop the push, and this is the judgement that follows it,
not a reason to loosen it.

**Rules, now enforced rather than remembered:**

- No attribution trailer, no "generated with" line, no robot emoji, in any commit
  message, pull-request description, README, changelog or file. Every commit is
  authored by Shahin Amani and nothing else — the address lives in commit
  metadata, where it belongs, and nowhere a scraper reads.
- `scripts/check-commit-messages.sh` runs in the required `test` job and fails on
  any of those patterns in any commit message across `--all`.
- It scans **messages, not files**, so this page may name the episode. There is a
  test asserting exactly that distinction, because a check that also flagged
  documentation would be turned off within a week.
- **The detector is seen red on every run, not once.** A single historic red run
  would have proved it worked one time — and would have left the offending commit
  in the history forever, which is the harm itself. Instead
  `tests/commit-attribution.test.js` builds a throwaway repository, plants each
  offending form in turn, and asserts the script exits 1: six forms, plus the
  empty-history case exiting 2 rather than passing, plus the documentation case
  passing.

**The general shape.** A default that writes into an append-only public record is
not a small default. Before accepting one, ask what removing it would cost — and
whether the platform will even let you.

### #9 — A guard on the key, with nothing on what the reader sees

**2026-10-01, found while merging the C1/C2 draft.**

`tests/concept-ids-permanent.test.js` checks that ids are unique, well formed,
parented and never renamed. Every one of those passed on the C1/C2 draft. Four
of its entries were still duplicates of concepts already live:

| Draft id | Already existed as | Both named |
|---|---|---|
| `gram.subjunctive.passe` | `gram.subjunctive.past` (B2) | « Le subjonctif passé » — *and* "The past subjunctive" |
| `gram.reported.concordance` | `gram.reported.tense-shift` (B1) | « La concordance des temps » |
| `gram.expression.mise-en-relief` | `gram.expression.emphasis` (B2) | « La mise en relief » |
| `gram.article.absence` | `gram.article.omission` (B1) | « L’absence d’article » |

The ids were distinct, so the uniqueness check was satisfied. The **names** were
character-for-character identical, which is the only part a learner ever sees.

This mattered more than an ordinary duplicate. Ids are permanent by design, so
merging would not have been correctable by deletion — each pair would have
needed a retirement, and any learner who had reviewed against the wrong half
would have had their record split across two ids for one piece of French.

The check that now exists compares names the way a reader does — case, accents
and apostrophes folded — in **both** languages separately. Its first run found a
fifth collision that had been live since the taxonomy was written: the group
`phon.elision` and its child `phon.elision.basic` were **both** « L’élision », so
a French-interface learner saw a heading nested inside itself. The English names
differed, which is exactly why nobody noticed.

**Rule:** a uniqueness guard on an internal key is not a uniqueness guard. Check
the field the user reads, in every language it is read in — a collision can exist
in one language and not another, and the one you do not speak is the one that
survives.

**Same family as #6:** the check was looking at something adjacent to the thing
under test, and passing on it.

### #10 — The alphabet was an assumption, and nobody declared it

**2026-10-01. Found while pointing the guards at the two languages nobody here reads.**

#7 was written up as a lesson about `\w`. That was too small. The real lesson is
that **every character class encodes a belief about which alphabet the text is
written in, and that belief is almost never stated.** `\w` excludes `é`; it also
excludes the whole of Arabic and Persian, and nothing in the code says so.

The proof arrived within a day. `concept-names-distinct.test.js` — written the
same day #7 was written up, by someone who had just written it up — ended with
`.replace(/[^a-z0-9']+/g, ' ')`:

```
foldLabel('العربية') -> ''      foldLabel('فارسی') -> ''
```

Every Arabic and Persian string folds to the empty string. Pointed at four
languages unchanged, that guard would have reported every Arabic label as
colliding with every other Arabic label, produced a wall of nonsense, and been
switched off inside a week — leaving the two languages least able to be reviewed
by eye with no guard at all.

This is why the class matters more than the instance. Fixing `\w` fixed one
regex. The belief behind it — *text is Latin unless something says otherwise* —
survived the fix and reappeared immediately in new code.

What a fold for this product actually has to do, none of which NFD or NFC does:

| | |
|---|---|
| ZWNJ U+200C | the Persian half-space. **Invisible.** `می‌رود` and `میرود` differ by one codepoint |
| ك U+0643 / ي U+064A | Arabic kaf and yeh against Persian ک U+06A9 and ی U+06CC — near-identical glyphs |
| ـ U+0640 | tatweel: decoration, no meaning — *except* where it carries a prefix onto a Latin word |
| harakat | combining marks, optional, and stripped by the same rule as the French accents |
| ٠١٢ / ۰۱۲ | Arabic-Indic and extended Arabic-Indic digits are the same digits as `012` |

**Rule:** a character class, a fold or a comparison that touches learner-facing
text must be demonstrated against a real string in **every** script the product
ships, in the test, visibly. Not asserted — run. And where a language cannot be
reviewed by eye here, what is legitimate in it is written down with a reason:
the tatweel in `لـFrance` is **correct** Arabic typography, and a non-reader
"tidying" it away would be introducing the defect, not removing it.

### #11 — A checker that cannot parse the shape the defect lives in

**2026-10-01. Found one layer under #10, and it is a different fault.**

The i18n parity and placeholder checks read values with
`/(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'/g` — single-quoted values only. Thirteen
French strings are written with double quotes. The checks never saw them.

What makes this its own lesson rather than another instance of #3 is **why**
those thirteen are double-quoted:

> They contain an apostrophe.

So the reader was blind to exactly the strings most likely to carry an
apostrophe fault — not by coincidence, but by the same cause. The quoting style
*is* the signal that the value contains the character under test. The hole in
the checker was cut in the precise shape of the problem.

**And the defect was in there.** Ten of the thirteen carried a straight prime:
`Aujourd'hui`, `S'entraîner`, `Minuteur d'étude`, `Langue de l'interface`,
`Outil d'étude indépendant`. `fr()` in `typography.ts` is applied to content —
concept names, verb forms, exam text — and **never to `t()` output**, so the
French interface had been rendering primes since the day it was written. Behind
a test file named for i18n parity, which was passing.

The giveaway was sitting in plain sight and nothing was reading it: `fr=147`
where `en=fa=ar=160`. Nobody compared the counts.

**Rules:**

- A reader must report what it read, and the counts must be compared. Four
  dictionaries now have to yield the same number of values, with a floor.
  A reader that silently returns a subset is #3 with better manners.
- When writing a checker, ask what the defective input *looks like* — and
  confirm the parser accepts that form. If values containing `X` are written
  differently from values that do not, a checker for `X` must parse both, and
  that is the first thing to test.

### #12 — A type that could not express the defect, so the compiler endorsed it

**2026-10-01. Found by looking at a Persian screenshot, which is not a method.**

`VerbTense.name` was declared `Record<'en' | 'fr', string>` and `Concept.name`
the same. `content/verbs.json` carries `حال ساده` and `المضارع` for every tense.
The type had no place to put them, so eighteen call sites wrote
`ui === 'fr' ? name.fr : name.en` — and **every one of those is type-correct**.
`tsc` passed. 184 unit tests passed. The RTL walk passed 856 checks, because
direction, overflow and isolation were all genuinely right: the text was
correctly laid out, and in the wrong language.

Three guards were adjacent to this and none of them could see it:

- **i18n parity** checks the 169 interface strings. A content name is not a key.
- **`concept-names-distinct`** checks that two concepts do not read alike — in
  `en` and `fr` only, the two languages that were never the problem.
- **the RTL walk** rendered ten screens, and **not one of them displayed a
  content name**: search shows nothing without a query, and the concept page was
  not in the list at all. The screens where the defect lived were the screens
  nobody walked.

**What makes it its own lesson rather than another #9:** in #9 the guard was
pointed at the wrong field. Here the *type* said the wrong field was the only
field there was. A guard can be added to a codebase; a type is agreed with the
compiler, and once agreed it reports every instance of the defect as correct.

**And the giveaway was in the data the whole time.** `name.fa` existed in
`content/verbs.json`, unreferenced, for as long as the type had excluded it.
Nothing compared what the content file offered against what the type admitted.

**Rules:**

- A field that holds learner-facing text is typed `Partial<Record<Locale, string>>`
  — every language the product ships — and is read through `pick()`, which
  reports whether what it returned is the learner's language. A two-language
  branch over a content field is now a test failure
  (`tests/content-names-localised.test.js`), with the detector run against a
  planted sample on every run.
- **A screen that renders a content name must be in the browser walk.** A walk
  whose screen list omits the screens where a class of defect lives is #6 at the
  level of the suite rather than the assertion.
- Where a language is not translated yet, say so on the page. The honest state
  is cheap and ships today; the translation arrives per level, counted in a
  ledger asserted with `deepEqual`, so finishing a level and forgetting the
  ledger fails too.

### #13 — A job that only runs on the branch it is never exercised on

**2026-10-01, the moment pull request #1 merged.**

`ci.yml` and `pages.yml` both have a job that runs the unit suite. They had
drifted: `ci.yml` runs

```
node --import ./tests/register.mjs --test tests/*.test.js
```

and `pages.yml` ran the same command **without the resolver hook**, which is what
lets Node resolve a relative import of a `.ts` module. Every test that imports one
dies on load.

It had been wrong since the suite was pointed at `web/`. Nobody saw it, because
`pages.yml` triggers on **push to `main`** only, and every commit for that whole
period lived on a feature branch. The resolver reached `main` for the first time
with the merge — so the job failed the first time it was ever genuinely
exercised, and took the Pages deploy down with it. The site did not publish.

**The shape:** a check whose trigger excludes the place the work happens is not
a check that passes. It is a check with no result at all, and an empty result
reads exactly like a green one in a branch-protection UI that is only watching
two other names.

**Second fault, found at the same moment and cheaper to fix than to explain
later:** both workflows had a job called `test`, and the ruleset requires a
status check called `test`. Two different runs were reporting under one name.
Renamed to `pages-test`.

**Rules:**

- A workflow that runs on `main` only is unverified until something merges. If
  it runs a command, that command is also run somewhere the work actually
  happens — or the two commands are one command in one place.
- When two workflows run "the same" suite, they drift. Diff them deliberately, or
  make one call the other.
- A required status-check name belongs to exactly one job. Two jobs sharing it
  makes the branch's reported state depend on which run lands last.

### #14 — A required status check identifies by NAME, and nothing else

**2026-10-01, found beside #13 and the more serious of the two.**

The ruleset protecting `main` requires status checks called `test` and
`browser`. Read back from the API, the requirement is:

```
context='test'      integration_id=None
context='browser'   integration_id=None
```

**`integration_id=None` means the requirement matches on the name alone** —
nothing binds it to a workflow, a job, or even to GitHub Actions. Both `ci.yml`
and `pages.yml` had a job called `test`. The merge of pull request #1 produced
exactly this on `main`:

```
name=test      conclusion=success    .../runs/36866704090   (ci.yml)
name=test      conclusion=failure    .../runs/36866703259   (pages.yml)
name=browser   conclusion=success    .../runs/36866704090
name=deploy    conclusion=skipped    .../runs/36866703259
```

Two check runs, one name, opposite conclusions, on one commit. Which one the
branch *appears* to satisfy is a question about ordering, not about whether the
tests passed.

**Why this is worse than a naming collision.** Branch protection is read as a
guarantee: nothing merges unless `test` passed. What it actually says is
*something called `test` passed.* A second workflow — added later, by anyone,
for any purpose — can satisfy or break that requirement without touching the
suite it is supposed to guard. The protection is weaker than it reads, and it
reads as absolute.

**Rules:**

- A required status-check name belongs to **exactly one job in exactly one
  workflow**. Before adding a job, check the name is not already required or
  already produced elsewhere.
- Verify protection by listing what a commit actually reported, not by reading
  the ruleset: `gh api repos/<owner>/<repo>/commits/<ref>/check-runs`. Two rows
  with one name is the defect, and it is invisible in the ruleset itself.
- A rule that matches on a string is only as strong as the uniqueness of that
  string, and nothing in the platform enforces that uniqueness for you.

**Enforced, not remembered:** `tests/workflow-check-names.test.js` parses every
active workflow, fails on two jobs publishing one check name, and fails when a
required check is produced by none or by more than one job. It also refuses a
workflow "disabled" by a filename that still ends in `.yml`. Seen red on the
exact state `main` was in: `pages.yml` re-enabled with its job called `test`
fails two assertions.

### #15 — A test that depended on the shape of the checkout, not on the repository

**2026-10-01, and it was mine, written the same day as #13 and #14.**

The handoff guard asserts that the CI block names a commit in this history:

```js
execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'])
```

`actions/checkout` fetches **depth 1** by default. `ci.yml` sets
`fetch-depth: 0` — it has to, because the history secret scan would otherwise
read one commit and report clean. `pages.yml` did not. So the same suite gave
two different answers depending on which workflow ran it, and the assertion
failed in the workflow whose checkout was ordinary.

It surfaced the moment #2 merged and the Pages test job ran for the first time
in a fixed state. **I had predicted that job would fail at
`actions/configure-pages`. It failed earlier, on my own test**, which is the
more useful outcome: the prediction was about the thing I had been looking at,
and the fault was in the thing I had just written.

**The shape:** an assertion about *the repository* that is really an assertion
about *the clone*. Depth, filters, `--single-branch`, a missing tag fetch and a
detached HEAD all produce this, and all of them look like the test being wrong
about the content rather than absent from it.

**Rules:**

- A check that reads history states its requirement. Here: the test detects a
  shallow clone with `git rev-parse --is-shallow-repository` and **skips with a
  reason**, reported as a skip and never as a pass (#2), with the shallowness
  verified so it cannot be used to dodge the check in a full clone.
- And the requirement is enforced where it belongs:
  `tests/workflow-check-names.test.js` fails any active job that runs the suite
  without `fetch-depth: 0`. Seen red by removing it from `ci.yml`.
- When two workflows run "the same" suite, the difference that bites is rarely
  the command. It is the environment around it — #13 said diff them
  deliberately, and this is what that costs when you do not.

**[extended 2026-10-01]** The first version of the guard required
`fetch-depth: 0` of *any job running the unit suite*, which left the `browser`
job on a depth-1 checkout: nothing in the walk reads history **today**. That is
the same sentence as "nothing currently breaks", which is how the Pages job
survived until the first day it mattered. The guard now covers any job running
any part of the suite — unit tests, the browser walk, the RTL walk, the contrast
check, the attribution scan, the sweep — and it **prints the jobs it matched**,
because a count that is obviously wrong is visible and a green tick is not.
That printout immediately earned itself: a planted failure silently failed to
apply, the guard reported green, and only the list of matched jobs showed the
plant had never taken effect.

### #16 — A suffix match is a proxy for a family, and a name match is a proxy for a topic

**2026-10-01. Four instances in one day, in three different domains, and they
are the same fault.**

A cheap string test stands in for a real relationship, and it is right often
enough that nobody checks it.

**In morphology.** The conjugator picked a verb's family by longest matching
suffix. Eleven verbs took the wrong one:

| verb | ends in | became |
|---|---|---|
| `installer` | **aller** | « instvais » |
| `inscrire` | **rire** | participle « inscri » |
| `apercevoir` | **voir** | « apercevoyaient » |
| `répartir` | **partir** | « répars », when it is regular |

A suffix is where a family usually *shows*, not what a family *is*. `comprendre`
really is `prendre` with a prefix; `installer` is not `aller` with a prefix, and
nothing in the string says which.

**In a coverage measurement.** The Part 3 grammar map was scored by searching
concept names for keywords: 82% covered. Four were false. *accord du participe
passé suivi d'un infinitif* matched **Verb + infinitive**; *accord des verbes
impersonnels* matched **il faut**; *phrase, types et formes* matched **Les
phrases avec « si »**; *adjectifs régissant une préposition* matched the verb
prepositions. The real figure was 77%. A name match is a proxy for a topic being
covered, and a concept id is a proxy for anything being taught at all.

**In the checker itself, twice.** The participle check required the masculine
singular to be among the corpus forms — but for an essentially-pronominal verb
the corpus attests only « entraidés » or « dandinée », so four correct verbs
were reported wrong. And the Wiktionary harvester reported three SSL failures as
*three verbs with no conjugation page*: a transport fault disguised as a finding
about French.

**What they share.** In every case the thing reporting was adjacent to the thing
under test, and right often enough to be trusted. This is #6 and #9 again, and
naming it a third time is the point: it is not a bug that recurs, it is a
*method* that recurs, and the method is "use the cheap test and move on".

**Rules:**

- A string relationship is a hypothesis. Where a real relationship exists —
  morphological family, topic coverage, file identity — either encode it
  explicitly or verify the string test against something independent. The
  conjugator now has `EXACT_ONLY` and `NOT_IRREGULAR` lists, which are the
  explicit encoding of what a suffix could not say.
- **A measurement that can fail must report its own failure separately from its
  result.** "No conjugation page" and "the network broke" are different facts and
  must never share a return value.
- When a proxy is unavoidable, get a second, independent one. Lexique attests
  about 19 of a verb's 45 forms; Wiktionary carries the other 26. One source
  silent is a blind spot; two sources disagreeing is a finding.

### #17 — `typeof` is not safe on a property accessor that can throw

**2026-10-02. The guard meant to detect a condition was the thing that died on it.**

```js
if (typeof localStorage === 'undefined') return DEFAULTS;   // the guard
```

`typeof` is famously the safe operator: the one thing you may do to an
undeclared identifier without a ReferenceError. That is true of *identifiers*.
`localStorage` is not an identifier, it is a **property of `window` with a
getter**, and in a browser where site data is blocked that getter raises
`SecurityError`. So `typeof localStorage` does not return `'undefined'`. It
throws, from inside the line written to find out whether it would.

The result was not a degraded experience. It was a **blank page**, for exactly
the learner whose data is not going to persist — the one person who most needed
the application to work and to warn them.

**Two failure modes, and only one had ever been imagined.** In a private window
the methods throw and the accessor is fine; with site data blocked the accessor
itself throws and nothing inside it ever runs. Code that handles the first is
untouched by the second — and the first is the one everybody tests, because it
is the one you can reach by opening a private window.

**What found it.** Not a check. The privacy notice — a feature written to be
honest with a learner about where their progress lives — had to behave
correctly when storage was unavailable, and asking that question for the first
time walked straight into the crash. **A feature written to tell the truth
uncovered a fault nobody would have gone looking for.**

**Rules:**

- `typeof x` is safe for an undeclared identifier and for nothing else. Any
  property whose accessor can throw — `localStorage`, `sessionStorage`,
  `indexedDB`, a cross-origin `window.parent` — is read inside `try`, including
  when all you want is to know whether it exists.
- Probe a capability by *using* it and catching, not by asking whether it is
  there. `storageWorks()` sets a key and removes it, which answers the real
  question: not "does this exist" but "will this work".
- When a resource can be unavailable, enumerate the ways. "Blocked" is at least
  two different behaviours here, and handling either one alone reads exactly
  like handling both.

**Enforced:** `web/e2e/walk.mjs` drives the application under both modes on
every push — it renders, no uncaught error, the notice appears, dismisses, and
stays dismissed while moving around. Seen red against the pre-fix code: the
accessor mode fails three checks, and treating blocked storage as "already
seen" fails the notice check in both modes.

### #18 — The fix for matching too eagerly is not to match less

**2026-10-02. The correction to #16 rather than a repetition of it.**

#16 said a suffix match is a proxy for a morphological family, and it was right:
`installer` ends in `aller`, `inscrire` ends in `rire`, `apercevoir` ends in
`voir`, and each took a family it does not belong to. The obvious conclusion is
to distrust suffix matching and match less.

That conclusion is wrong, and following it leaves ninety-one verbs unconjugated.
`attendre` does not end in `rendre`. `paraître` does not end in `connaître`.
`conquérir` does not end in `acquérir`. Matching *less* does not help, because
the problem was never that the match was too broad — it was that the key was a
**representative verb** rather than the thing that actually identifies the
family.

Keyed on the ending itself — `-eindre`, `-aindre`, `-oindre`, `-uire`, `-aître`,
`-quérir` — the same mechanism that produced « instvais » covers eighty-four
verbs correctly, and the handful it would still catch wrongly are named in two
short lists: `EXACT_ONLY` for `aller`, which may only match itself, and
`NOT_IRREGULAR` for `répartir` and `assortir`, which end in `partir` and
`sortir` and are regular.

**The general shape.** When a cheap test is wrong, there are two repairs and
they look alike from a distance: weaken the test, or find the key that carries
the meaning. The first is always available and always loses coverage. The second
costs a morning and ends with the exceptions written down, which is where they
belonged in the first place.

**And the third option is to refuse.** Seven verbs are generated by nothing:
`clore` has no *nous* or *vous* in the present, `seoir` is third-person only,
`faillir` survives as « il a failli + infinitif ». A paradigm invented for them
would teach a learner forms no French speaker uses, which is the one failure
this product cannot have. Each is named with its reason, so none of them reads
as unfinished work.

---

## How these are caught

Not by care. By two habits:

1. **Break it on purpose.** Every check in this repository has, at some point,
   been shown to fail: the CSS deleted, a secret planted, an address planted, a
   component stashed and the build re-run. A check never seen red is a check
   never seen.
2. **Read the number, not the verdict.** `4 of 188 elements animate`,
   `218 elements × 2 themes`, `10 of 22 cards`, `1 session id`. A count that is
   obviously wrong is visible; a green tick is not.

---

## Instances found on this project

| # | Where | Reported | Was |
|---|---|---|---|
| 1 | `walk.mjs` | success | printed FAIL, exited 0 |
| 2 | `check-links.sh` | success | zero URLs extracted |
| 2 | `contrast-check.mjs` | success | no floor on checks run |
| 3 | CI secret scan | clean | `git log` piped into `grep` |
| 3 | my own `grep … \| head -3 \|\| echo` | — | `\|\|` branch unreachable |
| 3 | cherry-pick verification | applied | `git diff --stat` exits 0 regardless |
| 4 | reduced-motion check | FAIL | assertion could never match |
| 5 | timer pill check | PASS | `15:00` default satisfied it |
| 6 | conjugation + axe screen list | PASS | asserting against a not-found page |
| 6 | `content.test.js` i18n parity | PASS | read `app/i18n.js`; the app's own dictionary was 40 keys short in fa and ar |
| 6 | `fsrs.test.js`, `timer.test.js` | PASS | 24 tests against modules the product replaced or never used |
| 5 | `typography.test.js` | PASS | read the source for the word "apostrophe" instead of running the formatter |
| 7 | `answer.ts` / search / verb filter | PASS | `œ` and `æ` never folded; `checkAnswer('soeur','sœur')` was WRONG |
| 8 | commit messages | *no check existed* | a default trailer reached public history; cure was a repository rebuild |
| 9 | C1/C2 concept draft | *ids all unique* | four entries carried a name already live, where ids are permanent |
| 9 | `phon.elision` / `.basic` | PASS, since the taxonomy was written | identical French name, group and child; English names differed |
| 10 | `concept-names-distinct` fold | PASS | ASCII-only: every Arabic and Persian string folded to `""` |
| 11 | i18n parity + placeholder checks | PASS | single-quoted values only — blind to the 13 strings that hold an apostrophe |
| 11 | French interface strings | *no check existed* | 10 carried a straight prime; `fr()` is never applied to `t()` output |
| 11 | `fr=147` vs `en=fa=ar=160` | *in plain sight* | nothing compared the counts |
| 12 | `Concept.name`, `VerbTense.name` | `tsc` clean | typed `Record<'en' \| 'fr', string>`; 18 sites served English to fa and ar, and `name.fa` sat unread in `verbs.json` |
| 12 | the RTL walk's screen list | 856 checks, 0 failed | no screen in the list rendered a content name |
| 13 | `pages.yml` unit-test job | *never ran* | triggers on push to `main` only; broken since the resolver arrived, failed the first time it was exercised, and the site did not deploy |
| 14 | the `test` required check | *protection read as absolute* | matched by name only (`integration_id=None`); two workflows reported under it, success and failure on one commit |
| 15 | `handoff-and-push-safety` ancestry check | PASS in ci.yml | depth-1 checkout in pages.yml made the same assertion fail; it tested the clone, not the repository |
| 16 | conjugator family matching | 2,102 verbs "correct" | suffix match: installer→aller gave « instvais », inscrire→rire gave « inscri » |
| 16 | Part 3 coverage map | 82% covered | keyword match: « accord PP + infinitif » matched « Verb + infinitive ». Really 77% |
| 16 | participle check | 4 verbs wrong | demanded the masculine singular; the corpus holds only « entraidés » |
| 16 | Wiktionary harvester | "3 verbs have no page" | three SSL failures reported as a fact about French |
| 17 | `settings.ts` storage guard | — | `typeof localStorage` THREW when site data was blocked; a blank page for the learner whose data will not persist |
| 18 | conjugator family keys | 91 verbs unconjugated | the key was a representative verb, not the ending that identifies the family |
| 2 | `no-untranslated-strings.test.js` | *could not start* | `new URL(...).pathname` percent-encodes; a clone under a path with a space in it crashed the suite |

Two more that are not checks but the same instinct: `@theme {}` in `tokens.css`
meant **not one design token was ever defined**, and the page still looked like a
page — a visual review would have passed it. And `.gitignore` said
`node_modules/` with a trailing slash, which matches directories only, so a
`node_modules` **symlink** was not ignored and would have been committed into a
public repository.
