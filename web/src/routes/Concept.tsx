/** One concept: what it is, the learner's record, and practice on it alone. */
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { loadContent } from '../lib/content';
import { statsForConcept, type ConceptStat } from '../lib/progress';
import type { Card, Concept as C } from '../lib/types';
import { Icon } from '../components/Icon';
import { NotFound } from './Stub';
import { Localised } from '../components/Localised';
import { pick } from '../lib/exams';

export function ConceptRoute() {
  const { id = '' } = useParams();
  const { t, settings } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const [concept, setConcept] = useState<C | null | undefined>(undefined);
  const [stat, setStat] = useState<ConceptStat | null>(null);
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const content = await loadContent();
      const s = await statsForConcept(userId, id);
      if (!live) return;
      setConcept(content.conceptById.get(id) ?? null);
      setCards(content.cards.filter((c) => c.conceptIds.includes(id)));
      setStat(s);
    })();
    return () => { live = false; };
  }, [id, userId]);

  if (concept === undefined) return <div className="page"><div className="skeleton skeleton--title" /></div>;
  if (concept === null) return <NotFound />;

  const shown = pick(concept.name, settings.ui);
  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)} data-testid="concept-back">
        ← {t('back')}
      </button>
      <h1 className="h2"><Localised field={concept.name} /></h1>
      {!shown.translated && <p className="muted notice-untranslated">{t('notTranslatedName')}</p>}
      <div className="row gap-2" style={{ marginBlockEnd: 'var(--space-4)' }}>
        <span className={`chip chip--${concept.level.toLowerCase()}`}>{concept.level}</span>
        <span className="chip">{t(concept.type as 'grammar')}</span>
      </div>

      <section className="card" aria-labelledby="rec-h">
        <h2 id="rec-h" className="eyebrow">{t('conceptRecord')}</h2>
        {stat ? (
          <dl className="facts" data-testid="concept-stat">
            <dt>{t('reviewsCount', { n: stat.reviews })}</dt><dd>{stat.reviews}</dd>
            <dt>{t('accuracy')}</dt><dd>{Math.round(stat.accuracy * 100)} %</dd>
          </dl>
        ) : <p className="muted" data-testid="concept-no-record">{t('noRecordYet')}</p>}
      </section>

      {cards.length > 0 ? (
        <>
          <Link className="btn btn--primary btn--block" data-testid="concept-practise"
                to={`/practise/review?concept=${encodeURIComponent(id)}`}
                style={{ marginBlock: 'var(--space-4)' }}>
            {t('practiseThis')} ({cards.length})
          </Link>
          <h2 className="h3">{t('cards')}</h2>
          <ul className="rows">
            {cards.map((c) => (
              <li key={c.key}>
                <Link className="row row--link" to={`/practise/review?card=${encodeURIComponent(c.key)}`}>
                  <span className="row-fr" lang="fr" dir="ltr">{c.fr}</span>
                  <span className="muted">{c.meanings[settings.meaning] ?? c.meanings.en}</span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted" style={{ marginBlockStart: 'var(--space-4)' }} data-testid="concept-no-cards">
          {t('notBuiltBody')}
        </p>
      )}
    </div>
  );
}
