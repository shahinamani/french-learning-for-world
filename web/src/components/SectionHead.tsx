import type { ReactNode } from 'react';

/**
 * The one heading every list page wears (redesign v2, 2026-11-19). Seven
 * sections had a photograph banner with the French name and then the same
 * name again in the interface language; four had neither. A learner moving
 * between them met a different page each time and 300 px of banner before
 * any content. Now: the name, the French beside it as content, one line of
 * lede, and a slot for the counts and filters that belong to the heading.
 */
export function SectionHead({ title, fr, lede, note, aside, titleTestId, ledeTestId }: {
  title: ReactNode; fr?: string; lede?: ReactNode; note?: ReactNode; aside?: ReactNode;
  titleTestId?: string; ledeTestId?: string;
}) {
  return (
    <header className="sec-head">
      <div className="sec-head__text">
        <h1 className="sec-head__title" data-testid={titleTestId}>
          <span>{title}</span>
          {fr && <span className="sec-head__fr" lang="fr" dir="ltr">{fr}</span>}
        </h1>
        {lede && <p className="sec-head__lede" dir="auto" data-testid={ledeTestId}>{lede}</p>}
        {note}
      </div>
      {aside && <div className="sec-head__aside">{aside}</div>}
    </header>
  );
}
