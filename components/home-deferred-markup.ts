import type {HomeContent} from '@/content/types';

import {documentHref, escapeHtml, kebabId} from './static-markup';

type AudienceContent = HomeContent['audiences'];
type ApproachContent = HomeContent['approach'];

const audienceIcons = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-graduation-cap" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path><path d="M22 10v6"></path><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-school" aria-hidden="true"><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M18 4.933V21"></path><path d="m4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6"></path><path d="m6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11"></path><path d="M6 4.933V21"></path><circle cx="12" cy="9" r="2"></circle></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users-round" aria-hidden="true"><path d="M18 21a8 8 0 0 0-16 0"></path><circle cx="10" cy="8" r="5"></circle><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"></path></svg>',
] as const;

const approachIcons = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages" aria-hidden="true"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shapes" aria-hidden="true"><path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"></path><rect x="3" y="14" width="7" height="7" rx="1"></rect><circle cx="17.5" cy="17.5" r="3.5"></circle></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mouse-pointer-click" aria-hidden="true"><path d="M14 4.1 12 6"></path><path d="m5.1 8-2.9-.8"></path><path d="m6 12-1.9 2"></path><path d="M7.2 2.2 8 5.1"></path><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"></path></svg>',
] as const;

const arrowRightIcon =
  '<svg aria-hidden="true" class="lucide lucide-arrow-right" fill="none" height="18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';

function requireStaticCardContract(
  cards: AudienceContent['cards'] | ApproachContent['cards'],
  context: string,
) {
  if (cards.length !== 3) {
    throw new Error(`Unsafe ${context} card count: ${cards.length}`);
  }

  for (const card of cards) {
    kebabId(card.id, `${context} card id`);
  }
}

function cardDetail(detail: string | undefined, className: string): string {
  return detail ? `<p class="${className}">${escapeHtml(detail)}</p>` : '';
}

export function renderHomeAudiencesMarkup(content: AudienceContent): string {
  requireStaticCardContract(content.cards, 'home audience');

  const cards = content.cards.map((card, index) => (
    '<article>' +
      audienceIcons[index] +
      `<h3>${escapeHtml(card.title)}</h3>` +
      `<p>${escapeHtml(card.description)}</p>` +
      cardDetail(card.detail, 'audience-grid__detail') +
    '</article>'
  )).join('');

  return (
    '<div class="container">' +
      '<header class="section-heading section-heading--center">' +
        `<p class="eyebrow">${escapeHtml(content.eyebrow)}</p>` +
        `<h2>${escapeHtml(content.title)}</h2>` +
        `<p>${escapeHtml(content.intro)}</p>` +
      '</header>' +
      `<div class="audience-grid">${cards}</div>` +
    '</div>'
  );
}

export function renderHomeApproachMarkup(content: ApproachContent): string {
  requireStaticCardContract(content.cards, 'home approach');

  const cards = content.cards.map((card, index) => (
    '<article class="feature-card">' +
      `<div aria-hidden="true" class="feature-card__icon">${approachIcons[index]}</div>` +
      `<h3>${escapeHtml(card.title)}</h3>` +
      `<p>${escapeHtml(card.description)}</p>` +
      cardDetail(card.detail, 'feature-card__detail') +
    '</article>'
  )).join('');

  return (
    '<div class="container">' +
      '<div class="split-heading">' +
        '<header class="section-heading section-heading--left">' +
          `<p class="eyebrow">${escapeHtml(content.eyebrow)}</p>` +
          `<h2>${escapeHtml(content.title)}</h2>` +
          `<p>${escapeHtml(content.intro)}</p>` +
        '</header>' +
        `<a class="action action--quiet" href="${documentHref(content.action.href, 'home approach href')}">` +
          `<span>${escapeHtml(content.action.label)}</span>` +
          arrowRightIcon +
        '</a>' +
      '</div>' +
      `<div class="feature-grid feature-grid--3">${cards}</div>` +
    '</div>'
  );
}
