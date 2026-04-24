/**
 * Typed command constructors. One per documented SC server command
 * plus an `other` escape hatch. Most are thin wrappers that take the
 * jco-generated args record and package it into the tagged-union
 * `ServerMessage`. A handful of heavy-hitters expose richer, more
 * ergonomic call shapes on top (e.g. `sNew` taking a controls record
 * instead of the raw `Array<[ControlId, ControlValue]>` tail).
 *
 * All commands correspond 1:1 to the SuperCollider Server Command
 * Reference:
 *   https://doc.sccode.org/Reference/Server-Command-Reference.html
 */

import type {
  BAllocArgs,
  BAllocReadArgs,
  BAllocReadChannelArgs,
  BCloseArgs,
  BFillArgs,
  BFreeArgs,
  BGenArgs,
  BGetArgs,
  BGetnArgs,
  BQueryArgs,
  BReadArgs,
  BReadChannelArgs,
  BSetArgs,
  BSetSampleRateArgs,
  BSetnArgs,
  BWriteArgs,
  BZeroArgs,
  CFillArgs,
  CGetArgs,
  CGetnArgs,
  CSetArgs,
  CSetnArgs,
  CmdArgs,
  ControlId,
  ControlValue,
  DFreeArgs,
  DLoadArgs,
  DLoadDirArgs,
  DRecvArgs,
  DumpOscArgs,
  ErrorArgs,
  GDeepFreeArgs,
  GDumpTreeArgs,
  GFreeAllArgs,
  GHeadArgs,
  GNewArgs,
  GQueryTreeArgs,
  GTailArgs,
  NAfterArgs,
  NBeforeArgs,
  NFillArgs,
  NFreeArgs,
  NMapArgs,
  NMapaArgs,
  NMapanArgs,
  NMapnArgs,
  NOrderArgs,
  NQueryArgs,
  NRunArgs,
  NSetArgs,
  NSetnArgs,
  NTraceArgs,
  NotifyArgs,
  NumericValue,
  OscArg,
  OtherMsg,
  PNewArgs,
  SGetArgs,
  SGetnArgs,
  SNewArgs,
  SNoidArgs,
  ServerMessage,
  SyncArgs,
  UCmdArgs,
} from '@wasm/scserver-commands/interfaces/scserver-commands-commands';

// ── Polymorphic arg helpers ────────────────────────────────────────────

/** Add-action (for `/s_new`, `/g_new`, `/n_order`, etc.). */
export const AddToHead = 0;
export const AddToTail = 1;
export const AddBefore = 2;
export const AddAfter = 3;
export const AddReplace = 4;

/** Wrap a number as a `NumericValue` variant. Integers → int, else float. */
export const num = (v: number): NumericValue =>
  Number.isInteger(v) ? { tag: 'int', val: v } : { tag: 'float', val: v };

/** A control index. */
export const ctrlIndex = (i: number): ControlId => ({ tag: 'index', val: i });

/** A control name. */
export const ctrlName = (name: string): ControlId => ({ tag: 'name', val: name });

/** Coerce a string/number into a `ControlId` (strings → name, numbers → index). */
export const ctrl = (id: string | number): ControlId =>
  typeof id === 'number' ? ctrlIndex(id) : ctrlName(id);

/** `ControlValue` helper — numbers dispatch to int/float, strings → bus ref. */
export const ctrlValue = (v: number | string): ControlValue =>
  typeof v === 'string'
    ? { tag: 'bus', val: v }
    : Number.isInteger(v)
      ? { tag: 'int', val: v }
      : { tag: 'float', val: v };

// ── Argless commands ──────────────────────────────────────────────────

export const clearSched: ServerMessage = { tag: 'clear-sched' };
export const nrtEnd: ServerMessage = { tag: 'nrt-end' };
export const quit: ServerMessage = { tag: 'quit' };
export const rtMemoryStatus: ServerMessage = { tag: 'rt-memory-status' };
export const status: ServerMessage = { tag: 'status' };
export const version: ServerMessage = { tag: 'version' };

// ── Buffer commands (17) ──────────────────────────────────────────────

export const bAlloc = (val: BAllocArgs): ServerMessage => ({ tag: 'b-alloc', val });
export const bAllocRead = (val: BAllocReadArgs): ServerMessage =>
  ({ tag: 'b-alloc-read', val });
export const bAllocReadChannel = (val: BAllocReadChannelArgs): ServerMessage =>
  ({ tag: 'b-alloc-read-channel', val });
export const bClose = (val: BCloseArgs): ServerMessage => ({ tag: 'b-close', val });
export const bFill = (val: BFillArgs): ServerMessage => ({ tag: 'b-fill', val });
export const bFree = (val: BFreeArgs): ServerMessage => ({ tag: 'b-free', val });
export const bGen = (val: BGenArgs): ServerMessage => ({ tag: 'b-gen', val });
export const bGet = (val: BGetArgs): ServerMessage => ({ tag: 'b-get', val });
export const bGetn = (val: BGetnArgs): ServerMessage => ({ tag: 'b-getn', val });
export const bQuery = (val: BQueryArgs): ServerMessage => ({ tag: 'b-query', val });
export const bRead = (val: BReadArgs): ServerMessage => ({ tag: 'b-read', val });
export const bReadChannel = (val: BReadChannelArgs): ServerMessage =>
  ({ tag: 'b-read-channel', val });
