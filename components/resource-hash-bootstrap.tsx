import {BROWSER_LOCATION_CHANGE_EVENT} from '@/i18n/browser-location';

const RESOURCE_HASH_BOOTSTRAP = `
(() => {
  try {
    const locationChangeEvent = ${JSON.stringify(BROWSER_LOCATION_CHANGE_EVENT)};
    const replaceLocation = (url) => {
      window.history.replaceState(window.history.state, '', url);
      window.dispatchEvent(new Event(locationChangeEvent));
    };
    const resourceHash = window.location.hash;
    const isResourcePath = /^\\/(?:es\\/)?resources\\/?$/u.test(window.location.pathname);
    if (!isResourcePath || !resourceHash) return;
    document.documentElement.classList.add('resource-fragment-navigation');
    window.__helpMathDeferredResourceHash = resourceHash;
    const resourcePath = window.location.pathname;
    const resourceSearch = window.location.search;
    replaceLocation(resourcePath + resourceSearch);

    const isPendingResourceHash = () =>
      window.__helpMathDeferredResourceHash === resourceHash &&
      window.location.pathname === resourcePath &&
      (!window.location.hash || window.location.hash === resourceHash);
    const restoreVisibleHash = () => {
      if (!isPendingResourceHash()) return false;
      replaceLocation(resourcePath + resourceSearch + resourceHash);
      return true;
    };
    const cancelStaleResourceHash = () => {
      if (window.location.hash === resourceHash) return;
      delete window.__helpMathDeferredResourceHash;
      let target = null;
      try {
        target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      } catch {}
      if (!target || !target.classList.contains('resource-entry')) {
        document.documentElement.classList.remove('resource-fragment-navigation');
      }
    };
    const exposeCanonicalHash = () => {
      if (!restoreVisibleHash()) return;
      // Start observing user changes only after the initial navigation's
      // canonical hash is restored. This avoids treating that navigation as a
      // user-authored hash change in browsers that deliver it asynchronously.
      window.addEventListener('hashchange', cancelStaleResourceHash);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', exposeCanonicalHash, {once: true});
    } else {
      exposeCanonicalHash();
    }
    const restoreResourceHash = () => {
      if (!isPendingResourceHash()) return;
      try {
        restoreVisibleHash();
        delete window.__helpMathDeferredResourceHash;

        let target = null;
        try {
          target = document.getElementById(decodeURIComponent(resourceHash.slice(1)));
        } catch {}
        if (!target || !target.classList.contains('resource-entry')) {
          document.documentElement.classList.remove('resource-fragment-navigation');
        }
        target?.scrollIntoView({behavior: 'auto', block: 'start'});
      } catch {
        document.documentElement.classList.remove('resource-fragment-navigation');
      }
    };
    const queueFallback = () => {
      // DOMContentLoaded already exposed the canonical URL without triggering
      // a native jump. Load only schedules a guarded no-hydration scroll.
      if (!restoreVisibleHash()) return;
      window.setTimeout(() => {
        if (!isPendingResourceHash()) return;
        const fontsReady = document.fonts?.ready ?? Promise.resolve();
        fontsReady.then(() => requestAnimationFrame(() => {
          requestAnimationFrame(restoreResourceHash);
        }));
      }, 1000);
    };
    if (document.readyState === 'complete') queueFallback();
    else window.addEventListener('load', queueFallback, {once: true});
  } catch {}
})();`;

export function ResourceHashBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{__html: RESOURCE_HASH_BOOTSTRAP}}
      id="help-math-resource-hash-bootstrap"
    />
  );
}
