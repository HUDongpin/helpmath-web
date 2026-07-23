import type {ResourceEntry, ResourcesContent} from '@/content/types';

import {
  ResourceLibraryControls,
  type ResourceFilterItem,
} from './resource-library-controls';
import {Action} from './ui';

export function ResourceLibrary({
  filters,
  items,
}: {
  filters: ResourcesContent['filters'];
  items: ResourceEntry[];
}) {
  const filterItems: ResourceFilterItem[] = items.map((item) => ({
    category: item.category,
    id: item.id,
  }));

  return (
    <div className="resource-library" id="resource-library">
      <ResourceLibraryControls filters={filters} items={filterItems} />
      <noscript>
        <style>{`
          .resource-library__interactive { display: none !important; }
          .resource-list > .resource-entry { content-visibility: visible !important; }
        `}</style>
        <p className="resource-no-script">
          {filters.noScriptTemplate.replace('{count}', String(items.length))}
        </p>
      </noscript>
      <div className="resource-list">
        {items.map((item) => (
          <article className="resource-entry" id={item.id} key={item.id}>
            <div
              aria-hidden="true"
              className={`resource-entry__icon resource-entry__icon--${item.status}`}
            />
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
            <Action action={item.action} kind="quiet" navigation="document" />
          </article>
        ))}
      </div>
    </div>
  );
}
