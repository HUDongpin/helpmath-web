export const DRAFT_LEGAL_PAGE_NAMES = ['privacy', 'terms'] as const;

export const DRAFT_LEGAL_PATHS = [
  '/privacy',
  '/terms',
  '/en/privacy',
  '/en/terms',
  '/es/privacy',
  '/es/terms',
] as const;

export function isDraftLegalPage(value: string) {
  return (DRAFT_LEGAL_PAGE_NAMES as readonly string[]).includes(value);
}

