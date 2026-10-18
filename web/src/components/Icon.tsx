/**
 * One icon family: 24px grid, 1.7 stroke, round caps. Drawn, never emoji —
 * an emoji renders differently on every system and cannot inherit colour.
 * An icon is decoration unless it is the only thing in its control. The default
 * is `aria-hidden`, and the control then needs a visible label or an
 * `aria-label`; an icon that stands alone passes `label` and is exposed as an
 * image with that name. The blueprint (section 16, rejection reasons) treats an
 * icon row without names as a defect, and walk.mjs checks it on every route.
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
  // The portal navigation set (blueprint section 5). Same grid, same stroke.
  home: ['M4 11.5 12 5l8 6.5', 'M6 10v9h12v-9', 'M10 19v-5h4v5'],
  path: ['M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6'],
  wordtag: ['M4 4h7.5l8.5 8.5-7.5 7.5L4 11.5z', 'M8.5 8.5h.01'],
  stackedcards: ['M7 8h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M8 5h8', 'M10 2.5h4'],
  bookclock: ['M5 4h8a2 2 0 0 1 2 2v3', 'M5 4v15a1 1 0 0 0 1 1h4', 'M5 16h4',
              'M16 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16 14v2l1.5 1'],
  openbook: ['M12 6c-1.5-1.3-4-2-7-2v13c3 0 5.5.7 7 2 1.5-1.3 4-2 7-2V4c-3 0-5.5.7-7 2z', 'M12 6v13'],
  headphones: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3v6H5.5A1.5 1.5 0 0 1 4 18.5z', 'M20 14h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5z'],
  textpage: ['M6 3h9l3 3v15H6z', 'M9 9h6M9 13h6M9 17h4'],
  micpen: ['M9 3h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M5 10a5 5 0 0 0 10 0', 'M10 15v3',
           'M15 21l.7-3 5-5 2.3 2.3-5 5z'],
  newspaper: ['M4 5h13v14a1 1 0 0 0 1 1H6a2 2 0 0 1-2-2z', 'M17 9h3v9a2 2 0 0 1-2 2', 'M7 9h7M7 13h7M7 16h4'],
  soundwave: ['M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2'],
  examsheet: ['M6 3h9l3 3v15H6z', 'M9 9h6', 'M9 14l1.5 1.5L14 12', 'M9 19h5'],
  bookmark: ['M7 4h10v17l-5-4-5 4z'],
  chart: ['M4 4v16h16', 'M8 15l3-4 3 2 5-6'],
  more: ['M6 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M18 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7', 'M12 17h.01'],
  exit: ['M10 4H5v16h5', 'M15 8l4 4-4 4', 'M19 12H9'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  appearance: ['M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z'],
  chevrondown: ['M6 9l6 6 6-6'],
};

export function Icon({ name, size = 20, label }: { name: keyof typeof P | string; size?: number; label?: string }) {
  const paths = P[name] ?? P.info!;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
         {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
