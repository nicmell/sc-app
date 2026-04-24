# @sc-app/server-commands

Typed OSC messaging layer for [`scsynth`](https://doc.sccode.org/Reference/Server-Command-Reference.html),
wrapping [`osc-js`](https://github.com/adzialocha/osc-js). Provides
per-address command constructors, binary encode/decode, bundle +
timetag helpers, and positional accessors for common replies.

## Install

Workspace-local — referenced from the host app via `"@sc-app/server-commands":
"workspace:*"`.

## Usage

```ts
import OSC, {
  encode,
  decode,
  sNew,
  nRun,
  status,
  inFuture,
  AddToHead,
  Tr,
} from '@sc-app/server-commands';

// Construct a message.
const msg = sNew('sine', 1001, AddToHead, 100, { freq: 440, amp: 0.5 });

// Schedule it ~200 ms in the future (sclang's `s.latency` idiom).
const bundle = new OSC.Bundle([msg], inFuture(200));
const bytes = encode(bundle);
// …send `bytes` over your WS/UDP transport…

// Decode inbound bytes.
const reply = decode(incomingBytes);
if (!(reply instanceof OSC.Bundle) && reply.address === '/tr') {
  const trigId = Tr.triggerId(reply);
  const value = Tr.value(reply);
  // …
}
```

## What it provides

- **Command constructors** — one function per OSC address, each
  returning an `OSC.Message`. Grouped under `commands/`:
  - `commands/node.ts` — `sNew` / `sNewPairs` / `sGet` / `nRun` /
    `nRunOne` / `nFree` / `nSet` / `nMap*` / `nOrder` / …
  - `commands/group.ts` — `gNew` / `gNewOne` / `gFreeAll` /
    `gDeepFree` / `gHead` / `gTail` / `queryTree` / `dumpTree` / `pNew`
  - `commands/synthdef.ts` — `dRecv` / `dLoad` / `dLoadDir` / `dFree`
  - `commands/buffer.ts` — `bAlloc` / `bAllocRead` / `bFree` /
    `bQuery` / `bSet` / `bSetn` / `bGetn` / `bWrite` / `bGen` / …
  - `commands/control.ts` — `cSet` / `cSetn` / `cFill` / `cGet` / `cGetn`
  - `commands/misc.ts` — `status` / `version` / `quit` / `sync` /
    `notify` / `dumpOsc` / `errorMode` / `clearSched` / `cmd` /
    `uCmd` / `raw` (escape hatch)
- **`encode(packet)` / `decode(bytes)`** — thin wrappers over `osc-js`
  that convert between `OSC.Message | OSC.Bundle` and binary.
- **Timetag helpers** (`timetag.ts`):
  - `immediate()` — fire ASAP.
  - `atDate(ms)` — absolute JS timestamp.
  - `inFuture(ms)` — `Date.now() + ms`, the common "latency budget"
    pattern.
  - `fromTick(tick0Ms, tickIndex, tickRate)` — given an anchor
    captured at tick 0, returns the JS ms timestamp of any future
    tick index. Aliased as `tickToTimetag`.
- **Reply accessors** (`replies.ts`) — constant `ADDR_*` strings and
  typed positional readers for the common replies: `Tr`, `Synced`,
  `Done`, `Fail`, `StatusReply`, `NodeEvent`, `BSetnReply`.

## Design notes

**No parallel discriminated union.** Every message is structurally an
`OSC.Message` — `{ address, args, types }`. We keep that type at the
API boundary rather than re-wrapping it; reply filtering matches on
`msg.address` directly and arg access goes through the typed reader
helpers or direct positional indexing.

**Main/worker interchange.** On the send path, callers construct
`OSC.Message` / `OSC.Bundle` on the main thread and pass them into a
worker after `encode(packet)` to bytes. On the receive path, the
worker decodes bytes and posts plain `{ address, args }` POJOs over
`postMessage` (structured-clone strips the `OSC.Message` prototype).
Consumers read `.address` / `.args` directly, which matches the
osc-js field layout.

**Scheduling.** scsynth honors NTP timetags on OSC bundles,
queueing them internally and firing at the exact audio frame.
Combine `fromTick(clock.tick0Ms, targetTick, tickRate)` with
`new OSC.Bundle([msg], timetag)` to schedule a command at a
sample-accurate server-side tick.

## Dependencies

- `osc-js` — runtime OSC encode/decode and bundle semantics.
