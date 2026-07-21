'use client';

import {useMemo, useState} from 'react';
import {CheckCircle2, CircleAlert, SearchCheck} from 'lucide-react';

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

export function ResourceLibrary({
  filters,
  items,
}: {
  filters: ResourcesContent['filters'];
  items: ResourceEntry[];
}) {
  const [selection, setSelection] = useState<Selection>('all');
  const visibleItems = useMemo(
    () => items.filter((item) => selection === 'all' || item.category === selection),
    [items, selection],
  );
  const labels: Record<Selection, string> = {
    all: filters.all,
    program: filters.program,
    research: filters.research,
    technical: filters.technical,
  };

  return (
    <div className="resource-library" id="resource-library">
      <div aria-label={filters.ariaLabel} className="resource-filters" role="group">
        {selections.map((value) => {
          const count = value === 'all'
            ? items.length
            : items.filter((item) => item.category === value).length;

          return (
            <button
              aria-pressed={selection === value}
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
        {filters.resultsTemplate.replace('{count}', String(visibleItems.length))}
      </p>
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
