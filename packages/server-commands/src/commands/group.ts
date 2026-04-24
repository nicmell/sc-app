/**
 * Group commands. Parallel groups (`/p_new`) live here too since
 * scsynth treats them like groups with a different dispatch mode.
 */

import OSC from 'osc-js';

// ── /g_new, /p_new ────────────────────────────────────────────────────

export const gNew = (
  ...triples: ReadonlyArray<[number, number, number]>
): OSC.Message => new OSC.Message('/g_new', ...triples.flat());

export const gNewOne = (
  groupId: number,
  addAction: number,
  targetId: number,
): OSC.Message => new OSC.Message('/g_new', groupId, addAction, targetId);

export const pNew = (
  ...triples: ReadonlyArray<[number, number, number]>
): OSC.Message => new OSC.Message('/p_new', ...triples.flat());

// ── /g_freeAll, /g_deepFree ───────────────────────────────────────────

export const gFreeAll = (...groupIds: number[]): OSC.Message =>
  new OSC.Message('/g_freeAll', ...groupIds);

export const gDeepFree = (...groupIds: number[]): OSC.Message =>
  new OSC.Message('/g_deepFree', ...groupIds);

// ── /g_head, /g_tail ──────────────────────────────────────────────────

export const gHead = (
  ...pairs: ReadonlyArray<[number, number]>
): OSC.Message => new OSC.Message('/g_head', ...pairs.flat());

export const gTail = (
  ...pairs: ReadonlyArray<[number, number]>
): OSC.Message => new OSC.Message('/g_tail', ...pairs.flat());

// ── /g_dumpTree, /g_queryTree ─────────────────────────────────────────

/** `/g_queryTree groupId withControls`. Reply arrives as
 *  `/g_queryTree.reply` (modelled as an `OSC.Message` with that address). */
export const queryTree = (
  groupId: number,
  withControls = false,
): OSC.Message =>
  new OSC.Message('/g_queryTree', groupId, withControls ? 1 : 0);

export const dumpTree = (
  groupId: number,
  withControls = false,
): OSC.Message =>
  new OSC.Message('/g_dumpTree', groupId, withControls ? 1 : 0);
