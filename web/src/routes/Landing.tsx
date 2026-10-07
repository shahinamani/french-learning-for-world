/**
 * The front door.
 *
 * Until today `/` was one line — `<Navigate to="/learn" replace />` — so there
 * was no landing page to criticise, only a redirect. Two consequences, and the
 * second is the serious one:
 *
 *  1. Somebody who typed the domain was shown a study map, and the first words
 *     they read were a notice about browser storage. Nothing on the screen said
 *     what this is, who it is for, or which examinations it prepares them for.
 *  2. The build PRERENDERS the home route into index.html, so the static HTML
 *     a crawler reads — and the first paint on a slow connection — was also the
 *     study map. The page the site is judged by was the one page nobody had
 *     written.
 *
 * Two rules this file follows, and both have cost something before:
 *
 * **No number here is typed.** Every figure comes from
 * content/portal-summary.json, generated from the content and checked against
 * it by tests/portal-summary.test.js. The brief for this page said "2,392
 * verbs" and "nothing at C1 or C2 yet"; it is 2,387, and 991 verbs ARE at C1
 * and C2 — what stops at B2 is the exercises. Both would have shipped as
 * confident sentences on the front page.
 *
 * **"What is not here yet" carries the same weight as "what you can do".** Not
 * a footnote, not a collapsed section, not below the fold on a phone. A
 * stranger who reads that we have 22 flashcards and no listening, and comes
 * anyway, is the person this is for; one who discovers it on their third screen
 * has been misled by omission.
 */
import { Link } from 'react-router';
import { useApp, useLocale } from '../app-context';
import { landingTranslated } from '../lib/i18n';
import summary from '../generated/portal-summary.json';

