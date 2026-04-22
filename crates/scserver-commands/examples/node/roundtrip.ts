#!/usr/bin/env tsx
// Smoke test for the jco-transpiled scserver-commands component.
//
// Exercises the variant-based API across three sibling interfaces:
//   - `commands.encode(msg)`            — one exported function for every
//                                          command, discriminated by tag.
//   - `nrt.NrtScore`                    — assembles scores from typed
//                                          `ServerMessage` values.
//   - `replies.parseReply(bytes)`       — typed union, unchanged.
//
// To verify the content of encoded commands we round-trip the bytes
// through `parseReply`: addresses outside the reply catalogue come back
// as `{ tag: 'other', val: { address, args } }`, which gives us the
// decoded shape without a dedicated command-side decoder.
//
// Usage:
//   npm run build:wasm
//   npm run roundtrip

import { commands, nrt, replies } from './pkg/scserver_commands.js';
import type { OscArg } from './pkg/interfaces/scserver-commands-core.js';
import type { ServerMessage } from './pkg/interfaces/scserver-commands-commands.js';

const { encode } = commands;
const { NrtScore } = nrt;
const { parseReply } = replies;

function i(n: number): OscArg { return { tag: 'int32', val: n }; }
function f(n: number): OscArg { return { tag: 'float32', val: n }; }
function s(v: string): OscArg { return { tag: 'string', val: v }; }

function argEq(got: OscArg, want: OscArg): boolean {
  if (got.tag !== want.tag) return false;
  if (typeof got.val === 'number' && typeof want.val === 'number') {
    return Math.abs(got.val - want.val) < 1e-6;
  }
  return got.val === want.val;
}

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

let fails = 0;
function check(label: string, pass: boolean, detail?: string): void {
  if (pass) console.log(`  ✓ ${label}`);
  else { console.log(`  ✗ ${label}${detail ? ` (${detail})` : ''}`); fails++; }
}

/** Encode then `parseReply`-back: the reply parser returns `other` for any
 *  address outside its catalogue, which gives us a decoded `{address, args}`
 *  view of any command's wire bytes. */
function decodeAsOther(msg: ServerMessage): { address: string; args: OscArg[] } {
  const bytes = encode(msg);
  const reply = parseReply(bytes);
  if (reply.tag !== 'other') {
    throw new Error(`expected 'other' for non-reply addr, got '${reply.tag}'`);
  }
  return reply.val;
}

console.log('scserver-commands jco smoke test');
console.log('================================');

// 1. /status — zero-arg unit variant.
{
  console.log('\n▸ encode({ tag: "status" })');
  const bytes = encode({ tag: 'status' });
  const expected = new Uint8Array([
    0x2f, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0x00, // "/status\0"
    0x2c, 0x00, 0x00, 0x00, // ",\0\0\0"
  ]);
  check('matches hand-computed OSC wire form', eq(bytes, expected));
}

// 2. /s_new — the headline example with control pairs.
{
  console.log('\n▸ encode({ tag: "s-new", val: { defName, ..., tail } })');
  const { address, args } = decodeAsOther({
    tag: 's-new',
    val: {
      defName: 'sine',
      nodeId: 1001,
      addAction: 0,
      targetId: 1,
      tail: [
        [{ tag: 'name', val: 'freq' }, { tag: 'float', val: 440 }],
        [{ tag: 'name', val: 'amp' },  { tag: 'float', val: 0.5 }],
      ],
    },
  });
  check('address is /s_new', address === '/s_new');
  check('8 args (4 scalars + 2 pairs)', args.length === 8);
  check('arg[0] = "sine"', argEq(args[0], s('sine')));
  check('arg[4] = "freq"', argEq(args[4], s('freq')));
  check('arg[5] = 440', argEq(args[5], f(440)));
}

// 3. /b_alloc — required fields + optional overrides via struct update.
{
  console.log('\n▸ encode({ tag: "b-alloc", val: { bufnum, numFrames } })');
  const { address, args } = decodeAsOther({
    tag: 'b-alloc',
    val: { bufnum: 0, numFrames: 8192 },
  });
  check('address is /b_alloc', address === '/b_alloc');
  check('2 args (optionals omitted)', args.length === 2);
}

{
  console.log('\n▸ encode({ tag: "b-alloc", val: { ..., numChannels: 2 } })');
  const { args } = decodeAsOther({
    tag: 'b-alloc',
    val: { bufnum: 0, numFrames: 8192, numChannels: 2 },
  });
  check('3 args (numChannels appended)', args.length === 3);
  check('arg[2] = 2', argEq(args[2], i(2)));
}

