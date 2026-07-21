'use client';

import {useEffect, useRef, useState} from 'react';

import type {DemoDetailContent, DemoId, Locale} from '@/content/types';

type RuntimeOptions = {
  content: DemoDetailContent;
  demoId: DemoId;
  locale: Locale;
  requestedFrame?: number;
};

type ExecutiveDemoRuntime = {
  mount(host: HTMLElement, options: RuntimeOptions): void;
  unmount(host: HTMLElement): void;
};

declare global {
  interface Window {
    HelpMathExecutiveRuntimeConversion12?: ExecutiveDemoRuntime;
    HelpMathExecutiveRuntimeConversion14?: ExecutiveDemoRuntime;
  }
}

const runtimeConfig = {
  'conversion-1-2': {
    globalName: 'HelpMathExecutiveRuntimeConversion12',
    source: '/api/executive-preview/runtime/conversion-1-2.js',
  },
  'conversion-1-4': {
    globalName: 'HelpMathExecutiveRuntimeConversion14',
    source: '/api/executive-preview/runtime/conversion-1-4.js',
  },
} as const;
const RUNTIME_LOAD_TIMEOUT_MS = 15_000;

function getRuntime(demoId: DemoId): ExecutiveDemoRuntime | undefined {
  const name = runtimeConfig[demoId].globalName;
  return window[name];
}

export function ExecutiveDemoRuntimeLoader(options: RuntimeOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const {content, demoId, locale, requestedFrame} = options;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let settled = false;
    let mountedRuntime: ExecutiveDemoRuntime | undefined;
    const config = runtimeConfig[demoId];

    const fail = () => {
      if (!active || settled) return;
      settled = true;
      setFailed(true);
      setLoading(false);
    };

    const mount = () => {
      if (!active || settled) return;
      const runtime = getRuntime(demoId);
      if (!runtime) {
        fail();
        return;
      }
      try {
        runtime.mount(host, {content, demoId, locale, requestedFrame});
        mountedRuntime = runtime;
        settled = true;
        setFailed(false);
        setLoading(false);
      } catch {
        fail();
      }
    };

    const timeout = window.setTimeout(fail, RUNTIME_LOAD_TIMEOUT_MS);

    const existingRuntime = getRuntime(demoId);
    if (existingRuntime) {
      mount();
    } else {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.executiveDemoRuntime = demoId;
      script.src = config.source;
      script.addEventListener('load', mount, {once: true});
      script.addEventListener('error', fail, {once: true});
      document.head.append(script);
    }

    return () => {
      active = false;
      window.clearTimeout(timeout);
      try {
        mountedRuntime?.unmount(host);
      } catch {
        // The page is already unmounting. A failed third-party cleanup must
        // not surface as a user-facing runtime exception.
      }
    };
  }, [content, demoId, locale, requestedFrame]);

  return (
    <div className="executive-demo-runtime-host">
      {loading ? (
        <div aria-busy="true" className="demo-unavailable" role="status">
          <p>{content.loadingLabel}</p>
        </div>
      ) : null}
      {failed ? (
        <div className="demo-unavailable" role="alert">
          <h2>{content.unavailableTitle}</h2>
          <p>{content.unavailableMessage}</p>
        </div>
      ) : null}
      <div hidden={loading || failed} ref={hostRef} />
    </div>
  );
}
