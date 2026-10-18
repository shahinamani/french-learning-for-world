/**
 * The top of every portal page: where you are, and a way to look for anything.
 *
 * The breadcrumb is derived from the address, not passed in by each page, so a
 * page cannot forget it. The search is a real form: Enter submits it, and it
 * lands on the search route with the query in the address, where the existing
 * search page reads it.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../../app-context';
import { Icon } from '../../components/Icon';
import { itemFor, groupFor, FOOTER } from './nav';

type Crumb = { label: string; to?: string };

export function useCrumbs(pathname: string): Crumb[] {
  const { t } = useApp();
  const crumbs: Crumb[] = [{ label: t('appName'), to: '/app/today' }];
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'app') {
    const f = FOOTER.find((i) => i.to === pathname);
    if (f) crumbs.push({ label: t(f.label) });
    return crumbs;
  }
  const seg = parts[1];
  if (seg === 'search') { crumbs.push({ label: t('search') }); return crumbs; }
  if (seg === 'workspace') { crumbs.push({ label: t('wsTitle') }); return crumbs; }
  const it = itemFor(pathname);
  if (!it) return crumbs;
  const group = groupFor(it);
  if (group) crumbs.push({ label: t(group) });
  const rest = parts.slice(2);
  crumbs.push(rest.length ? { label: t(it.label), to: it.to } : { label: t(it.label) });
  rest.forEach((p, n) => {
    // The last segment is the page itself. Exam ids, verbs and level codes are
    // shown as written: they are identifiers, not interface strings.
    let label = decodeURIComponent(p);
    if (p === 'sit' || p === 'results') label = p;
    crumbs.push(n === rest.length - 1 ? { label } : { label, to: '/app/' + parts.slice(1, 3 + n).join('/') });
  });
  return crumbs;
}

export function TopLine() {
  const { t } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const crumbs = useCrumbs(pathname);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    navigate(text ? `/app/search?q=${encodeURIComponent(text)}` : '/app/search');
  };

  return (
    <div className="topline" data-testid="topline">
      <nav className="crumbs" aria-label={t('shellBreadcrumb')} data-testid="breadcrumb">
        <ol>
          {crumbs.map((c, i) => (
            <li key={i}>
              {c.to && i < crumbs.length - 1
                ? <Link to={c.to}>{c.label}</Link>
                : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <form className="gsearch" role="search" onSubmit={submit} data-testid="global-search">
        <label className="u-hidden-visually" htmlFor="gsearch-q">{t('shellSearchLabel')}</label>
        <input id="gsearch-q" type="search" className="gsearch__input" value={q} autoComplete="off"
               placeholder={t('shellSearchPlaceholder')} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="icon-btn" data-testid="global-search-go">
          <Icon name="search" /><span className="u-hidden-visually">{t('shellSearchGo')}</span>
        </button>
      </form>
    </div>
  );
}
