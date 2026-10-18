/**
 * /app/grammar — the grammar library, built to the §8 standard: a title, a
 * one-line description, search, filters, a result count, removable chips, and
 * state that survives leaving and coming back.
 *
 * "Survives" means the ADDRESS holds it (`?q=&level=&topic=`). Back from a
 * lesson, a refresh and a pasted link all restore the same view, which React
 * state could do for none of them. Each lesson link also carries this very
 * address as its origin, so finishing a lesson returns here, filters intact.
 */
import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useApp } from '../../app-context';
import { Localised } from '../../components/Localised';
import { fold } from '../../lib/fold';
import { pick } from '../../lib/exams';
import { lessonPath, topicOf, type Lesson, type LessonData } from './lessons';
import { PageState, useLessons, useLessonsGate } from './useLessons';
import './grammar.css';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];

export function GrammarList() {
  const [state, retry] = useLessons();
  const gate = useLessonsGate(state, retry);
  return (
    <div className="page grl-page" data-testid="grammar-list">
      <Heading />
      {gate ?? (state.status === 'ready' && <Library data={state.data} />)}
    </div>
  );
}

function Heading() {
  const { t } = useApp();
  return (
    <header>
      <h1 className="h2" data-testid="grammar-title">{t('grlTitle')}</h1>
      <p className="muted" data-testid="grammar-lead">{t('grlLead')}</p>
    </header>
  );
}

