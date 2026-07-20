"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GALLON_FLASH_MOVIE,
  getGallonFrameState,
  restartGallonTimeline,
} from "../lib/conversionTimeline.js";
import {
  FlashFluidOunces,
  FlashGallonCounter,
  FlashGallonFinalFormula,
} from "./FlashBauhausGallon.jsx";
import { FlashBauhausReplayText } from "./FlashBauhausFormula.jsx";

const ASSET_ROOT = "/flash-assets/conversion-1-2";
const FULL_BOTTLE_SOURCE = [1, 0, 0, 1, 56.8, 144.65];
const EMPTY_BOTTLE_SOURCE = [
  -0.363312, 0.93045, -0.93045, -0.363312, 96.4, 203.6,
];
const GALLON_LEVELS = [0, 0.25, 0.5, 0.75, 1];
const GALLON_LEVEL_ASSETS = ["0", "32", "64", "96", "128"];

function multiplyMatrices(left, right) {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function invertMatrix(matrix) {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function stageImageTransform(target, source) {
  const matrix = multiplyMatrices(target.slice(0, 6), invertMatrix(source));
  return `matrix(${matrix.join(" ")})`;
}

function GallonLayer({ progress }) {
  const scaled = Math.min(4, Math.max(0, progress * 4));
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(4, lowerIndex + 1);
  const blend = scaled - lowerIndex;

  return (
    <g>
      <image
        href={`${ASSET_ROOT}/gallon-${GALLON_LEVEL_ASSETS[lowerIndex]}.png`}
        x="455"
        y="95"
        width="180"
        height="175"
        opacity={1 - blend}
      />
      {upperIndex !== lowerIndex ? (
        <image
          href={`${ASSET_ROOT}/gallon-${GALLON_LEVEL_ASSETS[upperIndex]}.png`}
          x="455"
          y="95"
          width="180"
          height="175"
          opacity={blend}
        />
      ) : null}
    </g>
  );
}

function BottleShadow({ index }) {
  return (
    <ellipse
      cx={103 + index * 72}
      cy="253"
      rx="31"
      ry="8"
      fill="url(#quart-shadow)"
    />
  );
}

function FullBottle({ index, matrix }) {
  const transform = matrix
    ? stageImageTransform(matrix, FULL_BOTTLE_SOURCE)
    : `translate(${index * 72} 0)`;
  return (
    <image
      href={`${ASSET_ROOT}/quart-full-stage.png`}
      width="780"
      height="379"
      transform={transform}
    />
  );
}

function EmptyBottle({ index, matrix, opacity }) {
  const transform = matrix
    ? stageImageTransform(matrix, EMPTY_BOTTLE_SOURCE)
    : `translate(${index * 72} 0)`;
  return (
    <image
      href={`${ASSET_ROOT}/quart-empty-stage.png`}
      width="780"
      height="379"
      transform={transform}
      opacity={opacity}
    />
  );
}

function PouringBottle({ progress, opacity }) {
  const streamOpacity = Math.sin(Math.PI * progress) * opacity;
  return (
    <g opacity={opacity}>
      <path
        d="M526 91 C530 94 532 101 537 108"
        fill="none"
        stroke="#c1dce9"
        strokeLinecap="round"
        strokeWidth="4.2"
        opacity={streamOpacity}
      />
      <image
        href={`${ASSET_ROOT}/quart-pouring-full.png`}
        x="420"
        y="15"
        width="120"
        height="95"
        opacity={1 - progress}
      />
      <image
        href={`${ASSET_ROOT}/quart-pouring-empty.png`}
        x="420"
        y="15"
        width="120"
        height="95"
        opacity={progress}
      />
    </g>
  );
}

function BottleLayer({ bottle }) {
  if (bottle.phase === "full") {
    return (
      <g>
        <BottleShadow index={bottle.index} />
        <FullBottle index={bottle.index} />
      </g>
    );
  }
  if (bottle.phase === "moving") {
    return <FullBottle index={bottle.index} matrix={bottle.matrix} />;
  }
  if (bottle.phase === "pouring") {
    return (
      <PouringBottle
        progress={bottle.pourProgress}
        opacity={bottle.opacity}
      />
    );
  }
  return (
    <EmptyBottle
      index={bottle.index}
      matrix={bottle.matrix}
      opacity={bottle.opacity}
    />
  );
}

function ReplayButton({ opacity, onReplay }) {
  const onKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onReplay();
    }
  };

  return (
    <g
      className="flash-replay"
      opacity={opacity}
      role="button"
      tabIndex={opacity > 0 ? 0 : -1}
      aria-label="Replay animation"
      onClick={onReplay}
      onKeyDown={onKeyDown}
    >
      <rect
        x="678.4"
        y="9.2"
        width="90.5"
        height="20.5"
        rx="10.25"
        fill="#ffffff"
        stroke="#999999"
        strokeWidth="1.5"
      />
      <rect
        x="731.3"
        y="9.2"
        width="37.6"
        height="20.5"
        rx="10.25"
        fill="url(#replay-orange-gallon)"
        stroke="#cd6701"
        strokeWidth="1.5"
      />
      <path
        d="M733 12.1 C741 9.4 758 9.6 766.2 12.2"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.72"
        strokeWidth="1.3"
      />
      <FlashBauhausReplayText />
      <circle
        cx="750.3"
        cy="19.4"
        r="7.1"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.1"
      />
      <path
        d="M747.1 15.4 A5.1 5.1 0 1 1 746.1 22.2 M746.1 22.2 L746.2 18.7 M746.1 22.2 L749.5 21.7"
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.15"
      />
    </g>
  );
}