export const bSet = (val: BSetArgs): ServerMessage => ({ tag: 'b-set', val });
export const bSetSampleRate = (val: BSetSampleRateArgs): ServerMessage =>
  ({ tag: 'b-set-sample-rate', val });
export const bSetn = (val: BSetnArgs): ServerMessage => ({ tag: 'b-setn', val });
export const bWrite = (val: BWriteArgs): ServerMessage => ({ tag: 'b-write', val });
export const bZero = (val: BZeroArgs): ServerMessage => ({ tag: 'b-zero', val });

// ── Control-bus commands (5) ───────────────────────────────────────────

export const cFill = (val: CFillArgs): ServerMessage => ({ tag: 'c-fill', val });
export const cGet = (val: CGetArgs): ServerMessage => ({ tag: 'c-get', val });
export const cGetn = (val: CGetnArgs): ServerMessage => ({ tag: 'c-getn', val });
export const cSet = (val: CSetArgs): ServerMessage => ({ tag: 'c-set', val });
export const cSetn = (val: CSetnArgs): ServerMessage => ({ tag: 'c-setn', val });

// ── SynthDef commands (4) ──────────────────────────────────────────────

export const dFree = (val: DFreeArgs): ServerMessage => ({ tag: 'd-free', val });
export const dLoad = (val: DLoadArgs): ServerMessage => ({ tag: 'd-load', val });
export const dLoadDir = (val: DLoadDirArgs): ServerMessage => ({ tag: 'd-load-dir', val });
export const dRecv = (val: DRecvArgs): ServerMessage => ({ tag: 'd-recv', val });

// ── Group commands (8: 7 + p_new) ──────────────────────────────────────

export const gDeepFree = (val: GDeepFreeArgs): ServerMessage =>
  ({ tag: 'g-deep-free', val });
export const gDumpTree = (val: GDumpTreeArgs): ServerMessage =>
  ({ tag: 'g-dump-tree', val });
export const gFreeAll = (val: GFreeAllArgs): ServerMessage =>
  ({ tag: 'g-free-all', val });
export const gHead = (val: GHeadArgs): ServerMessage => ({ tag: 'g-head', val });
export const gNew = (val: GNewArgs): ServerMessage => ({ tag: 'g-new', val });
export const gQueryTree = (val: GQueryTreeArgs): ServerMessage =>
  ({ tag: 'g-query-tree', val });
export const gTail = (val: GTailArgs): ServerMessage => ({ tag: 'g-tail', val });
export const pNew = (val: PNewArgs): ServerMessage => ({ tag: 'p-new', val });

// ── Node commands (14) ─────────────────────────────────────────────────

export const nAfter = (val: NAfterArgs): ServerMessage => ({ tag: 'n-after', val });
export const nBefore = (val: NBeforeArgs): ServerMessage => ({ tag: 'n-before', val });
export const nFill = (val: NFillArgs): ServerMessage => ({ tag: 'n-fill', val });
export const nFree = (val: NFreeArgs): ServerMessage => ({ tag: 'n-free', val });
export const nMap = (val: NMapArgs): ServerMessage => ({ tag: 'n-map', val });
export const nMapa = (val: NMapaArgs): ServerMessage => ({ tag: 'n-mapa', val });
export const nMapan = (val: NMapanArgs): ServerMessage => ({ tag: 'n-mapan', val });
export const nMapn = (val: NMapnArgs): ServerMessage => ({ tag: 'n-mapn', val });
export const nOrder = (val: NOrderArgs): ServerMessage => ({ tag: 'n-order', val });
export const nQuery = (val: NQueryArgs): ServerMessage => ({ tag: 'n-query', val });
export const nRun = (val: NRunArgs): ServerMessage => ({ tag: 'n-run', val });
export const nSet = (val: NSetArgs): ServerMessage => ({ tag: 'n-set', val });
export const nSetn = (val: NSetnArgs): ServerMessage => ({ tag: 'n-setn', val });
export const nTrace = (val: NTraceArgs): ServerMessage => ({ tag: 'n-trace', val });

// ── Synth commands (4) ─────────────────────────────────────────────────

export const sGet = (val: SGetArgs): ServerMessage => ({ tag: 's-get', val });
export const sGetn = (val: SGetnArgs): ServerMessage => ({ tag: 's-getn', val });
export const sNew = (val: SNewArgs): ServerMessage => ({ tag: 's-new', val });
export const sNoid = (val: SNoidArgs): ServerMessage => ({ tag: 's-noid', val });

// ── UGen / misc (5) ────────────────────────────────────────────────────

