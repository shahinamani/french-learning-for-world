/** One verb: every tense and mood, irregularities marked, practice from the table. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadVerbs, type Verb } from '../../lib/verbs';
import { statsForConcept } from '../../lib/progress';
import { useSidePanel } from '../../components/SidePanel';
import { Icon } from '../../components/Icon';
import { NotFound } from '../../routes/Stub';
import { fr as frText } from '../../lib/typography';

export function VerbDetail() {
  const { infinitive = '' } = useParams();
  const { t, settings } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const panel = useSidePanel();
  const [verb, setVerb] = useState<Verb | null | undefined>(undefined);
  const [seen, setSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    loadVerbs().then(async (vs) => {
      const v = vs.find((x) => x.infinitive === decodeURIComponent(infinitive)) ?? null;
      if (!live) return;
      setVerb(v);
      if (v) {
        const entries = await Promise.all(v.tenses.map(async (tn) =>
          [tn.conceptId, (await statsForConcept(userId, tn.conceptId))?.reviews ?? 0] as const));
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
        <h1 className="h2" lang="fr" dir="ltr">{frText(verb.infinitive)}</h1>
        <p className="muted">{verb.meanings[settings.meaning] ?? verb.meanings.en}</p>
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
            <h2 id={`t-${tn.id}`} className="h3" style={{ margin: 0 }}>
              {settings.ui === 'fr' ? frText(tn.name.fr) : tn.name.en}
              <span className="muted" style={{ marginInlineStart: 'var(--space-2)', fontWeight: 400 }}>
                {tn.mood}
              </span>
            </h2>
            <div className="row gap-2">
              {/* The concept behind the tense, and the learner's record on it. */}
              <button className="chip chip--link" data-testid={`concept-${tn.conceptId}`}
                      onClick={() => panel.open(`concept:${tn.conceptId}`)}>
                {seen[tn.conceptId] ? t('reviewsCount', { n: seen[tn.conceptId] ?? 0 }) : t('openPanel')}
                <Icon name="chevron" size={12} />
              </button>
              {/* Practice straight from the table. */}
              <Link className="btn btn--sm btn--primary" data-testid={`practise-${tn.id}`}
                    to={`/practise/conjugation?verb=${encodeURIComponent(verb.infinitive)}&tense=${tn.id}`}>
                {t('practiseTense')}
              </Link>
            </div>
          </div>
          <table className="conj">
            <caption className="u-hidden-visually">
              {verb.infinitive} — {settings.ui === 'fr' ? tn.name.fr : tn.name.en}
            </caption>
            <tbody>
              {verb.persons.map((p, i) => (
                <tr key={p}>
                  <th scope="row" lang="fr" dir="ltr">{p}</th>
                  <td lang="fr" dir="ltr" data-testid={`form-${tn.id}-${i}`}>{frText(tn.forms[i] ?? '')}</td>
                </tr>
              ))}
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
