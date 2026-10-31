/**
 * The exam a learner is preparing for, and what the portal knows about it.
 *
 * Redesign v1 (REDESIGN-v1.md, owner decision 2026-10-31): the portal is built
 * around the learner's exam. They choose it once; the sidebar then shows that
 * exam's four sections. The choice is stored per profile, like every other
 * preference, and nothing about it leaves the device.
 *
 * Everything shown about an exam's format is read from content/exams.json,
 * where each figure carries the source it was read from. An exam whose format
 * nobody has verified shows no figures at all.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Locale } from './types';

export type SectionKey = 'co' | 'ce' | 'pe' | 'po';
export const SECTIONS: SectionKey[] = ['co', 'ce', 'pe', 'po'];

/** The skill name a section is filed under in exam-papers.json and in the
 *  resources lists of exams.json. */
export const SKILL_OF: Record<SectionKey, string> = { co: 'listening', ce: 'reading', pe: 'writing', po: 'speaking' };

/** The official section codes as each exam body prints them. DELF and DALF
 *  say PE and PO; the TCF and the TEF say EE and EO for the same skills. */
const CODES: Record<SectionKey, string[]> = {
  co: ['CO', 'CPO'], ce: ['CE', 'CPE'], pe: ['PE', 'EE', 'CPE'], po: ['PO', 'EO', 'CPO'],
};
// DALF C2 has two combined papers: CPO (listening and speaking) and CPE
// (reading and writing). Each serves two sections, and is counted once.

export type Target = {
  id: string;           // the address segment, e.g. "delf-b1"
  exam: string;         // the id in exams.json, e.g. "delf"
  level: string | null; // DELF and DALF are sat at a level; the TCF and TEF are not
  label: string;        // "DELF B1"
  family: 'delf' | 'dalf' | 'tcf' | 'canada';
};

const t = (exam: string, level: string | null, label: string, family: Target['family']): Target =>
  ({ id: level ? `${exam}-${level.toLowerCase()}` : exam, exam, level, label, family });

export const TARGETS: Target[] = [
  t('delf', 'A1', 'DELF A1', 'delf'), t('delf', 'A2', 'DELF A2', 'delf'),
  t('delf', 'B1', 'DELF B1', 'delf'), t('delf', 'B2', 'DELF B2', 'delf'),
  t('dalf', 'C1', 'DALF C1', 'dalf'), t('dalf', 'C2', 'DALF C2', 'dalf'),
  t('tcf', null, 'TCF tout public', 'tcf'),
  t('tcf-canada', null, 'TCF Canada', 'canada'),
  t('tef-canada', null, 'TEF Canada', 'canada'),
];

export const targetById = (id: string | null | undefined) => TARGETS.find((x) => x.id === id) ?? null;

// ── The learner's choice, per profile ─────────────────────────────────────
const key = (userId: string) => `flw:u:${userId}:exam-target`;
const EVENT = 'flw:exam-target';

export function readTarget(userId: string): Target | null {
  try { return targetById(localStorage.getItem(key(userId))); } catch { return null; }
}

export function useTarget(userId: string): [Target | null, (id: string) => void] {
  const [target, setTarget] = useState<Target | null>(() => readTarget(userId));
  useEffect(() => {
    const sync = () => setTarget(readTarget(userId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, [userId]);
  const choose = useCallback((id: string) => {
    try { localStorage.setItem(key(userId), id); } catch { /* private mode: the choice lasts the page */ }
    setTarget(targetById(id));
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);
  return [target, choose];
}

// ── What exams.json says ──────────────────────────────────────────────────
type Names = Partial<Record<Locale, string>>;
export type Paper = {
  code: string; name: Names; minutes?: number; minutesNote?: string;
  marks?: number; items?: number; exercises?: number; exercisesNote?: string; task?: string;
};
type Text = string | Partial<Record<Locale, string>>;
export type Resource = { title: string; url: string; skill: string; kind: string; publisher?: string; lang?: string };
export type Source = { what: string; url: string; readOn: string };
export type ExamEntry = {
  id: string; code: string; fullName: string; owner: string;
  resources: Resource[];
  preparationOffered?: boolean;
  structure: {
    verifiedOn: string | null; note?: Text; caveat?: Text; sources?: Source[];
    /** One rule for the exam, or one per level (DALF). */
    passing?: { overall?: string; perPaper?: string } & Record<string, unknown>;
    papers?: Record<string, Paper[]>;
    compulsory?: Paper[]; optional?: Paper[];
    scoring?: { scale?: string; note?: string };
    validity?: string | { resultsValidFor?: string };
  };
};

let cache: Promise<ExamEntry[]> | null = null;
export function loadExamEntries(): Promise<ExamEntry[]> {
  cache ??= fetch('./content/exams.json')
    .then((r) => { if (!r.ok) throw new Error('exams'); return r.json(); })
    .then((j) => j.exams as ExamEntry[])
    .catch((e) => { cache = null; throw e; });
  return cache;
}

/** The four official papers of a target, in CO, CE, PE, PO order, or null
 *  where the exam's format has not been verified. */
export function papersOf(entry: ExamEntry, target: Target): Partial<Record<SectionKey, Paper>> | null {
  const s = entry.structure;
  if (!s.verifiedOn) return null;
  const list: Paper[] = target.level && s.papers ? (s.papers[target.level] ?? [])
    : [...(s.compulsory ?? []), ...(s.optional ?? [])];
  const out: Partial<Record<SectionKey, Paper>> = {};
  for (const k of SECTIONS) {
    const p = list.find((x) => CODES[k].includes(x.code));
    if (p) out[k] = p;
  }
  return out;
}

/** The minutes of the whole exam, each paper counted once. */
export function totalMinutes(entry: ExamEntry, target: Target): number {
  const s = entry.structure;
  const list: Paper[] = target.level && s.papers ? (s.papers[target.level] ?? [])
    : [...(s.compulsory ?? []), ...(s.optional ?? [])];
  return list.reduce((m, p) => m + (p.minutes ?? 0), 0);
}

/** The passing rule for a target: per level where the exam states one. */
export function passingOf(entry: ExamEntry, target: Target): { overall?: string; perPaper?: string } | null {
  const p = entry.structure.passing;
  if (!p) return null;
  const byLevel = target.level ? (p[target.level] as { overall?: string; perPaper?: string } | undefined) : undefined;
  return byLevel ?? (p.overall || p.perPaper ? { overall: p.overall, perPaper: p.perPaper } : null);
}

export function validityOf(entry: ExamEntry): string | null {
  const v = entry.structure.validity;
  return typeof v === 'string' ? v : v?.resultsValidFor ?? null;
}

/** Papers the exam has beyond the four skills (the TCF's language-structures
 *  section). Shown on the overview so the format is complete. */
export function extraPapersOf(entry: ExamEntry): Paper[] {
  const all = entry.structure.compulsory ?? [];
  return all.filter((p) => !Object.values(CODES).flat().includes(p.code));
}
