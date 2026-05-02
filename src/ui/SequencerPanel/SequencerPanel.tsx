import { useEffect, useId, useSyncExternalStore } from 'react';
import type { DirtClient } from '@/dirt/DirtClient';
import type { PatternBank } from '@/sequencer/PatternBank';
import { SLOT_COUNT } from '@/sequencer/PatternBank';
import type { SequencerController } from '@/sequencer/SequencerController';
import { BankSelector } from './BankSelector';
import { TransportBar } from './TransportBar';
import { TrackRow } from './TrackRow';
import './SequencerPanel.scss';

interface SequencerPanelProps {
  controller: SequencerController;
  bank: PatternBank;
  /** For sample-name autocomplete (`sampleBanks` reactive store).
   *  Optional so the panel still renders if Dirt isn't wired. */
  dirtClient?: DirtClient;
  /** Whether the audio clock is running. Drives the Play button's
   *  disabled state — the controller refuses Play with no
   *  `tick0Ms` anchor. */
  clockReady: boolean;
}

/**
 * Step sequencer panel (Phase 27a/b/c).
 *
 * Pattern + transport state come from `controller`'s reactive
 * stores; the controller in turn reads from `bank.activePattern`.
 * The panel is otherwise stateless — every interaction is
 * `controller.somethingMutation(...)` or `bank.selectIndex(...)`.
 *
 * Phase 27c additions:
 * - 8-slot `BankSelector` row above the transport bar.
 * - Keyboard 1..8 to switch slots (gated on input focus so it
 *   doesn't fight with the BPM / sample-name inputs).
 *
 * Sample-bank autocomplete reads from `dirtClient.sampleBanks`;
 * the AppShell calls `dirtClient.listSamples()` once after the
 * SuperDirt probe lands `'alive'`, so the datalist may be empty
 * for the first second of use (free-text input still works
 * regardless).
 */
export function SequencerPanel({
  controller,
  bank,
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

  // Document-level 1..8 listener for slot switching. Gated on
  // editable focus so we don't intercept BPM / sample-name /
  // step-popover input. Modifier keys (Ctrl/Meta/Alt) are
  // ignored too — those are reserved for browser shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      // Numeric row keys produce '1'..'8' regardless of layout
      // (NumPad too, since e.key strips the prefix). Ignore '0'
      // and '9' — only 8 slots.
      const code = e.key;
      if (code < '1' || code > '8') return;
      const slotIndex = Number.parseInt(code, 10) - 1;
      if (slotIndex < 0 || slotIndex >= SLOT_COUNT) return;
      bank.selectIndex(slotIndex);
      // Don't preventDefault — the user might be navigating with
      // a screen reader, and 1..8 outside an input does nothing
      // by default anyway.
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bank]);

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

      <BankSelector bank={bank} />

      <TransportBar
        controller={controller}
        pattern={pattern}
        transport={transport}
        clockReady={clockReady}
      />

      {sampleBanks.length > 0 && (
        <datalist id={sampleListId}>
          {sampleBanks.map((b) => (
            <option key={b.name} value={b.name}>
              {b.count > 1 ? `${b.count} variants` : '1 variant'}
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

/** True when the event target is an input/textarea/select or a
 *  contenteditable element. Used to gate global keyboard
 *  shortcuts so the user can still type "8" into a BPM box
 *  without switching slots. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
