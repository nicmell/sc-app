/**
 * Phase 31c wire format: worker ↔ bridge binary frames for SHM
 * scope subscriptions, distinguished from OSC bytes on the same
 * WebSocket by a 1-byte op tag. OSC frames start with `/` (0x2f)
 * for messages or `#` (0x23) for bundles, so any byte ≤ 0x1f is
 * unambiguous as a non-OSC scope-protocol op.
 *
 * Bridge-side counterpart: `src-tauri/src/scope_shm.rs` —
 * encoders/decoders mirror the same byte layout. If you change
 * the layout here, change it there too.
 */

export const SCOPE_OP_SUBSCRIBE = 0x01;
export const SCOPE_OP_UNSUBSCRIBE = 0x02;
export const SCOPE_OP_CHUNK = 0x03;

/** `0x01` subscribe (worker → bridge):
 *
 *   [op:u8 = 0x01]
 *   [scope_idx:u32_le]
 *   [channels:u32_le]
 *   [chunk_size:u32_le]
 *   [buffer_id_len:u8]
 *   [buffer_id:utf8 bytes]
 */
export function encodeSubscribe(
  bufferId: string,
  scopeNum: number,
  channels: number,
  chunkSize: number,
): Uint8Array {
  const idBytes = new TextEncoder().encode(bufferId);
  if (idBytes.length > 255) {
    throw new Error(
      `encodeSubscribe: bufferId encodes to ${idBytes.length} bytes (max 255)`,
    );
  }
  const buf = new Uint8Array(1 + 4 + 4 + 4 + 1 + idBytes.length);
  const view = new DataView(buf.buffer);
  buf[0] = SCOPE_OP_SUBSCRIBE;
  view.setUint32(1, scopeNum, true);
  view.setUint32(5, channels, true);
  view.setUint32(9, chunkSize, true);
  buf[13] = idBytes.length;
  buf.set(idBytes, 14);
  return buf;
}

/** `0x02` unsubscribe (worker → bridge):
 *
 *   [op:u8 = 0x02]
 *   [buffer_id_len:u8]
 *   [buffer_id:utf8 bytes]
 */
export function encodeUnsubscribe(bufferId: string): Uint8Array {
  const idBytes = new TextEncoder().encode(bufferId);
  if (idBytes.length > 255) {
    throw new Error(
      `encodeUnsubscribe: bufferId encodes to ${idBytes.length} bytes (max 255)`,
    );
  }
  const buf = new Uint8Array(2 + idBytes.length);
  buf[0] = SCOPE_OP_UNSUBSCRIBE;
  buf[1] = idBytes.length;
  buf.set(idBytes, 2);
  return buf;
}

/** Decoded `0x03` bufferChunk frame from the bridge. */
export interface DecodedChunk {
  bufferId: string;
  tickIndex: number;
  isGap: boolean;
  channels: number;
  frameCount: number;
  /** Interleaved samples — `frameCount × channels` floats.
   *  Backed by a fresh `ArrayBuffer` so the worker can transfer
   *  it to main without affecting the WS message. */
  data: Float32Array;
}

/** Decode a `0x03` chunk frame:
 *
 *   [op:u8 = 0x03]
 *   [tick_index:u32_le]
 *   [is_gap:u8]
 *   [channels:u8]
 *   [frame_count:u32_le]
 *   [buffer_id_len:u8]
 *   [buffer_id:utf8 bytes]
 *   [frame_count × channels × float32_le]
 */
export function decodeChunk(bytes: Uint8Array): DecodedChunk {
  if (bytes.length < 1 + 4 + 1 + 1 + 4 + 1) {
    throw new Error(`decodeChunk: frame too short (${bytes.length} bytes)`);
  }
  if (bytes[0] !== SCOPE_OP_CHUNK) {
    throw new Error(`decodeChunk: wrong op tag 0x${bytes[0].toString(16)}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tickIndex = view.getUint32(1, true);
  const isGap = bytes[5] !== 0;
  const channels = bytes[6];
  const frameCount = view.getUint32(7, true);
  const idLen = bytes[11];
  if (bytes.length < 12 + idLen) {
    throw new Error('decodeChunk: bufferId truncated');
  }
  const bufferId = new TextDecoder('utf-8').decode(
    bytes.subarray(12, 12 + idLen),
  );
  const dataStart = 12 + idLen;
  const dataLen = frameCount * channels;
  const dataBytes = dataLen * 4;
  if (bytes.length < dataStart + dataBytes) {
    throw new Error(
      `decodeChunk: payload truncated — need ${dataBytes} bytes, have ${bytes.length - dataStart}`,
    );
  }
  // Copy into a fresh buffer so the Float32Array can be cleanly
  // transferred to the main thread. Without the copy the
  // underlying buffer is the WS message's, and the WS sink may
  // still be holding a reference.
  const data = new Float32Array(dataLen);
  // Read each float as little-endian explicitly via DataView so
  // we don't rely on platform endianness.
  for (let i = 0; i < dataLen; i++) {
    data[i] = view.getFloat32(dataStart + i * 4, true);
  }
  return {
    bufferId,
    tickIndex,
    isGap,
    channels,
    frameCount,
    data,
  };
}
