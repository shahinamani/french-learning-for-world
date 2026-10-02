import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router';
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

// Exams is the largest section and no screen needs it until a learner asks for
// it, so it is a lazy chunk. With 8 026 bytes of headroom left against the
// 150 KB budget, a section this size in the first load would have spent it.
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
        <Route index element={<Navigate to="/learn" replace />} />
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
        <Route path="learn/level/:level/:skill" element={<Stub titleKey="stubLevelTitle" bodyKey="stubLevelBody" />} />
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
