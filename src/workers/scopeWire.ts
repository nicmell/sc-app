/**
 * In-band scope-chunk wire format on the main /ws (Phase 35).
 *
 * Multiplexed by a one-byte op tag at the start of each binary
 * frame. OSC always begins with `/` (0x2F) for messages or `#`
 * (0x23) for bundles, so 0x01..0x03 are unambiguous discriminators
 * for the scope subprotocol:
 *
 * ```
 * 0x01 subscribe    [op:u8 | sub_id:u32_le | scope:u32_le | channels:u32_le | chunk:u32_le]
 * 0x02 unsubscribe  [op:u8 | sub_id:u32_le]
 * 0x03 chunk        [op:u8 | sub_id:u32_le | tick:u32_le | is_gap:u8 |
 *                    channels:u8 | frames:u32_le | float32_le payload…]
 * ```
 *
 * `sub_id` is minted by the worker on subscribe — a monotonic u32
 * counter local to the worker. The bridge never interprets it, just
 * echoes it back on chunk frames. Saves ~30+ bytes per chunk vs the
 * length-prefixed string `bufferId` variant we used pre-Phase-35.
 *
 * Bridge-side counterpart: `src-tauri/src/server/ws_bridge.rs`'s
 * scope handlers + `forward_broadcast`'s SHM polling. If you
 * change the layout there, change it here too.
 */

export const SCOPE_OP_SUBSCRIBE = 0x01;
export const SCOPE_OP_UNSUBSCRIBE = 0x02;
export const SCOPE_OP_CHUNK = 0x03;

const SUBSCRIBE_FRAME_LEN = 1 + 4 + 4 + 4 + 4;
const UNSUBSCRIBE_FRAME_LEN = 1 + 4;
const CHUNK_HEADER_LEN = 1 + 4 + 4 + 1 + 1 + 4;

export interface ScopeSubParams {
  scope: number;
  channels: number;
  chunkSize: number;
}

export interface DecodedScopeChunk {
  subId: number;
  tickIndex: number;
  isGap: boolean;
  channels: number;
  frameCount: number;
  /** Interleaved samples — `frameCount × channels` floats. Backed
   *  by a fresh `ArrayBuffer` so the worker can transfer it to
   *  the main thread cleanly. */
  data: Float32Array;
}

/** Tag a frame as a scope-protocol message (any of the 0x01..0x03
 *  ops). Used by `oscWorker`'s recv path to peek the first byte
 *  and route between OSC decode and chunk decode. */
export function isScopeFrame(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const op = bytes[0];
  return (
    op === SCOPE_OP_SUBSCRIBE ||
    op === SCOPE_OP_UNSUBSCRIBE ||
    op === SCOPE_OP_CHUNK
  );
}

export function encodeSubscribe(
  subId: number,
  params: ScopeSubParams,
): Uint8Array {
  const out = new Uint8Array(SUBSCRIBE_FRAME_LEN);
  const view = new DataView(out.buffer);
  out[0] = SCOPE_OP_SUBSCRIBE;
  view.setUint32(1, subId, true);
  view.setUint32(5, params.scope, true);
  view.setUint32(9, params.channels, true);
  view.setUint32(13, params.chunkSize, true);
  return out;
}

export function encodeUnsubscribe(subId: number): Uint8Array {
  const out = new Uint8Array(UNSUBSCRIBE_FRAME_LEN);
  const view = new DataView(out.buffer);
  out[0] = SCOPE_OP_UNSUBSCRIBE;
  view.setUint32(1, subId, true);
  return out;
}

export function decodeChunk(bytes: Uint8Array): DecodedScopeChunk {
  if (bytes.length < CHUNK_HEADER_LEN) {
    throw new Error(
      `decodeChunk: frame too short (${bytes.length} < ${CHUNK_HEADER_LEN})`,
    );
  }
  if (bytes[0] !== SCOPE_OP_CHUNK) {
    throw new Error(
      `decodeChunk: wrong op byte (${bytes[0]}, expected ${SCOPE_OP_CHUNK})`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const subId = view.getUint32(1, true);
  const tickIndex = view.getUint32(5, true);
  const isGap = bytes[9] !== 0;
  const channels = bytes[10];
  const frameCount = view.getUint32(11, true);
  const dataStart = CHUNK_HEADER_LEN;
  const dataLen = frameCount * channels;
  const dataBytes = dataLen * 4;
  if (bytes.length < dataStart + dataBytes) {
    throw new Error(
      `decodeChunk: payload truncated — need ${dataBytes} bytes, ` +
        `have ${bytes.length - dataStart}`,
    );
  }
  const data = new Float32Array(dataLen);
  for (let i = 0; i < dataLen; i++) {
    data[i] = view.getFloat32(dataStart + i * 4, true);
  }
  return { subId, tickIndex, isGap, channels, frameCount, data };
}
