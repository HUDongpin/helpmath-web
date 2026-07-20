export const FLASH_MOVIE = Object.freeze({
  stage: Object.freeze({ width: 780, height: 379 }),
  fps: 12,
  frameCount: 94,
  durationMs: 7833,
});

export const LITER_FLASH_MOVIE = Object.freeze({
  stage: Object.freeze({ width: 780, height: 379 }),
  fps: 12,
  frameCount: 67,
  durationMs: 5583,
});

export const GALLON_FLASH_MOVIE = Object.freeze({
  stage: Object.freeze({ width: 780, height: 379 }),
  fps: 12,
  frameCount: 109,
  durationMs: 9083,
});

const FORMULAS = Object.freeze({
  en: "1 cup = 8 fluid ounces",
  es: "1 taza = 8 onzas líquidas",
});

const LITER_FORMULAS = Object.freeze({
  en: "1 liter = 1000 milliliters",
  es: "1 litro = 1000 mililitros",
});

const GALLON_FORMULAS = Object.freeze({
  en: "1 gallon = 128 fluid ounces",
  es: "1 galón = 128 onzas líquidas",
});

const GALLON_BOTTLE_WINDOWS = Object.freeze([
  Object.freeze({ move: [5, 9], pour: [10, 19], return: [20, 24] }),
  Object.freeze({ move: [19, 24], pour: [25, 35], return: [36, 40] }),
  Object.freeze({ move: [35, 40], pour: [41, 49], return: [50, 55] }),
  Object.freeze({ move: [49, 54], pour: [55, 68], return: [68, 75] }),
]);

const GALLON_MOVE_MATRICES = Object.freeze([
  Object.freeze([
    [0.863403, -0.499786, 0.499786, 0.863403, 147.1, 72.5],
    [0.496841, -0.865601, 0.865601, 0.496841, 237.55, 18.1],
    [0.23793, -0.968826, 0.968826, 0.23793, 342.8, 22.45],
    [-0.035141, -0.997955, 0.997955, -0.035141, 444.25, 30.15],
    [-0.309174, -0.949982, 0.949982, -0.309174, 541.15, 40.55],
  ]),
  Object.freeze([
    [0.937759, -0.342346, 0.342346, 0.937759, 174.8, 97.55],
    [0.760056, -0.64534, 0.64534, 0.760056, 222.45, 58.55],
    [0.492828, -0.867859, 0.867859, 0.492828, 268.65, 27.45],
    [0.233231, -0.969955, 0.969955, 0.233231, 360.85, 30.45],
    [-0.04364, -0.997559, 0.997559, -0.04364, 449.35, 36.9],
    [-0.318253, -0.946915, 0.946915, -0.318253, 533.3, 46.05],
  ]),
  Object.freeze([
    [0.908981, -0.411011, 0.411011, 0.908981, 262.6, 91.1],
    [0.655899, -0.751694, 0.751694, 0.655899, 325.95, 49.3],
    [0.433777, -0.897125, 0.897125, 0.433777, 384.6, 42.7],
    [0.182053, -0.980621, 0.980621, 0.182053, 440.6, 40.05],
    [-0.079361, -0.994705, 0.994705, -0.079361, 493.2, 40.2],
    [-0.341797, -0.937973, 0.937973, -0.341797, 541.7, 42.95],
  ]),
  Object.freeze([
    [0.964661, -0.259125, 0.259125, 0.964661, 311.55, 113.85],
    [0.863449, -0.500351, 0.500351, 0.863449, 351.7, 87.35],
    [0.700958, -0.709549, 0.709549, 0.700958, 392.1, 65.55],
    [0.492325, -0.867294, 0.867294, 0.492325, 431.15, 48.25],
    [0.250198, -0.965683, 0.965683, 0.250198, 467.95, 34.9],
    [-0.009293, -0.998001, 0.998001, -0.009293, 501.55, 24.85],
  ]),
]);