// 4. /n_set — ControlId + NumericValue polymorphism.
{
  console.log('\n▸ encode({ tag: "n-set", val: { tail: mixed id/value variants } })');
  const { address, args } = decodeAsOther({
    tag: 'n-set',
    val: {
      nodeId: 1001,
      tail: [
        [{ tag: 'name', val: 'freq' }, { tag: 'float', val: 220 }],
        [{ tag: 'index', val: 1 },     { tag: 'int',   val: 7 }],
      ],
    },
  });
  check('address is /n_set', address === '/n_set');
  check('arg[1] = "freq"', argEq(args[1], s('freq')));
  check('arg[2] = 220 (float)', argEq(args[2], f(220)));
  check('arg[3] = 1 (index → int)', argEq(args[3], i(1)));
  check('arg[4] = 7 (int)', argEq(args[4], i(7)));
}

// 5. /s_new with a Bus-variant control value.
{
  console.log('\n▸ encode({ tag: "s-new", ..., tail with bus variant })');
  const { args } = decodeAsOther({
    tag: 's-new',
    val: {
      defName: 'voice',
      nodeId: 1002,
      addAction: 0,
      targetId: 1,
      tail: [[{ tag: 'name', val: 'freq' }, { tag: 'bus', val: 'c10' }]],
    },
  });
  check('arg[5] is string "c10"', argEq(args[5], s('c10')));
}

// 6. NRT score — build a tiny song from three typed ServerMessages.
{
  console.log('\n▸ NrtScore.at(seconds, ServerMessage)');
  const score = new NrtScore();
  score.at(0.0, {
    tag: 'g-new',
    val: { tail: [[1001, 0, 0]] },
  });
  score.at(0.5, {
    tag: 's-new',
    val: { defName: 'sine', nodeId: 1002, addAction: 0, targetId: 1001, tail: [] },
  });
  score.at(2.0, { tag: 'n-free', val: { nodeId: 1002 } });
  const bytes = score.encode();
  check('score has bytes', bytes.length > 0);
  const firstLen = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
  check('first bundle has valid length prefix', firstLen > 0 && firstLen + 4 <= bytes.length);
}

// 7. Escape hatch — `other` variant for addresses outside the catalogue.
{
  console.log('\n▸ encode({ tag: "other", val: { address, args } })');
  const { address, args } = decodeAsOther({
    tag: 'other',
    val: { address: '/my-plugin-cmd', args: [i(1), s('hello')] },
  });
  check('custom address preserved', address === '/my-plugin-cmd');
  check('2 args preserved', args.length === 2);
  check('arg[0] is int 1', argEq(args[0], i(1)));
}

// ── Typed replies — unchanged surface ────────────────────────────────────

// 8. /status.reply — typed payload.
{
  console.log('\n▸ parseReply(/status.reply)');
  // Build a fake status reply by encoding `other` with the reply address.
  const bytes = encode({
    tag: 'other',
    val: {
      address: '/status.reply',
      args: [
        i(1), i(42), i(3), i(2), i(10),
        f(0.05), f(0.2),
        { tag: 'float64', val: 44100 },
        { tag: 'float64', val: 44100 },
      ],
    },
  });
  const reply = parseReply(bytes);
  check('tag is status-reply', reply.tag === 'status-reply');
  if (reply.tag === 'status-reply') {
    check('numUgens is 42', reply.val.numUgens === 42);
    check('actualSampleRate is 44100', reply.val.actualSampleRate === 44100);
  }
}

// 9. /n_go — node-info variant.
{
  console.log('\n▸ parseReply(/n_go)');
  const bytes = encode({
    tag: 'other',
    val: {
      address: '/n_go',
      args: [i(1001), i(0), i(-1), i(-1), i(0)], // is-group = 0 → synth
    },
  });
  const reply = parseReply(bytes);
  check('tag is n-go', reply.tag === 'n-go');
  if (reply.tag === 'n-go') {
    check('nodeId is 1001', reply.val.nodeId === 1001);
    check('isGroup is 0', reply.val.isGroup === 0);
    check('headId undefined (not a group)', reply.val.headId === undefined);
  }
}

// 10. /fail — error-carrying reply.
{
  console.log('\n▸ parseReply(/fail)');
  const bytes = encode({
    tag: 'other',
    val: {
      address: '/fail',
      args: [s('/s_new'), s('SynthDef not found: bogus')],
    },
  });
  const reply = parseReply(bytes);
  check('tag is fail', reply.tag === 'fail');
  if (reply.tag === 'fail') {
    check('error includes "bogus"', reply.val.error.includes('bogus'));
  }
}

console.log();
if (fails === 0) {
  console.log('all smoke checks passed');
  process.exit(0);
} else {
  console.log(`${fails} check(s) failed`);
  process.exit(1);
}
