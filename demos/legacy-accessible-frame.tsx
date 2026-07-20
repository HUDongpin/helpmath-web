'use client';

import {useLayoutEffect, useRef, type ReactNode} from 'react';

export function AccessibleLegacyFrame({children, lang, kind, onReplay}: {
  children: ReactNode;
  lang: 'en' | 'es';
  kind: 'gallon' | 'liter';
  onReplay?: () => void;
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
    replay?.setAttribute('aria-label', spanish ? 'Repetir animación' : 'Replay animation');
    frameAnnouncement?.removeAttribute('aria-live');
    const click = () => onReplay?.();
    const keydown = (event: Event) => {
      if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) onReplay?.();
    };
    replay?.addEventListener('click', click);
    replay?.addEventListener('keydown', keydown);
    return () => {
      replay?.removeEventListener('click', click);
      replay?.removeEventListener('keydown', keydown);
    };
  }, [kind, lang, onReplay]);
  return <div ref={host}>{children}</div>;
}
