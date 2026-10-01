/**
 * Context without leaving the page. Its state lives in the URL as
 * `?panel=concept:<id>`, so a deep link opens it, the back button closes it,
 * and a reopened tab restores it. A panel held in component state would lose
 * all three.
 *
 * Built on Radix Dialog rather than by hand. The hand-rolled version had
 * Escape, a scrim and focus return, but no focus trap — Tab walked out into
 * the page behind a scrim that was blocking the mouse — and it declared
 * `aria-modal="false"` while being modal to every pointer user. Radix supplies
 * the trap, the inert background, the labelling and the focus return, which is
 * exactly the behaviour docs/01 chose a primitive library to get.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useSearchParams, useNavigate } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { statsForConcept, type ConceptStat } from '../lib/progress';
import { loadContent } from '../lib/content';
import type { Concept } from '../lib/types';
import { Icon } from './Icon';
import { Localised } from './Localised';
import { pick } from '../lib/exams';

export function useSidePanel() {
  const [params, setParams] = useSearchParams();
  const value = params.get('panel');
  return {
    value,
    open: (v: string) => { const p = new URLSearchParams(params); p.set('panel', v); setParams(p, { replace: false }); },
    close: () => { const p = new URLSearchParams(params); p.delete('panel'); setParams(p, { replace: false }); },
  };
}

export function SidePanel() {
  const { value, close } = useSidePanel();
  const { t, settings } = useApp();
  const userId = useUserId();
  const navigate = useNavigate();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [stat, setStat] = useState<ConceptStat | null>(null);
  const [loading, setLoading] = useState(false);

  const conceptId = value?.startsWith('concept:') ? value.slice('concept:'.length) : null;

  useEffect(() => {
    if (!conceptId) { setConcept(null); setStat(null); return; }
    let live = true;
    setLoading(true);
    (async () => {
      const { conceptById } = await loadContent();
      const s = await statsForConcept(userId, conceptId);
      if (!live) return;
      setConcept(conceptById.get(conceptId) ?? null);
      setStat(s);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [conceptId, userId]);

  if (!conceptId) return null;
  // The dialog's accessible name must be a plain string, so it takes pick()'s
  // text; the visible line takes Localised, which carries lang and dir with it.
  const name = concept ? pick(concept.name, settings.ui).text : conceptId;

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" data-testid="panel-scrim" />
        <Dialog.Content className="panel-side" data-testid="side-panel"
                        aria-describedby={undefined}>
        <div className="panel-side__head">
          <span className="eyebrow">{t('conceptRecord')}</span>
          <Dialog.Close asChild>
            <button className="icon-btn" data-testid="panel-close">
              <Icon name="close" /><span className="u-hidden-visually">{t('close')}</span>
            </button>
          </Dialog.Close>
        </div>
        <Dialog.Title className="u-hidden-visually">{name}</Dialog.Title>
        {loading && <div className="skeleton skeleton--title" />}
        {!loading && (
          <>
            <p className="panel-side__title" aria-hidden="true">
              {concept ? <Localised field={concept.name} /> : conceptId}
            </p>
            {concept && !pick(concept.name, settings.ui).translated && (
              <p className="muted notice-untranslated">{t('notTranslatedName')}</p>
            )}
            {concept && (
              <div className="row gap-2" style={{ marginBlockEnd: 'var(--space-4)' }}>
                <span className={`chip chip--${concept.level.toLowerCase()}`}>{concept.level}</span>
                <span className="chip">{t(concept.type as 'grammar')}</span>
              </div>
            )}
            {stat ? (
              <dl className="facts">
                <dt>{t('reviewsCount', { n: stat.reviews })}</dt>
                <dd>{stat.reviews}</dd>
                <dt>{t('accuracy')}</dt>
                <dd>{Math.round(stat.accuracy * 100)} %</dd>
                <dt>{t('lastSeen')}</dt>
                <dd>{new Date(stat.lastSeen).toLocaleDateString()}</dd>
              </dl>
            ) : (
              <p className="muted" data-testid="panel-no-record">{t('noRecordYet')}</p>
            )}
            <button
              className="btn btn--primary btn--block"
              data-testid="panel-practise"
              onClick={() => { close(); navigate(`/practise/review?concept=${encodeURIComponent(conceptId)}`); }}
            >
              {t('practiseThis')}
            </button>
          </>
        )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
