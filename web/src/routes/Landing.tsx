/**
 * The front door — what a stranger meets at `/`.
 *
 * A landing page is judged in the first screen and trusted or not by the
 * fourth. This one is built to be read in this order (the blueprint's section
 * 6): header · hero with a live preview · what do you want to do today · what
 * is not here yet · one learning, many shapes · learning for my goal · fresh
 * content · what you get wrong decides what comes back · what you can rely on ·
 * questions · a closing call to action · a footer.
 *
 * Four rules this file follows, each of which has cost something before:
 *
 * **No number here is typed.** Every figure comes from
 * content/portal-summary.json, generated from the content and checked by
 * tests/portal-summary.test.js. The brief for the first landing page said
 * "2,392 verbs" and "nothing at C1 or C2 yet"; it is 2,387, and 991 verbs ARE
 * at C1 and C2. The few pieces of quoted content (one card, four lines of one
 * dialogue) live in landing/data.ts and are checked by
 * tests/landing-data.test.js.
 *
 * **"What is not here yet" carries the same weight as "what you can do".** It
 * sits straight after the tiles, in the same band, not in a footnote. A
 * stranger who reads that there is no listening and comes anyway is the person
 * this is for; one who finds out on the third screen has been misled by
 * omission. Tiles for things that do not exist say so ON the tile.
 *
 * **No invented proof.** No learner count, no testimonial, no "success rate".
 * Where a section has nothing true to show it says what IS there. The worked
 * example of a mistake is labelled an example.
 *
 * **Copy is written in English and French only.** Persian and Arabic are not
 * machine-filled: the page is English behind the existing marker, and then
 * ALL of it is English, including its direction and its digits (see
 * `copyLocale` below, and the walk's Persian check, which exists because the
 * mixed version printed full stops on the wrong side).
 */
import { useId } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app-context';
import { Icon } from '../components/Icon';
import { LOCALES, landingTranslated, translator, type Dict } from '../lib/i18n';
import { fr } from '../lib/typography';
import type { Locale } from '../lib/types';
import summary from '../generated/portal-summary.json';
import { Flow } from './landing/Flow';
import { Goals } from './landing/Goals';
import { DialoguePreview, FlashcardPreview } from './landing/Preview';
import {
  DIALOGUE, EXAMPLE_ERROR, EXAMS, READING, READING_LEVELS, type Item,
} from './landing/data';
import { TYPE } from './landing/Goals';
import type { CopyLocale, Tx } from './landing/types';

/** 2387 → "2,387" in the page's own language, which is not always a comma. */
function n(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/**
 * A list in the page's language: "A1, A2" in English, "A1 et A2" in French.
 * Deliberately not a dictionary key: a separator and the word "and" would have
 * meant two more strings to write in each language, and Intl already knows.
 */
function list(items: string[], locale: string, type: 'unit' | 'conjunction'): string {
  try {
    return new Intl.ListFormat(locale, { style: 'short', type }).format(items);
  } catch {
    return items.join(', ');
  }
}

/** {"DELF":["A1","A2"],"TCF":["B1"]} → "DELF A1, A2 · TCF B1". No prose: exam
 *  names and level codes are the same in every language. */
function coverage(papers: Record<string, string[]>, locale: string): string {
  return Object.entries(papers)
    .map(([exam, levels]) => `${exam} ${list(levels, locale, 'unit')}`)
    .join(' · ');
}

/** In-page navigation. A button, not `<a href="#id">`: the router is a HASH
 *  router, so a fragment link would be read as a route and open the 404 page. */
function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* default */ }
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const heading = el.querySelector<HTMLElement>('h2');
  heading?.focus({ preventScroll: true });
}

type TileStatus = 'ready' | 'notbuilt' | 'noaudio';
type Tile = {
  id: string; icon: string; to: string; status: TileStatus;
  title: keyof Dict; body: keyof Dict; vars?: Record<string, string | number>;
};

const STATUS: Record<TileStatus, keyof Dict> = {
  ready: 'landingStatusReady', notbuilt: 'landingStatusNotBuilt', noaudio: 'landingStatusNoAudio',
};

