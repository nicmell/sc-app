import { useCallback, useSyncExternalStore } from 'react';
import { SLOT_COUNT, type PatternBank } from '@/sequencer/PatternBank';

interface BankSelectorProps {
  bank: PatternBank;
}

/** Phase 27c — 8-button bank selector. Active slot highlighted;
 *  slots with at least one track get a small "filled" indicator
 *  so the user can tell at a glance which slots have content.
 *  Keyboard 1..8 also switches; that listener lives in
 *  `SequencerPanel` so it can also gate on input focus. */
export function BankSelector({ bank }: BankSelectorProps) {
  const slots = useSyncExternalStore(
    (cb) => bank.slots.subscribe(cb),
    () => bank.slots.get(),
  );
  const activeIndex = useSyncExternalStore(
    (cb) => bank.activeIndex.subscribe(cb),
    () => bank.activeIndex.get(),
  );

  const onSelect = useCallback(
    (i: number) => {
      bank.selectIndex(i);
    },
    [bank],
  );

  return (
    <div className="bank-selector" role="tablist" aria-label="Pattern bank">
      {Array.from({ length: SLOT_COUNT }, (_, i) => {
        const slot = slots[i];
        const filled = slot.tracks.length > 0;
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[
              'bank-slot',
              isActive ? 'is-active' : '',
              filled ? 'is-filled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(i)}
            title={`Pattern ${i + 1} (${i + 1})${filled ? '' : ' — empty'}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
