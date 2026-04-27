/**
 * In-memory WAV encoder, lives in the OSC worker.
 *
 * Builds a single contiguous `Uint8Array` representing a complete WAV
 * file. The header is written up-front with placeholder size fields;
 * `finalise()` patches them and returns the underlying `ArrayBuffer`,
 * ready to be `postMessage`d to the main thread with zero-copy
 * transfer.
 *
 * Format chosen: **IEEE float32** (`fmt ` format code 3), 32-bit, LE.
 * The recorder buffers hold raw `Float32Array` samples already, so
 * float32 output skips a quantisation step and preserves full
 * precision. That doubles file size vs. 16-bit PCM but matches
 * what every modern DAW expects from a "scientific" capture.
 *
 * Memory growth strategy: doubling capacity (`Uint8Array` realloc +
 * `set`). Peak transient footprint is ~2× current size during
 * growth — see `plan.md` Phase 12 memory budget for the practical
 * ceiling (~10–15 minutes stereo before RAM pressure).
 */

const RIFF_HEADER_SIZE = 44;
/** Initial buffer capacity in bytes. 64 KiB is roughly 0.34 s of
 *  mono float32 at 48 kHz — enough that small recordings don't reallocate
 *  at all. */
const INITIAL_CAPACITY = 64 * 1024;

export interface WavWriterOptions {
  sampleRate: number;
  channels: number;
}

export class WavMemoryWriter {
  readonly sampleRate: number;
  readonly channels: number;
  private buffer: Uint8Array;
  private view: DataView;
  /** Byte offset of the next write. Starts past the placeholder
   *  header. Equals total file size at finalise time. */
  private writeOffset = RIFF_HEADER_SIZE;
  private _framesWritten = 0;
  private finalised = false;

  constructor(opts: WavWriterOptions) {
    if (!Number.isInteger(opts.sampleRate) || opts.sampleRate <= 0) {
      throw new Error(
        `WavMemoryWriter: sampleRate must be a positive integer, got ${opts.sampleRate}`,
      );
    }
    if (!Number.isInteger(opts.channels) || opts.channels < 1) {
      throw new Error(
        `WavMemoryWriter: channels must be a positive integer, got ${opts.channels}`,
      );
    }
    this.sampleRate = opts.sampleRate;
    this.channels = opts.channels;
    this.buffer = new Uint8Array(INITIAL_CAPACITY);
    this.view = new DataView(this.buffer.buffer);
    this.writePlaceholderHeader();
  }

  /** Frames (one frame = one sample per channel) appended so far. */
  get framesWritten(): number {
    return this._framesWritten;
  }

  /** Append `frames` interleaved float32 samples. `frames.length` must
   *  be a multiple of `channels`. The chunk is copied byte-for-byte
   *  into the internal buffer; the caller's `Float32Array` is not
   *  retained. */
  append(frames: Float32Array): void {
    if (this.finalised) {
      throw new Error('WavMemoryWriter.append: writer already finalised');
    }
    if (frames.length === 0) return;
    if (frames.length % this.channels !== 0) {
      throw new Error(
        `WavMemoryWriter.append: frames.length (${frames.length}) must be a ` +
          `multiple of channels (${this.channels})`,
      );
    }
    const byteLength = frames.length * 4;
    this.ensureCapacity(this.writeOffset + byteLength);
    // Float32Array is platform-endian. WAV is little-endian. On x86 +
    // ARM (everything we care about) those agree, so a byte copy
    // is safe. We assert it here defensively in case someone runs
    // this on big-endian (vanishingly unlikely in 2026).
    if (!IS_LITTLE_ENDIAN) {
      // Fallback: write samples one-at-a-time via DataView for the
      // (theoretical) BE case.
      for (let i = 0; i < frames.length; i++) {
        this.view.setFloat32(this.writeOffset + i * 4, frames[i], true);
      }
    } else {
      const bytes = new Uint8Array(frames.buffer, frames.byteOffset, byteLength);
      this.buffer.set(bytes, this.writeOffset);
    }
    this.writeOffset += byteLength;
    this._framesWritten += frames.length / this.channels;
  }

  /** Patch the RIFF + data size fields and return a tightly-packed
   *  `ArrayBuffer` suitable for transferring to the main thread. The
   *  writer is unusable after this call. */
  finalise(): ArrayBuffer {
    if (this.finalised) {
      throw new Error('WavMemoryWriter.finalise: already finalised');
    }
    this.finalised = true;
    const totalSize = this.writeOffset;
    const dataSize = totalSize - RIFF_HEADER_SIZE;
    // RIFF chunk size = total file size − 8 (the 'RIFF' magic + size
    // field themselves). Both fields are little-endian uint32.
    this.view.setUint32(4, totalSize - 8, true);
    this.view.setUint32(40, dataSize, true);
    // Slice down to the exact size — the doubling strategy may have
    // over-allocated. `slice` always copies, returning a fresh
    // ArrayBuffer that the worker can transfer to main without
    // detaching the in-progress allocation underneath us.
    return this.buffer.buffer.slice(0, totalSize);
  }

  // ── Internals ─────────────────────────────────────────────────────

  private ensureCapacity(needed: number): void {
    if (needed <= this.buffer.byteLength) return;
    let cap = this.buffer.byteLength;
    while (cap < needed) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buffer);
    this.buffer = next;
    this.view = new DataView(next.buffer);
  }

  private writePlaceholderHeader(): void {
    // WAV / RIFF + WAVE + fmt + data layout. All multi-byte fields
    // little-endian. Sizes are placeholders, patched in finalise().
    //
    //   offset  size  field
    //   ──────  ────  ──────────────────────────────────────────────
    //    0      4     "RIFF"
    //    4      4     RIFF chunk size            (placeholder 0)
    //    8      4     "WAVE"
    //   12      4     "fmt "
    //   16      4     fmt chunk size = 16
    //   20      2     audio format = 3 (IEEE float)
    //   22      2     numChannels
    //   24      4     sampleRate
    //   28      4     byteRate = sampleRate × numChannels × 4
    //   32      2     blockAlign = numChannels × 4
    //   34      2     bitsPerSample = 32
    //   36      4     "data"
    //   40      4     data chunk size            (placeholder 0)
    const v = this.view;
    writeAscii(v, 0, 'RIFF');
    v.setUint32(4, 0, true);
    writeAscii(v, 8, 'WAVE');
    writeAscii(v, 12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 3, true);
    v.setUint16(22, this.channels, true);
    v.setUint32(24, this.sampleRate, true);
    v.setUint32(28, this.sampleRate * this.channels * 4, true);
    v.setUint16(32, this.channels * 4, true);
    v.setUint16(34, 32, true);
    writeAscii(v, 36, 'data');
    v.setUint32(40, 0, true);
  }
}

function writeAscii(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}

const IS_LITTLE_ENDIAN = (() => {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setUint16(0, 1, true);
  return new Uint8Array(buf)[0] === 1;
})();
