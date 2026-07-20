import {
  Archive,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  LifeBuoy,
  LockKeyhole,
  MonitorPlay,
  SearchCheck,
  ShieldCheck
} from 'lucide-react';

import type {
  AboutContent,
  ApproachContent,
  CurriculumContent,
  EvidenceStatus,
  LegalContent,
  LoginContent,
  ResearchContent,
  ResourceStatus,
  ResourcesContent,
  SupportContent
} from '@/content/types';
import {FeatureGrid} from './feature-grid';
import {PageHero} from './page-hero';
import {TextSection} from './text-section';
import {Action, Callout, Container, Eyebrow, Section, SectionHeading} from './ui';

export function AboutPage({content}: {content: AboutContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="yellow" />
      <Section>
        <Container>
          {content.story.map((section) => (
            <TextSection content={section} key={section.id} />
          ))}
        </Container>
      </Section>
      <Section className="surface-blue">
        <Container>
          <SectionHeading
            eyebrow={content.principles.eyebrow}
            title={content.principles.title}
          />
          <FeatureGrid cards={content.principles.cards} columns={3} />
        </Container>
      </Section>
      <Section>
        <Container>
          <Callout {...content.today} tone="coral" />
        </Container>
      </Section>
    </>
  );
}

export function ApproachPage({content}: {content: ApproachContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="mint" />
      <Section>
        <Container>
          <SectionHeading
            eyebrow={content.foundations.eyebrow}
            intro={content.foundations.intro}
            title={content.foundations.title}
          />
          <FeatureGrid cards={content.foundations.cards} columns={3} />
        </Container>
      </Section>
      <Section className="surface-grid">
        <Container>
          <SectionHeading
            eyebrow={content.learningSequence.eyebrow}
            intro={content.learningSequence.intro}
            title={content.learningSequence.title}
          />
          <ol className="sequence-list">
            {content.learningSequence.steps.map((step) => (
              <li key={step.id}>
                <span className="sequence-list__number">{step.step}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {step.detail ? <p className="sequence-list__detail">{step.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
      <Section>
        <Container>
          <TextSection content={content.supportLayers} />
          <Callout {...content.teacherRole} tone="yellow" />
        </Container>
      </Section>
    </>
  );
}

export function CurriculumPage({content}: {content: CurriculumContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="blue" />
      <Section className="section--compact">
        <Container>
          <Callout {...content.archiveNotice} tone="yellow" />
        </Container>
      </Section>
      <Section>
        <Container>
          <SectionHeading
            eyebrow={content.domains.eyebrow}
            intro={content.domains.intro}
            title={content.domains.title}
          />
          <FeatureGrid cards={content.domains.cards} columns={3} />
        </Container>
      </Section>
      <Section className="surface-mint">
        <Container>
          <SectionHeading
            eyebrow={content.lessonFlow.eyebrow}
            title={content.lessonFlow.title}
          />
          <ol className="lesson-flow">
            {content.lessonFlow.steps.map((step) => (
              <li key={step.id}>
                <span>{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>
      <Section>
        <Container>
          <TextSection content={content.availability} />
          <Callout {...content.closing} tone="coral" />
        </Container>
      </Section>
    </>
  );
}

const evidenceIcons: Record<EvidenceStatus, typeof Archive> = {
  archived: Archive,
  verification: SearchCheck,
  context: FileCheck2
};

export function ResearchPage({content}: {content: ResearchContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="yellow" />
      <Section className="section--compact">
        <Container>
          <Callout {...content.evidenceNotice} tone="blue" />
        </Container>
      </Section>
      <Section>
        <Container>
          <Eyebrow>{content.entriesLabel}</Eyebrow>
          <div className="evidence-list">
            {content.entries.map((entry) => {
              const Icon = evidenceIcons[entry.status];
              return (
                <article className="evidence-entry" key={entry.id}>
                  <div className="evidence-entry__meta">
                    <Icon aria-hidden="true" size={22} />
                    <span className={`status-badge status-badge--${entry.status}`}>
                      {entry.statusLabel}
                    </span>
                    <span>{entry.dateLabel}</span>
                  </div>
                  <div>
                    <h2>{entry.title}</h2>
                    <p>{entry.summary}</p>
                    <p className="evidence-entry__interpretation">{entry.interpretation}</p>
                    <p className="evidence-entry__source">{entry.sourceLabel}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </Section>
      <Section className="surface-blue">
        <Container>
          <TextSection content={content.reviewPolicy} />
          <Callout {...content.request} tone="paper" />
        </Container>
      </Section>
    </>
  );
}

const resourceIcons: Record<ResourceStatus, typeof Archive> = {
  available: CheckCircle2,
  review: SearchCheck,
  request: CircleAlert
};

export function ResourcesPage({content}: {content: ResourcesContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="mint" />
      <Section className="section--compact">
        <Container>
          <Callout {...content.archiveNotice} tone="yellow" />
        </Container>
      </Section>
      <Section>
        <Container>
          <div className="resource-list">
            {content.items.map((item) => {
              const Icon = resourceIcons[item.status];
              return (
                <article className="resource-entry" key={item.id}>
                  <div aria-hidden="true" className="resource-entry__icon">
                    <Icon size={27} />
                  </div>
                  <div className="resource-entry__body">
                    <div className="resource-entry__meta">
                      <span className={`status-badge status-badge--${item.status}`}>
                        {item.statusLabel}
                      </span>
                      <span>{item.format}</span>
                      <span>{item.dateLabel}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.description}</p>
                  </div>
                  <Action action={item.action} kind="quiet" />
                </article>
              );
            })}
          </div>
        </Container>
      </Section>
      <Section className="section--compact">
        <Container>
          <Callout {...content.accessibleCopies} tone="coral" />
        </Container>
      </Section>
    </>
  );
}

export function SupportPage({content}: {content: SupportContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="blue" />
      <Section>
        <Container>
          <SectionHeading
            eyebrow={content.currentStatus.eyebrow}
            title={content.currentStatus.title}
          />
          <FeatureGrid cards={content.currentStatus.items} columns={3} />
        </Container>
      </Section>
      <Section className="surface-yellow">
        <Container className="faq-layout">
          <div>
            <Eyebrow>{content.faqLabel}</Eyebrow>
            <LifeBuoy aria-hidden="true" className="faq-layout__icon" size={72} strokeWidth={1.5} />
          </div>
          <div className="faq-list">
            {content.faqs.map((faq) => (
              <details key={faq.id}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <Callout {...content.contact} tone="blue" />
        </Container>
      </Section>
    </>
  );
}

export function LoginPage({content}: {content: LoginContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="coral">
        <div className="login-visual" role="img" aria-label={content.alert.title}>
          <LockKeyhole aria-hidden="true" size={68} strokeWidth={1.7} />
          <span>HELP Math</span>
          <ShieldCheck aria-hidden="true" size={28} />
        </div>
      </PageHero>
      <Section className="section--compact">
        <Container>
          <Callout {...content.alert} tone="yellow" />
        </Container>
      </Section>
      <Section>
        <Container>
          <SectionHeading eyebrow={content.options.eyebrow} title={content.options.title} />
          <div className="option-grid">
            {content.options.cards.map((card, index) => (
              <article className="option-card" key={card.id}>
                {index === 0 ? (
                  <MonitorPlay aria-hidden="true" size={34} />
                ) : (
                  <LifeBuoy aria-hidden="true" size={34} />
                )}
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                {card.detail ? <p className="option-card__detail">{card.detail}</p> : null}
                <Action action={card.action} />
              </article>
            ))}
          </div>
          <p className="safety-note">
            <ShieldCheck aria-hidden="true" size={20} />
            {content.safetyNote}
          </p>
        </Container>
      </Section>
    </>
  );
}

export function LegalPage({content}: {content: LegalContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="blue" />
      <Section>
        <Container className="legal-layout">
          <aside className="legal-meta">
            <strong>{content.effectiveDateLabel}</strong>
            <span>{content.effectiveDate}</span>
            <p>{content.reviewNotice}</p>
          </aside>
          <div className="legal-sections">
            {content.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets?.length ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </Container>
      </Section>
      <Section className="section--compact">
        <Container>
          <Callout {...content.contact} tone="paper" />
        </Container>
      </Section>
    </>
  );
}
