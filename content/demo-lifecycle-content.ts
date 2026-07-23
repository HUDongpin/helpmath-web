import type {
  DemoDetailContent,
  DemoId,
  DemoListItem,
  Locale,
  SiteContent,
} from './types';

type DemoLifecycleContentOptions = Readonly<{
  publicDemoIds: readonly DemoId[];
  indexableDemoIds: readonly DemoId[];
  reviewDemoIds: readonly DemoId[];
}>;

type DemoCopy = Readonly<{
  concept: string;
  publicSummary: string;
}>;

const COPY: Readonly<Record<Locale, Readonly<Record<DemoId, DemoCopy>>>> = {
  en: {
    'conversion-1-2': {
      concept: 'U.S. customary capacity',
      publicSummary:
        'Explore the relationship among gallons, quarts, and fluid ounces in a browser-native sequence.',
    },
    'conversion-1-4': {
      concept: 'Metric capacity',
      publicSummary:
        'Explore liters and milliliters through a browser-native visual sequence.',
    },
  },
  es: {
    'conversion-1-2': {
      concept: 'Capacidad del sistema estadounidense',
      publicSummary:
        'Explora la relación entre galones, cuartos y onzas líquidas en una secuencia nativa del navegador.',
    },
    'conversion-1-4': {
      concept: 'Capacidad métrica',
      publicSummary:
        'Explora litros y mililitros mediante una secuencia visual nativa del navegador.',
    },
  },
};

function publicDetail(
  detail: DemoDetailContent,
  locale: Locale,
  indexable: boolean,
): DemoDetailContent {
  if (locale === 'es') {
    return {
      ...detail,
      metadata: {
        title: detail.metadata.title,
        description: indexable
          ? `Demostración HELP Math revisada: ${detail.title}.`
          : `Prototipo público condicional HELP Math: ${detail.title}.`,
      },
      eyebrow: indexable
        ? 'Demostración revisada para navegador'
        : 'Prototipo público condicional',
      summary: indexable
        ? 'Esta migración nativa del navegador completó las puertas estrictas de evidencia, derechos y aceptación del repositorio para este candidato. Su alcance y sus límites documentados siguen siendo parte del registro de publicación.'
        : 'Este candidato tiene aceptación de derechos y producto para acceso público, pero la evidencia estricta de fidelidad sigue incompleta. Se publica con límites explícitos y no se autoriza su indexación.',
      statusLabel: indexable ? 'Demostración revisada' : 'Prototipo público condicional',
      statusDetail: indexable
        ? 'Publicada · Revisión estricta completada · Derechos y producto aceptados'
        : 'Acceso público · Derechos y producto aceptados · Validación estricta incompleta',
      disclaimerTitle: indexable ? 'Alcance de la demostración' : 'Límites del prototipo',
      disclaimer: indexable
        ? 'La evidencia aceptada corresponde a este candidato y a su alcance documentado. Esta demostración no es por sí sola un curso completo, una evaluación, una cuenta estudiantil ni una afirmación nueva de eficacia. No guarda respuestas, puntuaciones ni progreso.'
        : 'Esta implementación pública condicional no debe describirse como una migración completa o fiel. No es una lección, curso, evaluación ni afirmación nueva de eficacia, y no guarda respuestas, puntuaciones o progreso. Consulta el estado de revisión antes de reutilizarla.',
    };
  }

  return {
    ...detail,
    metadata: {
      title: detail.metadata.title,
      description: indexable
        ? `Reviewed HELP Math browser demonstration: ${detail.title}.`
        : `Public conditional HELP Math browser prototype: ${detail.title}.`,
    },
    eyebrow: indexable ? 'Reviewed browser demonstration' : 'Public conditional prototype',
    summary: indexable
      ? 'This browser-native migration completed the repository’s strict evidence, rights, and acceptance gates for this candidate. Its documented scope and limitations remain part of the publication record.'
      : 'This candidate has rights and product acceptance for public access, but strict fidelity evidence remains incomplete. It is published with explicit limits and is not approved for indexing.',
    statusLabel: indexable ? 'Reviewed demonstration' : 'Public conditional prototype',
    statusDetail: indexable
      ? 'Published · Strict migration review complete · Rights and product accepted'
      : 'Public access · Rights and product accepted · Strict validation incomplete',
    disclaimerTitle: indexable ? 'Demonstration scope' : 'Prototype limits',
    disclaimer: indexable
      ? 'Accepted evidence applies to this candidate and its documented scope. This demonstration is not by itself a complete course, assessment, student account, or new claim of effectiveness. It does not save responses, scores, or progress.'
      : 'This public conditional implementation must not be described as a completed or faithful migration. It is not a lesson, course, assessment, or new effectiveness claim, and it does not save responses, scores, or progress. Check its review status before reuse.',
  };
}

