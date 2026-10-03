"""Corrections to Wiktionary, ruled on by a French teacher.

**Why this file has to exist.** Until it did, there was no way to record "the
source is wrong here". The conjugator has had `conjugation_exceptions.py` since
the beginning — `ORACLES_DISAGREE`, `KNOWN_WRONG`, `CORPUS_NOISE` — because two
corpora disagreeing was expected. The glosses had nothing, so every meaning a
learner read was whatever en.wiktionary said, and a correction had nowhere to
go but into somebody's memory.

The first two entries show the two different ways the source is wrong, and
neither is a parsing fault:

  complaire   Wiktionary's own sense ORDER puts a bad translation first. Its
              three senses are "to get stuck in, to get caught in" / "to take
              pleasure in, to bask in" / "to wallow, to revel in". The harvest
              faithfully took the first two, and the first is a different verb.
              **Sense order is an editorial judgement and we were reading it as
              data.**
  tapir       Wiktionary's only sense is "to hide". « se tapir » is "to crouch,
              to lie low" — thin rather than wrong, and a learner cannot tell
              the difference. (The animal is under `Etymology 2` with its own
              Noun heading, so the parser never saw it; the confusion is
              Wiktionary's, not ours.)

A gloss here is marked `glossProvenance: "teacher"` rather than
`"wiktionary-en"`, and the page stops telling the learner it is unreviewed —
because for these, it is not. **These are the only reviewed meanings in the
product.** Every other one of the 2,375 still carries the warning.

Every entry needs the ruling AND the reason, so the next person can disagree
with the argument rather than guess at it.
"""
from __future__ import annotations

# lemma -> (the gloss a learner sees, why Wiktionary's was not usable)
TEACHER_GLOSS: dict[str, tuple[str, str]] = {
    "complaire": (
        "to revel in, to take pleasure in",
        "Wiktionary leads with « to get stuck in, to get caught in », which is a "
        "different verb. « se complaire dans » is to revel in something. Its "
        "third sense, « to wallow, to revel in », is the right one and fell "
        "outside the two-sense cap.",
    ),
    # Both of these were created by the removals above: the verb is no longer
    # marked pronominal-only, so the gloss must lead with the transitive sense.
    # A verb marked transitive and glossed reflexively is the inconsistency the
    # correction introduced.
    "cabrer": (
        "to pull up (an aircraft's nose); (reflexive) to rear up, to resist",
        "Wiktionary gives only the pronominal reading, « to rear up (on a horse "
        "or a motorcycle); to complain ». The transitive is aviation — « cabrer "
        "l'avion ». « Cabrer quelqu'un contre » (to turn someone against) is "
        "real but secondary. « Se cabrer » is to rear up, and figuratively to "
        "dig one's heels in.",
    ),
    "prostituer": (
        "to prostitute, to debase (one's talent, one's principles); "
        "(reflexive) to prostitute oneself",
        "Wiktionary gives only « to prostitute oneself ». « Prostituer son "
        "talent » is ordinary figurative French and is the transitive sense a "
        "learner is most likely to meet in writing.",
    ),
    "tapir": (
        "to crouch, to lie low",
        "Wiktionary's only sense is « to hide », which is thin enough to be "
        "misleading: « se tapir » is specifically to crouch low and stay still. "
        "A learner given « to hide » will use it for « se cacher ».",
    ),
}

# Verbs Wiktionary labels pronominal on every sense that nonetheless have an
# ordinary transitive use. Marking these pronominal-only is the MIRROR of the
# souvenir defect: it teaches that the plain form is wrong, when it is not.
NOT_PRONOMINAL: dict[str, str] = {
    "cabrer": "« cabrer un avion » — to pull an aircraft's nose up. Transitive.",
    "évaporer": "« évaporer un liquide » — to evaporate a liquid. Transitive.",
    "prostituer": "« prostituer son talent » — to prostitute one's talent. Transitive.",
}

# A lemma that is also a common word of another part of speech, where showing
# the verb alone would blur two different words. The note goes on the page.
HOMOGRAPH: dict[str, str] = {
    "fier": "Not the adjective « fier » (proud), which is a different word. "
            "The verb is « se fier à » — to trust.",
    "tapir": "Not the noun « un tapir » (the animal), which is a different word.",
}


def reviewed_gloss(lemma: str) -> str | None:
    got = TEACHER_GLOSS.get(lemma)
    return got[0] if got else None
