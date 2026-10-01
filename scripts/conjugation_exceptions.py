"""Where the generator and the corpus disagree, and what that means each time.

A conjugator that is right 99.79% of the time teaches a learner something false
about five verbs in 2,400, and the learner does not know which five. So every
disagreement between the generated forms and Lexique 3.83 is classified here,
by hand, with a reason — and the classification is asserted with `deepEqual`,
so adding a disagreement fails and fixing one without striking it from this list
also fails.

**A disagreement does not mean we are wrong.** The corpus has its own faults,
and three of the categories below are the three different things a disagreement
can actually mean:

    CORPUS_NOISE   Lexique is wrong. Our form is right and ships.
    ALTERNATES     Both are correct French. Ours ships; theirs is accepted.
    KNOWN_WRONG    We are wrong and have not fixed it. The verb DOES NOT SHIP.

The third category is the one that matters. A verb listed there is withheld from
the product until it is fixed, because a gap is visible to a learner and a wrong
conjugation is not.
"""

# ── The corpus is wrong ─────────────────────────────────────────────────────
# Each entry records what Lexique says and why it cannot be right. These are
# tagging faults in a 142,694-row corpus, which is a very low rate; they are
# listed rather than ignored so nobody "fixes" our correct output to match them.
CORPUS_NOISE = {
    "laisser": "Lexique tags « laisses » as sub:pre:1p. It is second person "
               "singular. « que nous laissions » is right.",
    "parier": "Lexique offers « parions » for ind:imp:1p. That is the present. "
              "The imperfect of parier is « nous pariions », with two i.",
    "impressionner": "Lexique offers « impressionnes » for ind:pre:1p. That is "
                     "second person singular.",
    "ruer": "A Lexique row under the lemma « ruer » carries « restent », which "
            "belongs to rester. A lemmatisation fault.",
    "dorer": "Lexique offers « dorer » for ind:pre:2p. That is the infinitive.",
    "accoupler": "Lexique offers « accoupler » for ind:pre:2p. The infinitive "
                 "again, same fault as dorer.",
    "chuter": "A Lexique row under « chuter » carries « contrôler ». A "
              "lemmatisation fault, like the one under ruer.",
    "maudire": "Lexique offers « maudis » as the participe passé. That is the "
               "first or second person singular; the participle is « maudit », "
               "which is also how the adjective is spelled.",
}

# ── Both forms are correct French ───────────────────────────────────────────
# We ship one and accept the other. Where a learner may legitimately write
# either, the drill must accept either too — which is a product requirement
# this list exists to carry, not just a validation note.
ALTERNATES = {
    "payer": "paie / paye are both standard. We ship the i-form, which the "
             "corpus attests far more often.",
    "effrayer": "effraie / effraye. Same rule as payer.",
    "balayer": "balaie / balaye. Same rule as payer.",
    "rayer": "raie / raye. Same rule as payer.",
    "essayer": "essaie / essaye. Same rule as payer.",
    "relayer": "relaie / relaye. Same rule as payer.",
    "égayer": "égaie / égaye. Same rule as payer.",
    "déblayer": "déblaie / déblaye. Same rule as payer.",
    "rasseoir": "Follows asseoir: rasseye / rassoie are both current.",
    "plaire": "plaît / plait. The 1990 rectifications drop the circumflex; "
              "both are correct and both are taught. We ship the circumflex.",
    "déplaire": "déplaît / déplait. Same as plaire.",
    "complaire": "complaît / complait. Same as plaire.",
    "entrouvrir": "entrouvrir / entr’ouvrir. The rectified spelling joins the "
                  "word; Wiktionary lists the apostrophe form. Both are current "
                  "and the whole paradigm differs by that one character.",
    "vouloir": "que nous voulions / veuillions. Both exist; voulions is the "
               "ordinary form and veuillions the literary one. We ship voulions.",
    "asseoir": "Two complete paradigms exist: j'assieds/j'assois, and the "
               "futures assiéra/assoira. We ship the assieds series, which is "
               "the one taught; the assois series is accepted.",
}

# ── We are wrong, and these verbs are withheld ──────────────────────────────
# Empty is the goal. Anything here is a verb a learner cannot see yet.
# ── Where the two oracles disagree with EACH OTHER ──────────────────────────
# Not our error and not noise: French itself is unsettled, or in transition.
# Each needs a teacher's decision about what to teach, which is Shahin's call.
ORACLES_DISAGREE = {
    "départir": "Lexique attests « il se départ » (the partir pattern); "
                "Wiktionary gives « départis » (regular). Both are defensible: "
                "the partir conjugation is traditional, the regular one is now "
                "common. We ship the partir pattern. NEEDS A TEACHER'S RULING.",
    "décroître": "Passé simple: we give « décrus », Wiktionary « décrûs ». The "
                 "circumflex on croître exists to tell crû from cru; whether its "
                 "compounds keep it is disputed. NEEDS A TEACHER'S RULING.",
}

KNOWN_WRONG: dict[str, str] = {
    "gésir": "Defective: only gis/gis/gît/gisons/gisez/gisent and the imperfect "
             "exist. The generator produces a full paradigm, which is wrong. "
             "Withheld until it has a defective model.",
}


def classification(lemma: str) -> str | None:
    """Which of the three a verb's disagreement is, or None if unclassified."""
    if lemma in CORPUS_NOISE:
        return "corpus-noise"
    if lemma in ALTERNATES:
        return "alternate"
    if lemma in KNOWN_WRONG:
        return "known-wrong"
    if lemma in ORACLES_DISAGREE:
        return "oracles-disagree"
    return None


def ships(lemma: str) -> bool:
    """False for a verb we know we conjugate wrongly."""
    return lemma not in KNOWN_WRONG
