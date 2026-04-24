/**
 * Binary ⇆ osc-js adapters. The rest of the package deals in
 * `OSC.Message` / `OSC.Bundle` instances; these two wrappers are the
 * only place where bytes enter or leave.
 */

import OSC from 'osc-js';

export type OscPacket = OSC.Message | OSC.Bundle;

/** Serialise a message or bundle to the OSC binary format. */
export function encode(packet: OscPacket): Uint8Array {
  return packet.pack();
}

/** Parse OSC binary into an `OSC.Message` or `OSC.Bundle`. The outer
 *  `OSC.Packet` wrapper handles the bundle-vs-message discrimination
 *  by reading the leading magic (`#bundle\0` vs an address pattern). */
export function decode(bytes: Uint8Array): OscPacket {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packet = new OSC.Packet();
  packet.unpack(dv);
  return packet.value;
}

/** Narrow to `OSC.Message` at a decode site. */
export function isMessage(p: OscPacket): p is OSC.Message {
  return p instanceof OSC.Message;
}

/** Narrow to `OSC.Bundle` at a decode site. */
export function isBundle(p: OscPacket): p is OSC.Bundle {
  return p instanceof OSC.Bundle;
}
