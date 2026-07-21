import {enContent} from '../content/en';
import {esContent} from '../content/es';

const legalCopy = {
  en: [enContent.pages.privacy, enContent.pages.terms],
  es: [esContent.pages.privacy, esContent.pages.terms],
} as const;

export function isLegalCopyDraft(): boolean {
  return (
    legalCopy.en.every((page) => /\bdraft\b/iu.test(page.reviewNotice)) &&
    legalCopy.es.every((page) => /borrador/iu.test(page.reviewNotice))
  );
}

export function isLegalCopyReady(): boolean {
  return Object.values(legalCopy).every((pages) =>
    pages.every((page) => !/\bdraft\b|borrador/iu.test(JSON.stringify(page))),
  );
}
