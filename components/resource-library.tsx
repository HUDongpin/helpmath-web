'use client';

import {useId, useMemo, useState, useSyncExternalStore} from 'react';
import {CheckCircle2, CircleAlert, Search, SearchCheck} from 'lucide-react';

import type {
  ResourceCategory,
  ResourceEntry,
  ResourcesContent,
  ResourceStatus,
} from '@/content/types';

import {Action} from './ui';

const resourceIcons: Record<ResourceStatus, typeof CheckCircle2> = {
  available: CheckCircle2,
  review: SearchCheck,
  request: CircleAlert,
};

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

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .trim();
}

function resourceSearchText(item: ResourceEntry) {
  return normalizeSearchValue([
    item.title,
    item.description,
    item.format,
    item.dateLabel,
    item.statusLabel,
    item.action.label,
  ].join(' '));
}

export function ResourceLibrary({
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

  return (
    <div className="resource-library" id="resource-library">
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
      <noscript>
        <style>{'.resource-library__interactive { display: none !important; }'}</style>
        <p className="resource-no-script">
          {filters.noScriptTemplate.replace('{count}', String(items.length))}
        </p>
      </noscript>
      {visibleItems.length > 0 ? (
        <div className="resource-list">
          {visibleItems.map((item) => {
            const Icon = resourceIcons[item.status];
            return (
              <article className="resource-entry" id={item.id} key={item.id}>
                <div aria-hidden="true" className="resource-entry__icon">
                  <Icon size={27} />
                </div>
                <div className="resource-entry__body">
                  <div className="resource-entry__meta">
                    <span className={`status-badge status-badge--${item.status}`}>
                      {item.statusLabel}
                    </span>
                    <span>{item.format}</span>
                    <span>{item.dateLabel}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
                <Action action={item.action} kind="quiet" />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="resource-empty">{filters.empty}</p>
      )}
    </div>
  );
}
