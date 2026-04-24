/**
 * Buffer commands. Allocation / read / write / query.
 */

import OSC from 'osc-js';

// osc-js's .d.ts types blob args as `Blob`; its runtime check is
// `instanceof Uint8Array`. Widen via cast at every call site that
// takes a `completionMsg` blob.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyArr = (xs: ReadonlyArray<unknown>): any[] => xs as any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b = (bytes: Uint8Array): any => bytes;

// ── /b_alloc[Read][Channel] ───────────────────────────────────────────

export const bAlloc = (
  bufnum: number,
  numFrames: number,
  numChannels = 1,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/b_alloc', bufnum, numFrames, numChannels)
    : new OSC.Message(
        '/b_alloc',
        bufnum,
        numFrames,
        numChannels,
        b(completionMsg),
      );

export const bAllocRead = (
  bufnum: number,
  path: string,
  startFrame = 0,
  numFrames = 0,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/b_allocRead', bufnum, path, startFrame, numFrames)
    : new OSC.Message(
        '/b_allocRead',
        bufnum,
        path,
        startFrame,
        numFrames,
        b(completionMsg),
      );

export const bAllocReadChannel = (
  bufnum: number,
  path: string,
  startFrame: number,
  numFrames: number,
  channels: readonly number[],
  completionMsg?: Uint8Array,
): OSC.Message => {
  const base: unknown[] = [bufnum, path, startFrame, numFrames, ...channels];
  if (completionMsg !== undefined) base.push(b(completionMsg));
  return new OSC.Message('/b_allocReadChannel', ...anyArr(base));
};

// ── /b_read[Channel] ──────────────────────────────────────────────────

export const bRead = (
  bufnum: number,
  path: string,
  startFrame = 0,
  numFrames = -1,
  bufStartFrame = 0,
  leaveOpen = 0,
  completionMsg?: Uint8Array,
): OSC.Message => {
  const base: unknown[] = [
    bufnum,
    path,
    startFrame,
    numFrames,
    bufStartFrame,
    leaveOpen,
  ];
  if (completionMsg !== undefined) base.push(b(completionMsg));
  return new OSC.Message('/b_read', ...anyArr(base));
};

export const bReadChannel = (
  bufnum: number,
  path: string,
  startFrame: number,
  numFrames: number,
  bufStartFrame: number,
  leaveOpen: number,
  channels: readonly number[],
  completionMsg?: Uint8Array,
): OSC.Message => {
  const base: unknown[] = [
    bufnum,
    path,
    startFrame,
    numFrames,
    bufStartFrame,
    leaveOpen,
    ...channels,
  ];
  if (completionMsg !== undefined) base.push(b(completionMsg));
  return new OSC.Message('/b_readChannel', ...anyArr(base));
};

// ── /b_write ──────────────────────────────────────────────────────────

export const bWrite = (
  bufnum: number,
  path: string,
  headerFormat: string,
  sampleFormat: string,
  numFrames = -1,
  startFrame = 0,
  leaveOpen = 0,
  completionMsg?: Uint8Array,
): OSC.Message => {
  const base: unknown[] = [
    bufnum,
    path,
    headerFormat,
    sampleFormat,
    numFrames,
    startFrame,
    leaveOpen,
  ];
  if (completionMsg !== undefined) base.push(b(completionMsg));
  return new OSC.Message('/b_write', ...anyArr(base));
};

// ── /b_free, /b_close, /b_zero ────────────────────────────────────────

export const bFree = (
  bufnum: number,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/b_free', bufnum)
    : new OSC.Message('/b_free', bufnum, b(completionMsg));

export const bClose = (
  bufnum: number,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/b_close', bufnum)
    : new OSC.Message('/b_close', bufnum, b(completionMsg));

export const bZero = (
  bufnum: number,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/b_zero', bufnum)
    : new OSC.Message('/b_zero', bufnum, b(completionMsg));

// ── /b_query ──────────────────────────────────────────────────────────

export const bQuery = (...bufnums: number[]): OSC.Message =>
  new OSC.Message('/b_query', ...bufnums);

// ── /b_set, /b_setn, /b_fill ──────────────────────────────────────────

export const bSet = (
  bufnum: number,
  ...pairs: ReadonlyArray<[number, number]>
): OSC.Message => new OSC.Message('/b_set', bufnum, ...pairs.flat());

/** `/b_setn bufnum start numValues v1 v2 …` — one contiguous run. */
export const bSetn = (
  bufnum: number,
  start: number,
  values: readonly number[],
): OSC.Message =>
  new OSC.Message('/b_setn', bufnum, start, values.length, ...values);

export const bFill = (
  bufnum: number,
  ...ranges: ReadonlyArray<[number, number, number]>
): OSC.Message => new OSC.Message('/b_fill', bufnum, ...ranges.flat());

// ── /b_get, /b_getn ───────────────────────────────────────────────────

export const bGet = (bufnum: number, ...indices: number[]): OSC.Message =>
  new OSC.Message('/b_get', bufnum, ...indices);

/** `/b_getn bufnum start count` — single range. */
export const bGetn = (
  bufnum: number,
  start: number,
  count: number,
): OSC.Message => new OSC.Message('/b_getn', bufnum, start, count);

// ── /b_gen, /b_setSampleRate ──────────────────────────────────────────

export const bGen = (
  bufnum: number,
  command: string,
  flags: number,
  ...params: (number | string)[]
): OSC.Message => new OSC.Message('/b_gen', bufnum, command, flags, ...params);

export const bSetSampleRate = (
  bufnum: number,
  sampleRate: number,
): OSC.Message => new OSC.Message('/b_setSampleRate', bufnum, sampleRate);
