/**
 * Side-column cards for the reading library and the reader page (redesign
 * v2b, owner 2026-11-19). Every figure is the learner's own record or a field
 * of the text's data file; nothing is estimated here.
 */
import '../../lib/locales/en/todayEn';   // registers its English (lazy group)
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { AsideCard } from './index';
import { Icon } from '../Icon';
import type { ReadingText } from '../../features/reader/types';
import type { ReaderResult } from '../../lib/types';

/** "n of m texts answered", and how the last one went. */
export function ReaderResultsCard({ results, texts }: { results: ReaderResult[]; texts: ReadingText[] }) {
  const { t } = useApp();
  const ids = new Set(texts.map((x) => x.id));
  const mine = results.filter((r) => ids.has(r.itemId)).sort((a, b) => b.updatedAt - a.updatedAt);
  const last = mine[0];
  const lastText = last ? texts.find((x) => x.id === last.itemId) : undefined;
  return (
    <AsideCard title={t('tdCsResultsTitle')} testId="aside-results">
      {mine.length === 0 && <p className="muted fine">{t('tdCsResultsNone')}</p>}
      {mine.length > 0 && (
        <>
          <p className="aside-card__lead">{t('tdCsResultsCount', { n: mine.length, m: texts.length })}</p>
          <span className="aside-rail"><span className="aside-rail__fill" style={{ width: `${texts.length ? (mine.length / texts.length) * 100 : 0}%` }} /></span>
          {last && (
            <p className="aside-card__facts">
              {t('tdCsResultsLast', { c: last.correct, n: last.total })}
              {lastText && <> · <Link to={`/app/reading/${lastText.id}`} lang="fr" dir="ltr">{lastText.title.fr ?? lastText.id}</Link></>}
            </p>
          )}
        </>
      )}
    </AsideCard>
  );
}

/** The facts the data file states about one text: level, topic, length, time, source. */
export function TextFactsCard({ text, topic }: { text: ReadingText; topic: string }) {
  const { t, settings } = useApp();
  const minutes = Math.max(1, Math.round(text.readingTime.seconds / 60));
  let readAt = text.source.readAt;
  try { readAt = new Intl.DateTimeFormat(settings.ui, { dateStyle: 'medium' }).format(new Date(text.source.readAt)); } catch { /* keep the raw date */ }
  return (
    <AsideCard title={t('tdCsFactsTitle')} testId="aside-facts">
      <p className="aside-card__lead">
        <span className={`chip chip--${(text.level ?? '').toLowerCase()}`}>{text.level ?? t('rdLevelNone')}</span> {topic}
      </p>
      <p className="aside-card__facts">{t('tdCsFactsWords', { n: text.words })} · {t('tdCsFactsMinutes', { n: minutes, w: text.readingTime.wordsPerMinute })}</p>
      <p className="fine" dir="auto">
        <b>{t('tdCsFactsSource')}</b>: <span lang="fr" dir="ltr">{text.source.name}</span> · {text.source.licence} · {t('tdCsFactsReadOn', { date: readAt })}
      </p>
    </AsideCard>
  );
}

/** Words the learner saved from THIS text first, then how many came from others. */
export function TextWordsCard({ textId, saved }: { textId: string; saved: Set<string> }) {
  const { t } = useApp();
  const userId = useUserId();
  const [rows, setRows] = useState<{ word: string; sentence?: string; here: boolean }[] | null>(null);
  useEffect(() => {
    let live = true;
    import('../../features/reader/store').then((m) => m.savedForUser(userId)).then((all) => {
      if (!live) return;
      const words = all.filter((r) => r.itemId.startsWith('word:')).sort((a, b) => b.savedAt - a.savedAt)
        .map((r) => ({ word: r.itemId.slice(5).split('@')[0] ?? '', sentence: r.context?.sentence, here: r.context?.fromId === textId || r.itemId.endsWith(`@${textId}`) }));
      setRows(words);
    }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [userId, textId, saved]);
  const here = rows?.filter((r) => r.here) ?? [];
  const other = rows ? rows.length - here.length : 0;
  return (
    <AsideCard title={t('tdCsTextWordsTitle')} testId="aside-text-words">
      {rows === null && <div className="skeleton skeleton--text" />}
      {rows !== null && here.length === 0 && <p className="muted fine">{t('tdCsTextWordsNone')}</p>}
      {here.length > 0 && (
        <ul className="aside-words">
          {here.slice(0, 6).map((w) => (
            <li key={w.word}>
              <span className="aside-words__fr" lang="fr" dir="ltr">{w.word}</span>
              {w.sentence && <span className="aside-words__ctx" lang="fr" dir="ltr">{w.sentence}</span>}
            </li>
          ))}
        </ul>
      )}
      {other > 0 && <p className="muted fine">{t('tdCsTextWordsOther', { n: other })}</p>}
      {rows !== null && rows.length > 0 && <Link className="aside-card__link" to="/app/cards">{t('cards')} <Icon name="chevron" size={14} /></Link>}
    </AsideCard>
  );
}
