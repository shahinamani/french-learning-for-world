/**
 * The learning workspace: one page, six tabs, and a card in the middle.
 *
 * Every tab opens something that already exists. There is no tab here whose
 * content was written to fill the tab — `Dialogues` has none, says so, and says
 * why, because a fabricated lesson behind a tab is worse than an empty tab.
 *
 * The tab lives in the URL (`?tab=quiz`), so a tab is a place a learner can
 * return to and link to. Hash routing means the whole address survives a
 * reload, which is the same reason every other view here has an address.
 */
// This chunk registers its English: the workspace strings are not in the first load.
import '../../lib/locales/en/workspaceEn';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../../app-context';
import { Num } from '../../components/Num';
import { NextActivity } from '../../components/NextActivity';
import { onVoicesReady, RATES, stop, type FrenchVoice } from '../../lib/speech';
import { landingTranslated } from '../../lib/i18n';
import * as timer from '../../lib/timer';
import { Flashcards, type Corpus } from './Flashcards';
import { Dialogues } from './Dialogues';

const TABS = ['flashcards', 'quiz', 'dialogues', 'grammar', 'vocabulary', 'progress'] as const;
type Tab = (typeof TABS)[number];

const TAB_KEY: Record<Tab, 'wsTabFlashcards' | 'wsTabQuiz' | 'wsTabDialogues'
  | 'wsTabGrammar' | 'wsTabVocabulary' | 'wsTabProgress'> = {
  flashcards: 'wsTabFlashcards',
  quiz: 'wsTabQuiz',
  dialogues: 'wsTabDialogues',
  grammar: 'wsTabGrammar',
  vocabulary: 'wsTabVocabulary',
  progress: 'wsTabProgress',
};

