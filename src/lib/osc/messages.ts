import OSC from 'osc-js';
import sineSynthDefUrl from '@/assets/synthdefs/sine.scsyndef?url';

export function createStatusMessage() {
  return new OSC.Message('/status');
}

export function createDumpOscMessage(level: number = 1) {
  return new OSC.Message('/dumpOSC', level);
}

export function createNotifyMessage(flag: number = 1, clientId: number = -1) {
  const msg = new OSC.Message('/notify', flag);
  if (clientId >= 0) {
    msg.add(clientId);
  }
  return msg;
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

export function createNodeRunMessage(nodeId: number, flag: number) {
  return new OSC.Message('/n_run', nodeId, flag);
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
