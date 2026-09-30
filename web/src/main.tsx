import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router';
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
import './styles.css';

// Hash routing: the site is served from a repository subpath on static hosting
// with no server to rewrite deep links, and a pasted URL must work. Every
// meaningful view therefore still has an address.
const router = createHashRouter([
  {
    path: '/',
    element: <AppProvider><Shell /></AppProvider>,
    children: [
      { index: true, element: <Navigate to="/learn" replace /> },
      { path: 'learn', element: <Learn /> },
      { path: 'learn/concept/:id', element: <ConceptRoute /> },
      { path: 'learn/level/:level/:skill', element: <Stub title="Level and skill"
          status="Lesson pages per level and skill are not built. The concepts for this level exist and are searchable, and the flashcards and verbs sections cover A1 today. Next after Sounds and Timers." /> },
      { path: 'learn/verbs', element: <VerbList /> },
      { path: 'learn/verbs/:infinitive', element: <VerbDetail /> },
      { path: 'practise/conjugation', element: <ConjugationDrill /> },
      { path: 'practise/review', element: <FlashcardSession /> },
      { path: 'practise/exams', element: <Stub title="Mock exams"
          status="DELF, DALF and TCF mock papers are not built. The exam descriptions and official links exist in the earlier portal and will move here. Planned after Sounds and Timers." /> },
      { path: 'practise/listening', element: <Stub title="Sounds and listening"
          status="Blocked on audio, not on code: this project may only use recordings whose licence permits it, and none has been obtained yet. Machine speech is not shipped as listening practice. The phonetics concepts exist and are searchable now." /> },
      { path: 'progress', element: <Progress /> },
      { path: 'search', element: <SearchRoute /> },
      { path: 'account', element: <Account /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

// Offline is an enhancement: if registration fails the app works exactly as
// before, without the cache.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* http://, private mode */ });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>
);
