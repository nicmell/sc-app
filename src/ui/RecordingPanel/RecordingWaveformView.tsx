/**
 * Per-recording waveform canvas. Reads the controller's envelope
 * buffer (per-tick min/max columns, populated by the internal "tap
 * scope" on the input bus) and renders a min/max polyline
 * representation across `windowSeconds` of recorded time.
 *
 * Auto-advance ↔ scroll behaviour mirrors the spec:
 *
 *  - Live (clock running AND recording active): the right edge of
 *    the visible window tracks the latest envelope column. The user
 *    cannot scroll — wheel and drag are no-ops.
 *  - Stopped (clock paused OR recording finished): the user can
 *    scroll back through the entire history via mousewheel or click-
 *    drag. `scrollOffsetTicks` measures how many ticks the right
 *    edge sits behind the latest column.
 *  - Resume from stopped → live: `scrollOffsetTicks` snaps back to 0
 *    so the playhead jumps to the right edge again.
 *
 * Rendering is RAF-driven. The component reads the envelope snapshot
 * fresh each frame (no React state for chunk data — would force ~48
 * re-renders/sec). `useState` is reserved for control surfaces:
 * scroll position, live mode, window size.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ClockController } from '@/scope/ClockController';
import type { RecordingController } from '@/recording/RecordingController';

const DEFAULT_PALETTE = ['#6ac46f', '#c4a06f', '#6f9fc4', '#c46f9f'];

const DEFAULT_BACKGROUND = '#15171b';
const DEFAULT_GRID_COLOR = '#262930';
const DEFAULT_PLAYHEAD_COLOR = '#e4b86a';
const DEFAULT_GRID_LABEL_COLOR = '#5a5e68';

export interface RecordingWaveformViewProps {
  recording: RecordingController;
  clock: ClockController;
  /** Seconds of recorded audio shown across the canvas. Default 5. */
  windowSeconds: number;
  /** Canvas pixel height. Default 120. */
  height?: number;
  /** Per-channel stroke colours. Cycles if the recording has more
   *  channels than the array's length. */
  channelColors?: string[];
  background?: string;
  gridColor?: string;
  playheadColor?: string;
}

interface ViewportControls {
  /** Snap the right edge back to the latest envelope column. */
  goLive: () => void;
  /** Whether the user is currently scrolled away from live. */
  isLive: boolean;
  /** Whether scrolling input (wheel / drag) is permitted right now —
   *  i.e. clock paused OR recording finished. */
  canScroll: boolean;
}

export function useWaveformViewport(
  recording: RecordingController,
  clock: ClockController,
): ViewportControls & {
  scrollOffsetTicks: number;
  setScrollOffsetTicks: (n: number | ((prev: number) => number)) => void;
} {
  const recState = useSyncExternalStore(
    (cb) => recording.state.subscribe(cb),
    () => recording.state.get(),
  );
  const clockState = useSyncExternalStore(
    (cb) => clock.effectiveState.subscribe(cb),
    () => clock.effectiveState.get(),
  );

  // canScroll: user-driven scroll input is permitted only when nothing
  // is actively pumping the playhead forward.
  const canScroll = clockState !== 'running' || recState !== 'recording';
  const [scrollOffsetTicks, setScrollOffsetTicks] = useState(0);

  // When canScroll flips from true → false (clock resumes while
  // recording is recording), snap back to live. The user's previous
  // scroll position is intentionally discarded — per spec, scroll
  // is a feature of the stopped state, not a parallel timeline.
  const wasScrollableRef = useRef(canScroll);
  useEffect(() => {
    if (wasScrollableRef.current && !canScroll) {
      setScrollOffsetTicks(0);
    }
    wasScrollableRef.current = canScroll;
  }, [canScroll]);

  const goLive = useCallback(() => setScrollOffsetTicks(0), []);

  return {
    scrollOffsetTicks,
    setScrollOffsetTicks,
    canScroll,
    isLive: scrollOffsetTicks === 0,
    goLive,
  };
}

