import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {GraduationCap, School, UsersRound} from 'lucide-react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {FeatureGrid} from '../components/feature-grid';
import {
  renderHomeApproachMarkup,
  renderHomeAudiencesMarkup,
} from '../components/home-deferred-markup';
import {Action, Container, SectionHeading} from '../components/ui';
import {getSiteContent} from '../content';
import type {HomeContent} from '../content/types';

function homeContent(locale: 'en' | 'es'): HomeContent {
  return getSiteContent(locale).pages.home;
}

const audienceIcons = [GraduationCap, School, UsersRound];

function normalizeReactMarkup(markup: string): string {
  return markup.replaceAll('&#x27;', '&#39;');
}

function renderReferenceAudiences(content: HomeContent['audiences']): string {
  return normalizeReactMarkup(renderToStaticMarkup(createElement(
    Container,
    null,
    createElement(SectionHeading, {
      align: 'center',
      eyebrow: content.eyebrow,
      intro: content.intro,
      title: content.title,
    }),
    createElement(
      'div',
      {className: 'audience-grid'},
      content.cards.map((card, index) => {
        const Icon = audienceIcons[index % audienceIcons.length];
        return createElement(
          'article',
          {key: card.id},
          createElement(Icon, {'aria-hidden': true, size: 34, strokeWidth: 1.9}),
          createElement('h3', null, card.title),
          createElement('p', null, card.description),
          card.detail
            ? createElement('p', {className: 'audience-grid__detail'}, card.detail)
            : null,
        );
      }),
    ),
  )));
}

function renderReferenceApproach(content: HomeContent['approach']): string {
  return normalizeReactMarkup(renderToStaticMarkup(createElement(
    Container,
    null,
    createElement(
      'div',
      {className: 'split-heading'},
      createElement(SectionHeading, {
        eyebrow: content.eyebrow,
        intro: content.intro,
        title: content.title,
      }),
      createElement(Action, {action: content.action, kind: 'quiet'}),
    ),
    createElement(FeatureGrid, {cards: content.cards, columns: 3}),
  )));
}

describe('static home deferred markup', () => {
  it('preserves localized audience and approach content, structure, icons, and links', () => {
    for (const locale of ['en', 'es'] as const) {
      const content = homeContent(locale);
      const audiences = renderHomeAudiencesMarkup(content.audiences);
      const approach = renderHomeApproachMarkup(content.approach);

      assert.equal(audiences, renderReferenceAudiences(content.audiences), locale);
      assert.equal(approach, renderReferenceApproach(content.approach), locale);

      assert.match(
        audiences,
        /<header class="section-heading section-heading--center">/u,
        locale,
      );
      assert.match(audiences, /<div class="audience-grid">/u, locale);
      assert.equal((audiences.match(/<article>/gu) ?? []).length, 3, locale);
      assert.equal((audiences.match(/aria-hidden="true"/gu) ?? []).length, 3, locale);
      for (const card of content.audiences.cards) {
        assert.match(audiences, new RegExp(escapeForRegExp(card.title), 'u'), card.id);
        assert.match(audiences, new RegExp(escapeForRegExp(card.description), 'u'), card.id);
      }

      assert.match(
        approach,
        /<header class="section-heading section-heading--left">/u,
        locale,
      );
      assert.match(approach, /<div class="feature-grid feature-grid--3">/u, locale);
      assert.equal(
        (approach.match(/<article class="feature-card">/gu) ?? []).length,
        3,
        locale,
      );
      assert.match(
        approach,
        new RegExp(`href="${escapeForRegExp(content.approach.action.href)}"`),
        locale,
      );
      assert.match(approach, /class="lucide lucide-arrow-right"/u, locale);
      for (const card of content.approach.cards) {
        assert.match(approach, new RegExp(escapeForRegExp(card.title), 'u'), card.id);
        assert.match(approach, new RegExp(escapeForRegExp(card.description), 'u'), card.id);
      }
    }
  });

  it('escapes every localized text field and optional card detail', () => {
    const content = homeContent('en');
    const audiences = renderHomeAudiencesMarkup({
      ...content.audiences,
      eyebrow: '<script>alert("eyebrow")</script>',
      title: 'Title & context',
      intro: 'An "intro" with <markup>.',
      cards: content.audiences.cards.map((card, index) => ({
        ...card,
        title: `${card.title} <unsafe>`,
        description: `${card.description} & "quoted"`,
        detail: index === 0 ? "Learner's <detail>" : undefined,
      })),
    });
    const approach = renderHomeApproachMarkup({
      ...content.approach,
      action: {
        ...content.approach.action,
        label: 'Open <approach> & "learn"',
      },
    });

    assert.doesNotMatch(audiences, /<script>|<unsafe>|<markup>|<detail>/u);
    assert.match(audiences, /&lt;script&gt;alert\(&quot;eyebrow&quot;\)&lt;\/script&gt;/u);
    assert.match(audiences, /Title &amp; context/u);
    assert.match(audiences, /Learner&#39;s &lt;detail&gt;/u);
    assert.match(approach, /Open &lt;approach&gt; &amp; &quot;learn&quot;/u);
  });

  it('fails closed for unsafe or disguised approach destinations', () => {
    const content = homeContent('en').approach;

    for (const href of [
      'javascript:alert(1)',
      '//evil.example/approach',
      '/\\evil.example/approach',
      '/\nevil.example/approach',
      ' /approach',
      'https://user@example.com/approach',
    ]) {
      assert.throws(
        () => renderHomeApproachMarkup({
          ...content,
          action: {...content.action, href},
        }),
        /Unsafe home approach href/u,
        href,
      );
    }
  });

  it('fails closed when the static card contract changes unexpectedly', () => {
    const content = homeContent('en');

    assert.throws(
      () => renderHomeAudiencesMarkup({
        ...content.audiences,
        cards: content.audiences.cards.slice(0, 2),
      }),
      /Unsafe home audience card count/u,
    );
    assert.throws(
      () => renderHomeApproachMarkup({
        ...content.approach,
        cards: content.approach.cards.map((card, index) => (
          index === 0 ? {...card, id: 'unsafe" onclick="alert(1)'} : card
        )),
      }),
      /Unsafe home approach card id/u,
    );
  });
});

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
