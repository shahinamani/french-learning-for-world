import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router';
import { AppProvider } from './app-context';
import { Shell } from './components/Shell';
import { Learn } from './routes/Learn';
import { Progress } from './routes/Progress';
import { Account } from './routes/Account';
import { SearchRoute } from './components/Search';
import { FlashcardSession } from './features/flashcards/Session';
import { VerbList } from './features/verbs/VerbList';
import { VerbDetail } from './features/verbs/VerbDetail';
import { ConjugationDrill } from './features/verbs/Conjugation';
import { Stub, NotFound } from './routes/Stub';
import { LevelSkill } from './routes/LevelSkill';
import { Home } from './routes/Home';
import { Redirect, LEGACY } from './routes/app/Redirects';
import { Placeholder, PLACEHOLDERS } from './routes/app/Placeholder';
import * as NAV from './routes/app/nav';

const PlaceholderRoute = ({ id }: { id: string }) => {
  const p = PLACEHOLDERS[id]!;
  return <Placeholder item={NAV.ALL_ITEMS.find((i) => i.id === id)!} missing={p.missing} instead={p.instead} />;
};

// Exams is the largest section and no screen needs it until a learner asks for
// it, so it is a lazy chunk: a section this size in the first load would spend
// most of what is left of the 150 KB budget.
//
// This comment used to state the headroom in bytes. It was typed once, by
// somebody who had measured it that day, and by the time anybody checked it was
// wrong — understating the headroom, which is the direction that makes people
// decline changes they could afford. The figure now lives in
// scripts/budget.mjs, which measures it on every build and prints it.
const ExamList = lazy(() => import('./features/exams/ExamList').then((m) => ({ default: m.ExamList })));
const ExamPaperRoute = lazy(() => import('./features/exams/ExamPaper').then((m) => ({ default: m.ExamPaperRoute })));
const ExamSit = lazy(() => import('./features/exams/ExamSit').then((m) => ({ default: m.ExamSit })));
const ExamResults = lazy(() => import('./features/exams/ExamResults').then((m) => ({ default: m.ExamResults })));

// The workspace is lazy for the same reason exams are: it pulls the verb index
// reader, the speech layer and the whole card surface, and the first load has
// 15.7 KB of headroom against the 150 KB budget. A learner who never opens it
// does not pay for it.
const Workspace = lazy(() => import('./features/workspace/Workspace').then((m) => ({ default: m.Workspace })));

// Grammar and the Reader are lazy chunks for the same reason: the first load
// is measured against a 150 KB ceiling (scripts/budget.mjs) and neither screen
// is needed until a learner opens it.
const GrammarList = lazy(() => import('./features/grammar').then((m) => ({ default: m.GrammarList })));
// :id is a lesson where one has been written and the concept page otherwise.
const GrammarOrConcept = lazy(() => import('./routes/app/GrammarOrConcept').then((m) => ({ default: m.GrammarOrConcept })));
const Reader = lazy(() => import('./features/reader').then((m) => ({ default: m.Reader })));

/** A lazy route still has to render something while its chunk arrives, and a
 *  blank screen is not one of the four honest states. */
const lazily = (node: React.ReactNode) => (
  <Suspense fallback={<div className="page"><div className="skeleton skeleton--title" /><div className="skeleton skeleton--text" /></div>}>
    {node}
  </Suspense>
);
import './styles.css';
import { About } from './routes/About';

// Hash routing: the site is served from a repository subpath on static hosting
// with no server to rewrite deep links, and a pasted URL must work. Every
// meaningful view therefore still has an address.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppProvider><Shell /></AppProvider>}>
        {/* Was `<Navigate to="/learn" replace />`. A stranger who typed the
            domain got the study map, and the first thing they read was a
            notice about browser storage — and because the build prerenders
            this route, that was also the HTML a crawler read. Home shows the
            landing page to a stranger and the dashboard to somebody who has
            studied here; see routes/Home.tsx for how it decides. */}
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        {/* The learner routes, all under /app (CONTRACTS-v0.2.md section 1).
            Each existing page is mounted here unchanged; the sections nobody
            has built render an honest placeholder (routes/app/Placeholder). */}
        <Route path="app">
          <Route index element={<Navigate replace to="/app/today" />} />
          <Route path="today" element={<Learn />} />
          <Route path="path" element={<PlaceholderRoute id="path" />} />
          <Route path="path/:level/:skill" element={<LevelSkill />} />
          <Route path="vocabulary" element={<PlaceholderRoute id="vocabulary" />} />
          <Route path="cards" element={<FlashcardSession />} />
          <Route path="verbs" element={<VerbList />} />
          {/* Static segment, so it outranks :infinitive. The contract sends the
              old conjugation page to /app/verbs/:infinitive (drill tab); that
              tab does not exist, and this page is the drill with its own
              ?verb=, so it is mounted here until the verb stream adds the tab. */}
          <Route path="verbs/drill" element={<ConjugationDrill />} />
          <Route path="verbs/:infinitive" element={<VerbDetail />} />
          <Route path="grammar" element={lazily(<GrammarList />)} />
          {/* :id is a lesson id or a concept id, so the old /learn/concept/:id
              redirect (routes/app/Redirects.tsx) lands here unchanged. A
              concept with no lesson shows the concept page, not a dead end. */}
          <Route path="grammar/:id" element={lazily(<GrammarOrConcept />)} />
          <Route path="listening" element={<Stub titleKey="stubSoundsTitle" bodyKey="stubSoundsBody" />} />
          <Route path="reading/*" element={lazily(<Reader />)} />
          <Route path="output" element={<PlaceholderRoute id="output" />} />
          <Route path="news" element={<PlaceholderRoute id="news" />} />
          <Route path="podcasts" element={<PlaceholderRoute id="podcasts" />} />
          <Route path="exams" element={lazily(<ExamList />)} />
          <Route path="exams/:paperId" element={lazily(<ExamPaperRoute />)} />
          <Route path="exams/:paperId/sit" element={lazily(<ExamSit />)} />
          <Route path="exams/:paperId/results" element={lazily(<ExamResults />)} />
          <Route path="saved" element={<PlaceholderRoute id="saved" />} />
          <Route path="progress" element={<Progress />} />
          <Route path="search" element={<SearchRoute />} />
          {/* Not in the contract's table. The workspace is a finished page that
              Learn links to; the table sends /workspace to Today, which would
              make that link a loop back to where it was clicked. */}
          <Route path="workspace" element={lazily(<Workspace />)} />
        </Route>

        {/* Old addresses. Every one forwards with `replace`; none may 404. */}
        {LEGACY.map((r) => <Route key={r.from} path={r.from} element={<Redirect to={r.to} />} />)}

        <Route path="account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}


// Offline is an enhancement: if registration fails the app works exactly as
// before, without the cache.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* http://, private mode */ });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><HashRouter><AppRoutes /></HashRouter></StrictMode>
);