export function RecordingWaveformView({
  recording,
  clock,
  windowSeconds,
  height = 120,
  channelColors = DEFAULT_PALETTE,
  background = DEFAULT_BACKGROUND,
  gridColor = DEFAULT_GRID_COLOR,
  playheadColor = DEFAULT_PLAYHEAD_COLOR,
}: RecordingWaveformViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewport = useWaveformViewport(recording, clock);

  const tickRate = clock.params.tickRate;
  const windowTicks = useMemo(
    () => Math.max(1, Math.round(windowSeconds * tickRate)),
    [windowSeconds, tickRate],
  );

  // Mirror controls into a ref so the RAF loop reads the latest
  // values without re-binding every render.
  const stateRef = useRef({
    windowTicks,
    scrollOffsetTicks: viewport.scrollOffsetTicks,
    canScroll: viewport.canScroll,
    background,
    gridColor,
    playheadColor,
    channelColors,
  });
  stateRef.current = {
    windowTicks,
    scrollOffsetTicks: viewport.scrollOffsetTicks,
    canScroll: viewport.canScroll,
    background,
    gridColor,
    playheadColor,
    channelColors,
  };

  // Wheel + drag handlers: only mutate scrollOffset when canScroll.
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!stateRef.current.canScroll) return;
      // Either deltaY (vertical wheel) or deltaX (trackpad pan): both
      // map to "scroll back in time" for positive values. Clamp to a
      // sensible per-event range so a single wheel notch doesn't
      // jump the entire window.
      const dominant =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const cssWidth = canvasRef.current?.getBoundingClientRect().width ?? 1;
      const pxPerTick = cssWidth / Math.max(1, stateRef.current.windowTicks);
      const dTicks = Math.round(dominant / Math.max(0.5, pxPerTick));
      if (dTicks === 0) return;
      e.preventDefault();
      viewport.setScrollOffsetTicks((prev) => Math.max(0, prev + dTicks));
    },
    [viewport],
  );

  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!stateRef.current.canScroll) return;
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startOffset: viewport.scrollOffsetTicks,
      };
    },
    [viewport.scrollOffsetTicks],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !stateRef.current.canScroll) return;
      const cssWidth = canvasRef.current?.getBoundingClientRect().width ?? 1;
      const pxPerTick = cssWidth / Math.max(1, stateRef.current.windowTicks);
      // Drag-right pulls earlier content rightward → we're moving
      // backward in time → increase scrollOffset.
      const dTicks = Math.round((drag.startX - e.clientX) / Math.max(0.5, pxPerTick));
      viewport.setScrollOffsetTicks(Math.max(0, drag.startOffset + dTicks));
    },
    [viewport],
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer may have already been released */
      }
    },
    [],
  );

  // RAF render loop. Re-binds whenever `height` changes (since the
  // canvas size depends on it via CSS). Reads the envelope snapshot
  // fresh each frame — no chunk data in React state.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextDpr = window.devicePixelRatio || 1;
      const nextW = Math.max(1, Math.round(rect.width));
      const nextH = Math.max(1, Math.round(rect.height));
      if (nextW === cssWidth && nextH === cssHeight && nextDpr === dpr) return;
      cssWidth = nextW;
      cssHeight = nextH;
      dpr = nextDpr;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const env = recording.envelopes.get();
      const channels = env.channels;
      const {
        windowTicks: winTicks,
        scrollOffsetTicks,
        background: bg,
        gridColor: grid,
        playheadColor: ph,
        channelColors: cols,
      } = stateRef.current;

      // Background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      if (env.count === 0) {
        // Pre-recording / pre-first-chunk — just zero lines per lane.
        drawZeroLines(ctx, cssWidth, cssHeight, channels, grid);
        return;
      }

      const latestTickIndex = env.firstTickIndex + env.count - 1;
      // Right edge tick of the visible window.
      const viewRightTick = latestTickIndex - scrollOffsetTicks;
      const viewLeftTick = viewRightTick - winTicks + 1;
      const pxPerTick = cssWidth / winTicks;

      drawGridlines(
        ctx,
        cssHeight,
        viewLeftTick,
        viewRightTick,
        env.firstTickIndex,
        tickRate,
        pxPerTick,
        grid,
      );
      drawZeroLines(ctx, cssWidth, cssHeight, channels, grid);

      drawWaveform(
        ctx,
        cssWidth,
        cssHeight,
        env,
        viewLeftTick,
        viewRightTick,
        pxPerTick,
        cols,
      );
      drawPlayhead(
        ctx,
        cssWidth,
        cssHeight,
        latestTickIndex,
        viewLeftTick,
        pxPerTick,
        ph,
      );
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, height, tickRate]);

  return (
    <div
      ref={containerRef}
      className="recording-waveform"
      style={{ height }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-can-scroll={viewport.canScroll}
    >
      <canvas ref={canvasRef} />
      {!viewport.isLive && (
        <button
          type="button"
          className="waveform-live-button"
          onClick={viewport.goLive}
          title="Snap back to the live edge"
        >
          Live
        </button>
      )}
    </div>
  );
}

