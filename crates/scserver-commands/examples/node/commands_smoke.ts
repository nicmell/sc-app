#!/usr/bin/env tsx
// Smoke test for the typed `commands` interface — the WIT-record, named-arg
// form. Every command takes a single record of typed fields, matching what
// a generated-only (no TS wrapper) flow can expose.
//
// Usage:
//   npm run build:wasm
//   ./node_modules/.bin/tsx commands_smoke.ts

import { core, commands, replies } from './pkg/scserver_commands.js';
import type { OscArg } from './pkg/interfaces/scserver-commands-core.js';

const { decodeMessage } = core;
const { parseReply } = replies;

function i(n: number): OscArg { return { tag: 'int32', val: n }; }
function f(n: number): OscArg { return { tag: 'float32', val: n }; }
function s(v: string): OscArg { return { tag: 'string', val: v }; }

let fails = 0;
function check(label: string, pass: boolean, detail?: string): void {
  if (pass) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label}${detail ? ` (${detail})` : ''}`); fails++; }
}

function argEq(got: OscArg, want: OscArg): boolean {
  if (got.tag !== want.tag) return false;
  if (typeof got.val === 'number' && typeof want.val === 'number') {
    return Math.abs(got.val - want.val) < 1e-6;
  }
  return got.val === want.val;
}

console.log('scserver-commands `commands` interface smoke test');
console.log('=================================================');

// 1. /status — zero-arg command, no record.
{
  console.log('\n▸ status()');
  const msg = commands.status();
  check('address is /status', msg.address() === '/status');
  check('no args', msg.args().length === 0);
}

// 2. /s_new — the headline example.
{
  console.log('\n▸ sNew({ defName, nodeId, addAction, targetId, tail })');
  const msg = commands.sNew({
    defName: 'sine',
    nodeId: 1001,
    addAction: 0,
    targetId: 1,
    tail: [
      [{ tag: 'name',  val: 'freq' }, { tag: 'float', val: 440 }],
      [{ tag: 'name',  val: 'amp'  }, { tag: 'float', val: 0.5 }],
    ],
  });
  const args = msg.args();
  check('address is /s_new', msg.address() === '/s_new');
  check('8 args (4 scalars + 2 pairs)', args.length === 8);
  check('arg[0] = "sine"', argEq(args[0], s('sine')));
  check('arg[1] = 1001', argEq(args[1], i(1001)));
  check('arg[4] = "freq"', argEq(args[4], s('freq')));
  check('arg[5] = 440.0', argEq(args[5], f(440)));
  check('arg[6] = "amp"', argEq(args[6], s('amp')));
  check('arg[7] = 0.5', argEq(args[7], f(0.5)));
}

// 3. /n_free — single-field record.
{
  console.log('\n▸ nFree({ nodeId })');
  const msg = commands.nFree({ nodeId: 1001 });
  check('address is /n_free', msg.address() === '/n_free');
  check('1 arg', msg.args().length === 1);
  check('arg[0] = 1001', argEq(msg.args()[0], i(1001)));
}

// 4. /b_alloc — required + trailing options.
{
  console.log('\n▸ bAlloc({ bufnum, numFrames }) with optionals undefined');
  const msg = commands.bAlloc({
    bufnum: 0,
    numFrames: 8192,
    numChannels: undefined,
    anOscMessage: undefined,
    theRequiredSample: undefined,
  });
  check('address is /b_alloc', msg.address() === '/b_alloc');
  check('2 args (optionals omitted)', msg.args().length === 2);
}

{
  console.log('\n▸ bAlloc with numChannels set');
  const msg = commands.bAlloc({
    bufnum: 0,
    numFrames: 8192,
    numChannels: 2,
    anOscMessage: undefined,
    theRequiredSample: undefined,
  });
  check('3 args', msg.args().length === 3);
  check('arg[2] = 2', argEq(msg.args()[2], i(2)));
}

// 5. /n_set — ControlId + NumericValue variants.
{
  console.log('\n▸ nSet({ nodeId, tail }) with mixed int-index and name keys');
  const msg = commands.nSet({
    nodeId: 1001,
    tail: [
      [{ tag: 'name',  val: 'freq' }, { tag: 'float', val: 220 }],
      [{ tag: 'index', val: 1 },      { tag: 'int',   val: 7 }],
    ],
  });
  const args = msg.args();
  check('address is /n_set', msg.address() === '/n_set');
  check('5 args (node + 2 pairs)', args.length === 5);
  check('arg[1] = "freq"', argEq(args[1], s('freq')));
  check('arg[2] = 220.0 (float)', argEq(args[2], f(220)));
  check('arg[3] = 1 (index → int)', argEq(args[3], i(1)));
  check('arg[4] = 7 (int variant)', argEq(args[4], i(7)));
}

// 6. /s_new with a bus reference control value.
{
  console.log('\n▸ sNew with Bus-variant control value');
  const msg = commands.sNew({
    defName: 'voice',
    nodeId: 1002,
    addAction: 0,
    targetId: 1,
    tail: [
      [{ tag: 'name', val: 'freq' }, { tag: 'bus', val: 'c10' }],
    ],
  });
  const args = msg.args();
  check('6 args', args.length === 6);
  check('arg[5] is string "c10"', argEq(args[5], s('c10')));
}

// 7. Round-trip — encode then decode.
{
  console.log('\n▸ encode + decodeMessage round-trip');
  const msg = commands.nFree({ nodeId: 7 });
  const bytes = msg.encode();
  const back = decodeMessage(bytes);
  check('round-tripped address', back.address() === '/n_free');
  check('round-tripped 1 arg', back.args().length === 1);
  check('round-tripped value', argEq(back.args()[0], i(7)));
}

// ── Typed replies ─────────────────────────────────────────────────────

// 8. /status.reply — full typed variant + typed payload record.
{
  console.log('\n▸ parseReply(/status.reply) typed');
  const m = new core.ServerMessage('/status.reply');
  m.push(i(1));                             // unused
  m.push(i(42)); m.push(i(3)); m.push(i(2)); m.push(i(10));
  m.push(f(0.05)); m.push(f(0.2));
  m.push({ tag: 'float64', val: 44100 });
  m.push({ tag: 'float64', val: 44100 });
  const reply = parseReply(m.encode());
  check('tag is status-reply', reply.tag === 'status-reply');
  if (reply.tag === 'status-reply') {
    check('numUgens is 42', reply.val.numUgens === 42);
    check('numSynths is 3', reply.val.numSynths === 3);
    check('avgCpu is 0.05', Math.abs(reply.val.avgCpu - 0.05) < 1e-6);
    check('actualSampleRate is 44100', reply.val.actualSampleRate === 44100);
  }
}

// 9. /n_go — node-info payload, no group fields.
{
  console.log('\n▸ parseReply(/n_go) typed');
  const m = new core.ServerMessage('/n_go');
  m.push(i(1001)); // node id
  m.push(i(0));    // parent
  m.push(i(-1));   // prev
  m.push(i(-1));   // next
  m.push(i(0));    // is-group = 0 (synth)
  const reply = parseReply(m.encode());
  check('tag is n-go', reply.tag === 'n-go');
  if (reply.tag === 'n-go') {
    check('nodeId is 1001', reply.val.nodeId === 1001);
    check('isGroup is 0', reply.val.isGroup === 0);
    check('headId is undefined (not a group)', reply.val.headId === undefined);
    check('tailId is undefined (not a group)', reply.val.tailId === undefined);
  }
}

// 10. /n_go with group fields.
{
  console.log('\n▸ parseReply(/n_go) group variant');
  const m = new core.ServerMessage('/n_go');
  m.push(i(2000)); m.push(i(0)); m.push(i(-1)); m.push(i(-1));
  m.push(i(1));    // is-group = 1
  m.push(i(2001)); // head
  m.push(i(2010)); // tail
  const reply = parseReply(m.encode());
  if (reply.tag === 'n-go') {
    check('isGroup is 1', reply.val.isGroup === 1);
    check('headId is 2001', reply.val.headId === 2001);
    check('tailId is 2010', reply.val.tailId === 2010);
  }
}

// 11. /done — address + extras.
{
  console.log('\n▸ parseReply(/done) with extras');
  const m = new core.ServerMessage('/done');
  m.push(s('/b_alloc')); m.push(i(5)); // bufnum echo
  const reply = parseReply(m.encode());
  check('tag is done', reply.tag === 'done');
  if (reply.tag === 'done') {
    check('address echoed', reply.val.address === '/b_alloc');
    check('extras length 1', reply.val.extras.length === 1);
    check('extras[0] is int 5', argEq(reply.val.extras[0], i(5)));
  }
}

// 12. /fail — error message included.
{
  console.log('\n▸ parseReply(/fail)');
  const m = new core.ServerMessage('/fail');
  m.push(s('/s_new')); m.push(s('SynthDef not found: bogus'));
  const reply = parseReply(m.encode());
  check('tag is fail', reply.tag === 'fail');
  if (reply.tag === 'fail') {
    check('fail address', reply.val.address === '/s_new');
    check('fail error', reply.val.error.includes('bogus'));
  }
}

// 13. /tr — trigger message.
{
  console.log('\n▸ parseReply(/tr)');
  const m = new core.ServerMessage('/tr');
  m.push(i(1001)); m.push(i(42)); m.push(f(3.14));
  const reply = parseReply(m.encode());
  check('tag is tr', reply.tag === 'tr');
  if (reply.tag === 'tr') {
    check('nodeId 1001', reply.val.nodeId === 1001);
    check('triggerId 42', reply.val.triggerId === 42);
    check('value 3.14', Math.abs(reply.val.value - 3.14) < 1e-6);
  }
}

// 14. Unknown reply → "other" fallback with raw message.
{
  console.log('\n▸ parseReply(unknown) → other variant');
  const m = new core.ServerMessage('/custom/ack');
  m.push(i(1)); m.push(s('hello'));
  const reply = parseReply(m.encode());
  check('tag is other', reply.tag === 'other');
  if (reply.tag === 'other') {
    check('address preserved', reply.val.address === '/custom/ack');
    check('2 args preserved', reply.val.args.length === 2);
  }
}

console.log();
if (fails === 0) {
  console.log('all commands smoke checks passed');
  process.exit(0);
} else {
  console.log(`${fails} check(s) failed`);
  process.exit(1);
}
