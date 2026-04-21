#!/usr/bin/env tsx
// End-to-end smoke test for the jco-transpiled scserver-commands
// component. Builds a handful of server commands + an NRT score, encodes
// them on the JS side, and verifies the byte output round-trips through
// decodeMessage. Also exercises `parseReply`.
//
// Usage:
//   npm run build:wasm
//   npm run roundtrip

import { core } from './pkg/scserver_commands.js';
import type { OscArg } from './pkg/interfaces/scserver-commands-core.js';

const { ServerMessage, NrtScore, decodeMessage, parseReply, registryJson } = core;

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function i(n: number): OscArg { return { tag: 'int32', val: n }; }
function f(n: number): OscArg { return { tag: 'float32', val: n }; }
function s(v: string): OscArg { return { tag: 'string', val: v }; }

let fails = 0;
function check(label: string, pass: boolean, detail?: string): void {
  if (pass) console.log(`  ✓ ${label}`);
  else {
    console.log(`  ✗ ${label}${detail ? ` (${detail})` : ''}`);
    fails++;
  }
}

console.log('scserver-commands jco smoke test');
console.log('================================');

// 1. /status — no args. Matches the hand-computed OSC wire form.
{
  console.log('\n▸ /status');
  const msg = new ServerMessage('/status');
  const bytes = msg.encode();
  const expected = new Uint8Array([
    0x2f, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0x00, // "/status\0"
    0x2c, 0x00, 0x00, 0x00, // ",\0\0\0"
  ]);
  check('bytes match spec wire format', eq(bytes, expected), hex(bytes));
  const back = decodeMessage(bytes);
  check('round-trips through decodeMessage', back.address() === '/status');
}

// 2. /s_new with one control pair.
{
  console.log('\n▸ /s_new');
  const msg = new ServerMessage('/s_new');
  msg.push(s('sine'));    // def_name
  msg.push(i(1001));      // node id
  msg.push(i(0));         // add action (head)
  msg.push(i(1));         // target
  msg.push(s('freq'));
  msg.push(f(440));
  const bytes = msg.encode();
  const back = decodeMessage(bytes);
  const args = back.args();
  check('address is /s_new', back.address() === '/s_new');
  check('six args present', args.length === 6, `got ${args.length}`);
  check('arg[0] is "sine"', args[0].tag === 'string' && args[0].val === 'sine');
  check('arg[5] is float 440', args[5].tag === 'float32' && Math.abs((args[5].val as number) - 440) < 1e-6);
}

// 3. NRT score — build a tiny song.
{
  console.log('\n▸ NRT score');
  const score = new NrtScore();
  score.at(0.0, (() => {
    const m = new ServerMessage('/g_new');
    m.push(i(1001)); m.push(i(0)); m.push(i(0));
    return m;
  })());
  score.at(0.5, (() => {
    const m = new ServerMessage('/s_new');
    m.push(s('sine')); m.push(i(1002)); m.push(i(0)); m.push(i(1001));
    return m;
  })());
  score.at(2.0, (() => {
    const m = new ServerMessage('/n_free');
    m.push(i(1002));
    return m;
  })());
  const bytes = score.encode();
  check('score produced bytes', bytes.length > 0, `${bytes.length} bytes`);
  // Layout: length-prefixed bundles. Verify first entry's prefix.
  const firstLen = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
  check('first bundle has valid length prefix', firstLen > 0 && firstLen + 4 <= bytes.length);
}

// 4. parseReply on a fabricated /status.reply.
{
  console.log('\n▸ parseReply(/status.reply)');
  const m = new ServerMessage('/status.reply');
  m.push(i(1));                             // unused
  m.push(i(42)); m.push(i(3)); m.push(i(2)); m.push(i(10));
  m.push(f(0.05)); m.push(f(0.2));
  m.push({ tag: 'float64', val: 44100 });
  m.push({ tag: 'float64', val: 44100 });
  const bytes = m.encode();
  const json = JSON.parse(parseReply(bytes));
  check('reply classified as status-reply', json.kind === 'status-reply');
  check('num-ugens is 42', json.num_ugens === 42);
  check('actual-sample-rate is 44100', json.actual_sample_rate === 44100);
}

// 5. Registry JSON carries 70+ command entries.
{
  console.log('\n▸ registryJson()');
  const catalogue = JSON.parse(registryJson());
  check('registry is array', Array.isArray(catalogue));
  check('at least 70 entries', catalogue.length >= 70, `got ${catalogue.length}`);
  check('/s_new is in registry', catalogue.some((e: any) => e.address === '/s_new'));
}

console.log();
if (fails === 0) {
  console.log('all smoke checks passed');
  process.exit(0);
} else {
  console.log(`${fails} check(s) failed`);
  process.exit(1);
}