// ── Drawing helpers ─────────────────────────────────────────────────

function drawZeroLines(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  channels: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const laneH = h / channels;
  for (let c = 0; c < channels; c++) {
    const y = c * laneH + laneH / 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawGridlines(
  ctx: CanvasRenderingContext2D,
  h: number,
  viewLeftTick: number,
  viewRightTick: number,
  firstTickIndex: number,
  tickRate: number,
  pxPerTick: number,
  color: string,
): void {
  // Gridlines at integer-second boundaries relative to the recording's
  // first tick. Skip when the window is so narrow that lines would
  // pile up (< 8 px apart).
  const pxPerSec = pxPerTick * tickRate;
  if (pxPerSec < 16) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = DEFAULT_GRID_LABEL_COLOR;
  ctx.lineWidth = 1;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textBaseline = 'top';

  // Find first second boundary at or after viewLeftTick.
  const firstSec = Math.ceil((viewLeftTick - firstTickIndex) / tickRate);
  const lastSec = Math.floor((viewRightTick - firstTickIndex) / tickRate);
  for (let s = firstSec; s <= lastSec; s++) {
    if (s < 0) continue;
    const tickAt = firstTickIndex + s * tickRate;
    const x = (tickAt - viewLeftTick) * pxPerTick;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillText(`${s}.0s`, x + 3, 2);
  }
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  env: ReturnType<RecordingController['envelopes']['get']>,
  viewLeftTick: number,
  viewRightTick: number,
  pxPerTick: number,
  channelColors: string[],
): void {
  const { mins, maxs, firstTickIndex, count, channels } = env;
  const laneH = h / channels;
  const totalCols = Math.ceil(w);

  for (let c = 0; c < channels; c++) {
    const y0 = c * laneH;
    const halfH = laneH / 2;
    const cy = y0 + halfH;
    ctx.fillStyle = channelColors[c % channelColors.length];

    if (pxPerTick >= 1) {
      // One tick = one or more pixels. Draw a vertical line per tick
      // from min to max.
      for (let t = viewLeftTick; t <= viewRightTick; t++) {
        const ord = t - firstTickIndex;
        if (ord < 0 || ord >= count) continue;
        const x = (t - viewLeftTick) * pxPerTick;
        const yMin = cy - mins[c][ord] * halfH;
        const yMax = cy - maxs[c][ord] * halfH;
        // 2-pixel wide bar so the polyline reads as a continuous
        // shape even at modest zoom levels.
        ctx.fillRect(x, Math.min(yMax, yMin), Math.max(1, pxPerTick), Math.max(1, Math.abs(yMax - yMin)));
      }
    } else {
      // Multiple ticks per pixel. For each pixel column, merge mins/
      // maxs across the ticks that map into it.
      for (let px = 0; px < totalCols; px++) {
        const tStart = viewLeftTick + Math.floor(px / pxPerTick);
        const tEnd =
          viewLeftTick + Math.floor((px + 1) / pxPerTick) - 1;
        let mn = Infinity;
        let mx = -Infinity;
        for (let t = tStart; t <= tEnd; t++) {
          const ord = t - firstTickIndex;
          if (ord < 0 || ord >= count) continue;
          if (mins[c][ord] < mn) mn = mins[c][ord];
          if (maxs[c][ord] > mx) mx = maxs[c][ord];
        }
        if (mn === Infinity) continue;
        const yMin = cy - mn * halfH;
        const yMax = cy - mx * halfH;
        ctx.fillRect(px, Math.min(yMin, yMax), 1, Math.max(1, Math.abs(yMax - yMin)));
      }
    }
  }
}

function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  latestTickIndex: number,
  viewLeftTick: number,
  pxPerTick: number,
  color: string,
): void {
  const x = (latestTickIndex - viewLeftTick) * pxPerTick;
  if (x < 0 || x > w) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
}