function LanguageSelect({ tx, ui, onChange }: { tx: Tx; ui: Locale; onChange: (l: Locale) => void }) {
  const id = useId();
  return (
    <div className="lp-lang">
      <label htmlFor={id} className="u-hidden-visually">{tx('landingLangLabel')}</label>
      <select id={id} className="select lp-lang__select" value={ui} data-testid="landing-lang"
              onChange={(e) => onChange(e.target.value as Locale)}>
        {(Object.keys(LOCALES) as Locale[]).map((l) => (
          <option key={l} value={l} lang={l}>{LOCALES[l].name}</option>
        ))}
      </select>
    </div>
  );
}

function ItemCard({ item, tx, locale }: { item: Item; tx: Tx; locale: CopyLocale }) {
  const type = TYPE[item.kind];
  const source = item.kind === 'reading' ? 'landingFreshReadingSource'
    : item.kind === 'dialogue' ? 'landingFreshDialogueSource' : 'landingFreshExamSource';
  const levelBasis = item.kind === 'exam' ? 'landingFreshLevelStated' : 'landingFreshLevelAuthor';
  return (
    <li className="lp-fresh__item">
      <div className="lp-fresh__top">
        <span className="lp-fresh__type"><Icon name={type.icon} size={18} />{tx(type.label)}</span>
        <span className={`chip chip--${item.level.toLowerCase()}`}>{item.level}</span>
      </div>
      <h3 className="lp-fresh__title" lang="fr">{fr(item.fr)}</h3>
      {locale !== 'fr' && <p className="lp-fresh__gloss" lang="en">{item.en}</p>}
      <p className="lp-fresh__facts">
        {item.seconds !== undefined && <>{tx('landingFreshMinRead', { minutes: Math.max(1, Math.round(item.seconds / 60)) })}</>}
        {item.minutes !== undefined && <>{tx('landingFreshMinSit', { minutes: item.minutes })}</>}
        {item.kind === 'dialogue' && <>{tx('landingFreshNoAudio')}</>}
      </p>
      <p className="lp-fresh__source">{tx(source)}</p>
      <p className="lp-fresh__source">{tx(levelBasis)}</p>
      <p className="lp-fresh__flag">{tx('landingFreshUnchecked')}</p>
      <Link to={item.to} className="btn lp-fresh__open">
        {tx('landingFreshOpen')}<span className="u-hidden-visually">: {item.en}</span>
      </Link>
    </li>
  );
}

