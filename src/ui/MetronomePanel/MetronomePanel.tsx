import { useCallback, useSyncExternalStore } from 'react';
import {
  MAX_BPM,
  MIN_BPM,
  type MetronomeController,
} from '@/metronome/MetronomeController';
import './MetronomePanel.css';

interface MetronomePanelProps {
  controller: MetronomeController;
}

export function MetronomePanel({ controller }: MetronomePanelProps) {
  const bpm = useSyncExternalStore(
    (cb) => controller.bpm.subscribe(cb),
    () => controller.bpm.get(),
  );

  const onBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(e.target.value, 10);
      if (!Number.isFinite(value)) return;
      controller.setBpm(value);
    },
    [controller],
  );

  return (
    <section className="panel metronome-panel">
      <header>Metronome</header>
      <div className="cluster" data-gap="md">
        <label>
          <span>BPM</span>
          <input
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={onBpmChange}
          />
        </label>
      </div>
    </section>
  );
}
