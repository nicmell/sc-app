import OSC from 'osc-js';
import sineSynthDefUrl from '@/assets/synthdefs/sine.scsyndef?url';

export function statusMessage() {
  return new OSC.Message('/status');
}

export function dumpOscMessage(level: number = 1) {
  return new OSC.Message('/dumpOSC', level);
}

export function notifyMessage(flag: number = 1, clientId: number = -1) {
  const msg = new OSC.Message('/notify', flag);
  if (clientId >= 0) {
    msg.add(clientId);
  }
  return msg;
}

export function quitMessage() {
  return new OSC.Message('/quit');
}

export function versionMessage() {
  return new OSC.Message('/version');
}

export function newSynthMessage(
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

export function newGroupMessage(nodeId: number, addAction: number = 0, targetId: number = 0) {
  return new OSC.Message('/g_new', nodeId, addAction, targetId);
}

export function groupTailMessage(groupId: number, nodeId: number) {
  return new OSC.Message('/g_tail', groupId, nodeId);
}

export function groupFreeAllMessage(groupId: number) {
  return new OSC.Message('/g_freeAll', groupId);
}

export function freeNodeMessage(nodeId: number) {
  return new OSC.Message('/n_free', nodeId);
}

export function nodeRunMessage(nodeId: number, flag: number) {
  return new OSC.Message('/n_run', nodeId, flag);
}

export function nodeSetMessage(nodeId: number, params: Record<string, number>) {
  const msg = new OSC.Message('/n_set', nodeId);
  for (const [key, value] of Object.entries(params)) {
    msg.add(key);
    msg.add(value);
  }
  return msg;
}

export async function defRecvMessage() {
  const resp = await fetch(sineSynthDefUrl);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  return new OSC.Message('/d_recv', bytes as unknown as Blob);
}
