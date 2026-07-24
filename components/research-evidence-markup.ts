import type {EvidenceEntry, EvidenceStatus} from '@/content/types';

import {documentHref, escapeHtml, kebabId} from './static-markup';

const evidenceStatuses = new Set<EvidenceStatus>([
  'archived',
  'verification',
  'context',
  'verified',
]);

const evidenceIcons: Record<EvidenceStatus, string> = {
  archived:
    '<svg aria-hidden="true" class="lucide lucide-archive" fill="none" height="22" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><rect height="5" rx="1" width="20" x="2" y="3"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path></svg>',
  verification:
    '<svg aria-hidden="true" class="lucide lucide-search-check" fill="none" height="22" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="m8 11 2 2 4-4"></path><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>',
  context:
    '<svg aria-hidden="true" class="lucide lucide-file-check-corner" fill="none" height="22" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M10.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v6"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="m14 20 2 2 4-4"></path></svg>',
  verified:
    '<svg aria-hidden="true" class="lucide lucide-circle-check" fill="none" height="22" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>',
};

function evidenceStatus(status: EvidenceEntry['status']): EvidenceStatus {
  if (!evidenceStatuses.has(status)) {
    throw new Error(`Unsafe research evidence status: ${status}`);
  }
  return status;
}

function sourceActionsMarkup(entry: EvidenceEntry): string {
  if (!entry.sourceActions?.length) return '';

  const actions = entry.sourceActions.map((action) => (
    `<a class="action action--quiet" href="${documentHref(action.href, 'research evidence source href')}">` +
      `<span>${escapeHtml(action.label)}</span>` +
      '<span aria-hidden="true" class="action__arrow">→</span>' +
    '</a>'
  )).join('');

  return `<div class="evidence-entry__actions">${actions}</div>`;
}

export function renderResearchEvidenceMarkup(entries: EvidenceEntry[]): {
  entriesMarkup: string;
  indexMarkup: string;
} {
  const seenIds = new Set<string>();
  const validatedEntries = entries.map((entry) => {
    const id = kebabId(entry.id, 'research evidence id');
    if (seenIds.has(id)) {
      throw new Error(`Duplicate research evidence id: ${id}`);
    }
    seenIds.add(id);

    return {entry, id, status: evidenceStatus(entry.status)};
  });

  const indexMarkup = '<ol>' + validatedEntries.map(({entry, id, status}) => (
    '<li>' +
      `<a href="#${id}">` +
        `<span class="status-badge status-badge--${status}">${escapeHtml(entry.statusLabel)}</span>` +
        `<span>${escapeHtml(entry.title)}</span>` +
      '</a>' +
    '</li>'
  )).join('') + '</ol>';

  const entriesMarkup = validatedEntries.map(({entry, id, status}) => (
    `<article class="evidence-entry" id="${id}">` +
      '<div class="evidence-entry__meta">' +
        evidenceIcons[status] +
        `<span class="status-badge status-badge--${status}">${escapeHtml(entry.statusLabel)}</span>` +
        `<span>${escapeHtml(entry.dateLabel)}</span>` +
      '</div>' +
      '<div>' +
        `<h2>${escapeHtml(entry.title)}</h2>` +
        `<p>${escapeHtml(entry.summary)}</p>` +
        `<p class="evidence-entry__interpretation">${escapeHtml(entry.interpretation)}</p>` +
        `<p class="evidence-entry__source">${escapeHtml(entry.sourceLabel)}</p>` +
        sourceActionsMarkup(entry) +
      '</div>' +
    '</article>'
  )).join('');

  return {entriesMarkup, indexMarkup};
}
