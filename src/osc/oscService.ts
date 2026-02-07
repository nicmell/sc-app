import OSC from 'osc-js';

export function createStatusMessage() {
  return new OSC.Message('/status');
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
