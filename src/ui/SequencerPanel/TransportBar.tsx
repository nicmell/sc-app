import { useCallback } from 'react';
import type { SequencerController } from '@/sequencer/SequencerController';
import {
  PATTERN_LENGTHS,
  type Pattern,
  type PatternLength,
  type TransportState,
} from '@/sequencer/types';

interface TransportBarProps {
  controller: SequencerController;
  pattern: Pattern;
  transport: TransportState;
  /** Disable Play when the audio clock isn't running yet. */
  clockReady: boolean;
}

/** Toolbar above the track grid. BPM lives on the centralized
 *  MetronomePanel above — this bar only exposes per-pattern controls
 *  (length, add-track) plus the transport. */
export function TransportBar({
  controller,
  pattern,
  transport,
  clockReady,
}: TransportBarProps) {
  const onTogglePlay = useCallback(() => {
    if (transport.isPlaying) controller.stop();
    else controller.play();
  }, [controller, transport.isPlaying]);

  const onLengthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = Number.parseInt(e.target.value, 10) as PatternLength;
      controller.setLength(value);
    },
    [controller],
  );

  const onAddTrack = useCallback(() => {
    controller.addTrack();
  }, [controller]);

  return (
    <div className="cluster transport-bar">
      <button
        type="button"
        data-variant={transport.isPlaying ? 'danger' : undefined}
        onClick={onTogglePlay}
        disabled={!transport.isPlaying && !clockReady}
        title={
          !transport.isPlaying && !clockReady
            ? 'audio clock not running'
            : undefined
        }
      >
        {transport.isPlaying ? 'Stop' : 'Play'}
      </button>

      <label>
        <span>Length</span>
        <select value={pattern.length} onChange={onLengthChange}>
          {PATTERN_LENGTHS.map((len) => (
            <option key={len} value={len}>
              {len}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={onAddTrack}>
        + Track
      </button>
    </div>
  );
}