export const cmd = (val: CmdArgs): ServerMessage => ({ tag: 'cmd', val });
export const dumpOscRaw = (val: DumpOscArgs): ServerMessage =>
  ({ tag: 'dump-osc', val });
export const errorMode = (val: ErrorArgs): ServerMessage => ({ tag: 'error', val });
export const notify = (val: NotifyArgs): ServerMessage => ({ tag: 'notify', val });
export const syncRaw = (val: SyncArgs): ServerMessage => ({ tag: 'sync', val });
export const uCmd = (val: UCmdArgs): ServerMessage => ({ tag: 'u-cmd', val });

// ── Escape hatch ───────────────────────────────────────────────────────

export const other = (val: OtherMsg): ServerMessage => ({ tag: 'other', val });

// ── Ergonomic helpers for common commands ──────────────────────────────
//
// These layer on top of the thin wrappers with more natural call shapes.
// They're additive — you can still use the raw `xxx(val: XxxArgs)` form
// for anything not covered here.

/** `/dumpOSC` with an integer mode (0 = off, 1 = parsed, 2 = hex, 3 = both). */
export const dumpOsc = (code: 0 | 1 | 2 | 3): ServerMessage =>
  ({ tag: 'dump-osc', val: { code } });

/** `/sync` with a caller-supplied id. (WorkerClient.sendAndSync manages
 *  ids automatically — prefer that.) */
export const sync = (id: number): ServerMessage =>
  ({ tag: 'sync', val: { aUniqueNumber: id } });

/** `/notify 1|0`, optionally with a client id for multi-client setups. */
export const notifyEnable = (enable: 0 | 1, clientId?: number): ServerMessage =>
  ({ tag: 'notify', val: { enable, clientId } });

/** `/g_queryTree` for a single group, with the flag for control values. */
export const queryTree = (groupId: number, withControls = false): ServerMessage =>
  ({ tag: 'g-query-tree', val: { tail: [[groupId, withControls ? 1 : 0]] } });

/** `/g_dumpTree` for a single group, with the flag for control values. */
export const dumpTree = (groupId: number, withControls = false): ServerMessage =>
  ({ tag: 'g-dump-tree', val: { tail: [[groupId, withControls ? 1 : 0]] } });

/** `/n_run` on one node with a binary flag. */
export const nRunOne = (nodeId: number, flag: 0 | 1): ServerMessage =>
  ({ tag: 'n-run', val: { tail: [[nodeId, flag]] } });

/** `/g_new` creating a single group with an add-action and target. */
export const gNewOne = (
  newGroupId: number,
  addAction: number,
  targetId: number,
): ServerMessage => ({
  tag: 'g-new',
  val: { tail: [[newGroupId, addAction, targetId]] },
});

/** `/b_alloc` with required args; optional fields default to undefined. */
export const bAllocSimple = (
  bufnum: number,
  numFrames: number,
  numChannels = 1,
): ServerMessage => ({
  tag: 'b-alloc',
  val: { bufnum, numFrames, numChannels },
});

/** `/b_getn` requesting one contiguous range. */
export const bGetnOne = (
  bufnum: number,
  start: number,
  count: number,
): ServerMessage => ({
  tag: 'b-getn',
  val: { bufnum, tail: [[start, count]] },
});

/** `/d_recv` with pre-compiled SynthDef bytes; pass an optional sync
 *  id to embed a `/sync` in the completion message (cheaper than a
 *  follow-up sendAndSync). */
export const dRecvWithSync = (
  bytes: Uint8Array,
  completionMsg?: Uint8Array,
): ServerMessage => ({
  tag: 'd-recv',
  val: { bufferOfData: bytes, completionMsg },
});

/** `/s_new` with a controls record: `{ freq: 440, amp: 0.5, bus: 'c10' }`
 *  → typed `(ControlId, ControlValue)` pairs. */
export const sNewEasy = (
  defName: string,
  nodeId: number,
  addAction: number,
  targetId: number,
  controls: Record<string, number | string> = {},
): ServerMessage => ({
  tag: 's-new',
  val: {
    defName,
    nodeId,
    addAction,
    targetId,
    tail: Object.entries(controls).map(
      ([k, v]) => [ctrlName(k), ctrlValue(v)] as [ControlId, ControlValue],
    ),
  },
});

/** Spread-style `/n_free` for one or more nodes. jco lifts `list<s32>`
 *  as `Int32Array`, so we coerce from `number[]` at the boundary. */
export const nFreeIds = (...nodeIds: number[]): ServerMessage =>
  ({ tag: 'n-free', val: { nodeIds: Int32Array.from(nodeIds) } });

/** Spread-style `/g_freeAll`. */
export const gFreeAllIds = (...groupIds: number[]): ServerMessage =>
  ({ tag: 'g-free-all', val: { groupIds: Int32Array.from(groupIds) } });

/** Raw-address escape hatch (extensions, plug-in commands). */
export const rawOther = (address: string, args: OscArg[] = []): ServerMessage =>
  ({ tag: 'other', val: { address, args } });
