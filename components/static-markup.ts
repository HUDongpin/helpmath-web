const INTERNAL_DOCUMENT_ORIGIN = 'https://www.helpmath.ai';

export function escapeHtml(value: string): string {
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

export function documentHref(href: string, context = 'document href'): string {
  if (
    href !== href.trim() ||
    /[\\\u0000-\u001f\u007f]/u.test(href)
  ) {
    throw new Error(`Unsafe ${context}: ${href}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(href, INTERNAL_DOCUMENT_ORIGIN);
  } catch {
    throw new Error(`Unsafe ${context}: ${href}`);
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
    throw new Error(`Unsafe ${context}: ${href}`);
  }

  return escapeHtml(href);
}

export function kebabId(value: string, context = 'id'): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error(`Unsafe ${context}: ${value}`);
  }

  return value;
}
