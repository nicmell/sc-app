import { memo } from 'react';

interface StepCellProps {
  active: boolean;
  isPlayhead: boolean;
  /** Visual cue for beat boundaries (every 4th step in 1/16ths).
   *  Doesn't affect behavior, just gives the grid a 4/4 read. */
  isBeatBoundary: boolean;
  onToggle(): void;
}

/** A single step in a track row. Memoized: the parent re-renders on
 *  every pattern mutation, but `active`/`isPlayhead`/`isBeatBoundary`
 *  rarely change for a given cell, so memo cuts most diff cost. */
export const StepCell = memo(function StepCell({
  active,
  isPlayhead,
  isBeatBoundary,
  onToggle,
}: StepCellProps) {
  const className = [
    'step-cell',
    active ? 'is-active' : '',
    isPlayhead ? 'is-playhead' : '',
    isBeatBoundary ? 'is-beat' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      onClick={onToggle}
    />
  );
});
