import { useEffect, useRef, type RefObject } from 'react';
import type { ScopeChunk } from '@/scope/workerProtocol';
import './ScopeView.scss';

export interface ScopeViewProps {
  /** Mutable ref pointing at the latest scope chunk. The owner
   *  (typically the panel managing the subscription) writes new
   *  chunks here as they arrive; this component reads `current`
   *  once per animation frame and redraws. */
  chunkRef: RefObject<ScopeChunk | null>;
  /** Vertical scale factor applied to the raw sample values
   *  before mapping `[-1, 1] → [bottom, top]`. Default 1. */
  gain?: number;
  /** Stroke colour for the waveform line. */
  strokeStyle?: string;
  /** Background fill cleared each frame. */
  background?: string;
  /** Pixel height in CSS px. Width fills the parent. Default 200. */
  height?: number;
  /** Optional zero-line stroke colour. Pass `null` to disable. */
  zeroLineStyle?: string | null;
}

const DEFAULTS = {
  gain: 1,
  strokeStyle: '#6ac46f',
  background: '#15171b',
  height: 200,
  zeroLineStyle: '#262930',
};

export function ScopeView({
  chunkRef,
  gain = DEFAULTS.gain,
  strokeStyle = DEFAULTS.strokeStyle,
  background = DEFAULTS.background,
  height = DEFAULTS.height,
  zeroLineStyle = DEFAULTS.zeroLineStyle,
}: ScopeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Mirror visual props into refs so the RAF loop stays stable
  // across re-renders — we don't want to cancel + restart the loop
  // every time gain ticks up.
  const styleRef = useRef({ gain, strokeStyle, background, zeroLineStyle });
  styleRef.current = { gain, strokeStyle, background, zeroLineStyle };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Track CSS size + DPR so we only re-size the canvas backing
    // store on actual change. Setting canvas.width / .height clears
    // the canvas, so doing it every frame would flicker.
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
      const { gain: g, strokeStyle: stroke, background: bg, zeroLineStyle: zl } =
        styleRef.current;

      // Background.
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // Optional zero line.
      if (zl !== null) {
        ctx.strokeStyle = zl;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cssHeight / 2);
        ctx.lineTo(cssWidth, cssHeight / 2);
        ctx.stroke();
      }

      if (!chunk || chunk.data.length < 2) return;

      // Mono fast path — skipping multi-channel is fine for Phase 9.
      // (For multi-channel chunks data is interleaved; Phase 10 adds
      // stacked-lane rendering. Until then, treat all channels as one
      // mixed stream by drawing the first channel only.)
      const data = chunk.data;
      const channels = chunk.channels || 1;
      const len = (data.length / channels) | 0;
      if (len < 2) return;

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      const xStep = cssWidth / (len - 1);
      const cy = cssHeight / 2;
      for (let i = 0; i < len; i++) {
        const v = data[i * channels];
        const x = i * xStep;
        const y = cy - v * g * cy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // styleRef is mutated in place; chunkRef identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scope-view" ref={containerRef} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
