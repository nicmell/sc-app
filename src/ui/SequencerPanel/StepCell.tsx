import { memo } from 'react';

interface StepCellProps {
  active: boolean;
  hasOverrides: boolean;
  isPlayhead: boolean;
  /** Visual cue for beat boundaries (every 4th step in 1/16ths).
   *  Doesn't affect behavior, just gives the grid a 4/4 read. */
  isBeatBoundary: boolean;
  onToggle(): void;
  /** Right-click or shift-click → open the parameter popover. The
   *  parent decides where to anchor it; this hook just relays the
   *  pointer event so the popover can read clientX/clientY. */
  onOpenParams(e: React.MouseEvent<HTMLButtonElement>): void;
}

/** A single step in a track row. Memoized: the parent re-renders on
 *  every pattern mutation, but only the cells whose props actually
 *  changed need to re-render. */
export const StepCell = memo(function StepCell({
  active,
  hasOverrides,
  isPlayhead,
  isBeatBoundary,
  onToggle,
  onOpenParams,
}: StepCellProps) {
  const className = [
    'step-cell',
    active ? 'is-active' : '',
    isPlayhead ? 'is-playhead' : '',
    isBeatBoundary ? 'is-beat' : '',
    hasOverrides ? 'has-overrides' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      onClick={(e) => {
        // Shift-click is the trackpad-friendly way to open the
        // params popover (right-click on macOS trackpads is a
        // tap-with-two-fingers gesture some users miss). The
        // contextmenu handler below covers actual right-clicks.
        if (e.shiftKey) {
          e.preventDefault();
          onOpenParams(e);
          return;
        }
        onToggle();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenParams(e);
      }}
    >
      {hasOverrides && <span className="override-dot" aria-hidden="true" />}
    </button>
  );
});
