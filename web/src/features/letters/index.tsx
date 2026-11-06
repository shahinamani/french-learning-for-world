/**
 * Letters (production écrite): the formal letter and the informal letter.
 * Mounted at `/app/writing/*` in main.tsx as a lazy chunk.
 */
// This chunk registers its English: the letters strings are not in the first load.
import '../../lib/locales/en/writingEn';
import { Route, Routes } from 'react-router';
import { LettersHome } from './LettersHome';
import { KindPage } from './KindPage';
import { WritingDesk } from './WritingDesk';

export function Letters() {
  return (
    <Routes>
      <Route index element={<LettersHome />} />
      <Route path=":kind" element={<KindPage />} />
      <Route path=":kind/:taskId" element={<WritingDesk />} />
    </Routes>
  );
}
