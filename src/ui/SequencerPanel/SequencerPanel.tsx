import { useId, useSyncExternalStore } from 'react';
import type { DirtClient } from '@/dirt/DirtClient';
import type { SequencerController } from '@/sequencer/SequencerController';
import { TransportBar } from './TransportBar';
import { TrackRow } from './TrackRow';
import './SequencerPanel.scss';

interface SequencerPanelProps {
  controller: SequencerController;
  /** For sample-name autocomplete (`sampleBanks` reactive store).
   *  Optional so the panel still renders if Dirt isn't wired. */
  dirtClient?: DirtClient;
  /** Whether the audio clock is running. Drives the Play button's
   *  disabled state — the controller refuses Play with no
   *  `tick0Ms` anchor. */
  clockReady: boolean;
}

/**
 * Step sequencer panel (Phase 27a).
 *
 * Pattern + transport state come from `controller`'s reactive
 * stores. The panel is otherwise stateless — every interaction is
 * `controller.somethingMutation(...)`. Sample-bank autocomplete
 * reads from `dirtClient.sampleBanks`; the AppShell calls
 * `dirtClient.listSamples()` once after the SuperDirt probe lands
 * `'alive'`, so the datalist may be empty for the first second of
 * use (free-text input still works regardless).
 */
export function SequencerPanel({
  controller,
  dirtClient,
  clockReady,
}: SequencerPanelProps) {
  const pattern = useSyncExternalStore(
    (cb) => controller.pattern.subscribe(cb),
    () => controller.pattern.get(),
  );
  const transport = useSyncExternalStore(
    (cb) => controller.transport.subscribe(cb),
    () => controller.transport.get(),
  );
  const sampleBanks = useSyncExternalStore(
    (cb) => (dirtClient ? dirtClient.sampleBanks.subscribe(cb) : () => {}),
    () => (dirtClient ? dirtClient.sampleBanks.get() : []),
  );

  // Stable per-mount id for the shared <datalist>, so each
  // TrackRow's input can reference it via `list=...`.
  const sampleListId = useId();

  return (
    <section className="panel sequencer-panel">
      <header>
        <span>Sequencer</span>
        {transport.isPlaying && (
          <span className="step-readout">
            step {Math.max(transport.currentStep, 0) + 1}/{pattern.length}
          </span>
        )}
      </header>

      <TransportBar
        controller={controller}
        pattern={pattern}
        transport={transport}
        clockReady={clockReady}
      />

      {sampleBanks.length > 0 && (
        <datalist id={sampleListId}>
          {sampleBanks.map((bank) => (
            <option key={bank.name} value={bank.name}>
              {bank.count > 1 ? `${bank.count} variants` : '1 variant'}
            </option>
          ))}
        </datalist>
      )}

      {pattern.tracks.length === 0 ? (
        <p className="empty">
          no tracks — click <strong>+ Track</strong> to add one
        </p>
      ) : (
        <div className="tracks">
          {pattern.tracks.map((track) => (
            <TrackRow
              key={track.id}
              controller={controller}
              track={track}
              currentStep={transport.isPlaying ? transport.currentStep : -1}
              sampleListId={sampleBanks.length > 0 ? sampleListId : ''}
            />
          ))}
        </div>
      )}
    </section>
  );
}
