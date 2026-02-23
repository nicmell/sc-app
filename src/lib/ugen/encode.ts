/**
 * Binary encoding utilities for SynthDef SCgf v2 format.
 * All multi-byte values are big-endian (DataView default).
 */
export class ByteWriter {
  private buf: ArrayBuffer;
  private view: DataView;
  private pos = 0;

  constructor(size = 4096) {
    this.buf = new ArrayBuffer(size);
    this.view = new DataView(this.buf);
  }

  private grow(needed: number) {
    if (this.pos + needed <= this.buf.byteLength) return;
    let newSize = this.buf.byteLength;
    while (newSize < this.pos + needed) newSize *= 2;
    const newBuf = new ArrayBuffer(newSize);
    new Uint8Array(newBuf).set(new Uint8Array(this.buf));
    this.buf = newBuf;
    this.view = new DataView(this.buf);
  }

  int8(v: number) {
    this.grow(1);
    this.view.setInt8(this.pos, v);
    this.pos += 1;
  }

  uint8(v: number) {
    this.grow(1);
    this.view.setUint8(this.pos, v);
    this.pos += 1;
  }

  int16(v: number) {
    this.grow(2);
    this.view.setInt16(this.pos, v);
    this.pos += 2;
  }

  int32(v: number) {
    this.grow(4);
    this.view.setInt32(this.pos, v);
    this.pos += 4;
  }

  float32(v: number) {
    this.grow(4);
    this.view.setFloat32(this.pos, v);
    this.pos += 4;
  }

  /** Pascal string: 1-byte unsigned length + ASCII bytes (max 255 chars). */
  pstring(s: string) {
    if (s.length > 255) throw new Error(`pstring too long: ${s.length}`);
    this.grow(1 + s.length);
    this.view.setUint8(this.pos, s.length);
    this.pos += 1;
    for (let i = 0; i < s.length; i++) {
      this.view.setUint8(this.pos + i, s.charCodeAt(i) & 0xff);
    }
    this.pos += s.length;
  }

  /** Returns a trimmed copy of the internal buffer. */
  bytes(): Uint8Array {
    return new Uint8Array(this.buf.slice(0, this.pos));
  }
}
