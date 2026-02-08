import OSC from 'osc-js';
import sineSynthDefUrl from '../assets/synthdefs/sine.scsyndef?url';

// --- Message creators ---

export function createStatusMessage() {
  return new OSC.Message('/status');
}

export function createDumpOscMessage(level: number = 1) {
  return new OSC.Message('/dumpOSC', level);
}

export function createNotifyMessage(flag: number = 1) {
  return new OSC.Message('/notify', flag);
}

export function createQuitMessage() {
  return new OSC.Message('/quit');
}

export function createVersionMessage() {
  return new OSC.Message('/version');
}

export function createSynthMessage(
  synthName: string = 'default',
  nodeId: number = 1000,
  addAction: number = 0,
  targetId: number = 0,
  params: Record<string, number> = { freq: 440, amp: 0.2 }
) {
  const msg = new OSC.Message('/s_new', synthName, nodeId, addAction, targetId);
  for (const [key, value] of Object.entries(params)) {
    msg.add(key);
    msg.add(value);
  }
  return msg;
}

export function createFreeNodeMessage(nodeId: number) {
  return new OSC.Message('/n_free', nodeId);
}

export function createNodeSetMessage(nodeId: number, params: Record<string, number>) {
  const msg = new OSC.Message('/n_set', nodeId);
  for (const [key, value] of Object.entries(params)) {
    msg.add(key);
    msg.add(value);
  }
  return msg;
}

export async function createDefRecvMessage() {
  const resp = await fetch(sineSynthDefUrl);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  return new OSC.Message('/d_recv', bytes as unknown as Blob);
}

// --- Reply parsing ---

export interface OscReply {
  address: string;
  args: unknown[];
}

export function parseOscResponse(data: Uint8Array): OscReply {
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const packet = new OSC.Packet();
  packet.unpack(dataView);
  const msg = packet.value as InstanceType<typeof OSC.Message>;
  return { address: msg.address, args: msg.args as unknown[] };
}

export function formatStatusReply(args: unknown[]): string {
  const [, ugens, synths, groups, defs, avgCpu, peakCpu, , actSR] = args as number[];
  return (
    `UGens: ${ugens} | Synths: ${synths} | Groups: ${groups} | Defs: ${defs} | ` +
    `CPU: ${avgCpu.toFixed(1)}% avg / ${peakCpu.toFixed(1)}% peak | ` +
    `SR: ${actSR.toFixed(0)} Hz`
  );
}

export function formatVersionReply(args: unknown[]): string {
  const [name, major, minor, patch, branch, hash] = args as (string | number)[];
  return `${name} ${major}.${minor}.${patch} (${branch} ${hash})`;
}

/** Format any OSC reply for display in the log. */
export function formatOscReply(reply: OscReply): string {
  switch (reply.address) {
    case '/status.reply':
      return formatStatusReply(reply.args);
    case '/version.reply':
      return formatVersionReply(reply.args);
    default:
      return `${reply.address} ${reply.args.join(' ')}`;
  }
}
