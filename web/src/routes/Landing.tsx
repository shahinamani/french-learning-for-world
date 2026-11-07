/**
 * The front door — what a stranger meets at `/`.
 *
 * Redesign v1 (docs/blueprint/REDESIGN-v1.md §5), third pass. The design plan,
 * so the next person does not drift back to a template:
 *
 *   - Subject first. The page is about French, so French leads: the headline
 *     is a French sentence with its English beneath it, the contents are a
 *     French book's sommaire, and the practice desk sits on Seyès ruling, the
 *     paper of every French school exercise book.
 *   - Paris limestone, the enamel blue of a Paris street sign, ink, and the red
 *     of the tricolore used only as a mark. No cream, no terracotta.
 *   - Spectral (Production Type, Paris) for French and headings, Inria Sans for
 *     the interface. One family each, two clear roles.
 *   - No all-caps labels above headings, no strings joined with middle dots, no
 *     arrows on buttons, no single coloured word in a headline, no grid of
 *     identical cards, no stats strip. The counts live in the contents rows.
 *
 * Rules that still hold from the first version:
 * **No number here is typed** — every figure is content/portal-summary.json,
 * checked by tests/portal-summary.test.js and scripts/prerender.mjs.
 * **"What is not here yet" comes straight after what you can do** — the
 * prerender fails if it moves. **No invented proof.** **Copy is English and
 * French only**; in Persian and Arabic the page is English, in English's
 * direction and digits, behind a line that says so.
 */
import { lazy, Suspense, useId } from 'react';
import { Link } from 'react-router';
import { Check, WifiOff, Lock } from 'lucide-react';
import { useApp } from '../app-context';
import { LOCALES, landingTranslated, translator, type Dict } from '../lib/i18n';
import { fr } from '../lib/typography';
import type { Locale } from '../lib/types';
import summary from '../generated/portal-summary.json';
import { Flow } from './landing/Flow';
import { Goals } from './landing/Goals';
import { DialoguePreview, FlashcardPreview } from './landing/Preview';
import { READING, READING_LEVELS } from './landing/data';
import type { CopyLocale, Tx } from './landing/types';
import { Button } from '../components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { cn } from '../lib/cn';

function n(value: number, locale: string): string {
  try { return new Intl.NumberFormat(locale).format(value); } catch { return String(value); }
}
function list(items: string[], locale: string, type: 'unit' | 'conjunction'): string {
  try { return new Intl.ListFormat(locale, { style: 'short', type }).format(items); } catch { return items.join(', '); }
}
function coverage(papers: Record<string, string[]>, locale: string): string {
  return Object.entries(papers).map(([exam, levels]) => `${exam} ${list(levels, locale, 'unit')}`).join('; ');
}

/** In-page navigation. A button, not `<a href="#id">`: the router is a HASH
 *  router, so a fragment link would be read as a route and open the 404 page. */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* default */ }
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
}

/** The tricolore as a thin rule along an edge. */
function Tricolore({ className }: { className?: string }) {
  return <span className={cn('lp3-tricolore', className)} aria-hidden="true"><span /><span /><span /></span>;
}

/** The French the page is about, the same in every interface language. The
 *  headline is `landingHeadline` in lib/locales/fr.ts, written out here
 *  because that dictionary is a lazy chunk, absent from the prerender. */
const HEADLINE_FR = 'Le français, pour la vie que tu veux.';
/** The hero film is its own lazy chunk: the first-load budget had 0.1 KB spare,
 *  and the still frame is the page's picture until the film arrives anyway. */
const HeroFilm = lazy(() => import('./landing/HeroFilm'));
const CLOSE_FR = 'On commence ?';

