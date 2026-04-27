import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { BufferChunk } from '@/server/workerProtocol';
import './ScopeView.scss';

type ScopeLayout = 'stacked' | 'overlay';

/** Discrete zoom factors. `1` = full chunk visible; smaller fractions
 *  zoom in to a sub-slice of the most recent chunk. We don't go above
 *  `1` (no rolling history buffer — `1×` is the natural maximum). */
const ZOOM_LEVELS = [1, 1 / 2, 1 / 4, 1 / 8] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];

const DEFAULT_PALETTE = ['#6ac46f', '#c4a06f', '#6f9fc4', '#c46f9f'];

const DEFAULTS = {
  gain: 1,
  background: '#15171b',
  height: 200,
  zeroLineStyle: '#262930',
};

export interface ScopeViewProps {
  /** Mutable ref pointing at the latest scope chunk. The owner
   *  (typically the panel managing the subscription) writes new
   *  chunks here as they arrive; this component reads `current`
   *  once per animation frame and redraws. */
  chunkRef: RefObject<BufferChunk | null>;
  /** Effective sample rate — used to display the visible window
   *  size in milliseconds in the corner readout. Typically
   *  `scope.effectiveRate`. */
  effectiveRate: number;
  /** Number of samples per channel in a chunk — used to derive the
   *  visible-sample count from the zoom factor.
   *  Typically `scope.detail.chunkSize`. */
  samplesPerChunk: number;
  /** Vertical scale factor applied to the raw sample values
   *  before mapping `[-1, 1] → lane vertical extent`. Default 1. */
  gain?: number;
  /** Per-channel stroke colours. Cycles if the chunk has more
   *  channels than the array's length. */
  channelColors?: string[];
  /** Background fill cleared each frame. */
  background?: string;
  /** Pixel height in CSS px. Width fills the parent. Default 200. */
  height?: number;
  /** Optional zero-line stroke colour per lane. `null` disables. */
  zeroLineStyle?: string | null;
}