const GALLON_RETURN_MATRICES = Object.freeze([
  Object.freeze([
    [-0.069611, 0.995499, -0.995499, -0.069611, 112.4, 163.6, 0],
    [-0.143585, 0.987335, -0.987335, -0.143585, 108.45, 173.55, 64],
    [-0.216797, 0.973862, -0.973862, -0.216797, 104.45, 183.6, 128],
    [-0.288849, 0.954987, -0.954987, -0.288849, 100.4, 193.65, 192],
    [-0.363312, 0.93045, -0.93045, -0.363312, 96.4, 203.6, 256],
  ]),
  Object.freeze([
    [-0.230194, 0.971344, -0.971344, -0.230194, 179.6, 195.6, 0],
    [-0.26741, 0.961044, -0.961044, -0.26741, 177.6, 197.6, 64],
    [-0.305298, 0.949707, -0.949707, -0.305298, 175.7, 199.6, 128],
    [-0.345749, 0.93576, -0.93576, -0.345749, 173.55, 201.6, 192],
    [-0.383728, 0.922119, -0.922119, -0.383728, 171.6, 203.6, 256],
  ]),
  Object.freeze([
    [-0.190887, 0.979706, -0.979706, -0.190887, 239.6, 187.6, 0],
    [-0.229202, 0.970856, -0.970856, -0.229202, 239.6, 190.75, 51],
    [-0.267471, 0.961029, -0.961029, -0.267471, 239.55, 193.95, 102],
    [-0.305328, 0.949692, -0.949692, -0.305328, 239.65, 197.2, 154],
    [-0.345779, 0.93573, -0.93573, -0.345779, 239.6, 200.4, 205],
    [-0.383728, 0.922119, -0.922119, -0.383728, 239.6, 203.6, 256],
  ]),
  Object.freeze([
    [0.09935, 0.992264, -0.992264, 0.09935, 335.6, 131.6, 0],
    [0.026886, 0.996994, -0.996994, 0.026886, 332.2, 141.9, 37],
    [-0.039688, 0.996735, -0.996735, -0.039688, 328.7, 152.2, 73],
    [-0.109344, 0.991516, -0.991516, -0.109344, 325.3, 162.45, 110],
    [-0.178513, 0.98143, -0.98143, -0.178513, 321.9, 172.75, 146],
    [-0.249985, 0.965698, -0.965698, -0.249985, 318.4, 183.05, 183],
    [-0.317047, 0.945847, -0.945847, -0.317047, 315.05, 193.35, 219],
    [-0.383728, 0.922119, -0.922119, -0.383728, 311.6, 203.6, 256],
  ]),
]);

const GALLON_COUNTER_FLASH_FRAMES = new Set([
  17, 19, 21, 34, 36, 38, 51, 53, 55, 66, 68, 70,
]);

const CUP_WALLS = Object.freeze({
  topY: 148,
  bottomY: 270,
  leftTopX: 462,
  leftBottomX: 486,
  rightTopX: 582,
  rightBottomX: 558,
});

const LITER_CYLINDER = Object.freeze({
  x: 72,
  y: 66,
  width: 72,
  height: 174,
  bottomY: 236.55,
  emptySurfaceY: 233.95,
  fullSurfaceY: 77.45,
});

const LITER_SURFACE_TWIPS = Object.freeze([
  4679, 4576, 4473, 4369, 4266, 4163, 4060, 3957, 3853, 3750, 3647,
  3544, 3440, 3337, 3234, 3131, 3028, 2924, 2821, 2718, 2615, 2512,
  2408, 2305, 2202, 2099, 1995, 1892, 1789, 1709, 1629, 1549,
]);

const LITER_MARKS = Object.freeze([
  ["100", 225.05, 228.6],
  ["200", 208.05, 212.05],
  ["300", 191.55, 195.55],
  ["400", 175.05, 179.05],
  ["500", 158.55, 162.55],
  ["600", 142.05, 146.05],
  ["700", 125.55, 129.55],
  ["800", 109.0, 113.05],
  ["900", 93.0, 96.55],
  ["1,000", 76.5, 80.05],
]);

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function flashAlpha(value) {
  return Math.round(clamp(value) * 256) / 256;
}

function literPitcherOpacity(frame) {
  if (frame <= 6) return flashAlpha((frame - 1) / 5);
  if (frame < 55) return 1;
  if (frame <= 59) return flashAlpha((59 - frame) / 5);
  return 0;
}

function literPourOpacity(frame) {
  if (frame < 5 || frame > 42) return 0;
  if (frame <= 39) return 1;
  return flashAlpha((42 - frame) / 3);
}

function literFormulaOpacity(frame) {
  if (frame < 43) return 0;
  return flashAlpha((frame - 43) / 8);
}

function literReplayOpacity(frame) {
  if (frame < 59) return 0;
  return flashAlpha((frame - 59) / 8);
}

function literSurfaceY(frame) {
  if (frame < 8) return LITER_CYLINDER.emptySurfaceY;
  if (frame > 39) return LITER_CYLINDER.fullSurfaceY;
  return LITER_SURFACE_TWIPS[frame - 8] / 20;
}

