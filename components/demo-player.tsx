'use client';

import {useEffect, useState} from 'react';

import type {DemoDetailContent, DemoId, Locale} from '@/content/types';
import {loadAnimationModule, type AnimationModule} from '@/demos/animation-registry';

import {AnimationPlayerCore} from './animation-player-core';

export function DemoPlayer({
  content,
  demoId,
  locale,
  requestedFrame,
}: {
  content: DemoDetailContent;
  demoId: DemoId;
  locale: Locale;
  requestedFrame?: number;
}) {
  const [loaded, setLoaded] = useState<{key: string; module?: AnimationModule; failed?: boolean}>({key: demoId});
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

  return (
    <AnimationPlayerCore
      animation={animation}
      content={content}
      demoId={demoId}
      key={demoId}
      locale={locale}
      requestedFrame={requestedFrame}
    />
  );
}
