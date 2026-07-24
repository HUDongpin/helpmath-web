import {ArrowLeft, CheckCircle2, ShieldCheck} from 'lucide-react';

import type {DemoDetailContent, DemoId, Locale} from '@/content/types';
import {Link} from '@/i18n/navigation';

import {ExecutiveDemoRuntimeLoader} from './executive-demo-runtime-loader';
import {Callout, Container, Eyebrow, Section, SectionHeading} from './ui';

export function DemoDetailPage({
  content,
  id,
  locale,
  requestedFrame,
  reviewMode = false,
  runtime,
}: {
  content: DemoDetailContent;
  id: DemoId;
  locale: Locale;
  requestedFrame?: number;
  reviewMode?: boolean;
  runtime: {
    globalName: string;
    source: string;
  };
}) {
  const reviewNotice = locale === 'es'
    ? 'Revisión ejecutiva interna. Este prototipo heredado no está validado como fiel o completo. El audio, la aceptación técnica y la revisión de derechos siguen pendientes. No se autoriza su distribución ni republicación pública.'
    : 'Internal executive review. This legacy prototype is not validated as faithful or complete. Audio, technical acceptance, and rights review remain pending. Public distribution or republication is not approved.';
  const backHref = reviewMode
    ? (locale === 'es' ? '/es/executive-preview' : '/executive-preview')
    : content.backAction.href;
  const backLabel = reviewMode
    ? (locale === 'es' ? 'Volver a la vista previa ejecutiva' : 'Back to executive preview')
    : content.backAction.label;

  return (
    <>
      {reviewMode ? (
        <aside className="section--compact surface-yellow" role="note">
          <Container>
            <p className="eyebrow">
              {locale === 'es' ? 'Solo revisión interna' : 'Internal review only'}
            </p>
            <p>{reviewNotice}</p>
          </Container>
        </aside>
      ) : null}
      <header className="demo-detail-header">
        <Container>
          <Link className="back-link" href={backHref} locale={locale}>
            <ArrowLeft aria-hidden="true" size={18} />
            {backLabel}
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
            <ExecutiveDemoRuntimeLoader
              content={content}
              demoId={id}
              locale={locale}
              requestedFrame={requestedFrame}
              runtimeGlobalName={runtime.globalName}
              runtimeSource={runtime.source}
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
