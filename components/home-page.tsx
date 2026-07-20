import {BookOpenText, GraduationCap, School, UsersRound} from 'lucide-react';

import type {HomeContent, Locale} from '@/content/types';

import {FeatureGrid} from './feature-grid';
import {MathPlayground} from './math-playground';
import {Action, Callout, Container, DotPattern, Eyebrow, Section, SectionHeading} from './ui';

const audienceIcons = [GraduationCap, School, UsersRound];

export function HomePage({content, locale}: {content: HomeContent; locale: Locale}) {
  return (
    <>
      <section className="home-hero">
        <Container className="home-hero__grid">
          <div className="home-hero__copy">
            <Eyebrow>{content.hero.eyebrow}</Eyebrow>
            <h1>{content.hero.title}</h1>
            <p className="home-hero__summary">{content.hero.summary}</p>
            <div className="home-hero__actions">
              {content.hero.primaryAction ? <Action action={content.hero.primaryAction} /> : null}
              {content.hero.secondaryAction ? (
                <Action action={content.hero.secondaryAction} kind="secondary" />
              ) : null}
            </div>
            <p className="home-hero__note">
              <BookOpenText aria-hidden="true" size={18} />
              {content.hero.supportingNote}
            </p>
          </div>
          <div className="home-hero__visual">
            <MathPlayground locale={locale} />
          </div>
        </Container>
        <DotPattern className="home-hero__dots" />
      </section>

      <Section className="section--compact">
        <Container>
          <Callout
            action={content.status.action}
            body={content.status.body}
            label={content.status.label}
            title={content.status.title}
            tone="yellow"
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            align="center"
            eyebrow={content.audiences.eyebrow}
            intro={content.audiences.intro}
            title={content.audiences.title}
          />
          <div className="audience-grid">
            {content.audiences.cards.map((card, index) => {
              const Icon = audienceIcons[index % audienceIcons.length];
              return (
                <article key={card.id}>
                  <Icon aria-hidden="true" size={34} strokeWidth={1.9} />
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {card.detail ? <p className="audience-grid__detail">{card.detail}</p> : null}
                </article>
              );
            })}
          </div>
        </Container>
      </Section>

      <Section className="surface-blue">
        <Container>
          <div className="split-heading">
            <SectionHeading
              eyebrow={content.approach.eyebrow}
              intro={content.approach.intro}
              title={content.approach.title}
            />
            <Action action={content.approach.action} kind="quiet" />
          </div>
          <FeatureGrid cards={content.approach.cards} columns={3} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeading
            eyebrow={content.demos.eyebrow}
            intro={content.demos.intro}
            title={content.demos.title}
          />
          <div className="demo-preview-grid">
            {content.demos.items.map((item, index) => (
              <article className="demo-preview" key={item.id}>
                <div aria-hidden="true" className={`demo-preview__art demo-preview__art--${index + 1}`}>
                  {index === 0 ? (
                    <>
                      <span className="measure-cup" />
                      <strong>4 × 32 = 128</strong>
                    </>
                  ) : (
                    <>
                      <span className="number-line" />
                      <strong>1 L = 1,000 mL</strong>
                    </>
                  )}
                </div>
                <div className="demo-preview__copy">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  {item.detail ? <p className="demo-preview__detail">{item.detail}</p> : null}
                  <Action action={item.action} kind="quiet" />
                </div>
              </article>
            ))}
          </div>
          <p className="demo-preview__note">{content.demos.note}</p>
        </Container>
      </Section>

      <Section className="home-closing">
        <Container>
          <Callout {...content.closing} tone="paper" />
        </Container>
      </Section>
    </>
  );
}
