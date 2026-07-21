import {createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';

import {AnimationPlayerCore} from '../components/animation-player-core';
import type {DemoDetailContent, DemoId, Locale} from '../content/types';
import type {AnimationModule} from '../demos/contract';

export type ExecutiveDemoRuntimeOptions = {
  content: DemoDetailContent;
  demoId: DemoId;
  locale: Locale;
  requestedFrame?: number;
};

export function createExecutiveDemoRuntime(animation: AnimationModule) {
  const roots = new WeakMap<HTMLElement, Root>();

  function unmount(host: HTMLElement) {
    roots.get(host)?.unmount();
    roots.delete(host);
  }

  function mount(host: HTMLElement, options: ExecutiveDemoRuntimeOptions) {
    unmount(host);
    if (options.demoId !== animation.key) {
      throw new Error('Executive demo runtime does not match the requested demo.');
    }

    const root = createRoot(host);
    roots.set(host, root);
    root.render(createElement(AnimationPlayerCore, {
      animation,
      content: options.content,
      demoId: options.demoId,
      locale: options.locale,
      requestedFrame: options.requestedFrame,
      startPaused: true,
    }));
  }

  return {mount, unmount};
}