export function Workspace() {
  const { profile, settings, update, t } = useApp();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'flashcards';

  const [corpus, setCorpus] = useState<Corpus>(
    { total: 0, rich: 0, gloss: 0, enriched: 0, reviewed: 0 });
  const onCorpus = useCallback((c: Corpus) => setCorpus(c), []);

  // ── Voices, read from the device and never assumed ───────────────────────
  const [voiceList, setVoiceList] = useState<FrenchVoice[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(1);
  useEffect(() => onVoicesReady((list) => {
    setVoiceList(list);
    setVoiceId((cur) => (cur && list.some((v) => v.id === cur) ? cur : list[0]?.id ?? null));
  }), []);
  useEffect(() => () => stop(), []);

  // ── Timer, on the existing timer library ─────────────────────────────────
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [paused, setPaused] = useState<number | null>(null);   // seconds left
  const [minutes, setMinutes] = useState<number>(25);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const restored = timer.restore(profile.id, Date.now());
    if (restored.state === 'running') { setEndsAt(restored.endsAt); setMinutes(restored.durationMin); }
  }, [profile.id]);
  useEffect(() => {
    if (endsAt === null) return;
    const h = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(h);
  }, [endsAt]);
  const left = paused ?? (endsAt === null ? minutes * 60 : timer.remainingSeconds(endsAt, now));
  const running = endsAt !== null && paused === null;
  useEffect(() => {
    if (!running || left > 0) return;
    void timer.announceFinish(settings.sound ? timer.chime : undefined);
    timer.clear(profile.id);
    setEndsAt(null);
  }, [running, left, settings.sound, profile.id]);

  const startTimer = (mins: number) => {
    const ends = Date.now() + mins * 60_000;
    setMinutes(mins); setPaused(null); setEndsAt(ends); setNow(Date.now());
    timer.save(profile.id, ends, mins);
  };
  const pauseTimer = () => { setPaused(Math.max(left, 0)); timer.clear(profile.id); setEndsAt(null); };
  const resumeTimer = () => {
    const secs = paused ?? minutes * 60;
    const ends = Date.now() + secs * 1000;
    setPaused(null); setEndsAt(ends); setNow(Date.now());
    timer.save(profile.id, ends, minutes);
  };
  const resetTimer = () => { setPaused(null); setEndsAt(null); timer.clear(profile.id); };

  // Persian and Arabic have no workspace copy; the screen says so rather than
  // showing English as if it were a translation.
  const translated = useMemo(
    () => settings.ui === 'en' || settings.ui === 'fr' || landingTranslated(settings.ui),
    [settings.ui]);

  const setTab = (next: Tab) => {
    stop();
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  };

  return (
    <div className="page ws" data-testid="workspace">
      <header className="ws-head">
        <h1 className="h2" data-testid="ws-title">{t('wsTitle')}</h1>
        <p className="muted" data-testid="ws-summary">
          {t('wsSummaryLead')}{' '}
          <strong><Num>{corpus.total}</Num></strong>{' · '}
          <Num>{corpus.rich}</Num> {t('wsSummaryRich')}{' · '}
          <Num>{corpus.gloss}</Num> {t('wsSummaryGloss')}
        </p>
        {/* Coverage, counted against the whole corpus rather than the batch
            that happens to be written. Both figures are measurements: a card
            counts as enriched when it has a written back, and `reviewed` is 0
            because nobody has reviewed any of it. Neither is a plan. */}
        <p className="muted" data-testid="ws-coverage">
          <strong><Num>{corpus.enriched}</Num></strong>{' / '}
          <Num>{corpus.total}</Num> {t('wsCoverageEnriched')}{' · '}
          <strong><Num>{corpus.reviewed}</Num></strong>{' / '}
          <Num>{corpus.total}</Num> {t('wsCoverageReviewed')}
        </p>
        <p className="fine muted" data-testid="ws-ceiling">{t('wsCeiling')}</p>
        <p className="fine muted" data-testid="ws-local-only">{t('wsLocalOnly')}</p>
        {!translated && (
          <p className="fine muted" data-testid="ws-untranslated">{t('notTranslatedHere')}</p>
        )}
      </header>

      {/* ── Top controls ──────────────────────────────────────────────────── */}
      <div className="ws-controls">
        <div className="ws-control" data-testid="ws-timer">
          <span className="ws-control__label">{t('wsTimer')}</span>
          <span className="ws-clock" data-testid="ws-clock">{timer.formatClock(Math.max(left, 0))}</span>
          <div className="ws-control__row">
            {running
              ? <button type="button" className="btn btn--sm" data-testid="ws-timer-pause"
                        onClick={pauseTimer}>{t('wsTimerPause')}</button>
              : <button type="button" className="btn btn--sm" data-testid="ws-timer-start"
                        onClick={() => (paused !== null ? resumeTimer() : startTimer(minutes))}>
                  {paused !== null ? t('wsTimerResume') : t('wsTimerStart')}
                </button>}
            <button type="button" className="btn btn--sm" data-testid="ws-timer-reset"
                    onClick={resetTimer}>{t('wsTimerReset')}</button>
          </div>
          <div className="ws-control__row">
            {timer.PRESETS.map((m) => (
              <button key={m} type="button"
                      className={`ws-chip ws-chip--sm${minutes === m ? ' is-on' : ''}`}
                      aria-pressed={minutes === m}
                      data-testid={`ws-preset-${m}`}
                      onClick={() => startTimer(m)}>
                <Num>{m}</Num>
              </button>
            ))}
          </div>
          <label className="ws-check">
            <input type="checkbox" checked={settings.sound} data-testid="ws-timer-sound"
                   onChange={(e) => update({ sound: e.target.checked })} />
            {t('wsTimerSound')}
          </label>
        </div>

        <div className="ws-control">
          <label className="ws-control__label" htmlFor="ws-rate">{t('wsVoiceSpeed')}</label>
          <select id="ws-rate" className="input" data-testid="ws-rate" value={String(rate)}
                  onChange={(e) => setRate(Number(e.target.value))}>
            {/* An <option> cannot hold a span, so the isolate is the Unicode
                one: without it "1×" renders as "×1" on an RTL page. */}
            {RATES.map((r) => <option key={r} value={r}>{`⁦${r}×⁩`}</option>)}
          </select>

          <label className="ws-control__label" htmlFor="ws-voice">{t('wsVoice')}</label>
          {voiceList.length === 0 ? (
            <p className="fine muted" data-testid="ws-no-voice">
              {t('wsVoiceNone')} — {t('wsVoiceNoneHelp')}
            </p>
          ) : (
            <select id="ws-voice" className="input" data-testid="ws-voice"
                    value={voiceId ?? ''} onChange={(e) => setVoiceId(e.target.value)}>
              {voiceList.map((v) => (
                <option key={v.id} value={v.id}>
                  {`${v.name} · ${v.region === 'fr-FR' ? t('wsRegionFrance')
                    : v.region === 'fr-CA' ? t('wsRegionCanada') : t('wsRegionOther')}`}
                </option>
              ))}
            </select>
          )}
          <p className="fine muted" data-testid="ws-speech-aid">{t('wsSpeechAid')}</p>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="ws-tabs" role="tablist" aria-label={t('wsTitle')}>
        {TABS.map((name) => (
          <button key={name} type="button" role="tab" id={`ws-tab-${name}`}
                  aria-selected={tab === name} aria-controls={`ws-panel-${name}`}
                  tabIndex={tab === name ? 0 : -1}
                  className={`ws-tab${tab === name ? ' is-on' : ''}`}
                  data-testid={`ws-tab-${name}`}
                  onClick={() => setTab(name)}>
            {t(TAB_KEY[name])}
          </button>
        ))}
      </div>

      <div className="ws-panel" role="tabpanel" id={`ws-panel-${tab}`}
           aria-labelledby={`ws-tab-${tab}`} data-testid={`ws-panel-${tab}`}>
        {tab === 'flashcards' && (
          <Flashcards voiceId={voiceId} rate={rate} voiceAvailable={voiceList.length > 0}
                      onCorpus={onCorpus} />
        )}

        {tab === 'quiz' && (
          <div className="card ws-lead">
            <p>{t('wsQuizLead')}</p>
            <Link className="btn btn--gold" to="/practise/exams" data-testid="ws-go-exams">
              {t('wsOpen')}
            </Link>
          </div>
        )}

        {/* Was the tab with nothing behind it. It has one complete starter
            unit now — a situation, the French, the Persian and comprehension
            questions with explanations — and it reports that there is one
            rather than implying a library. The empty state it used to show is
            still in Dialogues.tsx and is what appears if the content file ever
            goes missing. */}
        {tab === 'dialogues' && (
          <Dialogues voiceId={voiceId} rate={rate} voiceAvailable={voiceList.length > 0} />
        )}

        {tab === 'grammar' && (
          <div className="card ws-lead">
            <p>{t('wsGrammarLead')}</p>
            <Link className="btn btn--gold" to="/learn" data-testid="ws-go-learn">{t('wsOpen')}</Link>
          </div>
        )}

        {tab === 'vocabulary' && (
          <div className="card ws-lead">
            <p>{t('wsVocabLead')}</p>
            <Link className="btn btn--gold" to="/learn/verbs" data-testid="ws-go-verbs">{t('wsOpen')}</Link>
          </div>
        )}

        {tab === 'progress' && (
          <div className="ws-progress">
            <p className="muted">{t('wsProgressLead')}</p>
            {/* The existing "what next" card, unchanged: it already names an
                activity and the reason for it. */}
            <NextActivity />
            <Link className="btn" to="/progress" data-testid="ws-go-progress">{t('wsOpen')}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
