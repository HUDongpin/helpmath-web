import {getLaunchGateRuntimeState} from './launch-gates';
import {isLegalCopyReady} from './legal-copy-readiness';

const LEGAL_PAGE_NAMES = ['privacy', 'terms'] as const;

export function isLegalPublicationApproved(nowMs = Date.now()) {
  const gate = getLaunchGateRuntimeState('legalPublication', nowMs);
  return (
    gate.active &&
    gate.effectiveStatus === 'approved' &&
    isLegalCopyReady()
  );
}

export function getDraftLegalPageNames(nowMs = Date.now()) {
  return isLegalPublicationApproved(nowMs) ? [] : LEGAL_PAGE_NAMES;
}

export function getPublishedLegalPagePaths(nowMs = Date.now()) {
  return isLegalPublicationApproved(nowMs)
    ? LEGAL_PAGE_NAMES.map((page) => `/${page}`)
    : [];
}

export function getDraftLegalPaths(nowMs = Date.now()) {
  return isLegalPublicationApproved(nowMs)
    ? []
    : LEGAL_PAGE_NAMES.flatMap((page) => [
        `/${page}`,
        `/en/${page}`,
        `/es/${page}`,
      ]);
}

export const DRAFT_LEGAL_PAGE_NAMES: readonly (typeof LEGAL_PAGE_NAMES)[number][] =
  getDraftLegalPageNames();

export const PUBLISHED_LEGAL_PAGE_PATHS: readonly string[] =
  getPublishedLegalPagePaths();

export const DRAFT_LEGAL_PATHS: readonly string[] = getDraftLegalPaths();

export function isDraftLegalPage(value: string, nowMs = Date.now()) {
  return (getDraftLegalPageNames(nowMs) as readonly string[]).includes(value);
}
