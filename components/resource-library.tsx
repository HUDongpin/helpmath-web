import type {ResourceEntry, ResourcesContent} from '@/content/types';

import {
  ResourceLibraryControls,
  type ResourceFilterItem,
} from './resource-library-controls';
import {renderResourceEntriesMarkup} from './resource-entry-markup';

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
  const resourceEntriesMarkup = renderResourceEntriesMarkup(items);

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
      <div
        className="resource-list"
        data-resource-list=""
        dangerouslySetInnerHTML={{__html: resourceEntriesMarkup}}
      />
    </div>
  );
}
