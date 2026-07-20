'use client';

import {LiterConversionAnimation} from '../vendor/LiterConversionAnimation.jsx';
import {getLiterFrameState, LITER_FLASH_MOVIE} from '../lib/conversionTimeline.js';

import type {AnimationModule, AnimationRendererProps, RuntimeContext} from '../contract';
import {AccessibleLegacyFrame} from '../legacy-accessible-frame';
import {frameToElapsedMs} from '../runtime';

const scenarios = Object.freeze([{id: 'default', label: 'Default timeline'}]);

function Renderer({frame, lang, onReplay}: AnimationRendererProps) {
  return (
    <AccessibleLegacyFrame kind="liter" lang={lang} onReplay={onReplay}>
      <LiterConversionAnimation captureFrame={frame} spanishFormulaFlag={lang === 'es' ? 'on' : 'off'} />
    </AccessibleLegacyFrame>
  );
}

const animationModule: AnimationModule = Object.freeze({
  key: 'conversion-1-4',
  movie: LITER_FLASH_MOVIE,
  scenarios,
  audioCues: Object.freeze([]),
  maturity: 'legacy-prototype',
  Renderer,
  getFrameState(frame: number, context: RuntimeContext) {
    return getLiterFrameState(frameToElapsedMs(frame, LITER_FLASH_MOVIE), {
      spanishFormulaFlag: context.lang === 'es' ? 'on' : 'off'
    });
  }
});

export default animationModule;
