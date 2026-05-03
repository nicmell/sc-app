/**
 * Per-scope WebSocket binary frame decoder. Each `/ws/scope`
 * connection delivers one chunk per WS message; the wire layout
 * is small because `bufferId` is implicit in the connection
 * (we know what we subscribed to):
 *
 * ```
 * [tick_index:u32_le | is_gap:u8 | channels:u8 | frame_count:u32_le | float32_le payload]
 * ```
 *
 * Total fixed header = 10 bytes. Payload is `frame_count × channels`
 * float32 little-endian samples (interleaved).
 *
 * Bridge-side counterpart: `src-tauri/src/server/ws_scope.rs`
 * `encode_scope_frame`. If you change the layout there, change it
 * here too.
 */

const HEADER_BYTES = 10;

export interface DecodedScopeFrame {
  tickIndex: number;
  isGap: boolean;
  channels: number;
  frameCount: number;
  /** Interleaved samples — `frameCount × channels` floats. Backed
   *  by a fresh `ArrayBuffer` so the worker can transfer it to
   *  the main thread cleanly. */
  data: Float32Array;
}

export function decodeScopeFrame(bytes: Uint8Array): DecodedScopeFrame {
  if (bytes.length < HEADER_BYTES) {
    throw new Error(
      `decodeScopeFrame: frame too short (${bytes.length} < ${HEADER_BYTES})`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tickIndex = view.getUint32(0, true);
  const isGap = bytes[4] !== 0;
  const channels = bytes[5];
  const frameCount = view.getUint32(6, true);
  const dataStart = HEADER_BYTES;
  const dataLen = frameCount * channels;
  const dataBytes = dataLen * 4;
  if (bytes.length < dataStart + dataBytes) {
    throw new Error(
      `decodeScopeFrame: payload truncated — need ${dataBytes} bytes, ` +
        `have ${bytes.length - dataStart}`,
    );
  }
  const data = new Float32Array(dataLen);
  for (let i = 0; i < dataLen; i++) {
    data[i] = view.getFloat32(dataStart + i * 4, true);
  }
  return { tickIndex, isGap, channels, frameCount, data };
}
