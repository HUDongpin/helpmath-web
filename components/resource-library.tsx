import {CheckCircle2, CircleAlert, SearchCheck} from 'lucide-react';

import type {
  ResourceEntry,
  ResourcesContent,
  ResourceStatus,
} from '@/content/types';
import {resourceSearchText} from '@/lib/resource-search';

import {ResourceLibraryControls} from './resource-library-controls';
import {Action} from './ui';

const resourceIcons: Record<ResourceStatus, typeof CheckCircle2> = {
  available: CheckCircle2,
  review: SearchCheck,
  request: CircleAlert,
};

function ResourceEntryCard({item}: {item: ResourceEntry}) {
  const Icon = resourceIcons[item.status];

  return (
    <article
      className="resource-entry"
      data-category={item.category}
      data-search={resourceSearchText(item)}
      id={item.id}
    >
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
}

export function ResourceLibrary({
  filters,
  items,
}: {
  filters: ResourcesContent['filters'];
  items: ResourceEntry[];
}) {
  return (
    <div className="resource-library" id="resource-library">
      <ResourceLibraryControls filters={filters} items={items} />
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
          <ResourceEntryCard item={item} key={item.id} />
        ))}
      </div>
      <p className="resource-empty" hidden id="resource-empty">{filters.empty}</p>
    </div>
  );
}
