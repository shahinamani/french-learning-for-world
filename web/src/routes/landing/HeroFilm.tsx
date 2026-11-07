import { useEffect, useRef } from 'react';

/**
 * The silent film behind the landing headline: the Eiffel Tower at golden
 * hour above the Seine (Pexels 13315638, Yago Trillo, Pexels licence: free,
 * commercial use, no credit or permission needed; see content/attribution.json).
 *
 * The owner chose the design on 2026-11-07 (design 22). The still frame
 * underneath is the page's picture; the film is an enhancement laid over it:
 *
 *   - It has no `src` in the prerendered HTML. The source is set only here,
 *     after mount, so a visitor without JavaScript, with reduced motion, or
 *     with Save-Data on never downloads it and sees the still frame instead.
 *   - It is muted and plays at 60% speed: the calm was the point of the choice.
 *   - It plays only while it is on screen, and fades in once it is actually
 *     playing, so a slow network shows the still, never a black box.
 */
export default function HeroFilm({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (!v || conn?.saveData || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Every browser that runs this app has matchMedia and IntersectionObserver.
    v.muted = true;
    v.defaultPlaybackRate = 0.6;
    v.onplay = () => { v.playbackRate = 0.6; };
    v.onplaying = () => v.classList.add('is-playing');
    v.src = src;
    // Plays only on screen; a refused autoplay leaves the still frame.
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) v.play().catch(() => {}); else v.pause(); });
    io.observe(v);
    return () => { io.disconnect(); v.pause(); v.onplay = v.onplaying = null; v.removeAttribute('src'); };
  }, [src]);

  return <video ref={ref} className="lp3-hero__film" muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />;
}
