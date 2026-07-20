import type {
  AnimationLanguage,
  MovieMetadata,
  RuntimeContext,
  RuntimeScenario
} from './contract';

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function clampFrame(frame: number, frameCount: number): number {
  if (!Number.isFinite(frame) || !Number.isFinite(frameCount) || frameCount < 1) {
    return 1;
  }

  return Math.min(Math.trunc(frameCount), Math.max(1, Math.trunc(frame)));
}

export function parseFrame(value: QueryValue, frameCount: number): number | undefined {
  const raw = first(value)?.trim();
  if (!raw || !/^\d+$/.test(raw)) return undefined;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return undefined;
  return clampFrame(parsed, frameCount);
}

export function parseLanguage(value: QueryValue): AnimationLanguage {
  return first(value)?.toLowerCase() === 'es' ? 'es' : 'en';
}

export function parseSeed(value: QueryValue): number {
  const raw = first(value)?.trim();
  if (!raw || !/^-?\d+$/.test(raw)) return 0;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return 0;
  return parsed >>> 0;
}

export function parseScenario(
  value: QueryValue,
  scenarios: readonly RuntimeScenario[]
): string {
  const fallback = scenarios[0]?.id ?? 'default';
  const requested = first(value)?.trim();
  return scenarios.some((scenario) => scenario.id === requested) ? requested! : fallback;
}

export function frameToElapsedMs(frame: number, movie: MovieMetadata): number {
  const normalized = clampFrame(frame, movie.frameCount);
  return ((normalized - 1) * 1000) / movie.fps + 0.001;
}

export function createRuntimeContext(
  query: {frame?: QueryValue; scenario?: QueryValue; lang?: QueryValue; seed?: QueryValue},
  movie: MovieMetadata,
  scenarios: readonly RuntimeScenario[]
): RuntimeContext & {readonly captureFrame?: number} {
  const captureFrame = parseFrame(query.frame, movie.frameCount);
  return {
    frame: captureFrame ?? 1,
    captureFrame,
    scenario: parseScenario(query.scenario, scenarios),
    lang: parseLanguage(query.lang),
    seed: parseSeed(query.seed)
  };
}