export function Landing() {
  const { t, settings, update } = useApp();
  const ui = settings.ui;
  const translated = landingTranslated(ui);

  /**
   * When nobody has written this page in the reader's language they get
   * English — and then EVERYTHING on it is English, including its direction,
   * its digits, its list separators and its navigation words.
   *
   * Both halves were wrong when this was first rendered in Persian. English
   * sentences sat inside the document's `dir="rtl"`, so every full stop jumped
   * to the left of its sentence. And `Intl` was given the reader's locale, so
   * "2,387" came out as «۲٬۳۸۷» — Persian digits in the middle of an English
   * clause, which is neither language's typography. A page that is in English
   * is in English; the marker above says so; the direction and the numerals
   * have to agree with it. The translator is bound to the same decision for
   * the same reason: `verbs` in Persian would otherwise appear in the footer
   * of an English page.
   */
  const copyLocale: CopyLocale = translated ? (ui as CopyLocale) : 'en';
  const base = translated ? t : translator('en');
  // French is typeset on the way out (narrow no-break space before ; ! ?, the
  // typographic apostrophe), so the dictionary does not have to carry it.
  const tx: Tx = (key, vars) => (copyLocale === 'fr' ? fr(base(key, vars)) : base(key, vars));
  const num = (v: number) => n(v, copyLocale);
  const where = coverage(summary.paperCoverage, copyLocale);

  const tiles: Tile[] = [
    { id: 'word', icon: 'wordtag', to: '/app/vocabulary', status: 'notbuilt',
      title: 'landingTileTermTitle', body: 'landingTileTermBody' },
    { id: 'verb', icon: 'bookclock', to: '/app/verbs', status: 'ready',
      title: 'landingTileVerbTitle', body: 'landingTileVerbBody', vars: { verbs: num(summary.verbs) } },
    { id: 'listening', icon: 'headphones', to: '/app/listening', status: 'noaudio',
      title: 'landingTileListenTitle', body: 'landingTileListenBody' },
    { id: 'reading', icon: 'textpage', to: '/app/reading', status: 'ready',
      title: 'landingTileReadTitle', body: 'landingTileReadBody',
      vars: { from: READING_LEVELS[0], to: READING_LEVELS[1] } },
    { id: 'news', icon: 'newspaper', to: '/app/news', status: 'notbuilt',
      title: 'landingTileNewsTitle', body: 'landingTileNewsBody' },
    { id: 'podcast', icon: 'soundwave', to: '/app/podcasts', status: 'notbuilt',
      title: 'landingTilePodcastTitle', body: 'landingTilePodcastBody' },
    { id: 'exam', icon: 'examsheet', to: '/app/exams', status: 'ready',
      title: 'landingTileExamTitle', body: 'landingTileExamBody',
      vars: { papers: num(summary.papers), items: num(summary.examItems) } },
    { id: 'cards', icon: 'stackedcards', to: '/app/cards', status: 'ready',
      title: 'landingTileCardsTitle', body: 'landingTileCardsBody',
      vars: { cards: num(summary.cards), levels: list(summary.cardLevels, copyLocale, 'conjunction') } },
  ];

  const fresh: Item[] = [READING.market, READING.sleep, DIALOGUE, EXAMS.delfA1];
  const nav: [string, keyof Dict][] = [
    ['preview', 'landingNavTry'], ['today', 'landingNavToday'], ['goal', 'landingNavGoal'],
    ['fresh', 'landingNavFresh'], ['faq', 'landingNavFaq'],
  ];

  return (
    <>
    <div className="page landing" data-testid="landing"
         dir={translated ? undefined : 'ltr'}>
      {/* Shown when nobody has written this page in the reader's language. The
          English below is then the honest fallback, and this line says so
          rather than letting them assume the whole site is English. */}
      {!translated && (
        <p className="landing__untranslated" data-testid="landing-untranslated">
          {t('landingUntranslated')}
        </p>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="lp-top">
        <nav className="lp-top__nav" aria-label={tx('landingNavLabel')}>
          {nav.map(([id, key]) => (
            <button key={id} type="button" className="lp-navlink" onClick={() => goTo(id)}>{tx(key)}</button>
          ))}
        </nav>
        <div className="lp-top__end">
          <LanguageSelect tx={tx} ui={ui} onChange={(l) => update({ ui: l })} />
          <Link to="/app/today" className="btn btn--primary btn--sm lp-top__cta">{tx('landingStart')}</Link>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="landing__hero lp-hero">
        <div className="landing__pitch lp-hero__copy">
          <p className="lp-eyebrow lp-rise lp-d1"><span className="lp-rule" aria-hidden="true" />{tx('landingEyebrow')}</p>
          <h1 className="landing__headline">{tx('landingHeadline')}</h1>
          <p className="landing__lede lp-rise lp-d3">{tx('landingLede')}</p>
          <div className="landing__cta lp-rise lp-d4">
            <div className="lp-actions">
              <Link to="/app/today" className="btn btn--primary btn--lg" data-testid="landing-start">
                {tx('landingStart')}
              </Link>
              <button type="button" className="btn btn--lg" onClick={() => goTo('today')}>
                {tx('landingSeeHow')}
              </button>
            </div>
            <p className="landing__noaccount">{tx('landingNoAccount')}</p>
          </div>
          <p className="landing__audience lp-rise lp-d4">{tx('landingAudience')}</p>
        </div>

        <section className="lp-scene lp-rise lp-d5" id="preview" aria-labelledby="lp-preview-h">
          <div className="lp-scene__intro">
            <h2 id="lp-preview-h" className="lp-scene__title" tabIndex={-1}>{tx('landingPreviewHeading')}</h2>
            <p className="lp-scene__lede">{tx('landingPreviewLede')}</p>
          </div>
          <div className="lp-scene__stage">
            <FlashcardPreview tx={tx} locale={copyLocale} />
            <DialoguePreview tx={tx} locale={copyLocale} />
          </div>
        </section>
      </header>

      <ul className="lp-stats" aria-label={tx('landingStatsLabel')}>
        <li><span className="lp-stats__n">{num(summary.verbs)}</span><span className="lp-stats__l">{tx('landingStatVerbs')}</span></li>
        <li><span className="lp-stats__n">{num(summary.formsSearchable)}</span><span className="lp-stats__l">{tx('landingStatForms')}</span></li>
        <li><span className="lp-stats__n">{num(summary.cards)}</span><span className="lp-stats__l">{tx('landingStatCards')}</span></li>
        <li><span className="lp-stats__n">{num(summary.papers)}</span><span className="lp-stats__l">{tx('landingStatPapers')}</span></li>
        <li className="lp-stats__note">{tx('landingStatsNote')}</li>
      </ul>

      {/* ── What do you want to do today ────────────────────────────────── */}
      <section className="lp-section" id="today" aria-labelledby="landing-today-h" data-testid="landing-today">
        <div className="lp-section__head">
          <h2 id="landing-today-h" className="lp-h2" tabIndex={-1}>{tx('landingTodayHeading')}</h2>
          <p className="lp-section__lede">{tx('landingTodayLede')}</p>
        </div>
        <ul className="lp-tiles">
          {tiles.map((tile) => (
            <li key={tile.id}>
              <Link to={tile.to} className="lp-tile" data-status={tile.status} data-testid={`landing-tile-${tile.id}`}>
                <span className="lp-tile__icon"><Icon name={tile.icon} size={22} /></span>
                <span className="lp-tile__title">{tx(tile.title)}</span>
                <span className="lp-tile__body">{tx(tile.body, tile.vars)}</span>
                <span className="lp-tile__status">
                  {tile.status === 'ready' && <Icon name="check" size={14} />}
                  {tx(STATUS[tile.status])}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── What is not here yet ────────────────────────────────────────── */}
      <section className="lp-gaps" aria-labelledby="landing-notyet-h" data-testid="landing-notyet">
        <div className="lp-gaps__head">
          <h2 id="landing-notyet-h" className="lp-h2">{tx('landingNotYetHeading')}</h2>
          <p className="lp-section__lede">{tx('landingNotYetLede')}</p>
        </div>
        <ul className="landing__gaps lp-gaps__list">
          <li>{tx('landingNoListening')}</li>
          <li>{tx('landingNoWriting')}</li>
          <li>
            {tx('landingCeiling', {
              ceiling: summary.practiceCeiling ?? '—',
              without: num(summary.conceptsWithoutMaterial),
              live: num(summary.liveConcepts),
            })}
          </li>
          <li>{tx('landingUnreviewed')}</li>
        </ul>
      </section>

      {/* ── One learning, many shapes ───────────────────────────────────── */}
      <section className="lp-section" id="flow" aria-labelledby="lp-flow-h">
        <div className="lp-section__head">
          <h2 id="lp-flow-h" className="lp-h2" tabIndex={-1}>{tx('landingFlowHeading')}</h2>
          <p className="lp-section__lede">{tx('landingFlowLede')}</p>
        </div>
        <Flow tx={tx} locale={copyLocale} />
      </section>

      {/* ── Learning for my goal ────────────────────────────────────────── */}
      <section className="lp-section" id="goal" aria-labelledby="lp-goal-h">
        <div className="lp-section__head">
          <h2 id="lp-goal-h" className="lp-h2" tabIndex={-1}>{tx('landingGoalHeading')}</h2>
          <p className="lp-section__lede">{tx('landingGoalLede')}</p>
        </div>
        <Goals tx={tx} locale={copyLocale} />
      </section>

      {/* ── Fresh content ───────────────────────────────────────────────── */}
      <section className="lp-section" id="fresh" aria-labelledby="lp-fresh-h" data-testid="landing-fresh">
        <div className="lp-section__head">
          <h2 id="lp-fresh-h" className="lp-h2" tabIndex={-1}>{tx('landingFreshHeading')}</h2>
          <p className="lp-section__lede">{tx('landingFreshLede')}</p>
        </div>
        <ul className="lp-fresh">
          {fresh.map((it) => <ItemCard key={it.id} item={it} tx={tx} locale={copyLocale} />)}
        </ul>
      </section>

      {/* ── Personal progress ───────────────────────────────────────────── */}
      <section className="lp-section" id="progress" aria-labelledby="lp-progress-h" data-testid="landing-progress">
        <div className="lp-section__head">
          <h2 id="lp-progress-h" className="lp-h2" tabIndex={-1}>{tx('landingProgressHeading')}</h2>
          <p className="lp-section__lede">{tx('landingProgressLede')}</p>
        </div>
        <div className="lp-prog">
          <figure className="lp-fix">
            <figcaption className="lp-fix__tag">{tx('landingProgressExample')}</figcaption>
            <dl className="lp-fix__rows">
              <div className="lp-fix__row">
                <dt>{tx('landingProgressWrote')}</dt>
                <dd><del lang="fr">{fr(EXAMPLE_ERROR.wrote)}</del></dd>
              </div>
              <div className="lp-fix__row">
                <dt>{tx('landingProgressCorrect')}</dt>
                <dd><ins lang="fr">{fr(EXAMPLE_ERROR.correct)}</ins></dd>
              </div>
            </dl>
            <p className="lp-fix__why">{tx('landingProgressWhy')}</p>
            <div className="lp-fix__remedy">
              <h3 className="lp-fix__remedy-title">{tx('landingProgressRemedyTitle')}</h3>
              <p>{tx('landingProgressRemedy')}</p>
              <Link to={EXAMPLE_ERROR.drill} className="btn">{tx('landingProgressRemedyLink')}</Link>
            </div>
          </figure>
          <div className="lp-path">
            <span className="lp-path__icon"><Icon name="path" size={22} /></span>
            <h3 className="lp-path__title">{tx('landingPathHeading')}</h3>
            <p>{tx('landingPathBody')}</p>
            <Link to="/app/progress" className="btn btn--primary">{tx('landingPathLink')}</Link>
          </div>
        </div>
      </section>

      {/* ── What you can rely on, and the examinations ──────────────────── */}
      <section className="lp-section" id="trust" aria-labelledby="lp-trust-h">
        <div className="lp-section__head">
          <h2 id="lp-trust-h" className="lp-h2" tabIndex={-1}>{tx('landingTrustHeading')}</h2>
        </div>
        <ul className="lp-trust">
          <li><h3>{tx('landingTrustOpenTitle')}</h3><p>{tx('landingTrustOpenBody')}</p></li>
          <li>
            <h3>{tx('landingTrustSourcesTitle')}</h3>
            <p>{tx('landingTrustSourcesBody')}</p>
            <Link className="lp-textlink" to="/about">{tx('landingTrustSourcesLink')}</Link>
          </li>
          <li><h3>{tx('landingTrustHonestTitle')}</h3><p>{tx('landingTrustHonestBody')}</p></li>
          <li><h3>{tx('landingTrustIndependentTitle')}</h3><p>{tx('landingTrustIndependentBody')}</p></li>
        </ul>

        <div className="lp-exams" aria-labelledby="landing-exams-h" role="group" data-testid="landing-exams">
          <h3 id="landing-exams-h" className="lp-exams__title">{tx('landingExamsHeading')}</h3>
          <div className="lp-exams__body">
            <p>{tx('landingExamsVerified', { verified: list(summary.examsVerified, copyLocale, 'conjunction') })}</p>
            {/* Rendered only when something IS unverified, so the day somebody
                reads the TEF grid this sentence disappears by itself rather
                than becoming a stale admission. */}
            {summary.examsUnverified.length > 0 && (
              <p data-testid="landing-unverified">
                {tx('landingExamsUnverified', { unverified: list(summary.examsUnverified, copyLocale, 'conjunction') })}
              </p>
            )}
            <p>{tx('landingExamsPapers', { coverage: where })}</p>
          </div>
        </div>
      </section>

      {/* ── Questions ───────────────────────────────────────────────────── */}
      <section className="lp-section" id="faq" aria-labelledby="lp-faq-h">
        <div className="lp-section__head">
          <h2 id="lp-faq-h" className="lp-h2" tabIndex={-1}>{tx('landingFaqHeading')}</h2>
        </div>
        <div className="lp-faq">
          {([
            ['landingFaqAccountQ', 'landingFaqAccountA'],
            ['landingFaqWhereQ', 'landingFaqWhereA'],
            ['landingFaqOfficialQ', 'landingFaqOfficialA'],
            ['landingFaqAudioQ', 'landingFaqAudioA'],
            ['landingFaqTeacherQ', 'landingFaqTeacherA'],
          ] as [keyof Dict, keyof Dict][]).map(([q, a]) => (
            <details key={q} className="lp-faq__item">
              <summary>{tx(q)}</summary>
              <p>{tx(a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing call to action ──────────────────────────────────────── */}
      <section className="lp-close" aria-labelledby="lp-close-h">
        <h2 id="lp-close-h" className="lp-close__title">{tx('landingCloseHeading')}</h2>
        <p className="lp-close__body">{tx('landingCloseBody')}</p>
        <Link to="/app/today" className="btn btn--lg lp-close__cta">{tx('landingStart')}</Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="landing__footer">
        <div className="lp-foot__grid">
          <div className="lp-foot__brand">
            <p className="lp-foot__name"><span className="lp-rule" aria-hidden="true" />{t('appName')}</p>
            <p>{tx('landingFooterFree')}</p>
          </div>
          <nav aria-labelledby="lp-foot-learn">
            <h2 id="lp-foot-learn" className="lp-foot__h">{tx('landingFooterLearn')}</h2>
            <ul>
              <li><Link to="/app/verbs">{tx('landingTypeVerbs')}</Link></li>
              <li><Link to="/app/reading">{tx('landingTypeReading')}</Link></li>
              <li><Link to="/app/cards">{tx('landingTypeCards')}</Link></li>
              <li><Link to="/app/exams">{tx('landingTypeExam')}</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="lp-foot-project">
            <h2 id="lp-foot-project" className="lp-foot__h">{tx('landingFooterProject')}</h2>
            <ul className="landing__links">
              <li><Link to="/about#data">{tx('landingFooterPrivacy')}</Link></li>
              {/* The About screen's own heading, reused: the same words for the
                  same page. */}
              <li><Link to="/about">{tx('landingTrustSourcesLink')}</Link></li>
              <li><Link to="/account">{tx('landingFooterSettings')}</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="lp-foot__h">{tx('landingFooterLanguage')}</h2>
            <ul className="lp-foot__langs">
              {(Object.keys(LOCALES) as Locale[]).map((l) => (
                <li key={l}>
                  <button type="button" className="lp-foot__lang" lang={l} aria-pressed={ui === l}
                          onClick={() => update({ ui: l })}>{LOCALES[l].name}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="landing__independence">{tx('landingFooterIndependent')}</p>
      </footer>
    </div>

    {/* For a returning learner only, and hidden from everybody else by CSS.
        The prerendered HTML is this landing page, so without something to put
        in its place a learner who has studied here would see the pitch flash
        past on every visit while the bundle loads. public/boot.js reveals this
        block instead, before the first paint, and React replaces it with the
        real dashboard a moment later. aria-hidden because it carries no
        information: it is the shape of a card, not a card. */}
    <div className="landing-boot" aria-hidden="true" data-testid="landing-boot">
      <div className="page">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
      </div>
    </div>
    </>
  );
}
