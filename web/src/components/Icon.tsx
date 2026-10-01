/**
 * One icon family: 24px grid, 1.7 stroke, round caps. Drawn, never emoji —
 * an emoji renders differently on every system and cannot inherit colour.
 * Every icon here sits beside a text label; none is the only label.
 */
const P: Record<string, string[]> = {
  learn: ['M7 8.5A1.5 1.5 0 0 1 8.5 7h9A1.5 1.5 0 0 1 19 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 17.5z',
          'M5 16.2A1.6 1.6 0 0 1 4 14.8V6.6A1.6 1.6 0 0 1 5.6 5h8.2c.6 0 1.2.4 1.4 1'],
  practise: ['M7 3h7l4 4v14H7z', 'M14 3v4h4', 'M10 13h6M10 17h4'],
  progress: ['M4 19h16', 'M7 19v-6M12 19V7M17 19v-9'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4.2-4.2'],
  settings: ['M4 7h10M18 7h2M4 17h4M12 17h8M4 12h6M14 12h6',
             'M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
  timer: ['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 9v4l2.5 2.5M9 2h6'],
  close: ['M6 6l12 12M18 6L6 18'],
  check: ['M20 6 9 17l-5-5'],
  chevron: ['M9 6l6 6-6 6'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 8h.01'],
  book: ['M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 1-2-2z', 'M6 17h12'],
  sound: ['M11 5 6 9H3v6h3l5 4z', 'M16 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12'],
  mute: ['M11 5 6 9H3v6h3l5 4z', 'M16 9.5l5 5M21 9.5l-5 5'],
  alert: ['M12 3 2.5 20h19z', 'M12 10v4', 'M12 17h.01'],
};

export function Icon({ name, size = 20 }: { name: keyof typeof P | string; size?: number }) {
  const paths = P[name] ?? P.info!;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
