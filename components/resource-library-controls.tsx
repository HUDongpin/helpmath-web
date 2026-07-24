'use client';

import {Search} from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type {
  ResourceCategory,
  ResourcesContent,
} from '@/content/types';
import {replaceBrowserLocation} from '@/i18n/browser-location';

type Selection = 'all' | ResourceCategory;

export type ResourceFilterItem = {
  category: ResourceCategory;
  id: string;
};

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

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .trim();
}

export function ResourceLibraryControls({
  filters,
  items,
}: {
  filters: ResourcesContent['filters'];
  items: ResourceFilterItem[];
}) {
  const [selection, setSelection] = useState<Selection>('all');
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<Map<string, string> | null>(null);
  const isInteractiveReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReady,
    getServerNotReady,
  );
  const hasAppliedFiltering = useRef(false);
  const searchId = useId();
  const normalizedQuery = normalizeSearchValue(query);
  const filterIsActive = selection !== 'all' || normalizedQuery.length > 0;
  const searchMatches = useMemo(
    () => normalizedQuery
      ? items.filter((item) => (
          searchIndex?.get(item.id)?.includes(normalizedQuery) ?? false
        ))
      : items,
    [items, normalizedQuery, searchIndex],
  );
  const visibleItems = useMemo(
    () => searchMatches.filter(
      (item) => selection === 'all' || item.category === selection,
    ),
    [searchMatches, selection],
  );
  const visibleIds = useMemo(
    () => new Set(visibleItems.map((item) => item.id)),
    [visibleItems],
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
    if (!filterIsActive && !hasAppliedFiltering.current) return;

    const library = document.getElementById('resource-library');
    if (!library) return;

    for (const entry of library.querySelectorAll<HTMLElement>('.resource-entry')) {
      const shouldHide = !visibleIds.has(entry.id);
      if (entry.hidden !== shouldHide) entry.hidden = shouldHide;
    }
    const list = library.querySelector<HTMLElement>('.resource-list');
    const shouldHideList = visibleIds.size === 0;
    if (list && list.hidden !== shouldHideList) list.hidden = shouldHideList;
    hasAppliedFiltering.current = filterIsActive;

    const currentHash = window.location.hash;
    if (!currentHash) return;

    let targetId: string;
    try {
      targetId = decodeURIComponent(currentHash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(targetId);
    if (!target?.classList.contains('resource-entry') || !target.hidden) return;

    document.documentElement.classList.remove('resource-fragment-navigation');
    delete (window as Window & {
      __helpMathDeferredResourceHash?: string;
    }).__helpMathDeferredResourceHash;
    replaceBrowserLocation(
      `${window.location.pathname}${window.location.search}`,
    );
  }, [filterIsActive, visibleIds]);

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
          replaceBrowserLocation(
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
      const targetIsHiddenResource = Boolean(
        target?.classList.contains('resource-entry') && target.hidden,
      );
      if (!target || targetIsHiddenResource) {
        restoreDeferredHash();
        document.documentElement.classList.remove(fragmentNavigationClass);
        if (targetIsHiddenResource) {
          delete resourceWindow.__helpMathDeferredResourceHash;
          replaceBrowserLocation(
            `${window.location.pathname}${window.location.search}`,
          );
        }
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
            const activeHash = (
              window.location.hash || resourceWindow.__helpMathDeferredResourceHash || ''
            ).slice(1);
            let activeTargetId = '';
            try {
              activeTargetId = decodeURIComponent(activeHash);
            } catch {
              activeTargetId = '';
            }
            if (
              !cancelled &&
              version === alignmentVersion &&
              activeTargetId === targetId &&
              document.getElementById(targetId) === target &&
              !target.hidden
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
    <>
      <div className="resource-library__interactive" data-resource-controls="">
        <div className="resource-search">
          <label htmlFor={searchId}>{filters.searchLabel}</label>
          <div className="resource-search__field">
            <Search aria-hidden="true" size={20} strokeWidth={2.2} />
            <input
              autoComplete="off"
              data-resource-search=""
              disabled={!isInteractiveReady}
              id={searchId}
              onChange={(event) => {
                const nextQuery = event.currentTarget.value;
                if (normalizeSearchValue(nextQuery) && !searchIndex) {
                  const library = document.getElementById('resource-library');
                  setSearchIndex(new Map(items.map((item) => [
                    item.id,
                    normalizeSearchValue(
                      library?.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`)
                        ?.textContent ?? '',
                    ),
                  ])));
                }
                setQuery(nextQuery);
              }}
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
                data-resource-selection={value}
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
        <p
          aria-live="polite"
          className="resource-results"
          data-resource-results=""
          data-result-template={filters.resultTemplate}
          data-results-template={filters.resultsTemplate}
          role="status"
        >
          {resultsTemplate.replace('{count}', String(visibleItems.length))}
        </p>
      </div>
      <p className="resource-empty" data-resource-empty="" hidden={visibleItems.length > 0}>
        {filters.empty}
      </p>
    </>
  );
}
