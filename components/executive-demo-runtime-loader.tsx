'use client';

import {useEffect, useRef, useState} from 'react';

import type {DemoDetailContent, DemoId, Locale} from '@/content/types';

type RuntimeOptions = {
  content: DemoDetailContent;
  demoId: DemoId;
  locale: Locale;
  requestedFrame?: number;
};

type RuntimeLoaderOptions = RuntimeOptions & {
  runtimeGlobalName: string;
  runtimeSource: string;
};

type ExecutiveDemoRuntime = {
  mount(host: HTMLElement, options: RuntimeOptions): void;
  unmount(host: HTMLElement): void;
};

const RUNTIME_LOAD_TIMEOUT_MS = 15_000;
const RUNTIME_GLOBAL_NAME_PATTERN = /^HelpMathExecutiveRuntime[A-Za-z0-9]+$/u;

function getRuntime(globalName: string): ExecutiveDemoRuntime | undefined {
  const value = (window as unknown as Record<string, unknown>)[globalName];
  if (!value || typeof value !== 'object') return undefined;
  const runtime = value as Partial<ExecutiveDemoRuntime>;
  return typeof runtime.mount === 'function' && typeof runtime.unmount === 'function'
    ? (runtime as ExecutiveDemoRuntime)
    : undefined;
}

export function ExecutiveDemoRuntimeLoader(options: RuntimeLoaderOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const {
    content,
    demoId,
    locale,
    requestedFrame,
    runtimeGlobalName,
    runtimeSource,
  } = options;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let active = true;
    let settled = false;
    let mountedRuntime: ExecutiveDemoRuntime | undefined;

    const fail = () => {
      if (!active || settled) return;
      settled = true;
      setFailed(true);
      setLoading(false);
    };

    const mount = () => {
      if (!active || settled) return;
      const runtime = getRuntime(runtimeGlobalName);
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

    if (
      !RUNTIME_GLOBAL_NAME_PATTERN.test(runtimeGlobalName)
      || runtimeSource !== `/api/executive-preview/runtime/${demoId}.js`
    ) {
      fail();
      return;
    }

    const timeout = window.setTimeout(fail, RUNTIME_LOAD_TIMEOUT_MS);

    const existingRuntime = getRuntime(runtimeGlobalName);
    if (existingRuntime) {
      mount();
    } else {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.executiveDemoRuntime = demoId;
      script.src = runtimeSource;
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
  }, [content, demoId, locale, requestedFrame, runtimeGlobalName, runtimeSource]);

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
