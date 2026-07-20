'use client';

import {useEffect, useState} from 'react';
import {RotateCcw} from 'lucide-react';
import {loadAnimationModule, type AnimationModule} from '@/demos/animation-registry';

import type {DemoDetailContent, DemoId, Locale} from '@/content/types';

export function DemoPlayer({
  content,
  demoId,
  locale,
  requestedFrame
}: {
  content: DemoDetailContent;
  demoId: DemoId;
  locale: Locale;
  requestedFrame?: number;
}) {
  const [run, setRun] = useState(0);
  const [reduceMotion, setReduceMotion] = useState<boolean | undefined>(undefined);
  const [loaded, setLoaded] = useState<{key: string; module?: AnimationModule; failed?: boolean}>({key: demoId});
  const [liveFrame, setLiveFrame] = useState(1);
  const animation = loaded.key === demoId ? loaded.module : undefined;

  useEffect(() => {
    let cancelled = false;
    loadAnimationModule(demoId)
      .then((module) => {
        if (!cancelled) setLoaded({key: demoId, module, failed: !module});
      })
      .catch(() => {
        if (!cancelled) setLoaded({key: demoId, failed: true});
      });
    return () => {
      cancelled = true;
    };
  }, [demoId]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!animation || requestedFrame || reduceMotion !== false) return;
    const startedAt = performance.now();
    let request = 0;
    const tick = (now: number) => {
      const frame = Math.min(
        animation.movie.frameCount,
        Math.floor((now - startedAt) / (1000 / animation.movie.fps)) + 1
      );
      setLiveFrame((current) => current === frame ? current : frame);
      if (frame < animation.movie.frameCount) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [animation, reduceMotion, requestedFrame, run]);

  if (loaded.key === demoId && loaded.failed) {
    return (
      <div className="demo-unavailable" role="status">
        <h2>{content.unavailableTitle}</h2>
        <p>{content.unavailableMessage}</p>
      </div>
    );
  }

  if (!animation) return <div aria-busy="true" className="demo-unavailable" />;

  const Renderer = animation.Renderer;
  const renderedFrame = requestedFrame
    ? Math.min(animation.movie.frameCount, Math.max(1, Math.trunc(requestedFrame)))
    : reduceMotion === false
      ? Math.min(animation.movie.frameCount, Math.max(1, liveFrame))
      : 1;
  const context = {
    frame: renderedFrame,
    lang: locale,
    scenario: animation.scenarios[0]?.id ?? 'default',
    seed: 0
  } as const;

  return (
    <div className="demo-player">
      <Renderer
        frame={renderedFrame}
        key={`${demoId}-${run}`}
        lang={locale}
        onReplay={() => {
          setLiveFrame(1);
          setRun((value) => value + 1);
        }}
        scenario={context.scenario}
        seed={0}
        state={animation.getFrameState(renderedFrame, context)}
      />
      {!requestedFrame && reduceMotion === false ? (
        <div className="demo-player__controls">
          <button
            onClick={() => {
              setLiveFrame(1);
              setRun((value) => value + 1);
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={18} />
            {content.restartLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
