import { useCallback } from 'react';
import type { SequencerController } from '@/sequencer/SequencerController';
import { PARAM_SPECS, type ParamName, type Track } from '@/sequencer/types';

interface TrackDefaultsProps {
  controller: SequencerController;
  track: Track;
}

/** Inline track-default editor (Phase 27b). Toggled by the
 *  chevron on the track row. Same four params as the per-step
 *  popover (amp / cutoff / speed / pan). Each row shows the
 *  current default + a clear button. With no default set, the
 *  slider sits at the spec default — grabbing it adopts that
 *  position as the new default. */
export function TrackDefaults({ controller, track }: TrackDefaultsProps) {
  const onSet = useCallback(
    (name: ParamName, value: number) => {
      controller.setTrackDefault(track.id, name, value);
    },
    [controller, track.id],
  );

  const onClear = useCallback(
    (name: ParamName) => {
      controller.clearTrackDefault(track.id, name);
    },
    [controller, track.id],
  );

  return (
    <div className="track-defaults">
      <span className="track-defaults-title">track defaults</span>
      <div className="track-defaults-grid">
        {PARAM_SPECS.map((spec) => {
          const value = track.defaults[spec.name];
          const sliderValue = value ?? spec.default;
          const set = value !== undefined;
          return (
            <div
              key={spec.name}
              className={`track-defaults-row source-${set ? 'track' : 'unset'}`}
            >
              <label className="track-defaults-label">{spec.label}</label>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={sliderValue}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);
                  if (Number.isFinite(v)) onSet(spec.name, v);
                }}
              />
              <span className="track-defaults-value">
                {formatParamValue(spec.name, sliderValue)}
              </span>
              <button
                type="button"
                className="track-defaults-clear"
                onClick={() => onClear(spec.name)}
                disabled={!set}
                title={
                  set
                    ? 'Clear default (use SuperDirt default)'
                    : 'No track default set'
                }
                aria-label={`Clear ${spec.name} default`}
              >
                ⊘
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatParamValue(name: ParamName, value: number): string {
  if (name === 'cutoff') return `${value.toFixed(0)} Hz`;
  return value.toFixed(2);
}
