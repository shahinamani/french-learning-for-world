/** Search any verb. */
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../../app-context';
import { loadVerbIndex, loadVerbForms, type VerbSummary } from '../../lib/verbs';
import { Icon } from '../../components/Icon';
import { ErrorState } from '../../components/Search';
import { fr as frText } from '../../lib/typography';
import { verbLabel } from '../../lib/pronominal';
import { fold } from '../../lib/fold';
import { WithAccentBar } from '../../components/AccentBar';

// Shared with answer checking and the verb filter: three near-copies of this
// had drifted, and none of them handled the œ/æ ligatures.
const norm = fold;

export function VerbList() {
  const { t } = useApp();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const input = useRef<HTMLInputElement>(null);
  const setQuery = (v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set('q', v); else p.delete('q');
    setParams(p, { replace: true });
  };
  const [verbs, setVerbs] = useState<VerbSummary[] | null>(null);
  const [error, setError] = useState(false);
  // Filled only after a search finds nothing, and only once.
  const [forms, setForms] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let live = true;
    loadVerbIndex().then((v) => { if (live) setVerbs(v); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    if (!verbs) return [];
    const n = norm(q.trim());
    if (!n) return verbs;
    // The index carries the infinitive and the English gloss, not the forms.
    // Searching a conjugated form would mean holding every paradigm in memory,
    // which is the thing the split exists to avoid.
    const direct = verbs.filter((v) => norm(v.infinitive).includes(n) || norm(v.en).includes(n));
    if (direct.length) return direct;
    // Nothing matched a name or a meaning, so the query may be a conjugated
    // form: « allons », « fîtes », « vaudrait ». The form index answers that,
    // and is fetched only now.
    if (!forms) return [];
    const lemma = forms[q.trim().toLowerCase()] ?? forms[q.trim()];
    return lemma ? verbs.filter((v) => v.infinitive === lemma) : [];
  }, [verbs, q, forms]);

  useEffect(() => {
    if (!verbs || !q.trim() || forms) return;
    const n = norm(q.trim());
    const anyDirect = verbs.some((v) => norm(v.infinitive).includes(n) || norm(v.en).includes(n));
    if (anyDirect) return;
    let live = true;
    loadVerbForms().then((f) => { if (live) setForms(f); }).catch(() => {});
    return () => { live = false; };
  }, [verbs, q, forms]);

  // 2,392 rows is not a list, it is a wall. Show the first slice and say how
  // many there are, so the number is information rather than a scroll.
  const LIMIT = 60;
  const capped = shown.slice(0, LIMIT);

  if (error) return <ErrorState onRetry={() => location.reload()} />;

  return (
    <div className="page">
      <h1 className="h2">{t('verbs')}</h1>
      <p className="muted">{t('verbsIntro')}</p>
      <WithAccentBar inputRef={input} onInsert={setQuery}>
        <label className="field">
          <span className="u-hidden-visually">{t('search')}</span>
          <input ref={input} id="verb-q" className="input" type="search" value={q} data-testid="verb-search"
                 placeholder={t('verbSearchPlaceholder')}
                 onChange={(e) => setQuery(e.target.value)} />
      </label>
      </WithAccentBar>

      {verbs === null && (
        <ul className="rows" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <li key={i}><div className="row row--placeholder"><span className="skeleton skeleton--text" style={{ width: `${55 - i * 6}%` }} /></div></li>)}
        </ul>
      )}
      {verbs !== null && shown.length === 0 && (
        <p className="muted" data-testid="verbs-empty">{t('searchEmpty', { q })}</p>
      )}
      {verbs !== null && (
        <p className="muted" data-testid="verb-count">
          {t('verbCount', { shown: String(capped.length), total: String(shown.length) })}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="rows" data-testid="verb-list">
          {capped.map((v) => (
            <li key={v.infinitive}>
              <Link className="row row--link" to={`/learn/verbs/${encodeURIComponent(v.infinitive)}`}>
                {/* verbLabel, not v.infinitive: « se souvenir ». The learner
                    meets this list before the detail page, so the bare
                    infinitive here is the first thing they would have copied. */}
                <span className="row-fr" lang="fr" dir="ltr"
                      data-testid={`row-${v.infinitive}`}>{frText(verbLabel(v))}</span>
                {/* The first sense only. The index carries every sense so that
                    searching "to wear" finds « porter », but a row showing all
                    of them runs to 190 characters and stops being a list. */}
                <span className="muted">{v.en.split('; ')[0]}</span>
                {v.irregular && <span className="chip" data-testid={`irr-${v.infinitive}`}>{t('irregular')}</span>}
                <Icon name="chevron" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
