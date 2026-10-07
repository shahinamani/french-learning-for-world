import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router';
import { AppProvider } from './app-context';
import { Shell } from './components/Shell';
import { Learn } from './routes/Learn';
import { Progress } from './routes/Progress';
import { Account } from './routes/Account';
import { ConceptRoute } from './routes/Concept';
import { SearchRoute } from './components/Search';
import { FlashcardSession } from './features/flashcards/Session';
import { VerbList } from './features/verbs/VerbList';
import { VerbDetail } from './features/verbs/VerbDetail';
import { ConjugationDrill } from './features/verbs/Conjugation';
import { Stub, NotFound } from './routes/Stub';
import { LevelSkill } from './routes/LevelSkill';
import { Home } from './routes/Home';

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
        <Route path="learn" element={<Learn />} />
        <Route path="learn/concept/:id" element={<ConceptRoute />} />
        <Route path="learn/verbs" element={<VerbList />} />
        <Route path="learn/verbs/:infinitive" element={<VerbDetail />} />
        <Route path="practise/conjugation" element={<ConjugationDrill />} />
        <Route path="practise/review" element={<FlashcardSession />} />
        <Route path="practise/exams" element={lazily(<ExamList />)} />
        <Route path="practise/exams/:paperId" element={lazily(<ExamPaperRoute />)} />
        <Route path="practise/exams/:paperId/sit" element={lazily(<ExamSit />)} />
        <Route path="practise/exams/:paperId/results" element={lazily(<ExamResults />)} />
        <Route path="progress" element={<Progress />} />
        <Route path="search" element={<SearchRoute />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<NotFound />} />
        {/* Was a Stub. All 18 clickable cells of the learn map led here and
            said "Not built yet"; the map is the portal's main navigation and a
            learner who hits three dead ends stops believing it. */}
        <Route path="learn/level/:level/:skill" element={<LevelSkill />} />
        <Route path="practise/listening" element={<Stub titleKey="stubSoundsTitle" bodyKey="stubSoundsBody" />} />
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
