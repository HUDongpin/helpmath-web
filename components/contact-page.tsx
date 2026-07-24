import {CircleAlert, ShieldCheck} from 'lucide-react';

import type {ContactContent, Locale} from '@/content/types';

import {PageHero} from './page-hero';
import {Callout, Container, Section} from './ui';

export function ContactPage({
  content,
  form,
  locale,
}: {
  content: ContactContent;
  form: React.ReactNode;
  locale: Locale;
}) {
  return (
    <>
      <PageHero content={content.hero} locale={locale} tone="yellow" />
      <Section className="section--compact">
        <Container>
          <Callout {...content.responseNote} tone="blue" />
        </Container>
      </Section>
      <Section>
        <Container className="contact-layout">
          <div className="contact-form-shell">{form}</div>
          <aside className="contact-safety">
            <ShieldCheck aria-hidden="true" size={38} />
            <h2>{content.privacyWarning.title}</h2>
            <p>{content.privacyWarning.body}</p>
            <div className="contact-safety__student">
              <CircleAlert aria-hidden="true" size={20} />
              <span>{content.studentNote}</span>
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}