function demoListItem(
  id: DemoId,
  detail: DemoDetailContent,
  locale: Locale,
): DemoListItem {
  const copy = COPY[locale][id];
  return {
    id,
    title: detail.title,
    summary: copy.publicSummary,
    conceptLabel: locale === 'es' ? 'Concepto' : 'Concept',
    concept: copy.concept,
    statusLabel: detail.statusLabel,
    statusDetail: detail.statusDetail,
    action: {
      label: locale === 'es' ? 'Abrir demostración' : 'Open demonstration',
      href: `${locale === 'es' ? '/es' : ''}/demos/${id}`,
    },
  };
}

export function applyDemoLifecycleContent(
  content: SiteContent,
  {publicDemoIds, indexableDemoIds, reviewDemoIds}: DemoLifecycleContentOptions,
): SiteContent {
  if (publicDemoIds.length === 0) return content;

  const publicIds = [...new Set(publicDemoIds)];
  const publicIdSet = new Set(publicIds);
  const indexableIdSet = new Set(
    indexableDemoIds.filter((id) => publicIdSet.has(id)),
  );
  const localizedDetails = Object.fromEntries(
    Object.entries(content.pages.demoDetails).map(([id, detail]) => [
      id,
      publicIdSet.has(id as DemoId)
        ? publicDetail(detail, content.locale, indexableIdSet.has(id as DemoId))
        : detail,
    ]),
  ) as Record<DemoId, DemoDetailContent>;
  const items = publicIds.map((id) =>
    demoListItem(id, localizedDetails[id], content.locale),
  );
  const strictCount = indexableIdSet.size;
  const firstDemoHref = `${content.locale === 'es' ? '/es' : ''}/demos/${publicIds[0]}`;
  const firstDemoAction = {
    label: content.locale === 'es'
      ? 'Abrir la primera demostración'
      : 'Open the first demonstration',
    href: firstDemoHref,
  };
  const privatePreviewAction = {
    label: content.locale === 'es'
      ? 'Abrir vista previa ejecutiva privada'
      : 'Open private executive preview',
    href: content.locale === 'es'
      ? '/es/executive-preview'
      : '/executive-preview',
  };
  const preservationAction = {
    label: content.locale === 'es'
      ? 'Leer el enfoque de preservación'
      : 'Read the preservation approach',
    href: content.locale === 'es'
      ? '/es/about#preservation'
      : '/about#preservation',
  };
  const previewAction = reviewDemoIds.length > 0
    ? privatePreviewAction
    : firstDemoAction;
  const publicHeroSecondaryAction = reviewDemoIds.length > 0
    ? privatePreviewAction
    : preservationAction;

  if (content.locale === 'es') {
    return {
      ...content,
      shared: {
        ...content.shared,
        statusMessage:
          'HELP Math se moderniza cuidadosamente para la web actual. La información del proyecto y las demostraciones aprobadas están disponibles con su estado de revisión; el contacto y las cuentas aún no son públicos.',
      },
      pages: {
        ...content.pages,
        demos: {
          ...content.pages.demos,
          metadata: {
            title: 'Demostraciones HELP Math',
            description:
              'Explora las demostraciones HELP Math aprobadas y consulta el estado de validación de cada candidato.',
          },
          hero: {
            ...content.pages.demos.hero,
            eyebrow: 'Biblioteca de demostraciones',
            title: strictCount > 0
              ? 'Demostraciones revisadas disponibles en el navegador'
              : 'Prototipos públicos condicionales con límites claros',
            summary: strictCount > 0
              ? 'Cada demostración publicada muestra su alcance y estado de revisión. La aceptación se aplica al candidato identificado, no a material Flash no publicado ni a afirmaciones nuevas de eficacia.'
              : 'Estos candidatos tienen aceptación de derechos y producto para acceso público, pero la validación estricta sigue incompleta. Se muestran con límites claros y sin indexación.',
            primaryAction: firstDemoAction,
            secondaryAction: publicHeroSecondaryAction,
          },
          previewNotice: {
            title: `${items.length} ${items.length === 1 ? 'demostración pública disponible' : 'demostraciones públicas disponibles'}`,
            body: strictCount === items.length
              ? 'Todas las demostraciones visibles completaron las puertas estrictas del repositorio para su candidato. Revisa el alcance y las limitaciones de cada página antes de reutilizar el material.'
              : 'Al menos una demostración sigue en estado público condicional. Acceso público no significa fidelidad completa, autorización para redistribuir fuera del alcance aceptado ni una nueva afirmación de eficacia.',
            action: previewAction,
          },
          listLabel: 'Demostraciones públicas',
          items,
          quality: {
            ...content.pages.demos.quality,
            paragraphs: [strictCount > 0
              ? 'Las demostraciones publicadas muestran si completaron la revisión estricta. La evidencia y las excepciones permanecen vinculadas al candidato aceptado.'
              : 'Los prototipos públicos condicionales tienen aceptación de derechos y producto, pero ninguno ha completado todavía la validación estricta. Sus límites deben permanecer visibles.'],
          },
        },
        demoDetails: localizedDetails,
      },
    };
  }

  return {
    ...content,
    shared: {
      ...content.shared,
      statusMessage:
        'HELP Math is being carefully modernized for today’s web. Project information and approved demonstrations are available with their review status; contact intake and student accounts are not yet public.',
    },
    pages: {
      ...content.pages,
      demos: {
        ...content.pages.demos,
        metadata: {
          title: 'HELP Math Demonstrations',
          description:
            'Explore approved HELP Math browser demonstrations and the validation status of each candidate.',
        },
        hero: {
          ...content.pages.demos.hero,
          eyebrow: 'Demonstration library',
          title: strictCount > 0
            ? 'Reviewed browser demonstrations are available'
            : 'Public conditional prototypes with clear limits',
          summary: strictCount > 0
            ? 'Each published demonstration shows its scope and review status. Acceptance applies to the identified candidate, not to unpublished Flash material or new claims of effectiveness.'
            : 'These candidates have rights and product acceptance for public access, while strict validation remains incomplete. They are presented with clear limits and without indexing.',
          primaryAction: firstDemoAction,
          secondaryAction: publicHeroSecondaryAction,
        },
        previewNotice: {
          title: `${items.length} public ${items.length === 1 ? 'demonstration is' : 'demonstrations are'} available`,
          body: strictCount === items.length
            ? 'Every visible demonstration completed the repository’s strict gates for its candidate. Review each page’s scope and limitations before reusing the material.'
            : 'At least one demonstration remains public-conditional. Public access does not establish complete fidelity, permission to redistribute beyond the accepted scope, or a new claim of effectiveness.',
          action: previewAction,
        },
        listLabel: 'Public demonstrations',
        items,
        quality: {
          ...content.pages.demos.quality,
          paragraphs: [strictCount > 0
            ? 'Published demonstrations state whether they completed strict review. Evidence and exceptions remain bound to the accepted candidate.'
            : 'Public conditional prototypes have rights and product acceptance, but none has completed strict validation. Their limitations must remain visible.'],
        },
      },
      demoDetails: localizedDetails,
    },
  };
}
