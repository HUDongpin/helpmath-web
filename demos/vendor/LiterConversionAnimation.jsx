"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LITER_FLASH_MOVIE,
  getGraduatedCylinderMarks,
  getLiterFrameState,
  restartLiterTimeline,
} from "../lib/conversionTimeline.js";
import {
  FlashBauhausFormula,
  FlashBauhausReplayText,
} from "./FlashBauhausFormula.jsx";

const cylinderMarks = getGraduatedCylinderMarks();

function ScaleMark({ mark }) {
  return (
    <g>
      <path
        d={`M ${mark.tickX1} ${mark.tickY} C 91 ${mark.tickY + 3.2}, 116 ${mark.tickY + 3.2}, ${mark.tickX2} ${mark.tickY}`}
        fill="none"
        stroke="#333333"
        strokeOpacity="0.58"
        strokeWidth="0.55"
      />
      <text
        x={mark.labelX}
        y={mark.textY}
        fill="#000000"
        fontFamily="Verdana, Arial, sans-serif"
        fontSize="8"
      >
        {mark.label}
      </text>
    </g>
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
        fill="url(#replay-orange)"
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

export function LiterConversionAnimation({
  spanishFormulaFlag = "off",
  captureFrame,
}) {
  const normalizedCaptureFrame = Number.isInteger(captureFrame)
    ? Math.min(LITER_FLASH_MOVIE.frameCount, Math.max(1, captureFrame))
    : null;
  const capturedElapsedMs = normalizedCaptureFrame
    ? ((normalizedCaptureFrame - 1) * 1000) / LITER_FLASH_MOVIE.fps + 0.001
    : 0;
  const [runId, setRunId] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(capturedElapsedMs);
  const [isPlaying, setIsPlaying] = useState(normalizedCaptureFrame === null);
  const rafRef = useRef(0);

  const languageOptions = useMemo(
    () => ({ spanishFormulaFlag }),
    [spanishFormulaFlag],
  );
  const frameState = getLiterFrameState(
    normalizedCaptureFrame === null ? elapsedMs : capturedElapsedMs,
    languageOptions,
  );

  useEffect(() => {
    if (normalizedCaptureFrame !== null) return undefined;
    if (!isPlaying) return undefined;

    const startedAt = performance.now() - elapsedMs;

    function tick(now) {
      const nextState = getLiterFrameState(now - startedAt, languageOptions);
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
    const reset = restartLiterTimeline(languageOptions);
    setElapsedMs(reset.elapsedMs);
    setRunId((value) => value + 1);
    setIsPlaying(true);
  }, [languageOptions, normalizedCaptureFrame]);

  const spanishFormula = frameState.formulaText.startsWith("1 litro");
  const panelFill = spanishFormula ? "#b4dc9c" : "#9fd2df";
  const liquidBottom = 245.1;
  const surfaceY = frameState.surfaceY;

  return (
    <div className="faithful-conversion">
      <div
        className="faithful-stage-wrap"
        data-flash-frame={frameState.frame}
      >
        <svg
          className="faithful-stage"
          viewBox="0 0 780 379"
          role="group"
          aria-labelledby="liter-conversion-title liter-conversion-desc"
        >
          <title id="liter-conversion-title">
            1 liter equals 1000 milliliters
          </title>
          <desc id="liter-conversion-desc">
            A pitcher fills a graduated cylinder to one liter, then the conversion
            formula and Replay button appear.
          </desc>

          <defs>
            <linearGradient id="replay-orange" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ff9900" />
              <stop offset="0.66" stopColor="#ff6600" />
              <stop offset="1" stopColor="#ff9900" />
            </linearGradient>
            <linearGradient id="glass-shine-faithful" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.69" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
            </linearGradient>
            <clipPath id="cylinder-interior">
              <path d="M84.4 60.7 C88 64.6 96 66 106 66 C116 66 124.8 64 128.15 59.4 L128.15 245.1 L84.4 244.4 Z" />
            </clipPath>
          </defs>

          <rect width="780" height="379" fill="#e4e4e4" />

          <g className="bottom-formula-panel">
            <rect
              x="15.15"
              y="290.85"
              width="365.7"
              height="52.8"
              fill={panelFill}
              stroke="#1e4e59"
              strokeWidth="0.55"
            />
            <text
              x="29.15"
              y="320.85"
              fill="#000000"
              fontFamily="Verdana, Arial, sans-serif"
              fontSize="16"
            >
              {frameState.formulaText}
            </text>
          </g>

          <image
            href="/flash-assets/pitcher-back.png"
            width="780"
            height="379"
            opacity={frameState.pitcherOpacity}
          />

          <image
            href="/flash-assets/cylinder-base.png"
            width="780"
            height="379"
          />

          {frameState.fillVisible ? (
            <g clipPath="url(#cylinder-interior)">
              <path
                d={`M84.4 ${surfaceY} C92 ${surfaceY + 3.2}, 116 ${surfaceY + 3.2}, 128.15 ${surfaceY} L128.15 ${liquidBottom} L84.4 ${liquidBottom} Z`}
                fill="#8fbfde"
              />
              <path
                d={`M84.4 ${surfaceY} C92 ${surfaceY + 3.2}, 116 ${surfaceY + 3.2}, 128.15 ${surfaceY}`}
                fill="none"
                stroke="#6faed3"
                strokeWidth="0.65"
              />
            </g>
          ) : null}

          <path
            d={`M66 18 C72 25, 73 39, 85 49 C98 60, 101 ${Math.max(64, surfaceY - 12)}, 103 ${surfaceY + 1}`}
            fill="none"
            stroke="#8fbfde"
            strokeLinecap="round"
            strokeWidth="13.5"
            opacity={frameState.pourOpacity}
          />

          <path
            d="M84.4 60.7 L84.4 244.4 C84.45 246.7 90.75 248.25 99.8 248.25 L112 248.25 C121.6 248.25 128.1 246.4 128.15 244.1 L128.15 59.4 C124.8 63.6 116 65.6 106 65.6 C96 65.6 88 64.3 84.4 60.7 Z"
            fill="url(#glass-shine-faithful)"
          />

          {cylinderMarks.map((mark) => (
            <ScaleMark key={mark.value} mark={mark} />
          ))}

          <text
            x="99.75"
            y="75"
            fill="#000000"
            fontFamily="Verdana, Arial, sans-serif"
            fontSize="8"
            fontWeight="700"
          >
            L
          </text>

          <image
            href="/flash-assets/pitcher-front.png"
            width="780"
            height="379"
            opacity={frameState.pitcherOpacity}
          />

          <FlashBauhausFormula opacity={frameState.formulaOpacity} />
          <ReplayButton opacity={frameState.replayOpacity} onReplay={replay} />
        </svg>

        <span className="sr-only" aria-live="polite">
          Frame {frameState.frame} of {LITER_FLASH_MOVIE.frameCount}
        </span>
      </div>
    </div>
  );
}
