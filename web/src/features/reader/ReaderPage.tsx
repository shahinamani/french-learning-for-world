/**
 * One text, read. Blueprint section 11, half of the product's flagship journey:
 * touch a word, see what it means HERE, add it with the sentence it came from,
 * and find it again in the cards.
 *
 * Two promises are kept by construction rather than by care:
 *
 * 1. Opening the meaning panel cannot move the reading position. On a wide
 *    screen the panel's column is always laid out (empty or full), and on a
 *    narrow one it is a fixed sheet over reserved space, so showing it changes
 *    no height. Nothing in the open path scrolls: focus moves with
 *    `preventScroll`.
 * 2. A saved word keeps its sentence. `buildWordSave` is the only place a word
 *    row is made, and it takes the sentence as an argument.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { Icon } from '../../components/Icon';
import { Localised } from '../../components/Localised';
import { Num } from '../../components/Num';
import { pick } from '../../lib/exams';
import { userKey } from '../../lib/session';
import { onVoicesReady } from '../../lib/speech';
import { fr as frText } from '../../lib/typography';
import { buildWordSave, fold, matchVocab, minutesOf, splitSentences, tokenize, vocabInSentence, wordItemId } from './model';
import { MeaningPanel, type Selection } from './MeaningPanel';
import { Quiz } from './Quiz';
import { deleteSaved, getPosition, putPosition, putResult, putSaved, resultsForUser, savedForUser, type ReaderResult } from './store';
import type { ReadingText } from './types';
import { ReaderState, useReadingTexts, useWide } from './ui';
import './reader.css';

const SIZES = [16, 18, 20, 22, 24, 28] as const;
const DEFAULT_SIZE = 18;

/** Per-viewer convenience only: wrapped, because storage can throw. */
function readSize(userId: string): number {
  try {
    const v = Number(localStorage.getItem(userKey(userId, 'readerSize')));
    return (SIZES as readonly number[]).includes(v) ? v : DEFAULT_SIZE;
  } catch { return DEFAULT_SIZE; }
}
function writeSize(userId: string, v: number) {
  try { localStorage.setItem(userKey(userId, 'readerSize'), String(v)); } catch { /* not persisted */ }
}

export function ReaderPage() {
  const { id } = useParams();
  const { t } = useApp();
  const [data, retry] = useReadingTexts();
  const location = useLocation();
  const back = `/app/reading${(location.state as { from?: string } | null)?.from ?? ''}`;

  if (data.state === 'loading') {
    return (
      <div className="rd" data-testid="rd-loading" aria-busy="true">
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
          <Link className="btn" to={back}>{t('rdBack')}</Link>
        </ReaderState>
      </div>
    );
  }
  const text = data.texts.find((x) => x.id === id);
  if (!text) {
    return (
      <div className="rd">
        <ReaderState kind="notfound" title={t('rdNotFoundTitle')} body={t('rdNotFoundBody')}>
          <Link className="btn btn--primary" to={back}>{t('rdBack')}</Link>
        </ReaderState>
      </div>
    );
  }
  return <ReaderView key={text.id} text={text} back={back} />;
}

function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

