/**
 * The reading library: blueprint section 8's standard — a clear title and
 * one-line description on every card, search, filters, a result count,
 * removable chips, and filter state that is still there when you come back.
 *
 * The filter state lives in the URL (`?topic=work&level=A2`), not in component
 * state, which is what makes "come back" work: the card links carry the query
 * to the reader page, and Back returns to the same address.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { Localised } from '../../components/Localised';
import { pick } from '../../lib/exams';
import { fr as frText } from '../../lib/typography';
import {
  applyFilters, minutesOf, parseFilters, writeFilters, EMPTY_FILTERS,
  type Duration, type Filters,
} from './model';
import { CATEGORIES, type ReadingCategory, type ReadingText } from './types';
import { deleteSaved, putSaved, positionsFor, resultsForUser, savedForUser, type ReaderResult } from './store';
import { ReaderState, useReadingTexts, useWide } from './ui';
import './reader.css';

type Key = Parameters<ReturnType<typeof useApp>['t']>[0];
const TOPIC_KEY: Record<ReadingCategory, Key> = {
  daily: 'rdTopicDaily', work: 'rdTopicWork', science: 'rdTopicScience', culture: 'rdTopicCulture',
};
const DURATION_KEY: Record<Duration, Key> = { short: 'rdDurShort', medium: 'rdDurMedium', long: 'rdDurLong' };

type Group = 'level' | 'topic' | 'duration' | 'type';

export function ReaderList() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [data, retry] = useReadingTexts();
  const wide = useWide();
  const [sheet, setSheet] = useState(false);

  const filters = useMemo(() => parseFilters(params), [params]);
  const setFilters = (f: Filters) => setParams(writeFilters(f), { replace: true });

  // The learner's own marks on each text. Storage can be unavailable (private
  // window): then the cards simply carry no marks, which is true.
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState<Map<string, number>>(new Map());
  const [results, setResults] = useState<Map<string, ReaderResult>>(new Map());
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const ids = data.state === 'ready' ? data.texts.map((x) => x.id) : [];
        const [s, p, r] = await Promise.all([savedForUser(userId), positionsFor(userId, ids), resultsForUser(userId)]);
        if (!live) return;
        setSaved(new Set(s.map((x) => x.itemId)));
        setStarted(p);
        setResults(new Map(r.map((x) => [x.itemId, x])));
      } catch { /* no marks to show */ }
    })();
    return () => { live = false; };
  }, [userId, data]);

  const toggleSave = async (id: string) => {
    const was = saved.has(id);
    setSaved((prev) => { const n = new Set(prev); if (was) n.delete(id); else n.add(id); return n; });
    try {
      if (was) await deleteSaved(userId, id);
      else await putSaved({ userId, itemId: id, savedAt: Date.now() });   // no `context`: a text has no source sentence
    } catch {
      setSaved((prev) => { const n = new Set(prev); if (was) n.add(id); else n.delete(id); return n; });
    }
  };

  if (data.state === 'loading') {
    return (
      <div className="rd" data-testid="rd-loading" aria-busy="true">
        <h1 className="h2">{t('rdTitle')}</h1>
        <p className="rd-note" dir="auto" role="status">{t('rdLoading')}</p>
        <div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" /><div className="skeleton skeleton--text" />
      </div>
    );
  }
  if (data.state === 'error' || data.state === 'offline') {
    const off = data.state === 'offline';
    return (
      <div className="rd">
        <ReaderState kind={data.state} icon="alert" title={t(off ? 'rdOfflineTitle' : 'rdErrorTitle')} body={t(off ? 'rdOfflineBody' : 'rdErrorBody')}>
          <button type="button" className="btn btn--primary" onClick={retry} data-testid="rd-retry">{t('rdRetry')}</button>
        </ReaderState>
      </div>
    );
  }
  const texts = data.texts;
  if (texts.length === 0) {
    return (
      <div className="rd">
        <ReaderState kind="empty" title={t('rdNoTextsTitle')} body={t('rdNoTextsBody')}>
          <Link className="btn btn--primary" to="/app/vocabulary">{t('rdMyWords')}</Link>
        </ReaderState>
      </div>
    );
  }

  const titleIn = (x: ReadingText) => pick(x.title, settings.ui).text;
  const shown = applyFilters(texts, filters, titleIn);
  const levels = [...new Set(texts.map((x) => x.level ?? 'none'))].sort();
  const levelName = (l: string) => (l === 'none' ? t('rdLevelNone') : l);

  const toggle = (g: Exclude<Group, 'type'> | 'type', v: string) => {
    const cur = filters[g] as string[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    setFilters({ ...filters, [g]: next } as Filters);
  };

  const chips: { id: string; name: string; remove: () => void }[] = [];
  if (filters.q.trim()) chips.push({ id: 'q', name: `“${filters.q.trim()}”`, remove: () => setFilters({ ...filters, q: '' }) });
  filters.level.forEach((v) => chips.push({ id: `level:${v}`, name: levelName(v), remove: () => toggle('level', v) }));
  filters.topic.forEach((v) => chips.push({ id: `topic:${v}`, name: t(TOPIC_KEY[v] ?? 'rdTopicDaily'), remove: () => toggle('topic', v) }));
  filters.duration.forEach((v) => chips.push({ id: `duration:${v}`, name: t(DURATION_KEY[v] ?? 'rdDurShort'), remove: () => toggle('duration', v) }));
  filters.type.forEach((v) => chips.push({ id: `type:${v}`, name: t('rdTypeText'), remove: () => toggle('type', v) }));

  const controls = (
    <>
      <FilterGroup legend={t('rdFilterLevel')} group="level" name="level">
        {levels.map((l) => <Opt key={l} id={`l-${l}`} label={levelName(l)} on={filters.level.includes(l)} onChange={() => toggle('level', l)} />)}
      </FilterGroup>
      <FilterGroup legend={t('rdFilterTopic')} group="topic" name="topic">
        {CATEGORIES.map((c) => <Opt key={c} id={`t-${c}`} label={t(TOPIC_KEY[c])} on={filters.topic.includes(c)} onChange={() => toggle('topic', c)} />)}
      </FilterGroup>
      <FilterGroup legend={t('rdFilterDuration')} group="duration" name="duration">
        {(['short', 'medium', 'long'] as Duration[]).map((d) => <Opt key={d} id={`d-${d}`} label={t(DURATION_KEY[d])} on={filters.duration.includes(d)} onChange={() => toggle('duration', d)} />)}
      </FilterGroup>
      <FilterGroup legend={t('rdFilterType')} group="type" name="type">
        <Opt id="y-text" label={t('rdTypeText')} on={filters.type.includes('text')} onChange={() => toggle('type', 'text')} />
      </FilterGroup>
    </>
  );

  return (
    <div className="rd" data-testid="reader-list">
      <header className="rd-head">
        <h1 className="h2">{t('rdTitle')}</h1>
        <p className="rd-lead" dir="auto">{t('rdLead')}</p>
        <p className="rd-note" dir="auto" data-testid="rd-drafted">{t('rdDraftedNote')}</p>
      </header>

      <div className="rd-search" role="search">
        <div className="field">
          <label className="field__label" htmlFor="rd-q">{t('rdSearchLabel')}</label>
          <input id="rd-q" className="input" type="search" value={filters.q} data-testid="rd-search"
            placeholder={t('rdSearchPlaceholder')} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
        {!wide && (
          <button type="button" className="btn" onClick={() => setSheet(true)} data-testid="rd-open-filters">
            <Icon name="settings" size={16} /> {t('rdFilters')}{chips.length ? ` (${chips.length})` : ''}
          </button>
        )}
      </div>

      {wide && <div className="rd-filters rd-filters--wide" data-testid="rd-filters">{controls}</div>}
      {!wide && (
        <Dialog.Root open={sheet} onOpenChange={setSheet}>
          <Dialog.Portal>
            <Dialog.Overlay className="rd-scrim" />
            <Dialog.Content className="rd-sheet" aria-describedby={undefined} data-testid="rd-filter-sheet">
              <Dialog.Title className="h2">{t('rdFilters')}</Dialog.Title>
              <div className="rd-filters rd-filters--wide" style={{ flexDirection: 'column' }}>{controls}</div>
              <Dialog.Close className="btn btn--primary">{t('rdResultCount', { n: shown.length })}</Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <p className="rd-count" dir="auto" role="status" aria-live="polite" data-testid="rd-count">
        {shown.length === 1 ? t('rdResultCountOne') : t('rdResultCount', { n: shown.length })}
      </p>
      {chips.length > 0 && (
        <ul className="rd-active" aria-label={t('rdFilters')} data-testid="rd-chips">
          {chips.map((c) => (
            <li key={c.id}>
              <button type="button" className="rd-chip" data-testid="rd-chip" onClick={c.remove}
                aria-label={t('rdRemoveFilter', { name: c.name })}>
                {c.name} <Icon name="close" size={14} />
              </button>
            </li>
          ))}
          <li><button type="button" className="btn btn--ghost btn--sm" onClick={() => setFilters(EMPTY_FILTERS)}>{t('rdClearFilters')}</button></li>
        </ul>
      )}

      {shown.length === 0 ? (
        <ReaderState kind="empty" title={t('rdEmptyTitle')} body={t('rdEmptyBody')}>
          <button type="button" className="btn btn--primary" onClick={() => setFilters(EMPTY_FILTERS)} data-testid="rd-clear">{t('rdClearFilters')}</button>
        </ReaderState>
      ) : (
        <ul className="rd-cards">
          {shown.map((x) => {
            const pos = started.get(x.id) ?? 0;
            const res = results.get(x.id);
            const isSaved = saved.has(x.id);
            return (
              <li key={x.id}>
                <article className="card rd-card" data-testid="rd-card" data-id={x.id}>
                  <div className="rd-meta">
                    <span className={`chip chip--${(x.level ?? '').toLowerCase()}`}>{x.level ?? t('rdLevelNone')}</span>
                    <span>{t(TOPIC_KEY[x.category])}</span>
                    <span>{t('rdMinutes', { n: minutesOf(x) })}</span>
                    {isSaved && <span data-testid="rd-card-saved">{t('rdSavedBadge')}</span>}
                    {res && <span>{t('rdResultBadge', { c: res.correct, n: res.total })}</span>}
                  </div>
                  <h2 className="rd-card__title" lang="fr" dir="ltr">{frText(x.title.fr ?? '')}</h2>
                  <p className="rd-card__sub"><Localised field={x.title} /></p>
                  <p className="rd-card__desc"><Localised field={x.description} /></p>
                  <div className="rd-card__actions">
                    <Link className="btn btn--primary" to={`/app/reading/${x.id}`} state={{ from: location.search }} data-testid="rd-open">
                      {pos > 0 ? t('rdContinue') : t('rdRead')}
                    </Link>
                    <button type="button" className="btn" aria-pressed={isSaved} onClick={() => toggleSave(x.id)} data-testid="rd-card-save">
                      {isSaved ? t('rdSavedForLater') : t('rdSave')}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterGroup({ legend, group, children }: { legend: string; group: Group; name: string; children: React.ReactNode }) {
  return (
    <fieldset className="rd-group" data-group={group}>
      <legend>{legend}</legend>
      <div className="rd-opts">{children}</div>
    </fieldset>
  );
}

function Opt({ id, label, on, onChange }: { id: string; label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="rd-opt">
      <input type="checkbox" id={id} checked={on} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

