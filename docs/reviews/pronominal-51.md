# The 51 pronominal-only verbs — awaiting a teacher's ruling

**Status: unreviewed.** Wiktionary's `{{lb|fr|pronominal}}` and
`{{lb|fr|reflexive}}` labels are the only reviewer these 51 have had.

This matters more than the glosses do. A wrong meaning teaches a learner one
wrong word. A wrong reflexive marking teaches them a wrong conjugation on every
row of the table — and the defect this list exists to fix was exactly that:
« souvenir » was shown as a bare infinitive with a table reading « je
souviens », six rows of French that does not exist, on an A1 verb.

The mirror defect is just as bad and less visible. Marking a verb
pronominal-only when it is not teaches that the plain form is wrong. Five verbs
were wrong this way on the first pass — « transporter » carries
`{{lb|fr|transitive|or|pronominal}}`, a disjunction, and reading it as
"pronominal" would have made « se transporter » the only form of "to transport".
So a verb removed from this list is as much a correction as a verb added.

**Shahin has flagged `cabrer`, `évaporer` and `prostituer`** as likely wrong:
each has an ordinary transitive use that Wiktionary does not label.

## How to record a ruling

Write in the last column. `keep` · `not pronominal-only` · or the correct
headword. The list is also declared by name in `tests/pronominal.test.js`, so
changing one is a one-line edit the suite then checks — and a verb moved here
without the test being updated fails the build, which is the intention.

| rank | level | headword | infinitive | gloss (Wiktionary, unreviewed) | ruling |
|---:|:--|:--|:--|:--|:--|
| 89 | A1 | `se souvenir` | `souvenir` | to remember |  |
| 560 | B1 | `se méfier` | `méfier` | to mistrust, to be wary of, to watch out for |  |
| 572 | B1 | `s'efforcer` | `efforcer` | to make efforts towards, to try hard to, to endeavour |  |
| 585 | B1 | `s'envoler` | `envoler` | to take off, to take flight; to blow away |  |
| 640 | B1 | `s'emparer` | `emparer` | to seize, get hold of; to take over |  |
| 660 | B1 | `s'écrouler` | `écrouler` | to collapse |  |
| 672 | B1 | `s'écrier` | `écrier` | to exclaim; to yell, scream |  |
| 679 | B1 | `se marrer` | `marrer` | to laugh, to be amused (slang) |  |
| 718 | B1 | `s'évanouir` | `évanouir` | to lose consciousness, to faint; to vanish or disappear without a trace, especially things (formal) |  |
| 739 | B1 | `se suicider` | `suicider` | to commit suicide, to kill oneself, suicide |  |
| 918 | B2 | `s'agenouiller` | `agenouiller` | to kneel, to kneel down |  |
| 969 | B2 | `s'évader` | `évader` | to escape (from a building, situation etc.) |  |
| 1021 | B2 | `se fier` | `fier` | to trust (someone), to rely (on someone) |  |
| 1037 | B2 | `s'élancer` | `élancer` | to dash forward, to throw oneself at; to soar up |  |
| 1112 | B2 | `s'obstiner` | `obstiner` | to persevere, persist, insist; be obstinate about something |  |
| 1148 | B2 | `s'épanouir` | `épanouir` | to blossom, to bloom, to flower; to reveal its qualities |  |
| 1174 | B2 | `s'accouder` | `accouder` | to rest, lean (on one's elbows) |  |
| 1271 | B2 | `se repentir` | `repentir` | to repent |  |
| 1329 | B2 | `s'empresser` | `empresser` | to hasten; to mass, to gather (literary) |  |
| 1331 | B2 | `se blottir` | `blottir` | to snuggle, to huddle |  |
| 1341 | B2 | `se recroqueviller` | `recroqueviller` | to curl up, to shrivel (up) |  |
| 1380 | B2 | `se rendormir` | `rendormir` | to fall asleep again, to fall back to sleep, to go back to sleep |  |
| 1432 | C1 | `se tapir` | `tapir` | to hide |  |
| 1466 | C1 | `s'absenter` | `absenter` | to leave, to absent oneself |  |
| 1489 | C1 | `se recoucher` | `recoucher` | to go back to bed |  |
| 1490 | C1 | `se démerder` | `démerder` | to manage, to get by (vulgar); to figure something out (vulgar) |  |
| 1560 | C1 | `se lamenter` | `lamenter` | to lament, to bewail, to bemoan |  |
| 1627 | C1 | `s'enquérir` | `enquérir` | to inquire (about = de) |  |
| 1708 | C1 | `s'éprendre` | `éprendre` | to burn; to become enamoured with, fall in love with (literary) |  |
| 1730 | C1 | `s'esclaffer` | `esclaffer` | to burst out in laughter |  |
| 1742 | C1 | `se gourer` | `gourer` | to goof up, to mess up, to screw up; to doubt something, to be wary of something |  |
| 1794 | C1 | `s'ébrouer` | `ébrouer` | to snort; to flap its wings |  |
| 1800 | C1 | `s'attabler` | `attabler` | to sit down at the table |  |
| 1809 | C1 | `s'extasier` | `extasier` | to be in ecstasy; to rave |  |
| 1928 | C2 | `se raviser` | `raviser` | to change one's mind, reconsider |  |
| 1933 | C2 | `se cabrer` | `cabrer` | to rear up (on a horse or a motorcycle); to complain |  |
| 1986 | C2 | `se prosterner` | `prosterner` | to bow down |  |
| 1999 | C2 | `se démener` | `démener` | to convulse, thrash about, to struggle |  |
| 2003 | C2 | `s'évaporer` | `évaporer` | to evaporate; to vanish into thin air, to disappear |  |
| 2074 | C2 | `s'entrecroiser` | `entrecroiser` | to criss-cross, intersect |  |
| 2078 | C2 | `se biler` | `biler` | to worry (pour) about (colloquial) |  |
| 2119 | C2 | `se chamailler` | `chamailler` | to bicker, to squabble, to quarrel, especially over something of little value |  |
| 2148 | C2 | `se rebeller` | `rebeller` | to rebel |  |
| 2194 | C2 | `se complaire` | `complaire` | to get stuck in, to get caught in; to take pleasure in, to bask in |  |
| 2236 | C2 | `s'entretuer` | `entretuer` | to kill each other |  |
| 2268 | C2 | `se prostituer` | `prostituer` | to prostitute oneself |  |
| 2302 | C2 | `s'entraider` | `entraider` | to help one another |  |
| 2318 | C2 | `se camer` | `camer` | to take drugs |  |
| 2377 | C2 | `s'empiffrer` | `empiffrer` | to stuff oneself, to binge |  |
| 2381 | C2 | `s'insurger` | `insurger` | to rise up, to protest (against) |  |
| 2387 | C2 | `s'éperdre` | `éperdre` | to lose one's way (literary) |  |

51 verbs. Ranked by frequency across the 2,400 most common French verbs.