function ReaderView({ text, back }: { text: ReadingText; back: string }) {
  const { t, settings } = useApp();
  const userId = useUserId();
  const wide = useWide();

  const segs = useMemo(() => splitSentences(text.body.fr ?? ''), [text]);
  const toks = useMemo(() => segs.map((s) => tokenize(s.text)), [segs]);
  const glossed = useMemo(() => segs.map((s) => vocabInSentence(s.text, text.vocabulary)), [segs, text]);
  const wordKeys = useMemo(
    () => toks.flatMap((ts, i) => ts.flatMap((k, j) => (k.word ? [`${i}:${j}`] : []))), [toks]);

  const [sel, setSel] = useState<Selection | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  const [showTr, setShowTr] = useState(false);          // hidden until asked for
  const [size, setSize] = useState(() => readSize(userId));
  const [quiz, setQuiz] = useState(false);
  const [quizKey, setQuizKey] = useState(0);
  const [resumed, setResumed] = useState<number | null>(null);
  const [last, setLast] = useState<ReaderResult | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);

  const bar = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const segEls = useRef<(HTMLSpanElement | null)[]>([]);
  const lastIdx = useRef(-1);
  const hasRecord = useRef(false);
  const settled = useRef(false);        // no position is written until the restore has run
  const touched = useRef(false);        // the learner has scrolled by hand
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => onVoicesReady((v) => setVoiceAvailable(v.length > 0)), []);

  // What this learner has already saved, and how the last attempt went.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [s, r] = await Promise.all([savedForUser(userId), resultsForUser(userId)]);
        if (!live) return;
        setSaved(new Set(s.map((x) => x.itemId)));
        setLast(r.find((x) => x.itemId === text.id) ?? null);
      } catch { /* storage unavailable: nothing is marked, which is true */ }
    })();
    return () => { live = false; };
  }, [userId, text.id]);

  /* ── Reading position ─────────────────────────────────────────────────
   * detect(): the last sentence that begins at or above the top line of the
   * visible text. restore(p) puts sentence p's first line at that same line, so
   * detect(restore(p)) is stable and a reload never drifts. */
  const lineY = () => (bar.current?.getBoundingClientRect().bottom ?? 0) + 4;
  const firstTop = (i: number) => segEls.current[i]?.getClientRects()[0]?.top ?? Infinity;

  const detect = useCallback((): number => {
    const y = lineY() + 2;
    let at = 0;
    for (let i = 0; i < segEls.current.length; i++) { if (firstTop(i) <= y) at = i; else break; }
    return at;
  }, []);

  const restore = useCallback((p: number) => {
    const el = segEls.current[p];
    if (!el) return;
    const sc = scrollerOf(el);
    sc.scrollTop += firstTop(p) - lineY();
  }, []);

  const persist = useCallback((idx: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      putPosition(userId, text.id, idx)
        .then(() => { hasRecord.current = true; }).catch(() => { /* position not kept */ });
    }, 350);
  }, [userId, text.id]);

  useEffect(() => {
    let live = true;
    const mark = () => { touched.current = true; };
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    window.addEventListener('keydown', mark);
    (async () => {
      let p = 0;
      try {
        const rec = await getPosition(userId, text.id);
        if (rec) { hasRecord.current = true; p = Math.min(rec.paragraph, segs.length - 1); }
      } catch { /* start at the top */ }
      if (!live) return;
      if (p > 0) {
        setResumed(p);
        requestAnimationFrame(() => {
          restore(p);
          lastIdx.current = detect();
          settled.current = true;
          // Webfonts change line breaks. Do it once more when they are in, unless the learner already moved.
          document.fonts?.ready.then(() => { if (live && !touched.current) { restore(p); lastIdx.current = detect(); } });
        });
      } else { lastIdx.current = 0; settled.current = true; }
    })();
    return () => {
      live = false;
      window.removeEventListener('wheel', mark); window.removeEventListener('touchmove', mark); window.removeEventListener('keydown', mark);
    };
  }, [userId, text.id, segs.length, restore, detect]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf || !settled.current) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const idx = detect();
        if (idx === lastIdx.current) return;
        lastIdx.current = idx;
        if (idx === 0 && !hasRecord.current) return;
        persist(idx);
      });
    };
    window.addEventListener('scroll', onScroll, true);   // capture: <main> scrolls, not the window
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      cancelAnimationFrame(raf);
    };
  }, [detect, persist]);

  // Leaving flushes a pending write instead of dropping it.
  useEffect(() => () => {
    if (timer.current !== undefined && lastIdx.current >= 0) {
      window.clearTimeout(timer.current);
      putPosition(userId, text.id, lastIdx.current).catch(() => {});
    }
  }, [userId, text.id]);

  // The true top of the page, not "sentence 0 at the top line": sentences 0 and 1 can share a line, and
  // the position would then read as 1.
  const toTop = () => { if (body.current) scrollerOf(body.current).scrollTop = 0; };

  const fromStart = () => {
    setResumed(null);
    lastIdx.current = 0;
    toTop();
    putPosition(userId, text.id, 0).catch(() => {});
  };

  /* ── Selecting ────────────────────────────────────────────────────────── */
  const open = (phrase: string, seg: number, key: string | null) => {
    const clean = phrase.replace(/[\s  ]+/g, ' ').replace(/’/g, "'").trim();
    const s = segs[seg];
    if (!clean || !s) return;
    setSaveFailed(false);
    setPickedKey(key);
    setSel({ phrase: clean, sentence: s.text, seg });
  };

  const readSelection = () => {
    const g = window.getSelection();
    const host = body.current;
    if (!g || g.isCollapsed || !host || !g.anchorNode || !host.contains(g.anchorNode)) return false;
    const phrase = g.toString();
    if (phrase.trim().length === 0 || phrase.length > 80) return false;
    const el = (g.anchorNode instanceof Element ? g.anchorNode : g.anchorNode.parentElement)?.closest<HTMLElement>('[data-seg]');
    const seg = Number(el?.dataset.seg);
    if (!Number.isFinite(seg)) return false;
    open(phrase, seg, null);
    return true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    window.setTimeout(() => {
      if (readSelection()) return;
      const w = target.closest<HTMLElement>('[data-w]');
      if (w) open(w.textContent ?? '', Number(w.dataset.seg), w.dataset.w ?? null);
    }, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== body.current) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = Math.max(0, Math.min(wordKeys.length - 1, cursor + (e.key === 'ArrowRight' ? 1 : -1)));
      setCursor(n);
      body.current?.querySelector(`[data-w="${wordKeys[n]}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if ((e.key === 'Enter' || e.key === ' ') && cursor >= 0) {
      e.preventDefault();
      const k = wordKeys[cursor]!;
      const el = body.current?.querySelector<HTMLElement>(`[data-w="${k}"]`);
      if (el) open(el.textContent ?? '', Number(el.dataset.seg), k);
    } else if (e.key === 'Escape') setSel(null);
  };

  const close = () => { setSel(null); setPickedKey(null); body.current?.focus({ preventScroll: true }); };

  /* ── Saving ───────────────────────────────────────────────────────────── */
  const addWord = async (phrase: string, sentence: string) => {
    const row = buildWordSave(userId, phrase, sentence, text.id);
    setSaveFailed(false);
    try {
      await putSaved(row);
      setSaved((p) => new Set(p).add(row.itemId));
    } catch { setSaveFailed(true); }
  };

  const textSaved = saved.has(text.id);
  const toggleText = async () => {
    const was = textSaved;
    setSaved((p) => { const n = new Set(p); if (was) n.delete(text.id); else n.add(text.id); return n; });
    try {
      if (was) await deleteSaved(userId, text.id);
      else await putSaved({ userId, itemId: text.id, savedAt: Date.now() });   // saved, NOT learned: no context, no grade
    } catch {
      setSaved((p) => { const n = new Set(p); if (was) n.add(text.id); else n.delete(text.id); return n; });
    }
  };

  const savedPhrases = useMemo(() => {
    const suffix = `@${text.id}`;
    return new Set([...saved].filter((s) => s.startsWith('word:') && s.endsWith(suffix)).map((s) => fold(s.slice(5, -suffix.length))));
  }, [saved, text.id]);

  const bump = (dir: 1 | -1) => {
    const i = SIZES.indexOf(size as (typeof SIZES)[number]);
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, i + dir))]!;
    setSize(next); writeSize(userId, next);
  };

  const tr = pick({ fa: text.body.fa, en: text.body.en }, settings.meaning);
  const audio = text.media?.audio?.url;
  const onFinished = useCallback((c: number, n: number) => {
    const r = { userId, itemId: text.id, correct: c, total: n, updatedAt: Date.now() };
    setLast(r);
    putResult(r).catch(() => { /* result not kept; the screen still shows it */ });
  }, [userId, text.id]);

  return (
    <div data-testid="reader-page" data-text={text.id}>
      <div className="rd-bar" ref={bar}>
        <div className="rd-bar__in">
          <Link to={back} className="rd-back" data-testid="rd-back">
            <Icon name="chevron" size={18} /> {t('rdBack')}
          </Link>
          <h1 className="rd-bar__title" lang="fr" dir="ltr" data-testid="rd-title">{frText(text.title.fr ?? '')}</h1>
          <span className={`chip chip--${(text.level ?? '').toLowerCase()}`} data-testid="rd-level">{text.level ?? t('rdLevelNone')}</span>
          <span className="rd-note" data-testid="rd-time">{t('rdMinutes', { n: minutesOf(text) })}</span>
          <button type="button" className="btn" aria-pressed={textSaved} onClick={toggleText} data-testid="rd-save-text">
            {textSaved ? t('rdSavedForLater') : t('rdSave')}
          </button>
        </div>
      </div>

      <div className="rd">
        <div className="rd-tools">
          <div className="rd-size" role="group" aria-label={t('rdFontSize')}>
            <button type="button" className="btn" onClick={() => bump(-1)} disabled={size === SIZES[0]} aria-label={t('rdFontSmaller')} data-testid="rd-smaller">A−</button>
            <output data-testid="rd-size"><Num>{size}</Num></output>
            <button type="button" className="btn" onClick={() => bump(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label={t('rdFontLarger')} data-testid="rd-larger">A+</button>
          </div>
          <button type="button" className="btn" aria-pressed={showTr} onClick={() => setShowTr((s) => !s)} data-testid="rd-translation-btn">
            {showTr ? t('rdHideTranslation') : t('rdShowTranslation')}
          </button>
          {audio ? (
            <audio controls preload="none" src={audio} aria-label={t('rdListen')} data-testid="rd-audio" />
          ) : (
            <span className="rd-audio" data-testid="rd-audio-unavailable">
              <button type="button" className="btn" disabled aria-describedby="rd-audio-why"><Icon name="sound" size={16} /> {t('rdListen')}</button>
              <span id="rd-audio-why">{t('rdNoAudio')}</span>
            </span>
          )}
        </div>
        <p className="rd-note" dir="auto">{t('rdSaveNote')}</p>

        {resumed !== null && (
          <div className="rd-resumed" role="status" data-testid="rd-resumed">
            <span><Num>{t('rdResumed', { n: resumed + 1, total: segs.length })}</Num></span>
            <button type="button" className="btn btn--sm" onClick={fromStart} data-testid="rd-from-start">{t('rdFromStart')}</button>
          </div>
        )}

        <div className="rd-layout">
          <div className="rd-main">
            <div className="rd-text" ref={body} lang="fr" dir="ltr" tabIndex={0} role="group" aria-label={t('rdTextLabel')}
              style={{ ['--rd-size' as string]: `${size}px` }} data-testid="rd-text"
              onPointerUp={onPointerUp} onKeyUp={(e) => { if (e.shiftKey) readSelection(); }} onKeyDown={onKeyDown}>
              {segs.map((s, i) => (
                <span key={s.index} className="rd-seg" data-seg={i} ref={(el) => { segEls.current[i] = el; }}>
                  {toks[i]!.map((k, j) => {
                    if (!k.word) return <span key={j}>{frText(k.text).replace(/'/g, '’')}</span>;
                    const key = `${i}:${j}`;
                    const cls = ['rd-w'];
                    if (matchVocab(k.text, glossed[i]!)) cls.push('rd-w--gloss');
                    if (savedPhrases.has(fold(k.text))) cls.push('rd-w--saved');
                    if (wordKeys[cursor] === key) cls.push('rd-w--cursor');
                    if (pickedKey === key) cls.push('rd-w--picked');
                    return <span key={j} className={cls.join(' ')} data-w={key} data-seg={i}>{k.text}</span>;
                  })}
                  {' '}
                </span>
              ))}
            </div>

            {showTr && (
              <section className="rd-translation" aria-labelledby="rd-tr-h" data-testid="rd-translation">
                <h2 id="rd-tr-h">{t('rdTranslationHeading')}</h2>
                {tr.text ? <p lang={tr.locale} dir="auto">{tr.text}</p> : <p>{t('rdTranslationNone')}</p>}
                {tr.text && !tr.translated && <p className="rd-note" dir="auto">{t('rdTranslationNone')}</p>}
              </section>
            )}

            <section aria-labelledby="rd-words-h">
              <h2 id="rd-words-h" className="h2">{t('rdWordsHeading')}</h2>
              <ul className="rd-words">
                {text.vocabulary.map((v) => (
                  <li key={v.fr} data-testid="rd-vocab">
                    <span><strong lang="fr" dir="ltr">{frText(v.fr ?? '')}</strong>{' · '}<Localised field={{ en: v.en, fa: v.fa }} locale={settings.meaning} /></span>
                    <button type="button" className="btn btn--sm" disabled={saved.has(wordItemId(v.fr ?? '', text.id))}
                      onClick={() => addWord(v.fr ?? '', v.sentenceFromText)} data-testid="rd-vocab-add">
                      {saved.has(wordItemId(v.fr ?? '', text.id)) ? t('rdWordAdded') : t('rdAddWord')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {!quiz ? (
              <div className="rd-actions">
                <button type="button" className="btn btn--primary btn--lg" data-testid="rd-finish-reading"
                  onClick={() => { setQuiz(true); window.setTimeout(() => document.getElementById('rd-quiz-h')?.scrollIntoView({ block: 'start' }), 0); }}>
                  {t('rdFinishReading')}
                </button>
                {last && <span className="rd-note" data-testid="rd-last"><Num>{t('rdResultBadge', { c: last.correct, n: last.total })}</Num></span>}
              </div>
            ) : (
              <Quiz key={quizKey} textId={text.id} questions={text.questions} onFinished={onFinished} backSearch={back.replace('/app/reading', '')}
                onReread={() => { setQuiz(false); setQuizKey((k) => k + 1); toTop(); }} />
            )}
          </div>

          <MeaningPanel text={text} sel={sel} wide={wide} saved={saved} voiceAvailable={voiceAvailable}
            saveFailed={saveFailed} onAdd={addWord} onClose={close} />
        </div>
      </div>
    </div>
  );
}
