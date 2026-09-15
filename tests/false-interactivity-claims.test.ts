import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

import {siteContent} from '../content';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dragInstruction = /\b(?:drag|drop|draggable|arrastra(?:r)?|soltar)\b/iu;

describe('false interactivity claims', () => {
  it('keeps the home visual model from instructing a drag that is not implemented', async () => {
    const source = await readFile(
      path.join(repositoryRoot, 'components/math-playground.tsx'),
      'utf8',
    );

    assert.match(source, /role="img"/u);
    assert.match(source, /Example visual model/u);
    assert.match(source, /Modelo visual de ejemplo/u);
    assert.doesNotMatch(source, dragInstruction);
  });

  it('discloses that Try It / Play It drag and game controls are not restored', () => {
    for (const [locale, content] of Object.entries(siteContent)) {
      const availability = content.pages.curriculum.availability.paragraphs.join(' ');
      const faq = content.pages.support.faqs.find((entry) => entry.id === 'try-it-play-it');

      assert.match(availability, /Try It/u, `${locale} curriculum availability names Try It`);
      assert.match(availability, /Play It/u, `${locale} curriculum availability names Play It`);
      assert.ok(faq, `${locale} support FAQ includes try-it-play-it`);

      if (locale === 'en') {
        assert.match(availability, /does not currently restore matching interactive controls/u);
        assert.match(availability, /historical artwork/u);
        assert.match(faq.question, /Try It or Play It/u);
        assert.match(faq.answer, /does not restore those interactive widgets/u);
        assert.match(faq.answer, /original artwork, not live controls/u);
      } else {
        assert.match(availability, /no restaura ahora los controles interactivos equivalentes/u);
        assert.match(availability, /ilustración histórica/u);
        assert.match(faq.question, /Try It o Play It/u);
        assert.match(faq.answer, /no restaura esos widgets interactivos/u);
        assert.match(faq.answer, /ilustración original, no de controles activos/u);
      }
    }
  });

  it('does not attach HTML5 drag handlers to public components', async () => {
    const componentsDirectory = path.join(repositoryRoot, 'components');
    const files = (await readdir(componentsDirectory)).filter((name) => name.endsWith('.tsx'));

    for (const name of files) {
      const source = await readFile(path.join(componentsDirectory, name), 'utf8');
      assert.doesNotMatch(
        source,
        /\bonDrag(?:Start|End|Over|Leave|Enter)?\b|\bonDrop\b|draggable=\{?true/u,
        `${name} must not claim HTML5 drag-and-drop without a reviewed interaction`,
      );
    }
  });
});
