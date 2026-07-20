'use client';

import {GallonConversionAnimation} from '../vendor/GallonConversionAnimation.jsx';
import {GALLON_FLASH_MOVIE, getGallonFrameState} from '../lib/conversionTimeline.js';

import type {AnimationModule, AnimationRendererProps, RuntimeContext} from '../contract';
import {AccessibleLegacyFrame} from '../legacy-accessible-frame';
import {frameToElapsedMs} from '../runtime';

const scenarios = Object.freeze([{id: 'default', label: 'Default timeline'}]);

function Renderer({frame, lang, onReplay}: AnimationRendererProps) {
  return (
    <AccessibleLegacyFrame kind="gallon" lang={lang} onReplay={onReplay}>
      <GallonConversionAnimation captureFrame={frame} spanishFormulaFlag={lang === 'es' ? 'on' : 'off'} />
    </AccessibleLegacyFrame>
  );
}

const animationModule: AnimationModule = Object.freeze({
  key: 'conversion-1-2',
  movie: GALLON_FLASH_MOVIE,
  scenarios,
  audioCues: Object.freeze([]),
  maturity: 'legacy-prototype',
  Renderer,
  getFrameState(frame: number, context: RuntimeContext) {
    return getGallonFrameState(frameToElapsedMs(frame, GALLON_FLASH_MOVIE), {
      spanishFormulaFlag: context.lang === 'es' ? 'on' : 'off'
    });
  }
});

export default animationModule;
