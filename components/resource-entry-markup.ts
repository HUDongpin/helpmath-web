import type {ResourceEntry} from '@/content/types';

import {documentHref, escapeHtml, kebabId} from './static-markup';

const resourceStatuses = new Set<ResourceEntry['status']>([
  'available',
  'review',
  'request',
]);

const resourceCategories = new Set<ResourceEntry['category']>([
  'program',
  'research',
  'technical',
]);

function resourceStatus(status: ResourceEntry['status']): ResourceEntry['status'] {
  if (!resourceStatuses.has(status)) {
    throw new Error(`Unsafe resource status: ${status}`);
  }
  return status;
}

function resourceCategory(category: ResourceEntry['category']): ResourceEntry['category'] {
  if (!resourceCategories.has(category)) {
    throw new Error(`Unsafe resource category: ${category}`);
  }
  return category;
}

export function renderResourceEntriesMarkup(items: ResourceEntry[]): string {
  const seenIds = new Set<string>();

  return items.map((item) => {
    const status = resourceStatus(item.status);
    const category = resourceCategory(item.category);
    const id = kebabId(item.id, 'resource id');
    if (seenIds.has(id)) {
      throw new Error(`Duplicate resource id: ${id}`);
    }
    seenIds.add(id);

    return (
      `<article class="resource-entry" data-resource-category="${escapeHtml(category)}" id="${id}">` +
        `<div aria-hidden="true" class="resource-entry__icon resource-entry__icon--${escapeHtml(status)}"></div>` +
        '<div class="resource-entry__body">' +
          '<div class="resource-entry__meta">' +
            `<span class="status-badge status-badge--${escapeHtml(status)}">${escapeHtml(item.statusLabel)}</span>` +
            `<span>${escapeHtml(item.format)}</span>` +
            `<span>${escapeHtml(item.dateLabel)}</span>` +
          '</div>' +
          `<h2>${escapeHtml(item.title)}</h2>` +
          `<p>${escapeHtml(item.description)}</p>` +
        '</div>' +
        `<a class="action action--quiet" href="${documentHref(item.action.href, 'resource document href')}">` +
          `<span>${escapeHtml(item.action.label)}</span>` +
          '<span aria-hidden="true" class="action__arrow">→</span>' +
        '</a>' +
      '</article>'
    );
  }).join('');
}