/** 2387 → "2,387" in the reader's own locale, which is not always a comma. */
function n(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/**
 * A list in the reader's own language: "A1, A2" in English, "A1، A2" in Arabic.
 *
 * Deliberately not a dictionary key. A separator and the word "and" would have
 * meant writing two more strings in Farsi and Arabic to render this page, and
 * machine-filling those is the thing this project does not do. Intl already
 * knows, in every locale, and gets the Arabic comma right.
 */
function list(items: string[], locale: string, type: 'unit' | 'conjunction'): string {
  try {
    return new Intl.ListFormat(locale, { style: 'short', type }).format(items);
  } catch {
    return items.join(', ');
  }
}

/** {"DELF":["A1","A2"],"TCF":["B1"]} → "DELF A1, A2 · TCF B1". No prose: the
 *  exam names and the level codes are the same in every language, and
 *  punctuation needs no translator. */
function coverage(papers: Record<string, string[]>, locale: string): string {
  return Object.entries(papers)
    .map(([exam, levels]) => `${exam} ${list(levels, locale, 'unit')}`)
    .join(' · ');
}

export function Landing() {
  const { t } = useApp();
  const ui = useLocale();
  const translated = landingTranslated(ui);

  /**
   * When nobody has written this page in the reader's language they get
   * English — and then EVERYTHING on it is English, including its direction
   * and its digits.
   *
   * Both halves were wrong when this was first rendered in Persian. English
   * sentences sat inside the document's `dir="rtl"`, so every full stop jumped
   * to the left of its sentence: ".No account. Nothing to sign up for". And
   * `Intl` was given the reader's locale, so "2,387" came out as «۲٬۳۸۷» —
   * Persian digits in the middle of an English clause, which is neither
   * language's typography.
   *
   * A page that is in English is in English. The marker above says so; the
   * direction and the numerals have to agree with it.
   */
  const copyLocale = translated ? ui : 'en';
  const num = (v: number) => n(v, copyLocale);
  const where = coverage(summary.paperCoverage, copyLocale);

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

      <header className="landing__hero">
        {/* The prose is wrapped so the hero has exactly TWO children. Without
            this wrapper the desktop rule turned the hero into a row of four
            columns and squeezed the headline into a 323px-tall sliver — caught
            by the 1440px check in web/e2e/walk.mjs, which exists because the
            complaint that started this page was "a phone layout on a wide
            screen". */}
        <div className="landing__pitch">
          <h1 className="landing__headline">{t('landingHeadline')}</h1>
          <p className="landing__lede">{t('landingLede')}</p>
          <p className="landing__audience">{t('landingAudience')}</p>
        </div>
        <div className="landing__cta">
          <Link to="/learn" className="btn btn--primary btn--lg" data-testid="landing-start">
            {t('landingStart')}
          </Link>
          <p className="landing__noaccount">{t('landingNoAccount')}</p>
        </div>
      </header>

      <div className="landing__columns">
        <section className="landing__panel landing__panel--have"
                 aria-labelledby="landing-today" data-testid="landing-today">
          <h2 id="landing-today" className="h2">{t('landingTodayHeading')}</h2>

          <article className="landing__item">
            <h3 className="h3">{t('landingVerbsTitle', { verbs: num(summary.verbs) })}</h3>
            <p>{t('landingVerbsBody', { forms: num(summary.formsSearchable) })}</p>
          </article>

          <article className="landing__item">
            <h3 className="h3">{t('landingDrillTitle')}</h3>
            <p>{t('landingDrillBody')}</p>
          </article>

          <article className="landing__item">
            <h3 className="h3">
              {t('landingExamsTitle', { papers: num(summary.papers), items: num(summary.examItems) })}
            </h3>
            <p>{t('landingExamsBody', { coverage: where })}</p>
            {/* The caveat sits with the claim, not at the bottom of the page.
                Nothing in this product is teacher-reviewed yet, and the one
                place a stranger must not learn that late is beside the words
                "exam papers". */}
            {summary.examItemsReviewed === 0 && (
              <p className="landing__caveat" data-testid="landing-exams-caveat">
                {t('landingExamsCaveat')}
              </p>
            )}
          </article>

          <article className="landing__item">
            <h3 className="h3">
              {t('landingCardsTitle', {
                cards: num(summary.cards),
                levels: list(summary.cardLevels, copyLocale, 'conjunction'),
              })}
            </h3>
            <p>{t('landingCardsBody')}</p>
          </article>
        </section>

        <section className="landing__panel landing__panel--havent"
                 aria-labelledby="landing-notyet" data-testid="landing-notyet">
          <h2 id="landing-notyet" className="h2">{t('landingNotYetHeading')}</h2>
          <p className="landing__lede-sm">{t('landingNotYetLede')}</p>
          <ul className="landing__gaps">
            <li>{t('landingNoListening')}</li>
            <li>{t('landingNoWriting')}</li>
            <li>
              {t('landingCeiling', {
                ceiling: summary.practiceCeiling ?? '—',
                without: num(summary.conceptsWithoutMaterial),
                live: num(summary.liveConcepts),
              })}
            </li>
            <li>{t('landingUnreviewed')}</li>
          </ul>
        </section>
      </div>

      <section className="landing__panel" aria-labelledby="landing-exams-h"
               data-testid="landing-exams">
        <h2 id="landing-exams-h" className="h2">{t('landingExamsHeading')}</h2>
        <p>{t('landingExamsVerified', { verified: list(summary.examsVerified, copyLocale, 'conjunction') })}</p>
        {/* Rendered only when something IS unverified, so the day somebody
            reads the TEF grid this sentence disappears by itself rather than
            becoming a stale admission. */}
        {summary.examsUnverified.length > 0 && (
          <p data-testid="landing-unverified">
            {t('landingExamsUnverified', { unverified: list(summary.examsUnverified, copyLocale, 'conjunction') })}
          </p>
        )}
        <p>{t('landingExamsPapers', { coverage: where })}</p>
      </section>

      <footer className="landing__footer">
        <p>{t('landingFooterFree')}</p>
        <p className="landing__independence">{t('landingFooterIndependent')}</p>
        <p className="landing__links">
          <Link to="/about#data">{t('landingFooterPrivacy')}</Link>
          <span aria-hidden="true"> · </span>
          {/* The About screen's own heading, reused: the same words for the same
              page. A separate landing key holding identical text would be a
              second thing to keep in step for nothing. */}
          <Link to="/about">{t('aboutSources')}</Link>
        </p>
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
