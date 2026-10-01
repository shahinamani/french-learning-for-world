"""Irregular French verb models — the head of the frequency list.

The 2,400 most frequent verbs split cleanly: 2,130 follow a regular pattern, and
**270 do not.** Those 270 are the verbs a learner meets on day one — être, avoir,
aller, faire, pouvoir, vouloir, prendre, venir, mettre — so they are worth more
than verbs 500 to 2,400 put together.

A model is one family's stems. Derived verbs inherit by prefix: `comprendre`,
`apprendre` and `surprendre` are the `prendre` model with a prefix, and
`revenir`, `devenir` and `parvenir` are `venir`. Twenty-two verbs in the top
2,400 are venir/tenir; eleven are mettre.

What a model gives, and what is derived from it:

    pres   six forms, written out, because this is where irregularity lives
    fut    the future stem; conditionnel is the same stem + imparfait endings
    ps     passé simple, six forms — read, not produced, but it is in every
           B2 reading text
    pp     participe passé          ppr   participe présent
    subj   only when it does not follow the rule below
    aux    only when it is être

    imparfait   = ppr minus -ant, + ais/ais/ait/ions/iez/aient
    subjonctif  = ils-présent stem + e/es/e/…/ent, and the nous-imparfait
                  stem for 1p/2p — true for almost every irregular, which is
                  why only the exceptions are listed
    subj imparfait = tu-passé-simple + sse/sses/^t/ssions/ssiez/ssent
    impératif   = tu/nous/vous of the présent, except where noted

Every form generated from these models is checked against Lexique 3.83, which
attests 29,105 of them. A model whose output disagrees with the corpus does not
ship — see scripts/conjugate.py.
"""

