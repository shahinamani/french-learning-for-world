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
      { path: 'learn/level/:level/:skill', element: <Stub title="Level" /> },
      { path: 'learn/verbs', element: <Stub title="Verbs" /> },
      { path: 'practise/review', element: <FlashcardSession /> },
      { path: 'practise/exams', element: <Stub title="Exams" /> },
      { path: 'practise/listening', element: <Stub title="Listening" /> },
      { path: 'progress', element: <Progress /> },
      { path: 'search', element: <SearchRoute /> },
      { path: 'account', element: <Account /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>
);
