import type {ResourceEntry} from '@/content/types';

const INTERNAL_DOCUMENT_ORIGIN = 'https://www.helpmath.ai';
const resourceStatuses = new Set<ResourceEntry['status']>([
  'available',
  'review',
  'request',
]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function documentHref(href: string): string {
  if (
    href !== href.trim() ||
    /[\\\u0000-\u001f\u007f]/u.test(href)
  ) {
    throw new Error(`Unsafe resource document href: ${href}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(href, INTERNAL_DOCUMENT_ORIGIN);
  } catch {
    throw new Error(`Unsafe resource document href: ${href}`);
  }

  const isInternalPath = href.startsWith('/') &&
    !href.startsWith('//') &&
    parsed.origin === INTERNAL_DOCUMENT_ORIGIN;
  const isExternalHttps = href.startsWith('https://') && parsed.protocol === 'https:';
  if (
    (!isInternalPath && !isExternalHttps) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new Error(`Unsafe resource document href: ${href}`);
  }

  return escapeHtml(href);
}

function resourceStatus(status: ResourceEntry['status']): ResourceEntry['status'] {
  if (!resourceStatuses.has(status)) {
    throw new Error(`Unsafe resource status: ${status}`);
  }
  return status;
}

export function renderResourceEntriesMarkup(items: ResourceEntry[]): string {
  return items.map((item) => {
    const status = resourceStatus(item.status);

    return (
      `<article class="resource-entry" id="${escapeHtml(item.id)}">` +
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
        `<a class="action action--quiet" href="${documentHref(item.action.href)}">` +
          `<span>${escapeHtml(item.action.label)}</span>` +
          '<span aria-hidden="true" class="action__arrow">→</span>' +
        '</a>' +
      '</article>'
    );
  }).join('');
}
