/**
 * One box over everything. It is a route (`/search?q=`), not a modal held in
 * state, so a search is shareable, survives refresh, and the back button
 * leaves it. ⌘K / Ctrl-K navigates here from anywhere.
 *
 * It takes commands as well as queries: "5 min" starts a five-minute session,
 * "B1" filters to that level.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app-context';
import { loadContent } from '../lib/content';
import type { Card, Concept } from '../lib/types';
import { Icon } from './Icon';
import { fr as frText } from '../lib/typography';
import { fold } from '../lib/fold';
import { WithAccentBar } from './AccentBar';

type Result =
  | { kind: 'command'; label: string; to: string }
  | { kind: 'concept'; concept: Concept }
  | { kind: 'card'; card: Card };

// Shared with answer checking and the verb filter: three near-copies of this
// had drifted, and none of them handled the œ/æ ligatures.
const norm = fold;

export function searchAll(q: string, cards: Card[], concepts: Concept[]): Result[] {
  const needle = norm(q.trim());
  if (!needle) return [];
  const out: Result[] = [];
  const mins = needle.match(/^(\d{1,3})\s*(min|m)?$/);
  if (mins?.[1] && Number(mins[1]) >= 1 && Number(mins[1]) <= 180) {
    out.push({ kind: 'command', label: `${mins[1]} min`, to: `/practise/review?minutes=${mins[1]}` });
  }
  const level = needle.match(/^([abc][12])$/);
  if (level?.[1]) out.push({ kind: 'command', label: level[1].toUpperCase(), to: `/learn?level=${level[1].toUpperCase()}` });

  for (const c of concepts) {
    if (c.retired) continue;
    if (norm(c.name.en).includes(needle) || norm(c.name.fr).includes(needle) || norm(c.id).includes(needle)) {
      out.push({ kind: 'concept', concept: c });
    }
  }
  for (const c of cards) {
    const inMeaning = Object.values(c.meanings).some((m) => m && norm(m).includes(needle));
    if (norm(c.fr).includes(needle) || inMeaning) out.push({ kind: 'card', card: c });
  }
  // Commands first, then concepts, then words; each group already in order.
  return out.slice(0, 40);
}

export function SearchRoute() {
  const { t, settings } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [cards, setCards] = useState<Card[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    loadContent().then((c) => { if (live) { setCards(c.cards); setConcepts(c.concepts); } })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const setQuery = (v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set('q', v); else p.delete('q');
    setParams(p, { replace: true });
  };

  const results = useMemo(() => searchAll(q, cards, concepts), [q, cards, concepts]);
  const grouped = {
    command: results.filter((r) => r.kind === 'command'),
    concept: results.filter((r) => r.kind === 'concept'),
    card: results.filter((r) => r.kind === 'card'),
  };

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  return (
    <div className="page">
      <h1 className="h2">{t('search')}</h1>
      <WithAccentBar inputRef={input} onInsert={setQuery}>
        <label className="field" style={{ marginBlockEnd: 'var(--space-4)' }}>
          <span className="u-hidden-visually">{t('search')}</span>
          <input
            ref={input} id="search-q" className="input" type="search" value={q} data-testid="search-input"
            placeholder={t('searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </WithAccentBar>

      {!q && <p className="muted" data-testid="search-hint">{t('searchHint')}</p>}
      {q && results.length === 0 && (
        <p className="muted" data-testid="search-empty">{t('searchEmpty', { q })}</p>
      )}

      {grouped.command.length > 0 && (
        <section><h2 className="eyebrow">{t('practise')}</h2>
          <ul className="rows" data-testid="search-commands">
            {grouped.command.map((r, i) => r.kind === 'command' && (
              <li key={i}><Link className="row row--link" to={r.to}>
                <Icon name="timer" /><span>{r.label}</span><Icon name="chevron" size={16} />
              </Link></li>
            ))}
          </ul></section>
      )}
      {grouped.concept.length > 0 && (
        <section><h2 className="eyebrow">{t('concepts')}</h2>
          <ul className="rows" data-testid="search-concepts">
            {grouped.concept.slice(0, 12).map((r) => r.kind === 'concept' && (
              <li key={r.concept.id}>
                <Link className="row row--link" to={`/learn/concept/${encodeURIComponent(r.concept.id)}`}>
                  <span lang={settings.ui === 'fr' ? 'fr' : undefined}>
                    {settings.ui === 'fr' ? frText(r.concept.name.fr) : r.concept.name.en}
                  </span>
                  <span className={`chip chip--${r.concept.level.toLowerCase()}`}>{r.concept.level}</span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul></section>
      )}
      {grouped.card.length > 0 && (
        <section><h2 className="eyebrow">{t('cards')}</h2>
          <ul className="rows" data-testid="search-cards">
            {grouped.card.slice(0, 12).map((r) => r.kind === 'card' && (
              <li key={r.card.key}>
                <Link className="row row--link" to={`/practise/review?card=${encodeURIComponent(r.card.key)}`}>
                  <span className="row-fr" lang="fr" dir="ltr">{r.card.fr}</span>
                  <span className="muted">{r.card.meanings[settings.meaning] ?? r.card.meanings.en}</span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
          </ul></section>
      )}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useApp();
  return (
    <div className="empty" data-testid="error-state">
      <div className="empty__icon"><Icon name="alert" size={34} /></div>
      <p className="empty__title">{t('loadFailed')}</p>
      <button className="btn btn--primary" onClick={onRetry}>{t('retry')}</button>
    </div>
  );
}
