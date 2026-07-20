import {ArrowLeft, CheckCircle2, FlaskConical, ShieldCheck} from 'lucide-react';

import type {DemoDetailContent, DemoId, DemosContent, Locale} from '@/content/types';
import {Link} from '@/i18n/navigation';

import {DemoPlayer} from './demo-player';
import {Action, Callout, Container, Eyebrow, Section, SectionHeading} from './ui';
import {PageHero} from './page-hero';
import {TextSection} from './text-section';

export function DemosPage({content}: {content: DemosContent}) {
  return (
    <>
      <PageHero content={content.hero} tone="coral" />
      <Section className="section--compact">
        <Container>
          <Callout {...content.previewNotice} tone="yellow" />
        </Container>
      </Section>
      <Section>
        <Container>
          <Eyebrow>{content.listLabel}</Eyebrow>
          <div className="demo-library">
            {content.items.map((item, index) => (
              <article className="demo-library__item" key={item.id}>
                <div className={`demo-library__number demo-library__number--${index + 1}`}>
                  <FlaskConical aria-hidden="true" size={30} strokeWidth={1.9} />
                  <span>0{index + 1}</span>
                </div>
                <div className="demo-library__copy">
                  <div className="demo-library__meta">
                    <span className="status-badge status-badge--verification">
                      {item.statusLabel}
                    </span>
                    <span>{item.conceptLabel}: {item.concept}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.summary}</p>
                  <p className="demo-library__status">{item.statusDetail}</p>
                </div>
                <Action action={item.action} kind="secondary" />
              </article>
            ))}
          </div>
        </Container>
      </Section>
      <Section className="surface-blue">
        <Container>
          <TextSection content={content.quality} />
          <Callout {...content.accessibility} tone="paper" />
        </Container>
      </Section>
    </>
  );
}

export function DemoDetailPage({
  content,
  id,
  locale,
  requestedFrame
}: {
  content: DemoDetailContent;
  id: DemoId;
  locale: Locale;
  requestedFrame?: number;
}) {
  return (
    <>
      <header className="demo-detail-header">
        <Container>
          <Link className="back-link" href={content.backAction.href}>
            <ArrowLeft aria-hidden="true" size={18} />
            {content.backAction.label}
          </Link>
          <div className="demo-detail-header__grid">
            <div>
              <Eyebrow>{content.eyebrow}</Eyebrow>
              <h1>{content.title}</h1>
              <p>{content.summary}</p>
            </div>
            <aside>
              <strong>{content.statusLabel}</strong>
              <p>{content.statusDetail}</p>
            </aside>
          </div>
        </Container>
      </header>

      <Section className="demo-stage-section">
        <Container>
          <div className="demo-stage-shell">
            <div className="demo-stage-shell__bar">
              <span>{content.playerLabel}</span>
              <span>{id.replace('conversion-', 'Conversion ')}</span>
            </div>
            <DemoPlayer
              content={content}
              demoId={id}
              locale={locale}
              requestedFrame={requestedFrame}
            />
          </div>
          <p className="demo-reduced-note">{content.reducedMotionNote}</p>
        </Container>
      </Section>

      <Section>
        <Container className="demo-info-grid">
          <section>
            <SectionHeading title={content.instructionsTitle} />
            <ol className="demo-instructions">
              {content.instructions.map((instruction, index) => (
                <li key={instruction}>
                  <span>{index + 1}</span>
                  {instruction}
                </li>
              ))}
            </ol>
          </section>
          <section className="demo-accessibility">
            <ShieldCheck aria-hidden="true" size={34} />
            <h2>{content.accessibilityTitle}</h2>
            <ul>
              {content.accessibilityNotes.map((note) => (
                <li key={note}>
                  <CheckCircle2 aria-hidden="true" size={18} />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>
        </Container>
      </Section>

      <Section className="section--compact surface-yellow">
        <Container>
          <Callout
            action={content.supportAction}
            body={content.disclaimer}
            title={content.disclaimerTitle}
            tone="paper"
          />
        </Container>
      </Section>
    </>
  );
}