function interpolateAtY(startX, startY, endX, endY, y) {
  return startX + ((y - startY) / (endY - startY)) * (endX - startX);
}

export function getFormulaText({ spanishFormulaFlag } = {}) {
  return String(spanishFormulaFlag ?? "").toUpperCase() === "ON"
    ? FORMULAS.es
    : FORMULAS.en;
}

export function getLiterFormulaText({ spanishFormulaFlag } = {}) {
  return String(spanishFormulaFlag ?? "").toUpperCase() === "ON"
    ? LITER_FORMULAS.es
    : LITER_FORMULAS.en;
}

export function getGallonFormulaText({ spanishFormulaFlag } = {}) {
  return String(spanishFormulaFlag ?? "").toUpperCase() === "ON"
    ? GALLON_FORMULAS.es
    : GALLON_FORMULAS.en;
}

function frameFromElapsedForMovie(elapsedMs, movie) {
  const frameDurationMs = 1000 / movie.fps;
  return Math.min(
    movie.frameCount,
    Math.max(1, Math.round(Math.max(0, elapsedMs) / frameDurationMs)),
  );
}

function exactFlashFrameFromElapsed(elapsedMs, movie) {
  const frameDurationMs = 1000 / movie.fps;
  return Math.min(
    movie.frameCount,
    Math.max(1, Math.floor(Math.max(0, elapsedMs) / frameDurationMs) + 1),
  );
}

export function frameFromElapsed(elapsedMs) {
  return frameFromElapsedForMovie(elapsedMs, FLASH_MOVIE);
}

export function getConversionFrameState(elapsedMs, options = {}) {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const frame = frameFromElapsed(safeElapsed);
  const isComplete = safeElapsed >= FLASH_MOVIE.durationMs || frame >= 94;
  const pourProgress = clamp((frame - 15) / 40);

  return {
    elapsedMs: isComplete ? FLASH_MOVIE.durationMs : safeElapsed,
    frame,
    progress: clamp(safeElapsed / FLASH_MOVIE.durationMs),
    isComplete,
    formulaText: getFormulaText(options),
    milkCartonVisible: frame < 86,
    formulaVisible: frame >= 1,
    pourVisible: frame >= 15 && frame < 67,
    pourProgress,
    cupFillLevel: pourProgress,
    ouncesLabelVisible: frame >= 45,
    finalFormulaVisible: frame >= 73,
    replayVisible: frame >= 86 || isComplete,
    cupHighlight: frame >= 57,
  };
}

export function getLiterFrameState(elapsedMs, options = {}) {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const frame = exactFlashFrameFromElapsed(safeElapsed, LITER_FLASH_MOVIE);
  const isComplete =
    safeElapsed >= LITER_FLASH_MOVIE.durationMs ||
    frame >= LITER_FLASH_MOVIE.frameCount;
  const surfaceY = literSurfaceY(frame);
  const fillProgress = clamp(
    (LITER_CYLINDER.emptySurfaceY - surfaceY) /
      (LITER_CYLINDER.emptySurfaceY - LITER_CYLINDER.fullSurfaceY),
  );
  const pitcherOpacity = literPitcherOpacity(frame);
  const pourOpacity = literPourOpacity(frame);
  const formulaOpacity = literFormulaOpacity(frame);
  const replayOpacity = literReplayOpacity(frame);

  return {
    elapsedMs: isComplete ? LITER_FLASH_MOVIE.durationMs : safeElapsed,
    frame,
    progress: clamp(safeElapsed / LITER_FLASH_MOVIE.durationMs),
    isComplete,
    formulaText: getLiterFormulaText(options),
    fillVisible: frame >= 8,
    fillProgress,
    surfaceY,
    emptySurfaceY: LITER_CYLINDER.emptySurfaceY,
    fullSurfaceY: LITER_CYLINDER.fullSurfaceY,
    cylinderBottomY: LITER_CYLINDER.bottomY,
    pitcherOpacity,
    pourOpacity,
    formulaOpacity,
    replayOpacity,
    finalFormulaVisible: formulaOpacity > 0,
    replayVisible: replayOpacity > 0 || isComplete,
    scaleHighlightVisible: false,
  };
}

function gallonBottlePhase(frame, index) {
  const window = GALLON_BOTTLE_WINDOWS[index];
  if (frame < window.move[0]) return "full";
  if (frame <= window.move[1]) return "moving";
  if (frame <= window.return[1] && frame >= window.return[0]) return "returning";
  if (frame <= window.pour[1] && frame >= window.pour[0]) return "pouring";
  return "empty";
}

