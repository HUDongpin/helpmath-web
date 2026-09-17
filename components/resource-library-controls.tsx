'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {Search} from 'lucide-react';

import type {
  ResourceCategory,
  ResourceEntry,
  ResourcesContent,
} from '@/content/types';
import {normalizeSearchValue, resourceSearchText} from '@/lib/resource-search';

type Selection = 'all' | ResourceCategory;

const selections = ['all', 'program', 'research', 'technical'] as const;

function subscribeToClientReady(): () => void {
  return () => undefined;
}

function getClientReady(): boolean {
  return true;
}

function getServerNotReady(): boolean {
  return false;
}

function syncResourceVisibility(visibleIds: ReadonlySet<string>, hasVisibleItems: boolean) {
  const root = document.getElementById('resource-library');
  if (!root) return;

  for (const entry of root.querySelectorAll<HTMLElement>('.resource-entry')) {
    entry.hidden = !visibleIds.has(entry.id);
  }

  const empty = root.querySelector<HTMLElement>('#resource-empty');
  if (empty) empty.hidden = hasVisibleItems;
}

export function ResourceLibraryControls({
  filters,
  items,
}: {
  filters: ResourcesContent['filters'];
  items: ResourceEntry[];
}) {
  const [selection, setSelection] = useState<Selection>('all');
  const [query, setQuery] = useState('');
  const isInteractiveReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReady,
    getServerNotReady,
  );
  const searchId = useId();
  const normalizedQuery = normalizeSearchValue(query);
  const searchMatches = useMemo(
    () => items.filter((item) => resourceSearchText(item).includes(normalizedQuery)),
    [items, normalizedQuery],
  );
  const visibleItems = useMemo(
    () => searchMatches.filter(
      (item) => selection === 'all' || item.category === selection,
    ),
    [searchMatches, selection],
  );
  const labels: Record<Selection, string> = {
    all: filters.all,
    program: filters.program,
    research: filters.research,
    technical: filters.technical,
  };
  const resultsTemplate = visibleItems.length === 1
    ? filters.resultTemplate
    : filters.resultsTemplate;

  useLayoutEffect(() => {
    syncResourceVisibility(
      new Set(visibleItems.map((item) => item.id)),
      visibleItems.length > 0,
    );
  }, [visibleItems]);

  useEffect(() => {
    let cancelled = false;
    let alignmentVersion = 0;
    const fragmentNavigationClass = 'resource-fragment-navigation';

    const alignResourceHash = (hashChanged = false) => {
      const version = ++alignmentVersion;
      const resourceWindow = window as Window & {
        __helpMathDeferredResourceHash?: string;
      };
      const currentHash = window.location.hash;
      let deferredHash = resourceWindow.__helpMathDeferredResourceHash;
      if (hashChanged && deferredHash && currentHash !== deferredHash) {
        delete resourceWindow.__helpMathDeferredResourceHash;
        deferredHash = undefined;
      }
      const hash = (currentHash || deferredHash || '').slice(1);
      const restoreDeferredHash = () => {
        if (
          !deferredHash ||
          resourceWindow.__helpMathDeferredResourceHash !== deferredHash
        ) return;
        if (window.location.hash && window.location.hash !== deferredHash) {
          delete resourceWindow.__helpMathDeferredResourceHash;
          return;
        }
        if (window.location.hash !== deferredHash) {
          window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${window.location.search}${deferredHash}`,
          );
        }
        if (resourceWindow.__helpMathDeferredResourceHash === deferredHash) {
          delete resourceWindow.__helpMathDeferredResourceHash;
        }
      };
      if (!hash) {
        document.documentElement.classList.remove(fragmentNavigationClass);
        return;
      }

      let targetId: string;
      try {
        targetId = decodeURIComponent(hash);
      } catch {
        restoreDeferredHash();
        document.documentElement.classList.remove(fragmentNavigationClass);
        return;
      }

      const target = document.getElementById(targetId);
      if (!target) {
        restoreDeferredHash();
        document.documentElement.classList.remove(fragmentNavigationClass);
        return;
      }
      if (target.classList.contains('resource-entry')) {
        document.documentElement.classList.add(fragmentNavigationClass);
      } else {
        document.documentElement.classList.remove(fragmentNavigationClass);
      }

      // Complete the address/history repair as soon as hydration owns this
      // route. Font readiness gates only the final geometry-dependent scroll;
      // it must not leave the canonical fragment vulnerable to router setup.
      restoreDeferredHash();
      void document.fonts.ready.then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (
              !cancelled &&
              version === alignmentVersion &&
              document.getElementById(targetId) === target
            ) {
              target.scrollIntoView({behavior: 'instant', block: 'start'});
            }
          });
        });
      });
    };

    alignResourceHash();
    const handleHashChange = () => alignResourceHash(true);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      cancelled = true;
      alignmentVersion += 1;
      window.removeEventListener('hashchange', handleHashChange);
      // React may tear down and immediately recreate this effect during
      // hydration. Only clear the parser guard after the library itself has
      // actually left the document, not during that transient cleanup frame.
      requestAnimationFrame(() => {
        if (!document.querySelector('.resource-library')) {
          document.documentElement.classList.remove(fragmentNavigationClass);
          delete (window as Window & {
            __helpMathDeferredResourceHash?: string;
          }).__helpMathDeferredResourceHash;
        }
      });
    };
  }, [items]);

  return (
    <div className="resource-library__interactive">
      <div className="resource-search">
        <label htmlFor={searchId}>{filters.searchLabel}</label>
        <div className="resource-search__field">
          <Search aria-hidden="true" size={20} strokeWidth={2.2} />
          <input
            autoComplete="off"
            disabled={!isInteractiveReady}
            id={searchId}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={filters.searchPlaceholder}
            type="search"
            value={query}
          />
        </div>
      </div>
      <div aria-label={filters.ariaLabel} className="resource-filters" role="group">
        {selections.map((value) => {
          const count = value === 'all'
            ? searchMatches.length
            : searchMatches.filter((item) => item.category === value).length;

          return (
            <button
              aria-pressed={selection === value}
              disabled={!isInteractiveReady}
              key={value}
              onClick={() => setSelection(value)}
              type="button"
            >
              <span>{labels[value]}</span>
              <span aria-hidden="true" className="resource-filters__count">{count}</span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="resource-results" role="status">
        {resultsTemplate.replace('{count}', String(visibleItems.length))}
      </p>
    </div>
  );
}
