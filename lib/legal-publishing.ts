import {isLaunchGateApproved} from './launch-gates';
import {isLegalCopyReady} from './legal-copy-readiness';

const LEGAL_PAGE_NAMES = ['privacy', 'terms'] as const;
const legalPublicationApproved =
  isLaunchGateApproved('legalPublication') && isLegalCopyReady();

export const DRAFT_LEGAL_PAGE_NAMES: readonly (typeof LEGAL_PAGE_NAMES)[number][] =
  legalPublicationApproved ? [] : LEGAL_PAGE_NAMES;

export const PUBLISHED_LEGAL_PAGE_PATHS: readonly string[] = legalPublicationApproved
  ? LEGAL_PAGE_NAMES.map((page) => `/${page}`)
  : [];

export const DRAFT_LEGAL_PATHS: readonly string[] = legalPublicationApproved
  ? []
  : LEGAL_PAGE_NAMES.flatMap((page) => [`/${page}`, `/en/${page}`, `/es/${page}`]);

export function isDraftLegalPage(value: string) {
  return (DRAFT_LEGAL_PAGE_NAMES as readonly string[]).includes(value);
}
