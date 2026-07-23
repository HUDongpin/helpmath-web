# Design QA: Attached typography restoration

## Visual source of truth

- User-provided Codex attachment:
  `codex-clipboard-a8d6ebca-44f9-4da6-b62c-ef9764bf8deb.png`.
- Original source pixels: `2354 × 1610`.
- Original SHA-256:
  `db61c19b63988006b623207a60f6a8131f2feead0ca4c82be63fc25500c7edf1`.
- Normalized comparison source:
  `design-evidence/reference-about-1177x805.png`.
- Normalization: resize the complete source to exactly 50% with aspect ratio
  preserved; no crop, retouching, or layout reconstruction.
- Final implementation capture:
  `design-evidence/final-about-nunito-1177x805.png`.
- Combined full-view comparison:
  `design-evidence/reference-vs-final-about.png`.
- Normalized glyph comparison:
  `design-evidence/font-candidate-comparison.png`.

The source is the English `/about` hero. The screenshot does not contain the
current modernization status strip. The controlled comparison therefore hides
that strip only in the evidence capture; the product keeps the strip because
removing it was not part of the typography request.

## Typography decision

The target glyph and three candidate glyphs were converted to binary masks,
normalized to the same height, centered on equal canvases, and compared by
normalized RMSE:

| Candidate | Normalized RMSE | Result |
| --- | ---: | --- |
| Nunito Sans | `0.313409` | Closest match |
| Avenir Next | `0.352811` | Rejected |
| Fredoka | `0.447944` | Rejected |

The target and Nunito both use the same double-storey lowercase `a`. Fredoka
uses a visibly different single-storey form. The final implementation therefore
uses the bundled Nunito Sans variable font for body, navigation, controls, and
display headings. Local Avenir installation is no longer allowed to override
the shipped font.

## Comparison review

- Typography: target letter construction is matched by Nunito Sans; no Avenir
  or Fredoka dependency remains.
- Font delivery: the local `.woff2` is preloaded, returns `200`, uses
  `font/woff2`, and receives immutable caching.
- Layout: no layout, spacing, color, imagery, border, or interaction was
  intentionally changed for the typography request.
- Expected source-state differences: the attached source is more zoomed and
  wraps the hero title into more lines. The current responsive layout and
  modernization strip remain intentionally unchanged.
- English and Spanish: desktop, tablet, and `320px` layouts keep text inside
  their containers without horizontal overflow.
- Interaction: primary navigation, language switching, mobile navigation,
  hero CTAs, deep links, keyboard focus, and both private executive-preview
  demo flows remain functional.
- Accessibility: automated Axe checks, reduced-motion behavior, forced-colors
  states, skip-link behavior, and keyboard focus checks pass.
- Browser coverage: Chromium, desktop WebKit, mobile WebKit, and Firefox smoke
  coverage passes; Firefox permits only its documented one-CSS-pixel subpixel
  focus-scroll rounding.
- Runtime: production build, font-loading checks, console/page-error monitors,
  private-demo boundaries, and the eight visual baselines pass.

## Severity review

- P0: none.
- P1: none.
- P2: none.

## Final result

passed
