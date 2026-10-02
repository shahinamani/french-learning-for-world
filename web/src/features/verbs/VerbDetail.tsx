/** One verb: every tense and mood, irregularities marked, practice from the table. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadVerb, loadTenseNames, type Verb, type TenseNames } from '../../lib/verbs';
import { statsForConcept } from '../../lib/progress';
import { useSidePanel } from '../../components/SidePanel';
import { Icon } from '../../components/Icon';
import { NotFound } from '../../routes/Stub';
import { fr as frText } from '../../lib/typography';
import { Localised } from '../../components/Localised';
import { withPronoun } from '../../lib/pronominal';

export function VerbDetail() {
  const { infinitive = '' } = useParams();
  const { t, settings } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const panel = useSidePanel();
  const [verb, setVerb] = useState<Verb | null | undefined>(undefined);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [names, setNames] = useState<TenseNames>({});
  useEffect(() => { loadTenseNames().then(setNames).catch(() => {}); }, []);

  useEffect(() => {
    let live = true;
    loadVerb(decodeURIComponent(infinitive)).then(async (v) => {
      if (!live) return;
      setVerb(v);
      if (v) {
        const entries = await Promise.all(v.tenses
          .filter((tn) => tn.conceptId)
          .map(async (tn) =>
            [tn.conceptId as string,
             (await statsForConcept(userId, tn.conceptId as string))?.reviews ?? 0] as const));
        if (live) setSeen(Object.fromEntries(entries));
      }
    }).catch(() => { if (live) setVerb(null); });
    return () => { live = false; };
  }, [infinitive, userId]);

  if (verb === undefined) return <div className="page"><div className="skeleton skeleton--title" /></div>;
  if (verb === null) return <NotFound />;

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)} data-testid="verb-back">
        ← {t('back')}
      </button>
      <div>
        {/* « se souvenir », not « souvenir ». The bare infinitive was the
            headword for all 51 pronominal-only verbs, and a learner copying it
            writes « je souviens ». */}
        <h1 className="h2" lang="fr" dir="ltr" data-testid="verb-headword">
          {frText(verb.headword ?? verb.infinitive)}
        </h1>
        {/* `verb.meanings[settings.meaning] ?? verb.meanings.en` was here. That
            pattern is forbidden in this codebase for the reason docs/04 gives:
            it serves English silently, so a learner reading Persian cannot tell
            a translated meaning from an untranslated one. `Localised` says
            which language came back, in the markup, and marks it. */}
        {verb.meanings?.en || verb.meanings?.[settings.meaning]
          ? <p className="muted"><Localised field={verb.meanings} locale={settings.meaning}
                                            testId="verb-meaning" /></p>
          : verb.glossWithheld === 'explicit'
            ? <p className="muted" data-testid="verb-gloss-withheld">{t('glossWithheldExplicit')}</p>
            : null}
        {/* Said on the page, every time, not once in an About screen. A learner
            about to memorise "to come" from a machine-harvested gloss should
            know no teacher has read it. */}
        {verb.pronominal
          ? <p className="fine" data-testid="verb-pronominal">{t('pronominalOnly')}</p>
          : null}
        {verb.meanings?.en
          ? <p className="fine muted" data-testid="verb-gloss-source">{t('glossSource')}</p>
          : null}
      </div>
      <div className="row gap-2 wrap">
        <span className={`chip chip--${verb.level.toLowerCase()}`}>{verb.level}</span>
        <span className="chip">{verb.irregular ? t('irregular') : t('regular')}</span>
        <span className="chip" lang="fr" dir="ltr">{t('auxiliary')}: {verb.auxiliary}</span>
        <span className="chip" lang="fr" dir="ltr">{frText(verb.participles.past)}</span>
        <span className="chip" lang="fr" dir="ltr">{frText(verb.participles.present)}</span>
      </div>

      {verb.tenses.map((tn) => (
        <section key={tn.id} className="card" aria-labelledby={`t-${tn.id}`}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            {/* The mood is a French grammatical term. It was rendered bare, with no
                separator and no language, against an English tense name inside a
                right-to-left heading. The gap is a flex gap rather than an inline
                margin: `dir="ltr"` on the mood flips which physical side
                `margin-inline-start` resolves to, so the margin landed on the far
                side and the two words touched. */}
            <h2 id={`t-${tn.id}`} className="h3"
                style={{ margin: 0, display: 'flex', gap: 'var(--space-2)',
                         alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Localised field={names[tn.id] ?? {}} />
              <span className="muted" lang="fr" dir="ltr" style={{ fontWeight: 400 }}>
                {tn.mood}
              </span>
            </h2>
            <div className="row gap-2">
              {/* The concept behind the tense, and the learner's record on it. */}
              {tn.conceptId && (
              <button className="chip chip--link" data-testid={`concept-${tn.conceptId}`}
                      onClick={() => panel.open(`concept:${tn.conceptId}`)}>
                {seen[tn.conceptId] ? t('reviewsCount', { n: seen[tn.conceptId] ?? 0 }) : t('openPanel')}
                <Icon name="chevron" size={12} />
              </button>
              )}
              {/* Practice straight from the table — but only for a tense a
                  learner is ever asked to produce. Drilling somebody on the
                  passé simple wastes the evening: they will read it and never
                  be asked to write it. */}
              {tn.produced && (
                <Link className="btn btn--sm btn--primary" data-testid={`practise-${tn.id}`}
                      to={`/practise/conjugation?verb=${encodeURIComponent(verb.infinitive)}&tense=${tn.id}`}>
                  {t('practiseTense')}
                </Link>
              )}
              {!tn.produced && (
                <span className="chip" data-testid={`read-only-${tn.id}`}>{t('readNotWritten')}</span>
              )}
            </div>
          </div>
          <table className="conj">
            <caption className="u-hidden-visually">
              <span lang="fr" dir="ltr">{verb.infinitive}</span>{' — '}<Localised field={names[tn.id] ?? {}} />
            </caption>
            <tbody>
              {verb.persons.map((p, i) => (tn.forms[i] ? (
                <tr key={p}>
                  <th scope="row" lang="fr" dir="ltr">{p}</th>
                  {/* The pronoun goes in the FORM cell, not the person cell: it
                      belongs to the verb, it elides against the form
                      (« je m'évanouis »), and a learner copying the cell must
                      get something they can write down. */}
                  <td lang="fr" dir="ltr" data-testid={`form-${tn.id}-${i}`}>
                    {frText(verb.pronominal
                      ? withPronoun('', i, tn.forms[i] ?? '').trim()
                      : (tn.forms[i] ?? ''))}
                  </td>
                </tr>
              ) : null))}
            </tbody>
          </table>
        </section>
      ))}

      <section className="card" aria-labelledby="imp-h">
        <h2 id="imp-h" className="h3">{t('imperative')}</h2>
        {verb.imperative ? (
          <table className="conj"><tbody>
            {['(tu)', '(nous)', '(vous)'].map((p, i) => (
              <tr key={p}><th scope="row" lang="fr" dir="ltr">{p}</th>
                <td lang="fr" dir="ltr">{frText(verb.imperative![i] ?? '')}</td></tr>
            ))}
          </tbody></table>
        ) : (
          /* Saying "this verb has none" is information; an empty table is not. */
          <p className="muted" data-testid="no-imperative">{t('noImperative')}</p>
        )}
      </section>
    </div>
  );
}
