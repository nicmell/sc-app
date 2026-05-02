import { useCallback, useEffect, useRef } from 'react';
import type { SequencerController } from '@/sequencer/SequencerController';
import {
  PARAM_SPECS,
  type ParamName,
  type Step,
  type Track,
} from '@/sequencer/types';

interface StepPopoverProps {
  controller: SequencerController;
  track: Track;
  stepIndex: number;
  step: Step;
  /** Anchor pointer position from the click event. The popover
   *  positions its top-left near (x, y) and clamps to the
   *  viewport so it stays fully visible. */
  anchorX: number;
  anchorY: number;
  onClose(): void;
}

/** Per-step parameter editor (Phase 27b). Four sliders for
 *  amp / cutoff / speed / pan. Each row shows whether the value
 *  is an override, a track-level default, or unset (= SuperDirt
 *  default). Adjusting the slider creates an override; the ⊘
 *  button clears the override and the row falls back to the
 *  inherited value.
 *
 *  Closes on click-outside, Escape, or scroll/resize (the anchor
 *  position would otherwise become stale).
 */
export function StepPopover({
  controller,
  track,
  stepIndex,
  step,
  anchorX,
  anchorY,
  onClose,
}: StepPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside, Escape, scroll/resize → close. Pointerdown
  // (not click) so a drag started inside the popover doesn't
  // close on mouseup outside. Capturing phase so we see clicks
  // before any cell's own onClick fires.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onViewportChange = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [onClose]);

  // Position post-mount using the rendered size so we can clamp
  // to the viewport. Falls back to the raw anchor on first
  // paint — the clamp runs in a layout effect right after.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = anchorX + 8;
    let top = anchorY + 8;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, anchorX - rect.width - 8);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, anchorY - rect.height - 8);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [anchorX, anchorY]);

  const onSetParam = useCallback(
    (name: ParamName, value: number) => {
      controller.setStepParam(track.id, stepIndex, name, value);
    },
    [controller, stepIndex, track.id],
  );

  const onClearParam = useCallback(
    (name: ParamName) => {
      controller.clearStepParam(track.id, stepIndex, name);
    },
    [controller, stepIndex, track.id],
  );

  const onClearAll = useCallback(() => {
    controller.clearAllStepParams(track.id, stepIndex);
  }, [controller, stepIndex, track.id]);

  return (
    <div
      ref={ref}
      className="step-popover"
      role="dialog"
      aria-label={`Step ${stepIndex + 1} parameters`}
      style={{ left: anchorX, top: anchorY }}
    >
      <header>
        <span className="step-popover-title">
          {track.sample || '(no sample)'} · step {stepIndex + 1}
        </span>
        <button
          type="button"
          className="step-popover-clear-all"
          onClick={onClearAll}
          disabled={!step.params}
          title="Clear all per-cell overrides"
        >
          reset
        </button>
      </header>
      <div className="step-popover-rows">
        {PARAM_SPECS.map((spec) => {
          const override = step.params?.[spec.name];
          const trackDefault = track.defaults[spec.name];
          // Slider position: override > track default > spec default
          // (the spec default is just a sensible starting point —
          // grabbing the slider when nothing's set yet picks up
          // from there rather than from the slider's leftmost
          // position).
          const sliderValue = override ?? trackDefault ?? spec.default;
          const source: 'override' | 'track' | 'unset' =
            override !== undefined
              ? 'override'
              : trackDefault !== undefined
                ? 'track'
                : 'unset';
          return (
            <div
              key={spec.name}
              className={`step-popover-row source-${source}`}
            >
              <label className="step-popover-label">{spec.label}</label>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={sliderValue}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  if (Number.isFinite(v)) onSetParam(spec.name, v);
                }}
              />
              <span className="step-popover-value">
                {formatParamValue(spec.name, sliderValue)}
              </span>
              <button
                type="button"
                className="step-popover-clear"
                onClick={() => onClearParam(spec.name)}
                disabled={override === undefined}
                title={
                  override !== undefined
                    ? 'Clear override (inherit track default)'
                    : 'No override on this cell'
                }
                aria-label={`Clear ${spec.name} override`}
              >
                ⊘
              </button>
            </div>
          );
        })}
      </div>
      <footer className="step-popover-legend">
        <span className="legend-swatch source-override" /> override
        <span className="legend-swatch source-track" /> track default
        <span className="legend-swatch source-unset" /> unset
      </footer>
    </div>
  );
}

function formatParamValue(name: ParamName, value: number): string {
  if (name === 'cutoff') return `${value.toFixed(0)} Hz`;
  return value.toFixed(2);
}