function Library({ data }: { data: LessonData }) {
  const { t, settings } = useApp();
  const [params, setParams] = useSearchParams();
  const here = useLocation();
  const q = params.get('q') ?? '';
  const level = params.get('level') ?? '';
  const topic = params.get('topic') ?? '';

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    // replace: typing a letter is not a page to go Back to.
    setParams(next, { replace: true });
  };
  const clear = () => setParams(new URLSearchParams(), { replace: true });

  const rows = useMemo(() => data.lessons.map((lesson) => {
    const concept = data.concepts.get(lesson.conceptId);
    return { lesson, concept, topic: topicOf(data.concepts, lesson.conceptId) };
  }), [data]);

  const topics = useMemo(() => {
    const seen = new Map<string, NonNullable<(typeof rows)[number]['topic']>>();
    for (const r of rows) if (r.topic) seen.set(r.topic.id, r.topic);
    return [...seen.values()];
  }, [rows]);
  const levels = LEVELS.filter((l) => rows.some((r) => r.lesson.level === l));

  const needle = fold(q.trim());
  const shown = rows.filter((r) => {
    if (level && r.lesson.level !== level) return false;
    if (topic && r.topic?.id !== topic) return false;
    if (!needle) return true;
    const hay = [
      ...Object.values(r.concept?.name ?? {}),
      ...Object.values(r.lesson.explanation),
      ...Object.values(r.lesson.simplerExplanation ?? {}),
      ...Object.values(r.lesson.difference),
      r.lesson.id,
      ...r.lesson.examples.map((e) => e.fr),
    ].filter(Boolean).map((s) => fold(s as string));
    return hay.some((h) => h.includes(needle));
  });

  const topicName = (id: string) => {
    const c = topics.find((x) => x.id === id);
    return c ? pick(c.name, settings.ui).text : id;
  };
  const chips: { key: string; name: string; remove: () => void }[] = [];
  if (q.trim()) chips.push({ key: 'q', name: t('grlSearchChip', { q: q.trim() }), remove: () => set('q', '') });
  if (level) chips.push({ key: 'level', name: `${t('grlFilterLevel')}: ${level}`, remove: () => set('level', '') });
  if (topic) chips.push({ key: 'topic', name: `${t('grlFilterTopic')}: ${topicName(topic)}`, remove: () => set('topic', '') });

  if (data.lessons.length === 0) {
    return <PageState kind="empty" title={t('grlEmpty')} body={t('grlEmptyHelp')}
                      primary={{ label: t('grlRetryLoad'), onClick: () => location.reload(), testId: 'grl-empty-action' }} />;
  }

  const origin = here.pathname + here.search;
  return (
    <>
      <div className="grl-controls card">
        <label className="grl-search">
          <span className="eyebrow">{t('grlSearch')}</span>
          <input type="search" value={q} data-testid="grammar-search"
                 placeholder={t('grlSearchPlaceholder')}
                 onChange={(e) => set('q', e.target.value)} />
        </label>

        <FilterRow label={t('grlFilterLevel')} testId="grammar-filter-level"
                   allLabel={t('grlAll')} value={level} onChange={(v) => set('level', v)}
                   options={levels.map((l) => ({ value: l, label: l }))} />
        <FilterRow label={t('grlFilterTopic')} testId="grammar-filter-topic"
                   allLabel={t('grlAll')} value={topic} onChange={(v) => set('topic', v)}
                   options={topics.map((c) => ({ value: c.id, label: pick(c.name, settings.ui).text }))} />
      </div>

      <div className="grl-status row gap-2">
        <p className="grl-count" role="status" aria-live="polite" data-testid="grammar-count">
          {t('grlCount', { n: shown.length, total: rows.length })}
        </p>
        {chips.length > 0 && (
          <ul className="chips grl-chips" aria-label={t('grlActiveFilters')} data-testid="grammar-chips">
            {chips.map((c) => (
              <li key={c.key}>
                <button type="button" className="ws-chip is-on grl-chip" onClick={c.remove}
                        aria-label={t('grlRemoveFilter', { name: c.name })}
                        data-testid={`grammar-chip-${c.key}`}>
                  {c.name} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="btn btn--ghost btn--sm" onClick={clear}
                      data-testid="grammar-clear">{t('grlClearFilters')}</button>
            </li>
          </ul>
        )}
      </div>

      {shown.length === 0 ? (
        <PageState kind="empty" title={t('grlNoMatch')} body={t('grlNoMatchHelp')}
                   primary={{ label: t('grlClearFilters'), onClick: clear, testId: 'grammar-empty-clear' }} />
      ) : (
        <ul className="grl-cards" data-testid="grammar-cards">
          {shown.map(({ lesson, concept }) => (
            <li key={lesson.id}>
              <LessonCard lesson={lesson} name={concept?.name} origin={origin} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function LessonCard({ lesson, name, origin }:
  { lesson: Lesson; name: Parameters<typeof Localised>[0]['field']; origin: string }) {
  const { t } = useApp();
  return (
    <article className="card grl-card" data-testid={`grammar-card-${lesson.id}`}>
      <div className="row gap-2">
        <span className={`chip chip--${lesson.level.toLowerCase()}`}>{lesson.level}</span>
        <span className="muted">{t('grlQuestionsN', { n: lesson.questions.length })}</span>
      </div>
      <h2 className="h3"><Localised field={name} /></h2>
      {/* The one-line description is the lesson's own simpler explanation: a
          single question, written by the lesson's author, not a summary made here. */}
      <p className="muted grl-card__line"><Localised field={lesson.simplerExplanation} /></p>
      <Link className="btn btn--primary" to={lessonPath(lesson.id, origin)}
            data-testid={`grammar-open-${lesson.id}`}>
        {t('grlOpenLesson')}
      </Link>
    </article>
  );
}

function FilterRow({ label, testId, allLabel, value, onChange, options }:
  { label: string; testId: string; allLabel: string; value: string;
    onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="ws-filters" role="group" aria-label={label} data-testid={testId}>
      <span className="ws-filters__label" aria-hidden="true">{label}</span>
      <button type="button" className={`ws-chip${value === '' ? ' is-on' : ''}`}
              aria-pressed={value === ''} onClick={() => onChange('')}>{allLabel}</button>
      {options.map((o) => (
        <button key={o.value} type="button" className={`ws-chip${value === o.value ? ' is-on' : ''}`}
                aria-pressed={value === o.value} data-testid={`${testId}-${o.value}`}
                onClick={() => onChange(value === o.value ? '' : o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