function gallonBottleState(frame, index) {
  const window = GALLON_BOTTLE_WINDOWS[index];
  const phase = gallonBottlePhase(frame, index);
  let matrix = null;
  let opacity = 1;
  let pourProgress = 0;

  if (phase === "moving") {
    matrix = GALLON_MOVE_MATRICES[index][frame - window.move[0]];
  } else if (phase === "pouring") {
    pourProgress = clamp(
      (frame - window.pour[0]) / (window.pour[1] - window.pour[0]),
    );
    if (index === 3 && frame >= 65) {
      opacity = flashAlpha((68 - frame) / 3);
    }
  } else if (phase === "returning") {
    matrix = GALLON_RETURN_MATRICES[index][frame - window.return[0]];
    opacity = (matrix?.[6] ?? 256) / 256;
  }

  return Object.freeze({ index, phase, matrix, opacity, pourProgress });
}

function gallonFillProgress(frame) {
  if (frame < 10) return 0;
  if (frame <= 17) return 0.25 * clamp((frame - 10) / 7);
  if (frame < 25) return 0.25;
  if (frame <= 33) return 0.25 + 0.25 * clamp((frame - 25) / 8);
  if (frame < 41) return 0.5;
  if (frame <= 49) return 0.5 + 0.25 * clamp((frame - 41) / 8);
  if (frame < 55) return 0.75;
  if (frame <= 65) return 0.75 + 0.25 * clamp((frame - 55) / 10);
  return 1;
}

function gallonFluidOunces(frame) {
  if (frame < 17) return null;
  if (frame < 34) return 32;
  if (frame < 51) return 64;
  if (frame < 66) return 96;
  return 128;
}

export function getGallonFrameState(elapsedMs, options = {}) {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const frame = exactFlashFrameFromElapsed(safeElapsed, GALLON_FLASH_MOVIE);
  const isComplete =
    safeElapsed >= GALLON_FLASH_MOVIE.durationMs ||
    frame >= GALLON_FLASH_MOVIE.frameCount;

  return {
    elapsedMs: isComplete ? GALLON_FLASH_MOVIE.durationMs : safeElapsed,
    frame,
    progress: clamp(safeElapsed / GALLON_FLASH_MOVIE.durationMs),
    isComplete,
    formulaText: getGallonFormulaText(options),
    bottles: [0, 1, 2, 3].map((index) => gallonBottleState(frame, index)),
    gallonProgress: gallonFillProgress(frame),
    fluidOunces: gallonFluidOunces(frame),
    counterOpacity:
      frame < 7 ? 0 : frame >= 14 ? 1 : flashAlpha((frame - 7) / 7),
    counterFlash: GALLON_COUNTER_FLASH_FRAMES.has(frame),
    formulaOpacity:
      frame < 88 ? 0 : frame >= 100 ? 1 : flashAlpha((frame - 88) / 12),
    replayOpacity:
      frame < 101 ? 0 : flashAlpha((frame - 101) / 8),
  };
}

export function getCupMeasureMarks() {
  return [1, 2, 3].map((value) => {
    const y = 248 - value * 30;
    const leftWallX = interpolateAtY(
      CUP_WALLS.leftTopX,
      CUP_WALLS.topY,
      CUP_WALLS.leftBottomX,
      CUP_WALLS.bottomY,
      y,
    );
    const rightWallX = interpolateAtY(
      CUP_WALLS.rightTopX,
      CUP_WALLS.topY,
      CUP_WALLS.rightBottomX,
      CUP_WALLS.bottomY,
      y,
    );
    const labelX = Math.round(leftWallX + 17);
    const lineX1 = Math.round(leftWallX + 42);
    const preferredLineX2 = lineX1 + (value === 3 ? 54 : 46);

    return {
      value,
      y,
      labelX,
      leftWallX,
      rightWallX,
      lineX1,
      lineX2: Math.round(Math.min(rightWallX - 16, preferredLineX2)),
    };
  });
}

export function getGraduatedCylinderMarks() {
  return LITER_MARKS.map(([label, y, tickY], index) => ({
    value: (index + 1) * 100,
    label,
    y,
    textY: y + 8,
    labelX: 105.75,
    tickY,
    tickX1: 84.35,
    tickX2: 128.15,
  }));
}

export function restartTimeline(options = {}) {
  return getConversionFrameState(0, options);
}

export function restartLiterTimeline(options = {}) {
  return getLiterFrameState(0, options);
}

export function restartGallonTimeline(options = {}) {
  return getGallonFrameState(0, options);
}
