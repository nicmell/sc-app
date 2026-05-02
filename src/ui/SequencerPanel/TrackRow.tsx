import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SequencerController } from '@/sequencer/SequencerController';
import { stepHasOverrides, type Track } from '@/sequencer/types';
import { StepCell } from './StepCell';
import { StepPopover } from './StepPopover';
import { TrackDefaults } from './TrackDefaults';

interface TrackRowProps {
  controller: SequencerController;
  track: Track;
  currentStep: number;
  /** id of the shared `<datalist>` populated from
   *  `dirtClient.sampleBanks` — the input wires `list={listId}` for
   *  autocomplete. Empty string ⇒ no list (datalist not yet
   *  populated; just falls back to free-text). */
  sampleListId: string;
}

/** Open-popover state. Co-located on the row so closing one cell's
 *  popover when another opens "just works" — there's exactly one
 *  popover slot per row. */
interface PopoverState {
  stepIndex: number;
  anchorX: number;
  anchorY: number;
}

/** One row: chevron toggle, sample input, gain slider, step grid,
 *  delete button. Below it (when expanded): track-default editor.
 *  Floating above any of its cells: the per-step popover. */
export function TrackRow({
  controller,
  track,
  currentStep,
  sampleListId,
}: TrackRowProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);

  const onSampleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      controller.setTrackSample(track.id, e.target.value);
    },
    [controller, track.id],
  );

  const onGainChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(e.target.value);
      if (Number.isFinite(value)) controller.setTrackGain(track.id, value);
    },
    [controller, track.id],
  );

  const onRemove = useCallback(() => {
    controller.removeTrack(track.id);
  }, [controller, track.id]);

  const onClosePopover = useCallback(() => setPopover(null), []);

  const popoverStep = popover ? track.steps[popover.stepIndex] : null;
  const hasAnyDefault = Object.keys(track.defaults).length > 0;

  return (
    <div className={`track-row ${defaultsOpen ? 'is-expanded' : ''}`}>
      <div className="track-row-main">
        <button
          type="button"
          className={`track-defaults-toggle ${hasAnyDefault ? 'has-defaults' : ''}`}
          onClick={() => setDefaultsOpen((v) => !v)}
          title={defaultsOpen ? 'Hide track defaults' : 'Show track defaults'}
          aria-expanded={defaultsOpen}
        >
          {defaultsOpen ? '▾' : '▸'}
        </button>
        <input
          type="text"
          className="track-sample"
          value={track.sample}
          placeholder="sample"
          onChange={onSampleChange}
          list={sampleListId || undefined}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <input
          type="range"
          className="track-gain"
          min={0}
          max={2}
          step={0.01}
          value={track.gain}
          onChange={onGainChange}
          title={`gain ${track.gain.toFixed(2)}`}
        />
        <span className="track-gain-value">{track.gain.toFixed(2)}</span>
        <div className="track-steps">
          {track.steps.map((step, i) => (
            <StepCell
              key={i}
              active={step.active}
              hasOverrides={stepHasOverrides(step)}
              isPlayhead={i === currentStep}
              isBeatBoundary={i % 4 === 0}
              onToggle={() => controller.toggleStep(track.id, i)}
              onOpenParams={(e) =>
                setPopover({
                  stepIndex: i,
                  anchorX: e.clientX,
                  anchorY: e.clientY,
                })
              }
            />
          ))}
        </div>
        <button
          type="button"
          className="track-remove"
          onClick={onRemove}
          title="Remove track"
          aria-label="Remove track"
        >
          ×
        </button>
      </div>

      {defaultsOpen && (
        <TrackDefaults controller={controller} track={track} />
      )}

      {popover &&
        popoverStep &&
        // Portal so the popover escapes the panel's overflow
        // clipping and the track-row's stacking context. Anchored
        // by viewport coordinates (clientX/clientY) — the popover
        // closes on scroll/resize, so stale anchors aren't an
        // ongoing concern.
        createPortal(
          <StepPopover
            controller={controller}
            track={track}
            stepIndex={popover.stepIndex}
            step={popoverStep}
            anchorX={popover.anchorX}
            anchorY={popover.anchorY}
            onClose={onClosePopover}
          />,
          document.body,
        )}
    </div>
  );
}
