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
    # Found by reading the 48 pronominal verbs, ruled on by Shahin 2026-10-03.
    # Four of the five are the same fault as « complaire »: Wiktionary's sense
    # ORDER is an editor's judgement about primacy and the harvest reads
    # position as meaning, so an archaic or marginal sense leads.
    "éprendre": (
        "to fall in love with, to become enamoured with (literary)",
        "Wiktionary leads with « to burn », which is archaic literary "
        "(éprendre = enflammer) and should not lead, if it appears at all. "
        "« S'éprendre de » is to fall in love with.",
    ),
    "gourer": (
        "to be mistaken, to get it wrong (familiar)",
        "Wiktionary's « to goof up, to mess up, to screw up » is close enough, "
        "but its second sense — « to doubt something, to be wary of something » "
        "— is not this verb at all and was being shown.",
    ),
    "empresser": (
        "to hurry to, to be eager to",
        "Wiktionary's second sense « to mass, to gather (literary) » is an "
        "archaic sense of « presser » and does not belong here. "
        "« S'empresser de » is to hurry to do something.",
    ),
    "envoler": (
        "to fly away, to take off; to vanish, to disappear",
        "The character budget admitted a fourth sense reading « to vanish, "
        "disappear, walk (to be stolen) (colloquial) ». « Walk » there is "
        "English slang glossing the figurative sense and is useless to a "
        "learner. NOTE: this is damage from WIDENING the budget, not from the "
        "old cap — see the lessons entry on a filter doing two jobs.",
    ),
    "suicider": (
        "to commit suicide",
        "Wiktionary's « to commit suicide, to kill oneself, suicide » ends with "
        "a bare noun that got into a verb gloss.",
    ),
    # Shahin's pass over the 48 pronominal verbs, 2026-10-03.
    "ébrouer": (
        "to snort, to shake oneself",
        "Wiktionary's « to flap its wings » is simply wrong. « S'ébrouer » is a "
        "horse shaking itself, or a person shaking water off.",
    ),
    "extasier": (
        "to go into raptures, to enthuse (over)",
        "Wiktionary's « to be in ecstasy; to rave » misleads in modern English: "
        "« to rave » now reads as ranting, or as a party.",
    ),
    "démener": (
        "to struggle, to bustle about, to exert oneself",
        "Wiktionary's « to convulse » is wrong. « Se démener » is to throw "
        "oneself into something, not a medical event.",
    ),
    "évanouir": (
        "to lose consciousness, to faint; to vanish, to disappear",
        "Wiktionary marks the vanishing sense « especially things (formal) ». It "
        "is ordinary French, not formal, and the restriction to things is wrong.",
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
    "rendormir": "« rendormir un enfant » — to get a child back to sleep. Transitive.",
    "recoucher": "« recoucher un enfant » — to put a child back to bed. Transitive.",
    "entrecroiser": "« entrecroiser les doigts » — to interlace one's fingers. Transitive.",
    "cabrer": "« cabrer un avion » — to pull an aircraft's nose up. Transitive.",
    "évaporer": "« évaporer un liquide » — to evaporate a liquid. Transitive.",
    "prostituer": "« prostituer son talent » — to prostitute one's talent. Transitive.",
}

# **Not obsolete — not used as a verb at all**, which is a measurement rather
# than a judgement. Shahin asked whether the product should carry obsolete verbs.
# The answer these three force is narrower and firmer: for each of them, 100% of
# the corpus frequency is the four past-participle agreement forms, and not one
# finite form is attested in either Lexique corpus. They are in the frequency
# list because the ADJECTIVE exists — « éperdu », « dépourvu », « dénué » —
# and Lexique tags those forms as participles of a verb nobody conjugates.
#
# So the test is not "is this verb archaic" but "does the corpus attest anybody
# using it as a verb". An archaic verb people still write — « ouïr », « seoir »
# — is withheld elsewhere for being defective, and a literary verb in use gets a
# register label instead. These three have no verb to teach.
#
# `sous-titrer` is the one the same measurement flags and we KEEP: its frequency
# is also all participle, because films are subtitled rather than people
# subtitling them, but « ils ont sous-titré le film » is ordinary French. A
# measurement that cannot tell a dead verb from a participle-heavy living one is
# a filter for a human to read, not one to apply.
NOT_USED_AS_VERB: dict[str, str] = {
    "éperdre": "100% of its frequency is « éperdu/e/s/es » and no finite form is "
               "attested. The adjective « éperdu » survives; the verb does not.",
    "dépourvoir": "Same shape: « dépourvu » is the living word, the verb is not used.",
    "dénuer": "Same shape: « dénué (de) » is the living word.",
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
