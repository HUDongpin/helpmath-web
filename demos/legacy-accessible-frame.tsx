'use client';

import {useLayoutEffect, useRef, type ReactNode} from 'react';

export function AccessibleLegacyFrame({children, frame, lang, kind}: {
  children: ReactNode;
  frame: number;
  lang: 'en' | 'es';
  kind: 'gallon' | 'liter';
}) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const spanish = lang === 'es';
    const title = host.current?.querySelector('svg title');
    const description = host.current?.querySelector('svg desc');
    const replay = host.current?.querySelector('.flash-replay');
    const frameAnnouncement = host.current?.querySelector('[aria-live]');
    if (title) title.textContent = kind === 'gallon'
      ? (spanish ? '1 galón equivale a 128 onzas líquidas' : '1 gallon equals 128 fluid ounces')
      : (spanish ? '1 litro equivale a 1000 mililitros' : '1 liter equals 1000 milliliters');
    if (description) description.textContent = kind === 'gallon'
      ? (spanish ? 'Cuatro botellas de un cuarto llenan una jarra de un galón.' : 'Four quart bottles fill a one-gallon jug.')
      : (spanish ? 'Una jarra llena una probeta graduada hasta un litro.' : 'A pitcher fills a graduated cylinder to one liter.');
    replay?.removeAttribute('aria-label');
    replay?.removeAttribute('role');
    replay?.setAttribute('tabindex', '-1');
    replay?.setAttribute('aria-hidden', 'true');
    if (replay instanceof SVGElement) replay.style.pointerEvents = 'none';
    frameAnnouncement?.removeAttribute('aria-live');
  }, [frame, kind, lang]);
  return <div ref={host}>{children}</div>;
}