export function GallonConversionAnimation({
  spanishFormulaFlag = "off",
  captureFrame,
}) {
  const normalizedCaptureFrame = Number.isInteger(captureFrame)
    ? Math.min(GALLON_FLASH_MOVIE.frameCount, Math.max(1, captureFrame))
    : null;
  const capturedElapsedMs = normalizedCaptureFrame
    ? ((normalizedCaptureFrame - 1) * 1000) / GALLON_FLASH_MOVIE.fps + 0.001
    : 0;
  const [runId, setRunId] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(capturedElapsedMs);
  const [isPlaying, setIsPlaying] = useState(normalizedCaptureFrame === null);
  const rafRef = useRef(0);
  const languageOptions = useMemo(
    () => ({ spanishFormulaFlag }),
    [spanishFormulaFlag],
  );
  const frameState = getGallonFrameState(
    normalizedCaptureFrame === null ? elapsedMs : capturedElapsedMs,
    languageOptions,
  );

  useEffect(() => {
    if (normalizedCaptureFrame !== null) return undefined;
    if (!isPlaying) return undefined;
    const startedAt = performance.now() - elapsedMs;

    function tick(now) {
      const nextState = getGallonFrameState(now - startedAt, languageOptions);
      setElapsedMs(nextState.elapsedMs);
      if (nextState.isComplete) {
        setIsPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [capturedElapsedMs, isPlaying, languageOptions, normalizedCaptureFrame, runId]);

  const replay = useCallback(() => {
    if (normalizedCaptureFrame !== null) return;
    const reset = restartGallonTimeline(languageOptions);
    setElapsedMs(reset.elapsedMs);
    setRunId((value) => value + 1);
    setIsPlaying(true);
  }, [languageOptions, normalizedCaptureFrame]);

  return (
    <div className="faithful-conversion gallon-conversion">
      <div
        className="faithful-stage-wrap"
        data-flash-frame={frameState.frame}
      >
        <svg
          className="faithful-stage"
          viewBox="0 0 780 379"
          role="group"
          aria-labelledby="gallon-conversion-title gallon-conversion-desc"
        >
          <title id="gallon-conversion-title">
            1 gallon equals 128 fluid ounces
          </title>
          <desc id="gallon-conversion-desc">
            Four quart bottles pour into a gallon jug as the fluid-ounce total
            increases from 32 to 128.
          </desc>

          <defs>
            <radialGradient id="quart-shadow">
              <stop offset="0" stopColor="#8a8a8a" stopOpacity="0.46" />
              <stop offset="0.55" stopColor="#a8a8a8" stopOpacity="0.22" />
              <stop offset="1" stopColor="#e4e4e4" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="replay-orange-gallon" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ff9900" />
              <stop offset="0.66" stopColor="#ff6600" />
              <stop offset="1" stopColor="#ff9900" />
            </linearGradient>
          </defs>

          <rect width="780" height="379" fill="#e4e4e4" />

          <g>
            <rect
              x="15.15"
              y="322.85"
              width="365.7"
              height="52.8"
              fill="#9fd2df"
              stroke="#1e4e59"
              strokeWidth="0.55"
            />
            <text
              x="29.15"
              y="352.85"
              fill="#000000"
              fontFamily="Verdana, Arial, sans-serif"
              fontSize="16"
            >
              {frameState.formulaText}
            </text>
          </g>

          <GallonLayer progress={frameState.gallonProgress} />

          {frameState.bottles.map((bottle) => (
            <BottleLayer key={bottle.index} bottle={bottle} />
          ))}

          <g opacity={frameState.counterOpacity}>
            <rect
              x="638.95"
              y="181"
              width="87"
              height="53"
              fill="#ffffcc"
              stroke={frameState.counterFlash ? "#ff0000" : "#b8b8a5"}
              strokeWidth={frameState.counterFlash ? "3" : "0.8"}
            />
            <FlashGallonCounter value={frameState.fluidOunces} />
            <FlashFluidOunces opacity={1} />
          </g>

          <g opacity={frameState.formulaOpacity}>
            <rect
              x="425.2"
              y="278.2"
              width="225.4"
              height="26.4"
              rx="13.2"
              fill="#ffff99"
              stroke="#999966"
              strokeWidth="0.55"
            />
          </g>
          <FlashGallonFinalFormula opacity={frameState.formulaOpacity} />
          <ReplayButton opacity={frameState.replayOpacity} onReplay={replay} />
        </svg>

        <span className="sr-only" aria-live="polite">
          Frame {frameState.frame} of {GALLON_FLASH_MOVIE.frameCount}
        </span>
      </div>
    </div>
  );
}
