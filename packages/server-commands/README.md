# @sc-app/server-commands

TypeScript library wrapping [`osc-js`](https://github.com/adzialocha/osc-js)
for scsynth OSC messaging. Replaces the earlier wasm-bindgen bridge
(`crates/scserver-commands`) at runtime; that crate is kept as a
parity reference.

## What it provides

- **Command constructors** — one function per OSC address, returning a
  configured `OSC.Message`. Examples: `sNew`, `gNew`, `nRun`, `dRecv`,
  `bAlloc`, `status`, `notify`, …
- **`encode(packet)`** — serialize an `OSC.Message` or `OSC.Bundle`
  into binary.
- **`decode(bytes)`** — parse binary back into an `OSC.Message` or
  `OSC.Bundle`.
- **Bundle + timetag helpers** — `bundle(timetag, packets)`,
  `immediate()`, `atDate(msSinceEpoch)`, `fromTick(tick0Ntp, tick,
  tickRate)`. Lets callers ship commands with sample-accurate
  scheduling via scsynth's NTP-timestamped bundle queue.
- **Reply address constants + typed accessors** — `Tr.nodeId(msg)`,
  `Fail.address(msg)`, `StatusReply.numSynths(msg)`, etc. Thin positional
  readers over `OSC.Message.args`.

## Why not types-per-command-variant?

Every message is structurally an `OSC.Message` — `{ address, args }`.
We keep that type at the API boundary rather than inventing a parallel
discriminated union. Reply filtering matches on `msg.address` directly.
