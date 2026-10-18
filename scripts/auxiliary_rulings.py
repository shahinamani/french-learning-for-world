"""Which auxiliary a verb takes, where the page alone cannot settle it.

`data/auxiliaries.json` records what fr.wiktionary says for each verb
(`scripts/harvest_auxiliaries.py`). This file holds the DECISIONS that evidence
cannot make by itself, and every one carries its reason, so the next person can
disagree with the argument and not guess at it.

Three kinds of entry, and the third is the reason the file exists:

  1. A verb that takes BOTH. fr.wiktionary gives such a verb two tables, and a
     single `auxiliary` value is a false claim whichever it is. The ORDER here
     is the order a learner meets them: the first auxiliary is the principal
     one and fills the plain `auxiliary` field; the second is `auxiliaryAlso`.
  2. A verb where the page is silent: no table at all.
  3. A verb where the page is WRONG, or incomplete, and we know it. « rentrer »
     is listed with être alone; « j'ai rentré la voiture » is ordinary French.
     « pourrir » is listed with être alone; « le fruit a pourri » is the form
     the Académie gives.

`examples` are French sentences for the two auxiliaries, shown on the verb page
untranslated because a sentence in French is the same for every learner. A key
is simply absent where nobody wrote a sentence — absent means nobody has said,
not that the construction does not exist.

**Status of every ruling here: not yet read by a French teacher.** The page
marks the verb's auxiliary as coming from fr.wiktionary or from a ruling, and
`reviewed` stays False until a teacher has been through this list. The order of
the two auxiliaries is a judgement about what a learner meets first, and is the
part most worth a teacher's eye.
"""
from __future__ import annotations

REVIEWED = False

# lemma -> {"auxiliary": [principal, (other)], "why": str, "examples": {aux: sentence}}
RULINGS: dict[str, dict] = {
    # ── Both. Intransitive movement takes être; the transitive sense takes avoir. ──
    "passer": {
        "auxiliary": ["avoir", "être"],
        "examples": {"être": "Je suis passé devant la gare.",
                     "avoir": "J'ai passé un examen."},
        "why": "Two tables on fr.wiktionary. Principal avoir because « passer un "
               "examen / du temps / un coup de fil » is what an A1 learner meets "
               "before « passer devant ».",
    },
    "rentrer": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Elle est rentrée tard.",
                     "avoir": "J'ai rentré la voiture dans le garage."},
        "why": "fr.wiktionary lists être alone. Transitive « rentrer la voiture / "
               "le linge » takes avoir and is ordinary French; the page is incomplete.",
    },
    "sortir": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Elle est sortie hier soir.",
                     "avoir": "J'ai sorti la voiture du garage."},
        "why": "Two tables on fr.wiktionary. Intransitive first.",
    },
    "entrer": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Il est entré dans la pièce.",
                     "avoir": "J'ai entré les données dans l'ordinateur."},
        "why": "Two tables on fr.wiktionary. Intransitive first.",
    },
    "monter": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Elle est montée au premier étage.",
                     "avoir": "J'ai monté les valises."},
        "why": "Two tables on fr.wiktionary. Intransitive first.",
    },
    "descendre": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Je suis descendu du train.",
                     "avoir": "J'ai descendu les poubelles."},
        "why": "Two tables on fr.wiktionary. Intransitive first.",
    },
    "retourner": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Il est retourné chez lui.",
                     "avoir": "J'ai retourné la crêpe."},
        "why": "Two tables on fr.wiktionary. Intransitive first.",
    },
    "tomber": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Elle est tombée dans l'escalier."},
        "why": "Two tables on fr.wiktionary. être is the ordinary auxiliary; the "
               "avoir use (« tomber un adversaire », and the Québec « j'ai tombé ») "
               "is marginal, so no avoir sentence is offered.",
    },
    "repasser": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Je suis repassé chez toi hier.",
                     "avoir": "J'ai repassé ma chemise."},
        "why": "fr.wiktionary lists être alone. « repasser le linge » (to iron) is "
               "transitive and takes avoir; the page is incomplete.",
    },
    "ressortir": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Elle est ressortie aussitôt.",
                     "avoir": "J'ai ressorti mes vieux manteaux."},
        "why": "Two tables on fr.wiktionary. Intransitive first.",
    },
    "repartir": {
        "auxiliary": ["être", "avoir"],
        "examples": {"être": "Ils sont repartis à midi."},
        "why": "Two tables on fr.wiktionary. être is movement (to set off again); "
               "avoir is the literary « repartir » = to retort, for which no "
               "sentence is offered.",
    },
    # ── Both, where the existing value was already one of the two. Kept as the
    #    principal so the change is only the addition of the other. ──
    "disparaître": {"auxiliary": ["avoir", "être"],
                    "why": "Two tables on fr.wiktionary; avoir kept as principal, "
                           "être (« il est disparu », the resulting state) added."},
    "paraître": {"auxiliary": ["avoir", "être"],
                 "why": "Two tables on fr.wiktionary; avoir kept as principal."},
    "réapparaître": {"auxiliary": ["avoir", "être"],
                     "why": "Two tables on fr.wiktionary; avoir kept as principal."},
    "reparaître": {"auxiliary": ["avoir", "être"],
                   "why": "Two tables on fr.wiktionary; avoir kept as principal."},
    "apparaître": {
        "auxiliary": ["être", "avoir"],
        "why": "fr.wiktionary lists être alone. apparaître takes both, like "
               "disparaître and paraître, which it is listed beside; être first "
               "because the page says so.",
    },
    "demeurer": {
        "auxiliary": ["avoir", "être"],
        "examples": {"avoir": "Il a demeuré dix ans à Lyon.",
                     "être": "Elle est demeurée silencieuse."},
        "why": "Two tables on fr.wiktionary. avoir for « demeurer » = to live "
               "somewhere, être for = to remain.",
    },
    "accourir": {"auxiliary": ["avoir", "être"],
                 "why": "Two tables on fr.wiktionary; avoir kept as principal."},
    "convenir": {"auxiliary": ["être", "avoir"],
                 "why": "Two tables on fr.wiktionary; être kept as principal."},

    # ── The page is wrong ──
    "pourrir": {
        "auxiliary": ["avoir"],
        "examples": {"avoir": "Les fruits ont pourri."},
        "why": "fr.wiktionary gives être alone. « Les fruits ont pourri » takes "
               "avoir; « ils sont pourris » is the participle used as an "
               "adjective, not a passé composé. The existing value was already "
               "avoir; this ruling stops the page from changing it.",
    },
    "moquer": {
        "auxiliary": ["être"],
        "examples": {"être": "Il s'est moqué de moi."},
        "why": "A learner meets this verb as « se moquer », which takes être. A "
               "literary transitive « moquer quelqu'un » takes avoir and is "
               "not offered. NOTE: the verb is shown under the bare infinitive "
               "although it is almost only pronominal — the same fault as "
               "« souvenir », outside this change.",
    },

    # ── The page has no table ──
    "manoeuvrer": {"auxiliary": ["avoir"],
                   "why": "fr.wiktionary has no conjugation page. Not a verb of "
                          "movement to a place or a change of state: avoir."},
    "écoeurer": {"auxiliary": ["avoir"],
                 "why": "fr.wiktionary has no conjugation page. Transitive: avoir."},
    "prévaloir": {"auxiliary": ["avoir"],
                  "why": "The page names no auxiliary for the plain verb. « Il a "
                         "prévalu » takes avoir; « se prévaloir » (être) is a "
                         "different construction."},
}
