/**
 * The Reader, exported whole.
 *
 * Not mounted by this stream: web/src/main.tsx and the routing table belong to
 * S1. It should be mounted at `/app/reading/*`:
 *
 *     const Reader = lazy(() => import('./features/reader').then((m) => ({ default: m.Reader })));
 *     <Route path="app/reading/*" element={lazily(<Reader />)} />
 *
 * or as two routes, `app/reading` -> ReaderList and `app/reading/:id` -> ReaderPage.
 */
// This chunk registers its English: the Reader strings are not in the first load.
import '../../lib/locales/en/readerEn';
import { Route, Routes } from 'react-router';
import { ReaderList } from './ReaderList';
import { ReaderPage } from './ReaderPage';

export { ReaderList, ReaderPage };

/** Both reader routes under one mount point: `/app/reading` and `/app/reading/:id`. */
export function Reader() {
  return (
    <Routes>
      <Route index element={<ReaderList />} />
      <Route path=":id" element={<ReaderPage />} />
    </Routes>
  );
}
