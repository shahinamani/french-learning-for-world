/**
 * Characters a French keyboard has and a UK, US or Persian one does not.
 *
 * This is the other half of the `œ` defect. Folding fixed the marking — a
 * learner typing `soeur` for `sœur` is no longer told they are wrong. It did
 * nothing about the thing they actually feel, which is that on their keyboard
 * `é è ê ç à ù œ` cannot be typed at all. `docs/04` specified this bar and it
 * was never built; the register said so, which is not the same as fixing it.
 *
 * Accessibility, because a row of sixteen buttons is easy to get wrong:
 *
 * - It is ONE tab stop, not sixteen. `role="toolbar"` with a roving tabindex:
 *   Tab moves past the whole bar, and ← → Home End move within it. Sixteen
 *   extra tab stops between an answer box and its Check button would make the
 *   keyboard path worse for everyone, including the people this is for.
 * - It appears when the field it serves has focus and stays while focus is
 *   inside it, so three screens do not each carry a permanent sixteen-button
 *   row. It is never the only way to enter a character — a French keyboard,
 *   a compose key and pasting all still work.
 * - Every button is ≥44px and carries an accessible name, because "é" alone is
 *   announced as a letter with no context.
 * - It stays left-to-right inside a right-to-left page: these are French
 *   letters and their order is not the interface's order.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useApp } from '../app-context';

/** From docs/04. Order follows a French keyboard's own grouping, not the alphabet. */
export const ACCENT_CHARS = [
  'é', 'è', 'ê', 'ë',
  'à', 'â', 'ù', 'û',
  'î', 'ï', 'ô', 'ç',
  'œ', 'æ', '«', '»',
] as const;

/** Names for a screen reader. "é" on its own is announced as a bare letter. */
const NAMES: Record<string, string> = {
  'é': 'e acute', 'è': 'e grave', 'ê': 'e circumflex', 'ë': 'e diaeresis',
  'à': 'a grave', 'â': 'a circumflex', 'ù': 'u grave', 'û': 'u circumflex',
  'î': 'i circumflex', 'ï': 'i diaeresis', 'ô': 'o circumflex', 'ç': 'c cedilla',
  'œ': 'o e ligature', 'æ': 'a e ligature',
  '«': 'opening guillemet', '»': 'closing guillemet',
};

/**
 * Insert at the caret, replacing any selection — not append. Appending would
 * put the accent at the end of the word whatever the learner had selected,
 * which is worse than useless when correcting a letter mid-word.
 */
export function insertAtCaret(value: string, start: number, end: number, ch: string) {
  const at = Math.max(0, Math.min(start, value.length));
  const to = Math.max(at, Math.min(end, value.length));
  return { value: value.slice(0, at) + ch + value.slice(to), caret: at + ch.length };
}

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  onInsert: (next: string) => void;
  id?: string;
};

export function AccentBar({ inputRef, onInsert, id = 'accent-bar' }: Props) {
  const { t } = useApp();
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const caret = useRef<number | null>(null);

  // Put the caret back after React has re-rendered with the new value.
  useEffect(() => {
    if (caret.current === null) return;
    const el = inputRef.current;
    const at = caret.current;
    caret.current = null;
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(at, at); } catch { /* some input types refuse */ }
  });

  const insert = useCallback((ch: string) => {
    const el = inputRef.current;
    if (!el) return;
    const { value, caret: to } = insertAtCaret(
      el.value, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, ch);
    caret.current = to;
    onInsert(value);
  }, [inputRef, onInsert]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = ACCENT_CHARS.length - 1;
    let next = active;
    if (e.key === 'ArrowRight') next = active === last ? 0 : active + 1;
    else if (e.key === 'ArrowLeft') next = active === 0 ? last : active - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    setActive(next);
    const buttons = barRef.current?.querySelectorAll('button');
    (buttons?.[next] as HTMLButtonElement | undefined)?.focus();
  };

  return (
    <div ref={barRef} id={id} className="accents" role="toolbar" dir="ltr"
         aria-label={t('accentBar')} aria-controls={inputRef.current?.id}
         data-testid="accent-bar" onKeyDown={onKeyDown}>
      {ACCENT_CHARS.map((ch, i) => (
        <button key={ch} type="button" className="accents__key"
                // Roving tabindex: exactly one button is in the tab order.
                tabIndex={i === active ? 0 : -1}
                data-testid={`accent-${ch}`}
                aria-label={NAMES[ch] ?? ch}
                onFocus={() => setActive(i)}
                // Keep the caret where it is: taking focus on mousedown would
                // collapse the selection before the click handler reads it.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(ch)}>
          <span aria-hidden="true">{ch}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Shows the bar once the field it serves has been focused, and then LEAVES IT.
 *
 * The first version closed it again on blur, which was wrong in a way only the
 * browser showed: unmounting the bar reflows the page between mousedown and
 * mouseup, so the click lands on nothing. Typing a search term and then tapping
 * the first result did nothing at all — the learner's first tap was eaten every
 * time. Caught by walking it; the component tested fine in isolation.
 *
 * Opening on focus still shifts the content below by one row, but that happens
 * while the learner is in the field rather than while they are clicking
 * something under it. Not closing costs a strip of screen on a page whose
 * fields are all French anyway.
 */
export function WithAccentBar(
  { inputRef, onInsert, children }: Props & { children: React.ReactNode },
) {
  const [shown, setShown] = useState(false);
  return (
    <div className="accents__host" onFocus={() => setShown(true)}>
      {children}
      {shown && <AccentBar inputRef={inputRef} onInsert={onInsert} />}
    </div>
  );
}