export function ScopeView({
  chunkRef,
  effectiveRate,
  samplesPerChunk,
  gain = DEFAULTS.gain,
  channelColors = DEFAULT_PALETTE,
  background = DEFAULTS.background,
  height = DEFAULTS.height,
  zeroLineStyle = DEFAULTS.zeroLineStyle,
}: ScopeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [layout, setLayout] = useState<ScopeLayout>('stacked');
  const [zoomFactor, setZoomFactor] = useState<ZoomLevel>(1);

  // Mirror visual state into refs so the RAF loop stays stable
  // across re-renders — we don't want to cancel + restart it on
  // every gain / zoom / layout tick.
  const styleRef = useRef({
    gain,
    background,
    zeroLineStyle,
    channelColors,
    layout,
    zoomFactor,
  });
  styleRef.current = {
    gain,
    background,
    zeroLineStyle,
    channelColors,
    layout,
    zoomFactor,
  };

  const windowMs = useMemo(
    () => (samplesPerChunk * zoomFactor * 1000) / effectiveRate,
    [samplesPerChunk, zoomFactor, effectiveRate],
  );

  const zoomIdx = ZOOM_LEVELS.indexOf(zoomFactor);
  const canZoomIn = zoomIdx < ZOOM_LEVELS.length - 1;
  const canZoomOut = zoomIdx > 0;

  const onZoomIn = useCallback(() => {
    const i = ZOOM_LEVELS.indexOf(styleRef.current.zoomFactor);
    if (i < ZOOM_LEVELS.length - 1) setZoomFactor(ZOOM_LEVELS[i + 1]);
  }, []);
  const onZoomOut = useCallback(() => {
    const i = ZOOM_LEVELS.indexOf(styleRef.current.zoomFactor);
    if (i > 0) setZoomFactor(ZOOM_LEVELS[i - 1]);
  }, []);
  const onZoomReset = useCallback(() => setZoomFactor(1), []);

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
      const chunk = chunkRef.current;
      const {
        gain: g,
        background: bg,
        zeroLineStyle: zl,
        channelColors: cols,
        layout: lay,
        zoomFactor: zf,
      } = styleRef.current;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      if (!chunk || chunk.data.length < 2) {
        // Still draw zero line(s) at idle so the canvas isn't blank.
        if (zl !== null) {
          ctx.strokeStyle = zl;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, cssHeight / 2);
          ctx.lineTo(cssWidth, cssHeight / 2);
          ctx.stroke();
        }
        return;
      }

      const data = chunk.data;
      const channels = chunk.channels || 1;
      const totalSamplesPerChannel = (data.length / channels) | 0;
      // Visible window in samples-per-channel — clamp to what the
      // chunk actually carries. (For most configs this is exact:
      // `samplesPerChunk × zoomFactor`. Defensive in case the panel
      // delivered a shorter chunk for any reason.)
      const visible = Math.min(
        totalSamplesPerChannel,
        Math.max(2, Math.floor(samplesPerChunk * zf)),
      );
      // Take the *most recent* `visible` samples (right-aligned).
      const startSample = totalSamplesPerChannel - visible;

      if (lay === 'stacked') {
        const laneHeight = cssHeight / channels;
        // Zero lines per lane
        if (zl !== null) {
          ctx.strokeStyle = zl;
          ctx.lineWidth = 1;
          for (let c = 0; c < channels; c++) {
            const cy = c * laneHeight + laneHeight / 2;
            ctx.beginPath();
            ctx.moveTo(0, cy);
            ctx.lineTo(cssWidth, cy);
            ctx.stroke();
          }
        }
        // Polyline per channel
        const xStep = cssWidth / Math.max(1, visible - 1);
        const halfLane = laneHeight / 2;
        ctx.lineWidth = 1.25;
        for (let c = 0; c < channels; c++) {
          const cy = c * laneHeight + halfLane;
          ctx.strokeStyle = cols[c % cols.length];
          ctx.beginPath();
          for (let i = 0; i < visible; i++) {
            const v = data[(startSample + i) * channels + c];
            const x = i * xStep;
            const y = cy - v * g * halfLane;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else {
        // overlay — every channel uses full vertical extent
        if (zl !== null) {
          ctx.strokeStyle = zl;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, cssHeight / 2);
          ctx.lineTo(cssWidth, cssHeight / 2);
          ctx.stroke();
        }
        const xStep = cssWidth / Math.max(1, visible - 1);
        const cy = cssHeight / 2;
        ctx.lineWidth = 1.25;
        for (let c = 0; c < channels; c++) {
          ctx.strokeStyle = cols[c % cols.length];
          ctx.beginPath();
          for (let i = 0; i < visible; i++) {
            const v = data[(startSample + i) * channels + c];
            const x = i * xStep;
            const y = cy - v * g * cy;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // styleRef and chunkRef identities are stable; the loop reads
    // their .current each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samplesPerChunk]);

  return (
    <div className="scope-view">
      <div className="scope-view-canvas" ref={containerRef} style={{ height }}>
        <canvas ref={canvasRef} />
        <div className="scope-view-window">{windowMs.toFixed(2)} ms</div>
      </div>
      <div className="scope-view-toolbar">
        <label className="layout">
          Layout&nbsp;
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as ScopeLayout)}
          >
            <option value="stacked">stacked</option>
            <option value="overlay">overlay</option>
          </select>
        </label>
        <div className="zoom">
          <button
            type="button"
            onClick={onZoomOut}
            disabled={!canZoomOut}
            title="Zoom out (longer window)"
          >
            −
          </button>
          <span className="factor">
            {zoomFactor === 1
              ? '1×'
              : `1/${Math.round(1 / zoomFactor)}×`}
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            disabled={!canZoomIn}
            title="Zoom in (shorter window)"
          >
            +
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            disabled={zoomFactor === 1}
            title="Reset to 1×"
          >
            1×
          </button>
        </div>
      </div>
    </div>
  );
}
