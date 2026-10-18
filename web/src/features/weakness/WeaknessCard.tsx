/**
 * One weakness suggestion, with its reason (blueprint §15 / contracts: "the
 * reason for the suggestion and a link to the practice; no mastery %").
 *
 * WHERE TO MOUNT IT: `/progress` ("Progress and weaknesses"), above the list
 * of concepts, and optionally on the home dashboard. It takes no props that
 * matter: `<WeaknessCard />`. It reads the learner from context.
 *
 * ── Deliberate omissions ────────────────────────────────────────────────────
 * No percentage, no score, no bar, no streak. The only numbers on screen are
 * counts of answers ("3 of 5 in a row"), which are the rule, not a grade.
 * One suggestion at a time; skipping is a visible, free choice.
 *
 * ── The five states ─────────────────────────────────────────────────────────
 *   loading   reading the log; skeleton, aria-busy
 *   error     the log could not be read: Try again
 *   offline   names and practice links need the network: Try again
 *   empty     no answers recorded: start a 5-minute review
 *   finished  nothing needs another look: practise something else
 * Displaying this writes nothing to the review log. Postpone and ignore write
 * only to this feature's own key, and only when the learner presses them.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, useUserId } from '../../app-context';
import { loadContent } from '../../lib/content';
import { loadMaterial, type Material } from '../../lib/material';
import { pick } from '../../lib/exams';
import { fr as frText } from '../../lib/typography';
import {
  describe, loadReport, saveChoice, type Report, type Weakness,
} from '../../lib/weakness';
import type { Concept } from '../../lib/types';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'offline' }
  | { kind: 'ready'; report: Report };

export function WeaknessCard() {
  const { t, settings } = useApp();
  const userId = useUserId();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [byId, setById] = useState<Map<string, Concept>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setPhase({ kind: 'loading' });
    (async () => {
      // Names and the "has cards" test come from the network; the answers
      // themselves are on this device. Losing the network is therefore its own
      // state, not an error in the learner's record.
      let material: Map<string, Material>;
      let concepts: Map<string, Concept>;
      try {
        const [content, m] = await Promise.all([loadContent(), loadMaterial()]);
        material = m; concepts = content.conceptById;
      } catch {
        if (live) setPhase({ kind: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error' });
        return;
      }
      try {
        const report = await loadReport(userId, {
          now: Date.now(),
          hasCards: (id) => (material.get(id)?.cards ?? 0) > 0,
        });
        if (live) { setById(concepts); setPhase({ kind: 'ready', report }); }
      } catch {
        if (live) setPhase({ kind: 'error' });
      }
    })();
    return () => { live = false; };
  }, [userId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const choose = (w: Weakness, mode: 'postponed' | 'ignored') => {
    const saved = saveChoice(userId, w.topicId, mode, Date.now());
    setMessage((mode === 'postponed' ? t('wkPostponedDone') : t('wkIgnoredDone'))
      + (saved ? '' : ` ${t('wkNotSaved')}`));
    retry();
  };

  const body = (() => {
    if (phase.kind === 'loading') {
      return (
        <div aria-busy="true" data-testid="weakness-loading">
          <div className="skeleton skeleton--text" />
          <p className="next__why">{t('wkLoading')}</p>
        </div>
      );
    }
    if (phase.kind === 'error' || phase.kind === 'offline') {
      return (
        <div data-testid={`weakness-${phase.kind}`} role="status">
          <p className="next__title">{t(phase.kind === 'error' ? 'wkErrorTitle' : 'wkOfflineTitle')}</p>
          <p className="next__why">{t(phase.kind === 'error' ? 'wkErrorBody' : 'wkOfflineBody')}</p>
          <div className="next__actions">
            <button type="button" className="btn btn--primary" onClick={retry}>{t('wkRetry')}</button>
          </div>
        </div>
      );
    }
    const { report } = phase;
    if (report.empty) {
      return (
        <div data-testid="weakness-empty">
          <p className="next__title">{t('wkEmptyTitle')}</p>
          <p className="next__why">{t('wkEmptyBody')}</p>
          <div className="next__actions">
            <Link className="btn btn--primary" to="/practise/review">{t('wkEmptyAction')}</Link>
          </div>
        </div>
      );
    }
    if (!report.shown) {
      return (
        <div data-testid="weakness-finished">
          <p className="next__title">{t('wkFinishedTitle')}</p>
          <p className="next__why">{t('wkFinishedBody')}</p>
          <div className="next__actions">
            <Link className="btn btn--primary" to="/learn">{t('wkFinishedAction')}</Link>
          </div>
        </div>
      );
    }
    const w = report.shown;
    const concept = byId.get(w.topicId);
    const topic = concept ? pick(concept.name, settings.ui).text || w.topicId : w.topicId;
    const d = describe(w, t, topic);
    return (
      <div data-testid="weakness-card" data-situation={w.situation} data-status={w.status}>
        <p className="next__title" data-testid="weakness-reason">{d.reason}</p>

        {w.example && w.situation !== 'improving' && (
          <div data-testid="weakness-example">
            <h3 className="eyebrow">{t('wkExample')}</h3>
            <p className="next__why">
              {t('wkShown')}: <span lang="fr" dir="ltr">{frText(w.example.front)}</span>
              {' · '}
              {w.example.response
                ? <>{t('wkAnswered')}: <span lang="fr" dir="ltr">{w.example.response}</span></>
                : t('wkSelfRated')}
              {' · '}
              {t('wkWhen', { date: new Date(w.example.at).toLocaleDateString(settings.ui) })}
            </p>
          </div>
        )}

        <p className="next__why" data-testid="weakness-recheck">{d.recheck}</p>
        {d.note && <p className="next__why fine">{d.note}</p>}
        <p className="next__why fine">{t('wkExplainNote')}</p>

        <div className="next__actions">
          <Link className="btn btn--primary" to={w.action.to} data-testid="weakness-go">{d.action}</Link>
          <Link className="btn btn--sm" to={w.explainTo}>{t('wkExplain')}</Link>
          <button type="button" className="btn btn--sm" data-testid="weakness-postpone"
                  onClick={() => choose(w, 'postponed')}>{t('wkPostpone')}</button>
          <button type="button" className="btn btn--sm" data-testid="weakness-ignore"
                  onClick={() => choose(w, 'ignored')}>{t('wkIgnore')}</button>
        </div>
        <p className="next__why fine">{t('wkIgnoreNote')}</p>
        {report.waiting > 0 && <p className="next__why fine">{t('wkWaiting', { n: report.waiting })}</p>}
      </div>
    );
  })();

  return (
    <section className="next" data-testid="weakness" aria-labelledby="weakness-h">
      <h2 id="weakness-h" className="eyebrow">{t('wkHeading')}</h2>
      {body}
      {message && <p className="next__why fine" role="status" data-testid="weakness-message">{message}</p>}
      <p className="next__why fine" data-testid="weakness-threshold">{t('wkThresholdNote')}</p>
      <p className="next__why fine">{t('wkNoPressure')}</p>
    </section>
  );
}
