# The pronominal-only verbs — a teacher's review in progress

**48 verbs.** Started at 51 from Wiktionary's labels alone.

## Why this review matters more than the glosses

A wrong meaning teaches one wrong word. A wrong reflexive marking teaches a
wrong conjugation on **every row** of the table — which is the defect this list
exists because of: « souvenir » was shown as a bare infinitive with a table
reading « je souviens », six rows of non-French, on an A1 verb.

The mirror defect is as bad and less visible. Marking a verb pronominal-only
when it is not teaches that the plain form is wrong. **So a verb removed from
this list is as much a correction as a verb added.**

## Rulings applied (2026-10-03)

Removed from the list — all three have ordinary transitive uses that Wiktionary
does not label:

| verb | why |
|:--|:--|
| `cabrer` | « cabrer un avion » — to pull an aircraft's nose up |
| `évaporer` | « évaporer un liquide » — to evaporate a liquid |
| `prostituer` | « prostituer son talent » — to prostitute one's talent |

Glosses corrected — the marking was right, the meaning was not:

| verb | was (Wiktionary) | now (teacher) |
|:--|:--|:--|
| `complaire` | to get stuck in, to get caught in | **to revel in, to take pleasure in** |
| `tapir` | to hide | **to crouch, to lie low** |

Homographs named, so two different words are not blurred: `fier` (the verb
« se fier à », not the adjective "proud") and `tapir` (not the animal).

All of it is in `scripts/gloss_corrections.py` with the reasoning, and the
build **refuses** if a correction names a verb that is not in the content —
seen failing on purpose, because a recorded ruling with a typo in it is worse
than no ruling at all.

### The consequence of those removals, ruled on 2026-10-03

`cabrer` and `prostituer` were left marked transitive and glossed reflexively.
Both now lead with the transitive sense, per Shahin's ruling:

| verb | gloss |
|:--|:--|
| `cabrer` | to pull up (an aircraft's nose); (reflexive) to rear up, to resist |
| `prostituer` | to prostitute, to debase (one's talent, one's principles); (reflexive) to prostitute oneself |

Four of the 2,375 meanings in the product have now been read by a human.

## The remaining 48

Rank is position among the 2,400 most frequent French verbs. Glosses are
Wiktionary's and unreviewed unless marked, and now carry up to four senses
within a 130-character budget rather than the two a count allowed.

Write in the last column: `keep`, `not pronominal-only`, a corrected gloss, or
both.

| rank | headword | infinitive | gloss | ruling |
|---:|:--|:--|:--|:--|
| 89 | `se souvenir` | `souvenir` | to remember |  |
| 560 | `se méfier` | `méfier` | to mistrust, to be wary of, to watch out for |  |
| 572 | `s'efforcer` | `efforcer` | to make efforts towards, to try hard to, to endeavour |  |
| 585 | `s'envoler` | `envoler` | to take off, to take flight; to blow away; to fly (of time); to vanish, disappear, walk (to be stolen) (colloquial) |  |
| 640 | `s'emparer` | `emparer` | to seize, get hold of; to take over |  |
| 660 | `s'écrouler` | `écrouler` | to collapse |  |
| 672 | `s'écrier` | `écrier` | to exclaim; to yell, scream |  |
| 679 | `se marrer` | `marrer` | to laugh, to be amused (slang) |  |
| 718 | `s'évanouir` | `évanouir` | to lose consciousness, to faint; to vanish or disappear without a trace, especially things (formal) |  |
| 739 | `se suicider` | `suicider` | to commit suicide, to kill oneself, suicide |  |
| 918 | `s'agenouiller` | `agenouiller` | to kneel, to kneel down |  |
| 969 | `s'évader` | `évader` | to escape (from a building, situation etc.) |  |
| 1021 | `se fier` | `fier` | to trust (someone), to rely (on someone) |  |
| 1037 | `s'élancer` | `élancer` | to dash forward, to throw oneself at; to soar up |  |
| 1112 | `s'obstiner` | `obstiner` | to persevere, persist, insist; be obstinate about something |  |
| 1148 | `s'épanouir` | `épanouir` | to blossom, to bloom, to flower; to reveal its qualities; to thrive, flourish |  |
| 1174 | `s'accouder` | `accouder` | to rest, lean (on one's elbows) |  |
| 1271 | `se repentir` | `repentir` | to repent |  |
| 1329 | `s'empresser` | `empresser` | to hasten; to mass, to gather (literary) |  |
| 1331 | `se blottir` | `blottir` | to snuggle, to huddle |  |
| 1341 | `se recroqueviller` | `recroqueviller` | to curl up, to shrivel (up) |  |
| 1380 | `se rendormir` | `rendormir` | to fall asleep again, to fall back to sleep, to go back to sleep |  |
| 1432 | `se tapir` | `tapir` | to crouch, to lie low **(teacher-reviewed)** |  |
| 1466 | `s'absenter` | `absenter` | to leave, to absent oneself |  |
| 1489 | `se recoucher` | `recoucher` | to go back to bed |  |
| 1490 | `se démerder` | `démerder` | to manage, to get by (vulgar); to figure something out (vulgar) |  |
| 1560 | `se lamenter` | `lamenter` | to lament, to bewail, to bemoan |  |
| 1627 | `s'enquérir` | `enquérir` | to inquire (about = de) |  |
| 1708 | `s'éprendre` | `éprendre` | to burn; to become enamoured with, fall in love with (literary) |  |
| 1730 | `s'esclaffer` | `esclaffer` | to burst out in laughter |  |
| 1742 | `se gourer` | `gourer` | to goof up, to mess up, to screw up; to doubt something, to be wary of something |  |
| 1794 | `s'ébrouer` | `ébrouer` | to snort; to flap its wings |  |
| 1800 | `s'attabler` | `attabler` | to sit down at the table |  |
| 1809 | `s'extasier` | `extasier` | to be in ecstasy; to rave |  |
| 1928 | `se raviser` | `raviser` | to change one's mind, reconsider |  |
| 1986 | `se prosterner` | `prosterner` | to bow down |  |
| 1999 | `se démener` | `démener` | to convulse, thrash about, to struggle |  |
| 2074 | `s'entrecroiser` | `entrecroiser` | to criss-cross, intersect |  |
| 2078 | `se biler` | `biler` | to worry (pour) about (colloquial) |  |
| 2119 | `se chamailler` | `chamailler` | to bicker, to squabble, to quarrel, especially over something of little value |  |
| 2148 | `se rebeller` | `rebeller` | to rebel |  |
| 2194 | `se complaire` | `complaire` | to revel in, to take pleasure in **(teacher-reviewed)** |  |
| 2236 | `s'entretuer` | `entretuer` | to kill each other |  |
| 2302 | `s'entraider` | `entraider` | to help one another |  |
| 2318 | `se camer` | `camer` | to take drugs |  |
| 2377 | `s'empiffrer` | `empiffrer` | to stuff oneself, to binge |  |
| 2381 | `s'insurger` | `insurger` | to rise up, to protest (against) |  |
| 2387 | `s'éperdre` | `éperdre` | to lose one's way (literary) |  |