function LanguageSelect({ tx, ui, onChange }: { tx: Tx; ui: Locale; onChange: (l: Locale) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="u-hidden-visually">{tx('landingLangLabel')}</label>
      <select id={id} value={ui} data-testid="landing-lang" onChange={(e) => onChange(e.target.value as Locale)}
        className="min-h-11 rounded-md border border-border-strong bg-card px-3 pe-8 text-sm text-foreground cursor-pointer">
        {(Object.keys(LOCALES) as Locale[]).map((l) => (
          <option key={l} value={l} lang={l}>{LOCALES[l].name}</option>
        ))}
      </select>
    </div>
  );
}

function Head({ id, title, lede }: { id: string; title: string; lede?: string }) {
  return (
    <div className="lp3-head">
      <h2 id={id} tabIndex={-1} className="lp3-h2">{title}</h2>
      {lede && <p className="lp3-lede">{lede}</p>}
    </div>
  );
}

type Row = {
  id: string; to: string; word: string; title: keyof Dict; body: keyof Dict;
  vars?: Record<string, string | number>; count: string; unit: string; photo: string;
};

export function Landing() {
  const { t, settings, update } = useApp();
  const ui = settings.ui;
  const translated = landingTranslated(ui);
  const copyLocale: CopyLocale = translated ? (ui as CopyLocale) : 'en';
  const base = translated ? t : translator('en');
  const tx: Tx = (key, vars) => (copyLocale === 'fr' ? fr(base(key, vars)) : base(key, vars));
  const num = (v: number) => n(v, copyLocale);
  const english = copyLocale !== 'fr';

  // The contents of the portal, as a French book lists its chapters. The
  // French word is content (lang="fr"); the count is counted, not typed.
  const rows: Row[] = [
    { id: 'verb', to: '/app/verbs', word: 'les verbes', title: 'landingTypeVerbs', body: 'landingTileVerbBody',
      vars: { verbs: num(summary.verbs) }, count: num(summary.verbs), unit: tx('landingStatVerbs'), photo: 'bouquinistes' },
    { id: 'cards', to: '/app/cards', word: 'les cartes', title: 'landingTypeCards', body: 'landingTileCardsBody',
      vars: { cards: num(summary.cards), levels: list(summary.cardLevels, copyLocale, 'conjunction') },
      count: num(summary.cards), unit: tx('landingStatCards'), photo: 'croissant' },
    { id: 'reading', to: '/app/reading', word: 'la lecture', title: 'landingTypeReading', body: 'landingTileReadBody',
      vars: { from: READING_LEVELS[0], to: READING_LEVELS[1] },
      count: `${READING_LEVELS[0]}–${READING_LEVELS[1]}`, unit: tx('landingTypeReading'), photo: 'terrace' },
    { id: 'exam', to: '/app/exams', word: 'les examens', title: 'landingTypeExam', body: 'landingTileExamBody',
      vars: { papers: num(summary.papers), items: num(summary.examItems) },
      count: num(summary.papers), unit: tx('landingStatPapers'), photo: 'flag-balcony' },
  ];

  const day = [
    { item: READING.market, photo: 'market' },
    { item: READING.work, photo: 'metro' },
    { item: READING.sleep, photo: 'bookshelves' },
    { item: READING.music, photo: 'musicians' },
  ];

  const nav: [string, keyof Dict][] = [
    ['today', 'landingNavToday'], ['desk', 'landingNavTry'], ['goal', 'landingNavGoal'], ['faq', 'landingNavFaq'],
  ];

  const pic = (name: string, small: number, large: number) =>
    ({ src: `photos/${name}-${small}.webp`, srcSet: `photos/${name}-${small}.webp ${small}w, photos/${name}-${large}.webp ${large}w` });

  return (
    <>
    <div className="landing lp3" data-testid="landing" dir={translated ? undefined : 'ltr'}>
      {!translated && (
        <p className="landing__untranslated" data-testid="landing-untranslated">{t('landingUntranslated')}</p>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="lp3-header">
        <Tricolore />
        <div className="lp3-wrap lp3-header__in">
          <Link to="/" className="lp3-brand">{t('appName')}</Link>
          <nav className="lp3-nav" aria-label={tx('landingNavLabel')}>
            {nav.map(([id, key]) => (
              <button key={id} type="button" onClick={() => goTo(id)}>{tx(key)}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSelect tx={tx} ui={ui} onChange={(l) => update({ ui: l })} />
            <Button asChild className="hidden sm:inline-flex rounded-md">
              <Link to="/app/today">{tx('landingStart')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero: Paris at golden hour, and the sentence the page is about ─
           Design 22, chosen 2026-11-07: a calm silent film (the Eiffel Tower at
           golden hour, Pexels licence) over its own still frame, a centred and
           formal composition at the foot of the picture. */}
      <section className="lp3-hero" aria-labelledby="lp3-h1">
        <picture>
          <source media="(max-width: 960px)" srcSet="photos/eiffel-golden-hour-640.webp" />
          <img src="photos/eiffel-golden-hour-1280.webp" width={1280} height={720} alt={tx('landingHeroPhotoAltParis')}
               fetchPriority="high" className="lp3-hero__photo" />
        </picture>
        <Suspense><HeroFilm src="video/eiffel-golden-hour.mp4" /></Suspense>
        <div className="lp3-hero__shade" aria-hidden="true" />
        <div className="lp3-wrap lp3-hero__in">
          <h1 id="lp3-h1" className="landing__headline lp3-h1" lang="fr" dir="ltr">{fr(HEADLINE_FR)}</h1>
          {english && <p className="lp3-h1-en">{tx('landingHeadline')}</p>}
          <p className="lp3-hero__lede">{tx('landingLede')}</p>
          <p className="lp3-hero__audience">{tx('landingAudience')}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Button asChild size="lg" data-testid="landing-start" className="rounded-[2px] border border-white bg-transparent font-normal text-white hover:bg-white hover:text-[#1f3a6e]">
              <Link to="/app/today">{tx('landingStart')}</Link>
            </Button>
            <button type="button" className="lp3-textlink lp3-textlink--light" onClick={() => goTo('today')}>
              {tx('landingSeeHow')}
            </button>
          </div>
          <ul className="lp3-points">
            {([['landingPointFree', Check], ['landingPointOffline', WifiOff], ['landingPointPrivate', Lock]] as const)
              .map(([k, I]) => <li key={k}><I className="size-4" aria-hidden="true" />{tx(k)}</li>)}
          </ul>
        </div>
      </section>

      {/* ── Contents: what is here, counted ────────────────────────────── */}
      <section className="lp3-wrap lp3-section" id="today" aria-labelledby="landing-today-h" data-testid="landing-today">
        <Head id="landing-today-h" title={tx('landingTodayHeading')} lede={tx('landingTodayLedeReady')} />
        <ol className="lp3-contents">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={r.to} className="lp3-row" data-testid={`landing-tile-${r.id}`}>
                <img {...pic(r.photo, 480, 900)} sizes="160px" width={480} height={360} alt="" loading="lazy" className="lp3-row__photo" />
                <span className="lp3-row__word" lang="fr">{r.word}</span>
                <span className="lp3-row__text">
                  <span className="lp3-row__title">{tx(r.title)}</span>
                  <span className="lp3-row__body">{tx(r.body, r.vars)}</span>
                </span>
                <span className="lp3-row__count"><span>{r.count}</span><small>{r.unit}</small></span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="lp3-note">
          {tx('landingStatsNote')} {num(summary.formsSearchable)} {tx('landingStatForms')}.
        </p>
      </section>

      {/* ── What is not here yet: straight after, same weight ──────────── */}
      <section className="lp3-wrap lp3-gaps" aria-labelledby="landing-notyet-h" data-testid="landing-notyet">
        <Head id="landing-notyet-h" title={tx('landingNotYetHeading')} lede={tx('landingNotYetLede')} />
        <ul className="landing__gaps lp3-gaps__list">
          <li>{tx('landingNoListening')}</li>
          <li>{tx('landingNoWriting')}</li>
          <li>{tx('landingCeiling', {
            ceiling: summary.practiceCeiling ?? '—',
            without: num(summary.conceptsWithoutMaterial),
            live: num(summary.liveConcepts),
          })}</li>
        </ul>
      </section>

      {/* ── The practice desk: a real card and a real dialogue, on Seyès ─ */}
      <section className="lp3-desk" id="desk" aria-labelledby="lp3-desk-h">
        <div className="lp3-wrap lp3-section">
          <Head id="lp3-desk-h" title={tx('landingPreviewHeading')} lede={tx('landingPreviewLede')} />
          <div className="lp3-desk__grid">
            <FlashcardPreview tx={tx} locale={copyLocale} />
            <DialoguePreview tx={tx} locale={copyLocale} />
          </div>
        </div>
      </section>

      {/* ── A day in French: the reading texts ─────────────────────────── */}
      <section className="lp3-wrap lp3-section" aria-labelledby="lp3-day-h">
        <Head id="lp3-day-h" title={tx('landingDayHeading')} lede={tx('landingDayLede')} />
        <ul className="lp3-day">
          {day.map(({ item, photo }) => (
            <li key={item.id}>
              <Link to={item.to} className="lp3-story">
                <img {...pic(photo, 480, 900)} sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
                     width={480} height={360} alt="" loading="lazy" className="lp3-story__photo" />
                <span className="lp3-story__meta">
                  <span className={`chip chip--${item.level.toLowerCase()}`}>{item.level}</span>
                  {tx('landingFreshMinRead', { minutes: Math.max(1, Math.round((item.seconds ?? 60) / 60)) })}
                </span>
                <span className="lp3-story__title" lang="fr">{fr(item.fr)}</span>
                {english && <span className="lp3-story__en">{item.en}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="lp3-alt" id="flow" aria-labelledby="lp-flow-h">
        <div className="lp3-wrap lp3-section">
          <Head id="lp-flow-h" title={tx('landingFlowHeading')} lede={tx('landingFlowLede')} />
          <Flow tx={tx} locale={copyLocale} />
        </div>
      </section>

      {/* ── Learning for my goal ───────────────────────────────────────── */}
      <section className="lp3-wrap lp3-section lp3-goal" id="goal" aria-labelledby="lp-goal-h">
        <div className="flex flex-col gap-8">
          <Head id="lp-goal-h" title={tx('landingGoalHeading')} lede={tx('landingGoalLede')} />
          <img {...pic('boulangerie', 600, 1200)} sizes="(min-width: 1024px) 40vw, 100vw" width={1200} height={800}
               alt="" loading="lazy" className="lp3-goal__photo" />
        </div>
        <Goals tx={tx} locale={copyLocale} />
      </section>

      {/* ── What you can rely on, and the examinations ─────────────────── */}
      <section className="lp3-alt" id="trust" aria-labelledby="lp-trust-h">
        <div className="lp3-wrap lp3-section">
          <Head id="lp-trust-h" title={tx('landingTrustHeading')} />
          <dl className="lp3-trust">
            {([
              ['landingTrustOpenTitle', 'landingTrustOpenBody'],
              ['landingTrustSourcesTitle', 'landingTrustSourcesBody'],
              ['landingTrustIndependentTitle', 'landingTrustIndependentBody'],
            ] as [keyof Dict, keyof Dict][]).map(([h, b]) => (
              <div key={h}>
                <dt>{tx(h)}</dt>
                <dd>
                  {tx(b)}
                  {h === 'landingTrustSourcesTitle' && (
                    <> <Link className="lp3-textlink" to="/about">{tx('landingTrustSourcesLink')}</Link></>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="lp3-exams" role="group" aria-labelledby="landing-exams-h" data-testid="landing-exams">
            <h3 id="landing-exams-h">{tx('landingExamsHeading')}</h3>
            <div>
              <p>{tx('landingExamsVerified', { verified: list(summary.examsVerified, copyLocale, 'conjunction') })}</p>
              <p>{tx('landingExamsPapers', { coverage: coverage(summary.paperCoverage, copyLocale) })}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Questions ──────────────────────────────────────────────────── */}
      <section className="lp3-wrap lp3-section lp3-faq" id="faq" aria-labelledby="lp-faq-h">
        <Head id="lp-faq-h" title={tx('landingFaqHeading')} />
        <Accordion>
          {([
            ['landingFaqAccountQ', 'landingFaqAccountA'],
            ['landingFaqWhereQ', 'landingFaqWhereA'],
            ['landingFaqOfficialQ', 'landingFaqOfficialA'],
            ['landingFaqAudioQ', 'landingFaqAudioA'],
          ] as [keyof Dict, keyof Dict][]).map(([q, a]) => (
            <AccordionItem key={q}>
              <AccordionTrigger>{tx(q)}</AccordionTrigger>
              <AccordionContent>{tx(a)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ── Closing: Montmartre ────────────────────────────────────────── */}
      <section className="lp3-close" aria-labelledby="lp-close-h">
        <img {...pic('montmartre', 800, 1600)} sizes="100vw" width={1600} height={900} alt="" loading="lazy"
             className="lp3-close__photo" />
        <div className="lp3-close__shade" aria-hidden="true" />
        <div className="lp3-wrap lp3-close__in">
          <h2 id="lp-close-h" className="lp3-close__fr" lang="fr" dir="ltr">{fr(CLOSE_FR)}</h2>
          <p className="lp3-close__en">{tx('landingCloseHeading')}. {tx('landingCloseBody')}</p>
          <Button asChild size="lg" className="bg-white text-[#1f3a6e] hover:bg-[#e9edf5] rounded-md font-bold">
            <Link to="/app/today">{tx('landingStart')}</Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="landing__footer lp3-footer">
        <div className="lp3-wrap lp3-footer__grid">
          <div>
            <p className="lp3-brand">{t('appName')}</p>
            <p className="lp3-footer__free">{tx('landingFooterFree')}</p>
          </div>
          <nav aria-labelledby="lp-foot-learn">
            <h2 id="lp-foot-learn">{tx('landingFooterLearn')}</h2>
            <ul>
              <li><Link to="/app/verbs">{tx('landingTypeVerbs')}</Link></li>
              <li><Link to="/app/reading">{tx('landingTypeReading')}</Link></li>
              <li><Link to="/app/cards">{tx('landingTypeCards')}</Link></li>
              <li><Link to="/app/exams">{tx('landingTypeExam')}</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="lp-foot-project">
            <h2 id="lp-foot-project">{tx('landingFooterProject')}</h2>
            <ul className="landing__links">
              <li><Link to="/about#data">{tx('landingFooterPrivacy')}</Link></li>
              <li><Link to="/about">{tx('landingTrustSourcesLink')}</Link></li>
              <li><Link to="/account">{tx('landingFooterSettings')}</Link></li>
            </ul>
          </nav>
          <div>
            <h2>{tx('landingFooterLanguage')}</h2>
            <ul>
              {(Object.keys(LOCALES) as Locale[]).map((l) => (
                <li key={l}>
                  <button type="button" lang={l} aria-pressed={ui === l} onClick={() => update({ ui: l })}>
                    {LOCALES[l].name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="lp3-wrap landing__independence lp3-footer__legal">{tx('landingFooterIndependent')}</p>
        <Tricolore />
      </footer>
    </div>

    {/* For a returning learner only, hidden from everybody else by CSS: see
        public/boot.js. aria-hidden because it is the shape of a card, not one. */}
    <div className="landing-boot" aria-hidden="true" data-testid="landing-boot">
      <div className="page">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
      </div>
    </div>
    </>
  );
}