# aux defaults to "avoir"; subj and imper are given only when irregular.
MODELS: dict[str, dict] = {

    # ── Fully suppletive. These three are not patterns, they are vocabulary ──
    "être": {
        "pres": ["suis", "es", "est", "sommes", "êtes", "sont"],
        "fut": "ser", "pp": "été", "ppr": "étant",
        "ps": ["fus", "fus", "fut", "fûmes", "fûtes", "furent"],
        "subj": ["sois", "sois", "soit", "soyons", "soyez", "soient"],
        "imper": ["sois", "soyons", "soyez"],
        "imparfait": ["étais", "étais", "était", "étions", "étiez", "étaient"],
    },
    "avoir": {
        "pres": ["ai", "as", "a", "avons", "avez", "ont"],
        "fut": "aur", "pp": "eu", "ppr": "ayant",
        "ps": ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"],
        "subj": ["aie", "aies", "ait", "ayons", "ayez", "aient"],
        "imper": ["aie", "ayons", "ayez"],
        # ayant/sachant would give « ayaient »/« sachaient ». The corpus said no.
        "imparfait": ["avais", "avais", "avait", "avions", "aviez", "avaient"],
    },
    "aller": {
        "pres": ["vais", "vas", "va", "allons", "allez", "vont"],
        "fut": "ir", "pp": "allé", "ppr": "allant", "aux": "être",
        "ps": ["allai", "allas", "alla", "allâmes", "allâtes", "allèrent"],
        "subj": ["aille", "ailles", "aille", "allions", "alliez", "aillent"],
        "imper": ["va", "allons", "allez"],
    },

    # ── The high-frequency irregulars ──
    "faire": {
        "pres": ["fais", "fais", "fait", "faisons", "faites", "font"],
        "fut": "fer", "pp": "fait", "ppr": "faisant",
        "ps": ["fis", "fis", "fit", "fîmes", "fîtes", "firent"],
        "subj": ["fasse", "fasses", "fasse", "fassions", "fassiez", "fassent"],
    },
    # maudire looks like dire and conjugates like finir — nous maudissons —
    # but keeps an irregular participle, « maudit », which is also the
    # adjective. Neither half of that is guessable from the ending, and the
    # corpus attests only the participle; the second oracle supplied the rest.
    "maudire": {
        "pres": ["maudis", "maudis", "maudit", "maudissons", "maudissez", "maudissent"],
        "fut": "maudir", "pp": "maudit", "ppr": "maudissant",
        "ps": ["maudis", "maudis", "maudit", "maudîmes", "maudîtes", "maudirent"],
    },
    "dire": {
        "pres": ["dis", "dis", "dit", "disons", "dites", "disent"],
        "fut": "dir", "pp": "dit", "ppr": "disant",
        "ps": ["dis", "dis", "dit", "dîmes", "dîtes", "dirent"],
    },
    "pouvoir": {
        "pres": ["peux", "peux", "peut", "pouvons", "pouvez", "peuvent"],
        "fut": "pourr", "pp": "pu", "ppr": "pouvant",
        "ps": ["pus", "pus", "put", "pûmes", "pûtes", "purent"],
        "subj": ["puisse", "puisses", "puisse", "puissions", "puissiez", "puissent"],
        "imper": [],   # no imperative in ordinary French
    },
    "vouloir": {
        "pres": ["veux", "veux", "veut", "voulons", "voulez", "veulent"],
        "fut": "voudr", "pp": "voulu", "ppr": "voulant",
        "ps": ["voulus", "voulus", "voulut", "voulûmes", "voulûtes", "voulurent"],
        "subj": ["veuille", "veuilles", "veuille", "voulions", "vouliez", "veuillent"],
        "imper": ["veuille", "veuillons", "veuillez"],
    },
    "savoir": {
        "pres": ["sais", "sais", "sait", "savons", "savez", "savent"],
        "fut": "saur", "pp": "su", "ppr": "sachant",
        "ps": ["sus", "sus", "sut", "sûmes", "sûtes", "surent"],
        "subj": ["sache", "saches", "sache", "sachions", "sachiez", "sachent"],
        "imper": ["sache", "sachons", "sachez"],
        # ayant/sachant would give « ayaient »/« sachaient ». The corpus said no.
        "imparfait": ["savais", "savais", "savait", "savions", "saviez", "savaient"],
    },
    "devoir": {
        "pres": ["dois", "dois", "doit", "devons", "devez", "doivent"],
        "fut": "devr", "pp": "dû", "ppr": "devant",
        "ps": ["dus", "dus", "dut", "dûmes", "dûtes", "durent"],
    },
    "voir": {
        "pres": ["vois", "vois", "voit", "voyons", "voyez", "voient"],
        "fut": "verr", "pp": "vu", "ppr": "voyant",
        "ps": ["vis", "vis", "vit", "vîmes", "vîtes", "virent"],
    },
    "prévoir": {   # prévoir keeps a regular future, unlike voir
        "pres": ["prévois", "prévois", "prévoit", "prévoyons", "prévoyez", "prévoient"],
        "fut": "prévoir", "pp": "prévu", "ppr": "prévoyant",
        "ps": ["prévis", "prévis", "prévit", "prévîmes", "prévîtes", "prévirent"],
    },
    "falloir": {
        "pres": [None, None, "faut", None, None, None],
        "fut": "faudr", "pp": "fallu", "ppr": None,
        "ps": [None, None, "fallut", None, None, None],
        "subj": [None, None, "faille", None, None, None],
        "imparfait": [None, None, "fallait", None, None, None],
        "imper": [],
    },
    "pleuvoir": {
        "pres": [None, None, "pleut", None, None, "pleuvent"],
        "fut": "pleuvr", "pp": "plu", "ppr": "pleuvant",
        "ps": [None, None, "plut", None, None, "plurent"],
        "imper": [],
    },
    "valoir": {
        "pres": ["vaux", "vaux", "vaut", "valons", "valez", "valent"],
        "fut": "vaudr", "pp": "valu", "ppr": "valant",
        "ps": ["valus", "valus", "valut", "valûmes", "valûtes", "valurent"],
        "subj": ["vaille", "vailles", "vaille", "valions", "valiez", "vaillent"],
    },
    "prévaloir": {   # subjonctif prévale, NOT valoir's vaille
        "pres": ["prévaux", "prévaux", "prévaut", "prévalons", "prévalez", "prévalent"],
        "fut": "prévaudr", "pp": "prévalu", "ppr": "prévalant",
        "ps": ["prévalus", "prévalus", "prévalut", "prévalûmes", "prévalûtes", "prévalurent"],
        "subj": ["prévale", "prévales", "prévale", "prévalions", "prévaliez", "prévalent"],
    },
    "recevoir": {
        "pres": ["reçois", "reçois", "reçoit", "recevons", "recevez", "reçoivent"],
        "fut": "recevr", "pp": "reçu", "ppr": "recevant",
        "ps": ["reçus", "reçus", "reçut", "reçûmes", "reçûtes", "reçurent"],
    },
    "asseoir": {
        "pres": ["assieds", "assieds", "assied", "asseyons", "asseyez", "asseyent"],
        "fut": "assiér", "pp": "assis", "ppr": "asseyant",
        "ps": ["assis", "assis", "assit", "assîmes", "assîtes", "assirent"],
    },
    # Only « mû » takes the circumflex, to tell it from the article; ému and
    # promu do not. The corpus caught « émû ».
    "émouvoir": {
        "pres": ["émeus", "émeus", "émeut", "émouvons", "émouvez", "émeuvent"],
        "fut": "émouvr", "pp": "ému", "ppr": "émouvant",
        "ps": ["émus", "émus", "émut", "émûmes", "émûtes", "émurent"],
    },
    "promouvoir": {
        "pres": ["promeus", "promeus", "promeut", "promouvons", "promouvez", "promeuvent"],
        "fut": "promouvr", "pp": "promu", "ppr": "promouvant",
        "ps": ["promus", "promus", "promut", "promûmes", "promûtes", "promurent"],
    },
    "mouvoir": {
        "pres": ["meus", "meus", "meut", "mouvons", "mouvez", "meuvent"],
        "fut": "mouvr", "pp": "mû", "ppr": "mouvant",
        "ps": ["mus", "mus", "mut", "mûmes", "mûtes", "murent"],
    },

    # ── venir / tenir: 22 verbs in the top 2,400 ──
    "venir": {
        "pres": ["viens", "viens", "vient", "venons", "venez", "viennent"],
        "fut": "viendr", "pp": "venu", "ppr": "venant", "aux": "être",
        "ps": ["vins", "vins", "vint", "vînmes", "vîntes", "vinrent"],
    },
    "tenir": {
        "pres": ["tiens", "tiens", "tient", "tenons", "tenez", "tiennent"],
        "fut": "tiendr", "pp": "tenu", "ppr": "tenant",
        "ps": ["tins", "tins", "tint", "tînmes", "tîntes", "tinrent"],
    },

    # ── prendre and mettre: 19 between them ──
    "prendre": {
        "pres": ["prends", "prends", "prend", "prenons", "prenez", "prennent"],
        "fut": "prendr", "pp": "pris", "ppr": "prenant",
        "ps": ["pris", "pris", "prit", "prîmes", "prîtes", "prirent"],
    },
    "mettre": {
        "pres": ["mets", "mets", "met", "mettons", "mettez", "mettent"],
        "fut": "mettr", "pp": "mis", "ppr": "mettant",
        "ps": ["mis", "mis", "mit", "mîmes", "mîtes", "mirent"],
    },
    "battre": {
        "pres": ["bats", "bats", "bat", "battons", "battez", "battent"],
        "fut": "battr", "pp": "battu", "ppr": "battant",
        "ps": ["battis", "battis", "battit", "battîmes", "battîtes", "battirent"],
    },

    # ── regular -dre (rendre type): rendre, attendre, entendre, perdre … ──
    "rendre": {
        "pres": ["rends", "rends", "rend", "rendons", "rendez", "rendent"],
        "fut": "rendr", "pp": "rendu", "ppr": "rendant",
        "ps": ["rendis", "rendis", "rendit", "rendîmes", "rendîtes", "rendirent"],
    },

    # ── -indre: craindre, joindre, peindre and their cousins ──
    "craindre": {
        "pres": ["crains", "crains", "craint", "craignons", "craignez", "craignent"],
        "fut": "craindr", "pp": "craint", "ppr": "craignant",
        "ps": ["craignis", "craignis", "craignit", "craignîmes", "craignîtes", "craignirent"],
    },
    "joindre": {
        "pres": ["joins", "joins", "joint", "joignons", "joignez", "joignent"],
        "fut": "joindr", "pp": "joint", "ppr": "joignant",
        "ps": ["joignis", "joignis", "joignit", "joignîmes", "joignîtes", "joignirent"],
    },
    "peindre": {
        "pres": ["peins", "peins", "peint", "peignons", "peignez", "peignent"],
        "fut": "peindr", "pp": "peint", "ppr": "peignant",
        "ps": ["peignis", "peignis", "peignit", "peignîmes", "peignîtes", "peignirent"],
    },

    # ── -ir verbs that are not the -iss- family ──
    "partir": {
        "pres": ["pars", "pars", "part", "partons", "partez", "partent"],
        "fut": "partir", "pp": "parti", "ppr": "partant", "aux": "être",
        "ps": ["partis", "partis", "partit", "partîmes", "partîtes", "partirent"],
    },
    "sortir": {
        "pres": ["sors", "sors", "sort", "sortons", "sortez", "sortent"],
        "fut": "sortir", "pp": "sorti", "ppr": "sortant", "aux": "être",
        "ps": ["sortis", "sortis", "sortit", "sortîmes", "sortîtes", "sortirent"],
    },
    "dormir": {
        "pres": ["dors", "dors", "dort", "dormons", "dormez", "dorment"],
        "fut": "dormir", "pp": "dormi", "ppr": "dormant",
        "ps": ["dormis", "dormis", "dormit", "dormîmes", "dormîtes", "dormirent"],
    },
    "servir": {
        "pres": ["sers", "sers", "sert", "servons", "servez", "servent"],
        "fut": "servir", "pp": "servi", "ppr": "servant",
        "ps": ["servis", "servis", "servit", "servîmes", "servîtes", "servirent"],
    },
    "sentir": {
        "pres": ["sens", "sens", "sent", "sentons", "sentez", "sentent"],
        "fut": "sentir", "pp": "senti", "ppr": "sentant",
        "ps": ["sentis", "sentis", "sentit", "sentîmes", "sentîtes", "sentirent"],
    },
    "repentir": {   # se repentir: je me repens, not « je me repentis »
        "pres": ["repens", "repens", "repent", "repentons", "repentez", "repentent"],
        "fut": "repentir", "pp": "repenti", "ppr": "repentant", "aux": "être",
        "ps": ["repentis", "repentis", "repentit", "repentîmes", "repentîtes", "repentirent"],
    },
    "mentir": {
        "pres": ["mens", "mens", "ment", "mentons", "mentez", "mentent"],
        "fut": "mentir", "pp": "menti", "ppr": "mentant",
        "ps": ["mentis", "mentis", "mentit", "mentîmes", "mentîtes", "mentirent"],
    },
    "courir": {
        "pres": ["cours", "cours", "court", "courons", "courez", "courent"],
        "fut": "courr", "pp": "couru", "ppr": "courant",
        "ps": ["courus", "courus", "courut", "courûmes", "courûtes", "coururent"],
    },
    "mourir": {
        "pres": ["meurs", "meurs", "meurt", "mourons", "mourez", "meurent"],
        "fut": "mourr", "pp": "mort", "ppr": "mourant", "aux": "être",
        "ps": ["mourus", "mourus", "mourut", "mourûmes", "mourûtes", "moururent"],
    },
    "ouvrir": {
        "pres": ["ouvre", "ouvres", "ouvre", "ouvrons", "ouvrez", "ouvrent"],
        "fut": "ouvrir", "pp": "ouvert", "ppr": "ouvrant",
        "ps": ["ouvris", "ouvris", "ouvrit", "ouvrîmes", "ouvrîtes", "ouvrirent"],
    },
    "offrir": {
        "pres": ["offre", "offres", "offre", "offrons", "offrez", "offrent"],
        "fut": "offrir", "pp": "offert", "ppr": "offrant",
        "ps": ["offris", "offris", "offrit", "offrîmes", "offrîtes", "offrirent"],
    },
    "souffrir": {
        "pres": ["souffre", "souffres", "souffre", "souffrons", "souffrez", "souffrent"],
        "fut": "souffrir", "pp": "souffert", "ppr": "souffrant",
        "ps": ["souffris", "souffris", "souffrit", "souffrîmes", "souffrîtes", "souffrirent"],
    },
    "couvrir": {
        "pres": ["couvre", "couvres", "couvre", "couvrons", "couvrez", "couvrent"],
        "fut": "couvrir", "pp": "couvert", "ppr": "couvrant",
        "ps": ["couvris", "couvris", "couvrit", "couvrîmes", "couvrîtes", "couvrirent"],
    },
    "cueillir": {
        "pres": ["cueille", "cueilles", "cueille", "cueillons", "cueillez", "cueillent"],
        "fut": "cueiller", "pp": "cueilli", "ppr": "cueillant",
        "ps": ["cueillis", "cueillis", "cueillit", "cueillîmes", "cueillîtes", "cueillirent"],
    },
    "fuir": {
        "pres": ["fuis", "fuis", "fuit", "fuyons", "fuyez", "fuient"],
        "fut": "fuir", "pp": "fui", "ppr": "fuyant",
        "ps": ["fuis", "fuis", "fuit", "fuîmes", "fuîtes", "fuirent"],
    },
    "vêtir": {
        "pres": ["vêts", "vêts", "vêt", "vêtons", "vêtez", "vêtent"],
        "fut": "vêtir", "pp": "vêtu", "ppr": "vêtant",
        "ps": ["vêtis", "vêtis", "vêtit", "vêtîmes", "vêtîtes", "vêtirent"],
    },
    "acquérir": {
        "pres": ["acquiers", "acquiers", "acquiert", "acquérons", "acquérez", "acquièrent"],
        "fut": "acquerr", "pp": "acquis", "ppr": "acquérant",
        "ps": ["acquis", "acquis", "acquit", "acquîmes", "acquîtes", "acquirent"],
    },
    "bouillir": {
        "pres": ["bous", "bous", "bout", "bouillons", "bouillez", "bouillent"],
        "fut": "bouillir", "pp": "bouilli", "ppr": "bouillant",
        "ps": ["bouillis", "bouillis", "bouillit", "bouillîmes", "bouillîtes", "bouillirent"],
    },

    # ── -re families ──
    "connaître": {
        "pres": ["connais", "connais", "connaît", "connaissons", "connaissez", "connaissent"],
        "fut": "connaîtr", "pp": "connu", "ppr": "connaissant",
        "ps": ["connus", "connus", "connut", "connûmes", "connûtes", "connurent"],
    },
    "naître": {
        "pres": ["nais", "nais", "naît", "naissons", "naissez", "naissent"],
        "fut": "naîtr", "pp": "né", "ppr": "naissant", "aux": "être",
        "ps": ["naquis", "naquis", "naquit", "naquîmes", "naquîtes", "naquirent"],
    },
    "accroître": {
        "pres": ["accrois", "accrois", "accroît", "accroissons", "accroissez", "accroissent"],
        "fut": "accroîtr", "pp": "accru", "ppr": "accroissant",
        "ps": ["accrus", "accrus", "accrut", "accrûmes", "accrûtes", "accrurent"],
    },
    "décroître": {
        "pres": ["décrois", "décrois", "décroît", "décroissons", "décroissez", "décroissent"],
        "fut": "décroîtr", "pp": "décru", "ppr": "décroissant",
        "ps": ["décrus", "décrus", "décrut", "décrûmes", "décrûtes", "décrurent"],
    },
    # Only croître itself keeps crû and the circumflex throughout, to tell it
    # apart from « cru ». Its compounds do not.
    "croître": {
        "pres": ["croîs", "croîs", "croît", "croissons", "croissez", "croissent"],
        "fut": "croîtr", "pp": "crû", "ppr": "croissant",
        "ps": ["crûs", "crûs", "crût", "crûmes", "crûtes", "crûrent"],
    },
    "plaire": {
        "pres": ["plais", "plais", "plaît", "plaisons", "plaisez", "plaisent"],
        "fut": "plair", "pp": "plu", "ppr": "plaisant",
        "ps": ["plus", "plus", "plut", "plûmes", "plûtes", "plurent"],
    },
    "taire": {
        "pres": ["tais", "tais", "tait", "taisons", "taisez", "taisent"],
        "fut": "tair", "pp": "tu", "ppr": "taisant",
        "ps": ["tus", "tus", "tut", "tûmes", "tûtes", "turent"],
    },
    "lire": {
        "pres": ["lis", "lis", "lit", "lisons", "lisez", "lisent"],
        "fut": "lir", "pp": "lu", "ppr": "lisant",
        "ps": ["lus", "lus", "lut", "lûmes", "lûtes", "lurent"],
    },
    "écrire": {
        "pres": ["écris", "écris", "écrit", "écrivons", "écrivez", "écrivent"],
        "fut": "écrir", "pp": "écrit", "ppr": "écrivant",
        "ps": ["écrivis", "écrivis", "écrivit", "écrivîmes", "écrivîtes", "écrivirent"],
    },
    "conduire": {
        "pres": ["conduis", "conduis", "conduit", "conduisons", "conduisez", "conduisent"],
        "fut": "conduir", "pp": "conduit", "ppr": "conduisant",
        "ps": ["conduisis", "conduisis", "conduisit", "conduisîmes", "conduisîtes", "conduisirent"],
    },
    "rire": {
        "pres": ["ris", "ris", "rit", "rions", "riez", "rient"],
        "fut": "rir", "pp": "ri", "ppr": "riant",
        "ps": ["ris", "ris", "rit", "rîmes", "rîtes", "rirent"],
    },
    "suivre": {
        "pres": ["suis", "suis", "suit", "suivons", "suivez", "suivent"],
        "fut": "suivr", "pp": "suivi", "ppr": "suivant",
        "ps": ["suivis", "suivis", "suivit", "suivîmes", "suivîtes", "suivirent"],
    },
    "vivre": {
        "pres": ["vis", "vis", "vit", "vivons", "vivez", "vivent"],
        "fut": "vivr", "pp": "vécu", "ppr": "vivant",
        "ps": ["vécus", "vécus", "vécut", "vécûmes", "vécûtes", "vécurent"],
    },
    "boire": {
        "pres": ["bois", "bois", "boit", "buvons", "buvez", "boivent"],
        "fut": "boir", "pp": "bu", "ppr": "buvant",
        "ps": ["bus", "bus", "but", "bûmes", "bûtes", "burent"],
    },
    "croire": {
        "pres": ["crois", "crois", "croit", "croyons", "croyez", "croient"],
        "fut": "croir", "pp": "cru", "ppr": "croyant",
        "ps": ["crus", "crus", "crut", "crûmes", "crûtes", "crurent"],
    },
    "conclure": {
        "pres": ["conclus", "conclus", "conclut", "concluons", "concluez", "concluent"],
        "fut": "conclur", "pp": "conclu", "ppr": "concluant",
        "ps": ["conclus", "conclus", "conclut", "conclûmes", "conclûtes", "conclurent"],
    },
    "vaincre": {
        "pres": ["vaincs", "vaincs", "vainc", "vainquons", "vainquez", "vainquent"],
        "fut": "vaincr", "pp": "vaincu", "ppr": "vainquant",
        "ps": ["vainquis", "vainquis", "vainquit", "vainquîmes", "vainquîtes", "vainquirent"],
    },
    "résoudre": {
        "pres": ["résous", "résous", "résout", "résolvons", "résolvez", "résolvent"],
        "fut": "résoudr", "pp": "résolu", "ppr": "résolvant",
        "ps": ["résolus", "résolus", "résolut", "résolûmes", "résolûtes", "résolurent"],
    },
    "coudre": {
        "pres": ["couds", "couds", "coud", "cousons", "cousez", "cousent"],
        "fut": "coudr", "pp": "cousu", "ppr": "cousant",
        "ps": ["cousis", "cousis", "cousit", "cousîmes", "cousîtes", "cousirent"],
    },
    "moudre": {
        "pres": ["mouds", "mouds", "moud", "moulons", "moulez", "moulent"],
        "fut": "moudr", "pp": "moulu", "ppr": "moulant",
        "ps": ["moulus", "moulus", "moulut", "moulûmes", "moulûtes", "moulurent"],
    },
    "suffire": {
        "pres": ["suffis", "suffis", "suffit", "suffisons", "suffisez", "suffisent"],
        "fut": "suffir", "pp": "suffi", "ppr": "suffisant",
        "ps": ["suffis", "suffis", "suffit", "suffîmes", "suffîtes", "suffirent"],
    },

    # -cevoir: apercevoir, décevoir, concevoir, percevoir. Keyed on the ending
    # rather than on `recevoir`, because `apercevoir` does not end in it and
    # was matching `voir` instead, producing « apercevoyaient ».
    "cevoir": {
        "pres": ["çois", "çois", "çoit", "cevons", "cevez", "çoivent"],
        "fut": "cevr", "pp": "çu", "ppr": "cevant",
        "ps": ["çus", "çus", "çut", "çûmes", "çûtes", "çurent"],
    },
    # -crire: écrire, inscrire, décrire, prescrire. `inscrire` ends in "rire"
    # and was taking the `rire` model, giving « inscri » for the participle.
    "crire": {
        "pres": ["cris", "cris", "crit", "crivons", "crivez", "crivent"],
        "fut": "crir", "pp": "crit", "ppr": "crivant",
        "ps": ["crivis", "crivis", "crivit", "crivîmes", "crivîtes", "crivirent"],
    },
    "pourvoir": {   # regular future, unlike voir: pourvoira, not « pourverra »
        "pres": ["pourvois", "pourvois", "pourvoit", "pourvoyons", "pourvoyez", "pourvoient"],
        "fut": "pourvoir", "pp": "pourvu", "ppr": "pourvoyant",
        "ps": ["pourvus", "pourvus", "pourvut", "pourvûmes", "pourvûtes", "pourvurent"],
    },
}

# Models that may only match a verb EXACTLY, never as a suffix. `installer`
# ends in "aller" and was conjugated as « instvais » — a suffix match that is
# morphologically absurd, and exactly the confident nonsense this refuses to
# ship.
EXACT_ONLY = {"aller"}

# Verbs whose own entry must win over a longer-looking suffix match.
# `revenir` is venir, but `prévoir` is NOT voir, and `interdire` does not take
# the `dites` of dire — it takes `interdisez`.
DIRE_IRREGULAR_VOUS = {"dire", "redire"}   # the others take -disez
