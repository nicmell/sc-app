import { useCallback } from 'react';
import type { SequencerController } from '@/sequencer/SequencerController';
import type { Track } from '@/sequencer/types';
import { StepCell } from './StepCell';

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

/** One row: sample input, gain slider, step grid, delete button. */
export function TrackRow({
  controller,
  track,
  currentStep,
  sampleListId,
}: TrackRowProps) {
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

  return (
    <div className="track-row">
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
        {track.steps.map((active, i) => (
          <StepCell
            key={i}
            active={active}
            isPlayhead={i === currentStep}
            isBeatBoundary={i % 4 === 0}
            onToggle={() => controller.toggleStep(track.id, i)}
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
  );
}
