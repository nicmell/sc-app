import { useCallback, useSyncExternalStore } from 'react';
import { SLOT_COUNT, type PatternBank } from '@/sequencer/PatternBank';
import type { SequencerController } from '@/sequencer/SequencerController';

interface ChainEditorProps {
  bank: PatternBank;
  controller: SequencerController;
}

/** Phase 27d — chain editor. Compact horizontal strip below the
 *  bank selector; each entry is a small `[slot×cycles ⊘]` cell.
 *  Header carries the "Chain" enable toggle, the "Loop" toggle,
 *  and a "+ Step" append button. The currently-playing entry
 *  highlights via `controller.chainPlaybackIndex` so the user
 *  can see chain progression at a glance.
 *
 *  Editing the chain is fine while playing; changes apply at
 *  the next pump's chain-advancement check. Toggling `enabled`
 *  off mid-playback also takes effect at the next pump (the
 *  chain check short-circuits when `chainPlayback.currentEntryIndex
 *  >= 0` regardless of the bank flag — a deliberate choice so the
 *  current-cycle finishes cleanly rather than being interrupted).
 */
export function ChainEditor({ bank, controller }: ChainEditorProps) {
  const chain = useSyncExternalStore(
    (cb) => bank.chain.subscribe(cb),
    () => bank.chain.get(),
  );
  const playbackIndex = useSyncExternalStore(
    (cb) => controller.chainPlaybackIndex.subscribe(cb),
    () => controller.chainPlaybackIndex.get(),
  );

  const onToggleEnabled = useCallback(() => {
    bank.setChainEnabled(!chain.enabled);
  }, [bank, chain.enabled]);

  const onToggleLoop = useCallback(() => {
    bank.setChainLoop(!chain.loop);
  }, [bank, chain.loop]);

  const onAppend = useCallback(() => {
    // Default to the bank's currently-active slot — handy for
    // the common "build a pattern, drop it into the chain"
    // workflow.
    bank.appendChainEntry(bank.activeIndex.get(), 1);
  }, [bank]);

  return (
    <div className={`chain-editor ${chain.enabled ? 'is-enabled' : ''}`}>
      <div className="chain-editor-header">
        <label className="chain-toggle">
          <input
            type="checkbox"
            checked={chain.enabled}
            onChange={onToggleEnabled}
          />
          <span>Chain</span>
        </label>
        <label className="chain-toggle">
          <input
            type="checkbox"
            checked={chain.loop}
            onChange={onToggleLoop}
            disabled={!chain.enabled}
          />
          <span>Loop</span>
        </label>
        <button
          type="button"
          className="chain-append"
          onClick={onAppend}
          disabled={!chain.enabled}
          title="Append a chain step"
        >
          + Step
        </button>
      </div>

      {chain.enabled && (
        <div className="chain-entries">
          {chain.steps.length === 0 ? (
            <span className="chain-empty">
              empty — click <strong>+ Step</strong>
            </span>
          ) : (
            chain.steps.map((entry, i) => (
              <ChainEntryCell
                key={i}
                bank={bank}
                index={i}
                slotIndex={entry.slotIndex}
                cycles={entry.cycles}
                isPlaying={i === playbackIndex}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface ChainEntryCellProps {
  bank: PatternBank;
  index: number;
  slotIndex: number;
  cycles: number;
  isPlaying: boolean;
}

function ChainEntryCell({
  bank,
  index,
  slotIndex,
  cycles,
  isPlaying,
}: ChainEntryCellProps) {
  const onSlotChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = Number.parseInt(e.target.value, 10);
      if (Number.isFinite(v)) bank.updateChainEntry(index, { slotIndex: v });
    },
    [bank, index],
  );

  const onCyclesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number.parseInt(e.target.value, 10);
      if (Number.isFinite(v)) bank.updateChainEntry(index, { cycles: v });
    },
    [bank, index],
  );

  const onRemove = useCallback(() => {
    bank.removeChainEntry(index);
  }, [bank, index]);

  return (
    <div className={`chain-entry ${isPlaying ? 'is-playing' : ''}`}>
      <select
        className="chain-entry-slot"
        value={slotIndex}
        onChange={onSlotChange}
        title="Slot to play"
      >
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <option key={i} value={i}>
            {i + 1}
          </option>
        ))}
      </select>
      <span className="chain-entry-x">×</span>
      <input
        type="number"
        className="chain-entry-cycles"
        min={1}
        max={64}
        step={1}
        value={cycles}
        onChange={onCyclesChange}
        title="Cycles"
      />
      <button
        type="button"
        className="chain-entry-remove"
        onClick={onRemove}
        title="Remove step"
        aria-label="Remove chain step"
      >
        ⊘
      </button>
    </div>
  );
}
