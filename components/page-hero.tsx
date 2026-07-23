import type {ReactNode} from 'react';

import type {HeroContent, Locale} from '@/content/types';

import {Action, Container, DotPattern, Eyebrow} from './ui';
import {PageHeroMotif} from './page-hero-motif';

export function PageHero({
  content,
  locale,
  tone = 'blue',
  children
}: {
  content: HeroContent;
  locale: Locale;
  tone?: 'blue' | 'yellow' | 'mint' | 'coral';
  children?: ReactNode;
}) {
  return (
    <section className={`page-hero page-hero--${tone}`}>
      <Container className="page-hero__grid">
        <div className="page-hero__copy">
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <h1>{content.title}</h1>
          <p>{content.summary}</p>
          {content.primaryAction || content.secondaryAction ? (
            <div className="page-hero__actions">
              {content.primaryAction ? <Action action={content.primaryAction} /> : null}
              {content.secondaryAction ? (
                <Action action={content.secondaryAction} kind="secondary" />
              ) : null}
            </div>
          ) : null}
        </div>
        {children ? (
          <div className="page-hero__visual">{children}</div>
        ) : (
          <PageHeroMotif locale={locale} />
        )}
      </Container>
      <DotPattern className="page-hero__dots" />
    </section>
  );
}
