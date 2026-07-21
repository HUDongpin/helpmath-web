import {FlaskConical} from 'lucide-react';

import type {DemosContent} from '@/content/types';

import {Action, Callout, Container, Eyebrow, Section} from './ui';
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
      {content.items.length > 0 ? (
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
      ) : null}
      <Section className="surface-blue">
        <Container>
          <TextSection content={content.quality} />
          <Callout {...content.accessibility} tone="paper" />
        </Container>
      </Section>
    </>
  );
}
