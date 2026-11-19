/**
 * "This card": what the card in front of the learner is — its level, its kind,
 * the concepts it practises (each a link to a session on that concept) — and
 * the learner's record on it: how often seen, when last, the grade given in
 * this sitting, and what each grade would schedule next (the scheduler's own
 * preview, the same numbers the rating buttons show).
 */
import '../../lib/locales/en/todayEn';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app-context';
import { loadContent } from '../../lib/content';
import { GRADES, type Grade } from '../../lib/scheduler';
import type { Card, CardState, Concept } from '../../lib/types';
import { Localised } from '../Localised';
import { Num } from '../Num';
import { AsideCard } from './index';

const GRADE_KEY = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const;

export function ThisCardCard({ card, state, previews, lastGrade }:
  { card: Card; state: CardState; previews: Record<Grade, number>; lastGrade: Grade | null }) {
  const { t, settings } = useApp();
  const [byId, setById] = useState<Map<string, Concept> | null>(null);
  useEffect(() => {
    let live = true;
    loadContent().then((c) => { if (live) setById(c.conceptById); }).catch(() => { if (live) setById(new Map()); });
    return () => { live = false; };
  }, []);
  let last = '';
  if (state.lastReviewedAt) {
    try { last = new Intl.DateTimeFormat(settings.ui, { dateStyle: 'medium' }).format(state.lastReviewedAt); }
    catch { last = new Date(state.lastReviewedAt).toISOString().slice(0, 10); }
  }
  return (
    <AsideCard title={t('tdBsThisCard')} testId="aside-this-card">
      <p className="aside-card__lead">
        <span className={`chip chip--${card.level.toLowerCase()}`}>{card.level}</span>{' '}
        <span className="chip">{t(card.type as 'verb')}</span>
      </p>
      <p className="aside-card__facts">
        {state.reps === 0 ? t('cardNew') : <Num>{t('cardSeen', { n: state.reps })}</Num>}
        {last && <> · <Num>{t('tdBsLastReviewed', { d: last })}</Num></>}
      </p>
      <p className="aside-card__facts" data-testid="aside-last-grade">
        {lastGrade ? t('tdBsLastGrade', { g: t(GRADE_KEY[lastGrade]) }) : t('tdBsLastGradeNone')}
      </p>
      <p className="aside-card__facts">{t('tdBsNextIf')}</p>
      <ul className="aside-grades" data-testid="aside-previews">
        {GRADES.map((g) => (
          <li key={g} data-grade={GRADE_KEY[g]}>
            <span>{t(GRADE_KEY[g])}</span>
            <span><Num>{previews[g] === 0 ? t('now') : t('days', { n: previews[g] })}</Num></span>
          </li>
        ))}
      </ul>
      <p className="aside-card__facts">{t('tdBsConcepts')}</p>
      {card.conceptIds.length === 0 && <p className="muted fine">{t('tdBsNoConcepts')}</p>}
      {card.conceptIds.length > 0 && (
        <ul className="aside-list">
          {card.conceptIds.map((id) => {
            const c = byId?.get(id);
            return (
              <li key={id}>
                <Link to={`/app/cards?concept=${encodeURIComponent(id)}`} data-testid={`aside-concept-${id}`}>
                  {c ? <Localised field={c.name} /> : <span>{id}</span>}
                  {c && <span className="muted">{c.level}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AsideCard>
  );
}
