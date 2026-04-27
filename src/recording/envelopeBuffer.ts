/**
 * Per-tick min/max envelope storage for a recording's waveform view.
 *
 * Two `Float32Array`s per channel — one for mins, one for maxs —
 * indexed by an ordinal "column" (= 0 at `firstTickIndex`, growing
 * by one per appended tick). Capacity grows by doubling, so for a
 * 30-minute recording at 46.875 ticks/sec we end up with two ~84,000-
 * element arrays per channel (~700 KB total stereo). Memory cost is
 * dominated by the WAV itself, not these envelopes.
 *
 * Snapshots return shallow `Float32Array` views (subarray) over the
 * filled prefix. Callers must not mutate them. Each `append` may
 * invalidate a previous snapshot's underlying storage if a grow
 * happened — read snapshots fresh inside the RAF loop.
 */

const INITIAL_CAPACITY = 256;

export interface EnvelopeBufferSnapshot {
  /** One Float32Array per channel, length = `count`. */
  mins: ReadonlyArray<Float32Array>;
  maxs: ReadonlyArray<Float32Array>;
  /** `tickIndex` corresponding to column 0. */
  firstTickIndex: number;
  /** Number of populated columns. */
  count: number;
  channels: number;
}

export class EnvelopeBuffer {
  readonly channels: number;
  private mins: Float32Array[];
  private maxs: Float32Array[];
  private capacity: number;
  private _firstTickIndex = -1;
  private _count = 0;

  constructor(channels: number) {
    if (!Number.isInteger(channels) || channels < 1) {
      throw new Error(
        `EnvelopeBuffer: channels must be a positive integer, got ${channels}`,
      );
    }
    this.channels = channels;
    this.capacity = INITIAL_CAPACITY;
    this.mins = Array.from(
      { length: channels },
      () => new Float32Array(this.capacity),
    );
    this.maxs = Array.from(
      { length: channels },
      () => new Float32Array(this.capacity),
    );
  }

  get count(): number {
    return this._count;
  }

  get firstTickIndex(): number {
    return this._firstTickIndex;
  }

  /** Compute per-channel min/max over `chunk` (which is interleaved
   *  `channels`-stride samples) and append a column tagged
   *  `tickIndex`. The first append anchors `firstTickIndex`. */
  append(tickIndex: number, chunk: Float32Array): void {
    if (chunk.length === 0) return;
    if (chunk.length % this.channels !== 0) {
      throw new Error(
        `EnvelopeBuffer.append: chunk length ${chunk.length} not a multiple of channels ${this.channels}`,
      );
    }
    if (this._count === 0) this._firstTickIndex = tickIndex;
    if (this._count >= this.capacity) this.grow();

    const stride = this.channels;
    const samplesPerChannel = chunk.length / stride;

    for (let c = 0; c < this.channels; c++) {
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < samplesPerChannel; i++) {
        const v = chunk[i * stride + c];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      // Defensive against an empty chunk slipping through (already
      // ruled out above, but keeps the typed arrays non-NaN).
      if (mn === Infinity) mn = 0;
      if (mx === -Infinity) mx = 0;
      this.mins[c][this._count] = mn;
      this.maxs[c][this._count] = mx;
    }
    this._count++;
  }

  /** Snapshot for read-only consumption. Cheap — just `subarray`
   *  views that share the underlying buffer. */
  snapshot(): EnvelopeBufferSnapshot {
    return {
      mins: this.mins.map((arr) => arr.subarray(0, this._count)),
      maxs: this.maxs.map((arr) => arr.subarray(0, this._count)),
      firstTickIndex: this._firstTickIndex,
      count: this._count,
      channels: this.channels,
    };
  }

  private grow(): void {
    const next = this.capacity * 2;
    for (let c = 0; c < this.channels; c++) {
      const newMins = new Float32Array(next);
      const newMaxs = new Float32Array(next);
      newMins.set(this.mins[c]);
      newMaxs.set(this.maxs[c]);
      this.mins[c] = newMins;
      this.maxs[c] = newMaxs;
    }
    this.capacity = next;
  }
}
