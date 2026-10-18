/**
 * Old addresses, forwarded.
 *
 * Every redirect is `replace`: a push would leave the old address in history,
 * and Back would land on it, which forwards again, which is a loop the learner
 * cannot leave. The query string travels with the redirect because `?minutes=`,
 * `?concept=`, `?verb=` and `?panel=` are state that the old links carry.
 *
 * The table is CONTRACTS-v0.2.md section 1. Two rows are deliberately not what
 * the contract says; both are named where they are mounted in main.tsx.
 */
import { Navigate, useLocation, useParams } from 'react-router';

type Params = Record<string, string | undefined>;
const enc = encodeURIComponent;

/** Redirect to `to(params)`, keeping the query string. */
export function Redirect({ to }: { to: (p: Params) => string }) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate replace to={{ pathname: to(params), search }} />;
}

/** The splat arrives decoded, one segment at a time; re-encode each segment. */
export const splat = (p: Params) =>
  (p['*'] ?? '').split('/').filter(Boolean).map(enc).join('/');

/** old pattern -> how to build the new path. Read by main.tsx and by the walk. */
export const LEGACY: Array<{ from: string; to: (p: Params) => string }> = [
  { from: 'learn', to: () => '/app/today' },
  { from: 'learn/verbs', to: () => '/app/verbs' },
  { from: 'learn/verbs/:infinitive', to: (p) => `/app/verbs/${enc(p.infinitive ?? '')}` },
  { from: 'learn/concept/:id', to: (p) => `/app/grammar/${enc(p.id ?? '')}` },
  { from: 'learn/level/:level/:skill', to: (p) => `/app/path/${enc(p.level ?? '')}/${enc(p.skill ?? '')}` },
  { from: 'practise', to: () => '/app/cards' },
  { from: 'practise/review', to: () => '/app/cards' },
  { from: 'practise/conjugation', to: () => '/app/verbs/drill' },
  { from: 'practise/exams/*', to: (p) => `/app/exams${splat(p) ? '/' + splat(p) : ''}` },
  { from: 'practise/listening', to: () => '/app/listening' },
  { from: 'progress', to: () => '/app/progress' },
  { from: 'workspace', to: () => '/app/workspace' },
  { from: 'search', to: () => '/app/search' },
];
