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
