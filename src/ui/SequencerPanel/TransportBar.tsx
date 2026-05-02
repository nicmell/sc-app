import { useCallback } from 'react';
import type { SequencerController } from '@/sequencer/SequencerController';
import {
  PATTERN_LENGTHS,
  type Pattern,
  type PatternLength,
  type TransportState,
} from '@/sequencer/types';

const MIN_BPM = 60;
const MAX_BPM = 240;

interface TransportBarProps {
  controller: SequencerController;
  pattern: Pattern;
  transport: TransportState;
  /** Disable Play when the audio clock isn't running yet. */
  clockReady: boolean;
}

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

  const onBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      if (Number.isFinite(value)) controller.setBpm(value);
    },
    [controller],
  );

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
    <div className="row toolbar transport-bar">
      <button
        type="button"
        className={transport.isPlaying ? 'transport-stop' : 'transport-play'}
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
        <span>BPM</span>
        <input
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          step={1}
          value={pattern.bpm}
          onChange={onBpmChange}
        />
      </label>

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
