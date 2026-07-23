import {BookOpenText, Handshake} from 'lucide-react';

import type {HomeContent, Locale} from '@/content/types';

import {
  renderHomeApproachMarkup,
  renderHomeAudiencesMarkup,
} from './home-deferred-markup';
import {MathPlayground} from './math-playground';
import {Action, Callout, Container, DotPattern, Eyebrow, Section, SectionHeading} from './ui';

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

      <Section className="section--compact surface-mint" id="strategic-partnership">
        <Container>
          <article className="partnership-panel">
            <span aria-hidden="true" className="partnership-panel__icon">
              <Handshake size={34} strokeWidth={1.9} />
            </span>
            <div className="partnership-panel__copy">
              <Eyebrow>{content.partnership.eyebrow}</Eyebrow>
              <h2>{content.partnership.title}</h2>
              <p>{content.partnership.body}</p>
              <p className="partnership-panel__status">{content.partnership.statusNote}</p>
            </div>
            <div className="partnership-panel__actions">
              {content.partnership.actions.map((action, index) => (
                <Action
                  action={action}
                  key={action.href}
                  kind={index === 0 ? 'primary' : 'secondary'}
                />
              ))}
            </div>
          </article>
        </Container>
      </Section>

      <section
        className="section deferred-section deferred-section--home-audiences"
        dangerouslySetInnerHTML={{__html: renderHomeAudiencesMarkup(content.audiences)}}
      />

      <section
        className="section deferred-section deferred-section--home-approach surface-blue"
        dangerouslySetInnerHTML={{__html: renderHomeApproachMarkup(content.approach)}}
      />

      <Section className="deferred-section deferred-section--home-demos">
        <Container>
          <SectionHeading
            eyebrow={content.demos.eyebrow}
            intro={content.demos.intro}
            title={content.demos.title}
          />
          {content.demos.items.length > 0 ? (
            <div className="demo-preview-grid">
              {content.demos.items.map((item, index) => (
                <article className="demo-preview" key={item.id}>
                  <div
                    aria-hidden="true"
                    className={`demo-preview__art demo-preview__art--${index + 1}`}
                  >
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
          ) : null}
          <p className="demo-preview__note">{content.demos.note}</p>
        </Container>
      </Section>

      <Section className="deferred-section deferred-section--home-closing home-closing">
        <Container>
          <Callout {...content.closing} tone="paper" />
        </Container>
      </Section>
    </>
  );
}
