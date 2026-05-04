import { describe, expect, it } from 'vitest';

import {
  decode,
  decodeBlobFloatsBE,
  encode,
  isMessage,
  parseScopeChunkArgs,
  scopeSubscribe,
  scopeUnsubscribe,
  SCOPE_CHUNK_ADDRESS,
  SCOPE_SUBSCRIBE_ADDRESS,
  SCOPE_UNSUBSCRIBE_ADDRESS,
} from '@sc-app/server-commands';

describe('scope OSC wire (Phase 38)', () => {
  it('scopeSubscribe builds /scope/subscribe with 4 ints', () => {
    const msg = scopeSubscribe({
      subId: 7,
      scope: 12,
      channels: 2,
      chunkSize: 1024,
    });
    const bytes = encode(msg);
    const decoded = decode(bytes);
    if (!isMessage(decoded)) throw new Error('expected message');
    expect(decoded.address).toBe(SCOPE_SUBSCRIBE_ADDRESS);
    expect(decoded.args).toEqual([7, 12, 2, 1024]);
  });

  it('scopeUnsubscribe builds /scope/unsubscribe with 1 int', () => {
    const bytes = encode(scopeUnsubscribe(99));
    const decoded = decode(bytes);
    if (!isMessage(decoded)) throw new Error('expected message');
    expect(decoded.address).toBe(SCOPE_UNSUBSCRIBE_ADDRESS);
    expect(decoded.args).toEqual([99]);
  });

  it('decodeBlobFloatsBE round-trips a known big-endian float', () => {
    // 1.0_f32 = 0x3F800000 in IEEE-754. Pinned to catch
    // accidental endianness regressions.
    const blob = new Uint8Array([0x3f, 0x80, 0x00, 0x00]);
    const out = decodeBlobFloatsBE(blob);
    expect(out.length).toBe(1);
    expect(out[0]).toBe(1.0);
  });

  it('decodeBlobFloatsBE handles multi-float interleaved payloads', () => {
    // 0.5_f32 = 0x3F000000; -0.25_f32 = 0xBE800000
    const blob = new Uint8Array([
      0x3f, 0x00, 0x00, 0x00, 0xbe, 0x80, 0x00, 0x00,
    ]);
    const out = decodeBlobFloatsBE(blob);
    expect(Array.from(out)).toEqual([0.5, -0.25]);
  });

  it('parseScopeChunkArgs unpacks the bridge byte layout', () => {
    // Hand-build the bytes the bridge produces for
    // (subId=3, tick=10, isGap=false, channels=2, frames=2,
    //  floats=[0.5, -0.25, 1.0, -1.0]).
    // Expected blob: 16 bytes of BE float32.
    const floats = [0.5, -0.25, 1.0, -1.0];
    const blobBytes = new Uint8Array(floats.length * 4);
    const dv = new DataView(blobBytes.buffer);
    for (let i = 0; i < floats.length; i++) {
      dv.setFloat32(i * 4, floats[i], false);
    }
    const args: unknown[] = [3, 10, 0, 2, blobBytes];
    const chunk = parseScopeChunkArgs(args);
    expect(chunk.subId).toBe(3);
    expect(chunk.tickIndex).toBe(10);
    expect(chunk.isGap).toBe(false);
    expect(chunk.channels).toBe(2);
    expect(chunk.frameCount).toBe(2);
    expect(Array.from(chunk.data)).toEqual(floats);
  });

  it('parseScopeChunkArgs treats isGap > 0 as true', () => {
    const args: unknown[] = [0, 0, 1, 1, new Uint8Array(0)];
    const chunk = parseScopeChunkArgs(args);
    expect(chunk.isGap).toBe(true);
    expect(chunk.frameCount).toBe(0);
  });

  it('parseScopeChunkArgs rejects non-blob data arg', () => {
    const args: unknown[] = [0, 0, 0, 1, 'not-a-blob'];
    expect(() => parseScopeChunkArgs(args)).toThrow();
  });

  it('SCOPE_CHUNK_ADDRESS matches the bridge constant', () => {
    expect(SCOPE_CHUNK_ADDRESS).toBe('/scope/chunk');
  });
});
