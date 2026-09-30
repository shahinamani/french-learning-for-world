/**
 * Context without leaving the page. Its state lives in the URL as
 * `?panel=concept:<id>`, so a deep link opens it, the back button closes it,
 * and a reopened tab restores it. A panel held in component state would lose
 * all three.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useApp, useUserId } from '../app-context';
import { statsForConcept, type ConceptStat } from '../lib/progress';
import { loadContent } from '../lib/content';
import type { Concept } from '../lib/types';
import { Icon } from './Icon';
import { fr as frText } from '../lib/typography';

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
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  const conceptId = value?.startsWith('concept:') ? value.slice('concept:'.length) : null;

  useEffect(() => {
    if (!conceptId) { setConcept(null); setStat(null); return; }
    let live = true;
    setLoading(true);
    opener.current = document.activeElement;
    (async () => {
      const { conceptById } = await loadContent();
      const s = await statsForConcept(userId, conceptId);
      if (!live) return;
      setConcept(conceptById.get(conceptId) ?? null);
      setStat(s);
      setLoading(false);
      closeRef.current?.focus();
    })();
    return () => { live = false; };
  }, [conceptId, userId]);

  useEffect(() => {
    if (!conceptId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Focus returns to whatever opened the panel, not to the top of the page.
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [conceptId, close]);

  if (!conceptId) return null;
  const name = concept ? (settings.ui === 'fr' ? frText(concept.name.fr) : concept.name.en) : conceptId;

  return (
    <>
      <div className="scrim" onClick={close} data-testid="panel-scrim" />
      <aside className="panel-side" role="dialog" aria-modal="false" aria-label={name} data-testid="side-panel">
        <div className="panel-side__head">
          <span className="eyebrow">{t('conceptRecord')}</span>
          <button ref={closeRef} className="icon-btn" onClick={close} data-testid="panel-close">
            <Icon name="close" /><span className="u-hidden-visually">{t('close')}</span>
          </button>
        </div>
        {loading && <div className="skeleton skeleton--title" />}
        {!loading && (
          <>
            <h2 className="panel-side__title" lang={settings.ui === 'fr' ? 'fr' : undefined}>{name}</h2>
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
      </aside>
    </>
  );
}
