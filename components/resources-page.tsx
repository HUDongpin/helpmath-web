import type {Locale, ResourcesContent} from '@/content/types';

import {PageHero} from './page-hero';
import {ResourceHashBootstrap} from './resource-hash-bootstrap';
import {ResourceLibrary} from './resource-library';
import {Callout, Container, Section} from './ui';

export function ResourcesPage({
  content,
  locale,
}: {
  content: ResourcesContent;
  locale: Locale;
}) {
  return (
    <>
      <ResourceHashBootstrap />
      <PageHero content={content.hero} locale={locale} tone="mint" />
      <Section className="section--compact">
        <Container>
          <Callout {...content.archiveNotice} tone="yellow" />
        </Container>
      </Section>
      <Section>
        <Container>
          <ResourceLibrary filters={content.filters} items={content.items} />
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
