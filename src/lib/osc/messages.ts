import OSC from 'osc-js';
import sineSynthDefUrl from '@/assets/synthdefs/sine.scsyndef?url';
import {OSC_MESSAGES} from '@/constants/osc.ts';

export function statusMessage() {
  return new OSC.Message(OSC_MESSAGES.STATUS);
}

export function dumpOscMessage(level: number = 1) {
  return new OSC.Message(OSC_MESSAGES.DUMP_OSC, level);
}

export function notifyMessage(flag: number = 1, clientId: number = -1) {
  const msg = new OSC.Message(OSC_MESSAGES.NOTIFY, flag);
  if (clientId >= 0) {
    msg.add(clientId);
  }
  return msg;
}

export function quitMessage() {
  return new OSC.Message(OSC_MESSAGES.QUIT);
}

export function versionMessage() {
  return new OSC.Message(OSC_MESSAGES.VERSION);
}

export function newSynthMessage(
  synthName: string = 'default',
  nodeId: number = 1000,
  addAction: number = 0,
  targetId: number = 0,
  params: Record<string, number> = { freq: 440, amp: 0.2 }
) {
  const msg = new OSC.Message(OSC_MESSAGES.SYNTH_NEW, synthName, nodeId, addAction, targetId);
  for (const [key, value] of Object.entries(params)) {
    msg.add(key);
    msg.add(value);
  }
  return msg;
}

export function newGroupMessage(nodeId: number, addAction: number = 0, targetId: number = 0) {
  return new OSC.Message(OSC_MESSAGES.GROUP_NEW, nodeId, addAction, targetId);
}

export function groupTailMessage(groupId: number, nodeId: number) {
  return new OSC.Message(OSC_MESSAGES.GROUP_TAIL, groupId, nodeId);
}

export function groupFreeAllMessage(groupId: number) {
  return new OSC.Message(OSC_MESSAGES.GROUP_FREE_ALL, groupId);
}

export function freeNodeMessage(nodeId: number) {
  return new OSC.Message(OSC_MESSAGES.NODE_FREE, nodeId);
}

export function nodeRunMessage(nodeId: number, flag: number) {
  return new OSC.Message(OSC_MESSAGES.NODE_RUN, nodeId, flag);
}

export function nodeSetMessage(nodeId: number, params: Record<string, number>) {
  const msg = new OSC.Message(OSC_MESSAGES.NODE_SET, nodeId);
  for (const [key, value] of Object.entries(params)) {
    msg.add(key);
    msg.add(value);
  }
  return msg;
}

export async function defRecvMessage() {
  const resp = await fetch(sineSynthDefUrl);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  return new OSC.Message(OSC_MESSAGES.DEF_RECV, bytes as unknown as Blob);
}
