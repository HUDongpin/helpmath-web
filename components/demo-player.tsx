'use client';

import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Pause, Play, RotateCcw} from 'lucide-react';
import {loadAnimationModule, type AnimationModule} from '@/demos/animation-registry';

import type {DemoDetailContent, DemoId, Locale} from '@/content/types';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function reducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function reducedMotionServerSnapshot() {
  return true;
}

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
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    reducedMotionServerSnapshot,
  );
  const [loaded, setLoaded] = useState<{key: string; module?: AnimationModule; failed?: boolean}>({key: demoId});
  const [liveFrame, setLiveFrame] = useState(1);
  const [playbackIntent, setPlaybackIntent] = useState<'auto' | 'playing' | 'paused'>('auto');
  const liveFrameRef = useRef(1);
  const animation = loaded.key === demoId ? loaded.module : undefined;
  const isPlaying = playbackIntent === 'playing' || (playbackIntent === 'auto' && !reduceMotion);

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
    if (!animation || requestedFrame || !isPlaying) return;
    const frameDuration = 1000 / animation.movie.fps;
    const startedAt = performance.now() - (liveFrameRef.current - 1) * frameDuration;
    let request = 0;
    const tick = (now: number) => {
      const frame = Math.min(
        animation.movie.frameCount,
        Math.floor((now - startedAt) / frameDuration) + 1
      );
      liveFrameRef.current = frame;
      setLiveFrame((current) => current === frame ? current : frame);
      if (frame < animation.movie.frameCount) {
        request = requestAnimationFrame(tick);
      } else {
        setPlaybackIntent('paused');
      }
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [animation, isPlaying, requestedFrame, run]);

  if (loaded.key === demoId && loaded.failed) {
    return (
      <div className="demo-unavailable" role="status">
        <h2>{content.unavailableTitle}</h2>
        <p>{content.unavailableMessage}</p>
      </div>
    );
  }

  if (!animation) {
    return (
      <div aria-busy="true" className="demo-unavailable" role="status">
        <p>{content.loadingLabel}</p>
      </div>
    );
  }

  const Renderer = animation.Renderer;
  const movie = animation.movie;
  const renderedFrame = requestedFrame
    ? Math.min(movie.frameCount, Math.max(1, Math.trunc(requestedFrame)))
    : Math.min(movie.frameCount, Math.max(1, liveFrame));
  const context = {
    frame: renderedFrame,
    lang: locale,
    scenario: animation.scenarios[0]?.id ?? 'default',
    seed: 0
  } as const;

  function restart() {
    liveFrameRef.current = 1;
    setLiveFrame(1);
    setRun((value) => value + 1);
    setPlaybackIntent('playing');
  }

  function togglePlayback() {
    if (isPlaying) {
      setPlaybackIntent('paused');
      return;
    }
    if (liveFrameRef.current >= movie.frameCount) {
      liveFrameRef.current = 1;
      setLiveFrame(1);
      setRun((value) => value + 1);
    }
    setPlaybackIntent('playing');
  }

  function seek(frame: number) {
    const nextFrame = Math.min(movie.frameCount, Math.max(1, Math.trunc(frame)));
    setPlaybackIntent('paused');
    liveFrameRef.current = nextFrame;
    setLiveFrame(nextFrame);
  }

  const frameStatus = locale === 'es'
    ? `Fotograma ${renderedFrame} de ${movie.frameCount}`
    : `Frame ${renderedFrame} of ${movie.frameCount}`;

  return (
    <div className="demo-player" data-playback-state={isPlaying ? 'playing' : 'paused'}>
      <Renderer
        frame={renderedFrame}
        key={`${demoId}-${run}`}
        lang={locale}
        onReplay={restart}
        scenario={context.scenario}
        seed={0}
        state={animation.getFrameState(renderedFrame, context)}
      />
      {!requestedFrame ? (
        <div
          aria-label={content.playerLabel}
          className="demo-player__controls"
          role="group"
        >
          <div className="demo-player__buttons">
            <button
              aria-pressed={isPlaying}
              onClick={togglePlayback}
              type="button"
            >
              {isPlaying ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
              {isPlaying ? content.pauseLabel : content.playLabel}
            </button>
            <button onClick={restart} type="button">
              <RotateCcw aria-hidden="true" size={18} />
              {content.restartLabel}
            </button>
          </div>
          <label className="demo-player__scrubber">
            <span className="sr-only">{content.frameLabel}</span>
            <input
              aria-label={content.frameLabel}
              aria-valuetext={frameStatus}
              max={movie.frameCount}
              min={1}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              step={1}
              type="range"
              value={renderedFrame}
            />
            <output aria-live="off">{frameStatus}</output>
          </label>
        </div>
      ) : null}
    </div>
  );
}
