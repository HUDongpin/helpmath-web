import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {siteContent} from '../content';

const identityKeys = new Set(['category', 'id', 'status']);

function contentShape(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => contentShape(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryKey, entryValue]) => [
          entryKey,
          contentShape(entryValue, entryKey),
        ]),
    );
  }
  return identityKeys.has(key) ? value : typeof value;
}

describe('public HELP Math resource catalog', () => {
  it('keeps the complete English and Spanish content structures aligned', () => {
    assert.deepEqual(
      contentShape(siteContent.es),
      contentShape(siteContent.en),
    );
  });

  it('keeps the English and Spanish libraries structurally aligned', () => {
    const english = siteContent.en.pages.resources.items;
    const spanish = siteContent.es.pages.resources.items;
    const englishIds = english.map((item) => item.id);
    const spanishIds = spanish.map((item) => item.id);

    assert.deepEqual(spanishIds, englishIds);
    assert.equal(englishIds.length, 18);
    assert.equal(new Set(englishIds).size, englishIds.length);

    for (const items of [english, spanish]) {
      assert.equal(items.filter((item) => item.category === 'program').length, 4);
      assert.equal(items.filter((item) => item.category === 'research').length, 12);
      assert.equal(items.filter((item) => item.category === 'technical').length, 2);
    }
  });

  it('does not use the retiring legacy domain as a public citation target', () => {
    for (const [locale, content] of Object.entries(siteContent)) {
      assert.doesNotMatch(
        JSON.stringify(content),
        /(?:www\.)?helpprogram\.net/i,
        `${locale} public content must use canonical or durable external sources`,
      );
    }
  });

  it('keeps the confirmed partnership statement explicit in both locales', () => {
    assert.match(
      siteContent.en.pages.home.partnership.body,
      /Both organizations have confirmed this bilateral partnership/i,
    );
    assert.match(
      siteContent.es.pages.home.partnership.body,
      /Ambas organizaciones han confirmado esta alianza bilateral/i,
    );
  });

  it('keeps the requested HELP Math lineage and evidence facts explicit and qualified', () => {
    const englishLineage = siteContent.en.pages.about.lineage.items;
    const spanishLineage = siteContent.es.pages.about.lineage.items;
    const englishLegacy = englishLineage.find((item) => item.id === 'help-math-1');
    const spanishLegacy = spanishLineage.find((item) => item.id === 'help-math-1');
    const englishBoulder = englishLineage.find((item) => item.id === 'boulder-learning');
    const spanishBoulder = spanishLineage.find((item) => item.id === 'boulder-learning');
    const englishAward = siteContent.en.pages.research.entries.find(
      (entry) => entry.id === 'historical-awards-funding',
    );
    const spanishAward = siteContent.es.pages.research.entries.find(
      (entry) => entry.id === 'historical-awards-funding',
    );
    const englishWwc = siteContent.en.pages.research.entries.find(
      (entry) => entry.id === 'wwc-tran-study',
    );
    const spanishWwc = siteContent.es.pages.research.entries.find(
      (entry) => entry.id === 'wwc-tran-study',
    );

    assert.ok(englishLegacy);
    assert.ok(spanishLegacy);
    assert.ok(englishBoulder);
    assert.ok(spanishBoulder);
    assert.ok(englishAward);
    assert.ok(spanishAward);
    assert.ok(englishWwc);
    assert.ok(spanishWwc);

    assert.match(englishLegacy.paragraphs.join(' '), /leading research-proven online math intervention program/u);
    assert.match(englishLegacy.paragraphs.join(' '), /dated program self-description/u);
    assert.match(spanishLegacy.paragraphs.join(' '), /programa líder de intervención matemática en línea respaldado por investigación/u);
    assert.match(spanishLegacy.paragraphs.join(' '), /autodescripción histórica/u);

    assert.match(englishBoulder.paragraphs.join(' '), /student-facing HELP Math experience/u);
    assert.match(englishBoulder.paragraphs.join(' '), /teacher-facing Teaching with Grace/u);
    assert.match(englishBoulder.paragraphs.join(' '), /generative AI/u);
    assert.match(spanishBoulder.paragraphs.join(' '), /orientada al alumnado/u);
    assert.match(spanishBoulder.paragraphs.join(' '), /orientado a la práctica docente/u);
    assert.match(spanishBoulder.paragraphs.join(' '), /IA generativa/u);

    assert.match(englishWwc.interpretation, /highest possible rating/u);
    assert.match(englishWwc.interpretation, /official and more precise WWC wording/u);
    assert.match(spanishWwc.interpretation, /calificación más alta posible/u);
    assert.match(spanishWwc.interpretation, /formulación oficial y más precisa de WWC/u);

    assert.match(englishAward.summary, /40% federal share/u);
    assert.match(englishAward.interpretation, /46% federal share/u);
    assert.match(englishAward.interpretation, /conflicting/u);
    assert.match(spanishAward.summary, /participación federal del 40%/u);
    assert.match(spanishAward.interpretation, /participación federal del 46%/u);
    assert.match(spanishAward.interpretation, /en conflicto/u);
  });

  it('attributes the Tran evaluation and Colorado funding without overstating the evidence', () => {
    const englishWwc = siteContent.en.pages.research.entries.find(
      (entry) => entry.id === 'wwc-tran-study',
    );
    const englishPilot = siteContent.en.pages.research.entries.find(
      (entry) => entry.id === 'help-math-pilot',
    );
    const spanishWwc = siteContent.es.pages.research.entries.find(
      (entry) => entry.id === 'wwc-tran-study',
    );
    const spanishPilot = siteContent.es.pages.research.entries.find(
      (entry) => entry.id === 'help-math-pilot',
    );

    assert.ok(englishWwc);
    assert.ok(englishPilot);
    assert.ok(spanishWwc);
    assert.ok(spanishPilot);

    assert.match(englishWwc.summary, /Tran, Z\./u);
    assert.match(
      englishWwc.summary,
      /archived HELP Math materials identify the researcher as Zung Vu Tran, Ph\.D\./u,
    );
    assert.match(
      englishWwc.interpretation,
      /should not be restated as an award or a blanket product rating/u,
    );
    assert.match(
      englishPilot.summary,
      /independent researcher Zung Vu Tran, Ph\.D\., with funding from the Colorado Department of Education/u,
    );
    assert.match(
      englishPilot.interpretation,
      /not authorship or endorsement by that agency/u,
    );
    assert.match(
      englishPilot.interpretation,
      /not additional WWC-validated subgroup findings/u,
    );
    assert.match(englishPilot.interpretation, /should not be generalized to HELP Math 2\.0/u);
    assert.doesNotMatch(
      englishPilot.summary,
      /Colorado Department of Education (?:authored|conducted|endorsed|found|confirmed|validated|reported)/iu,
    );

    assert.match(spanishWwc.summary, /«Tran, Z\.»/u);
    assert.match(
      spanishWwc.summary,
      /materiales archivados de HELP Math identifican al investigador como Zung Vu Tran, Ph\.D\./u,
    );
    assert.match(
      spanishWwc.interpretation,
      /No debe presentarse como un premio ni como una calificación general del producto/u,
    );
    assert.match(
      spanishPilot.summary,
      /investigador independiente Zung Vu Tran, Ph\.D\., con financiación del Departamento de Educación de Colorado/u,
    );
    assert.match(
      spanishPilot.interpretation,
      /no autoría ni respaldo de esa agencia/u,
    );
    assert.match(
      spanishPilot.interpretation,
      /No son resultados de subgrupos validados adicionalmente por WWC/u,
    );
    assert.match(spanishPilot.interpretation, /ni deben generalizarse a HELP Math 2\.0/u);
    assert.doesNotMatch(
      spanishPilot.summary,
      /Departamento de Educación de Colorado (?:redactó|realizó|respaldó|determinó|confirmó|validó|informó)/iu,
    );
  });
});
