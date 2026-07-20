import type {ComponentType} from 'react';

export type AnimationLanguage = 'en' | 'es';

export interface MovieMetadata {
  readonly stage: Readonly<{width: number; height: number}>;
  readonly fps: number;
  readonly frameCount: number;
  readonly durationMs: number;
}

export interface RuntimeContext {
  readonly frame: number;
  readonly scenario: string;
  readonly lang: AnimationLanguage;
  readonly seed: number;
}

export interface RuntimeScenario {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface AudioCue {
  readonly id: string;
  readonly frame: number;
  readonly language: AnimationLanguage | 'shared';
  readonly source: string;
}

export interface AnimationRendererProps {
  /** The runtime-owned, one-indexed Flash frame. */
  readonly frame: number;
  readonly scenario: string;
  readonly lang: AnimationLanguage;
  readonly seed: number;
  readonly state?: unknown;
  readonly onReplay?: () => void;
}

export interface AnimationModule<State = unknown> {
  readonly key: string;
  readonly movie: MovieMetadata;
  readonly scenarios: readonly RuntimeScenario[];
  readonly audioCues: readonly AudioCue[];
  readonly maturity: 'legacy-prototype' | 'strict-complete';
  readonly Renderer: ComponentType<AnimationRendererProps>;
  readonly getFrameState: (frame: number, context: RuntimeContext) => State;
}
