# SuperDirt — architecture overview & integration sketch

This document captures what SuperDirt actually is, how it works under
the hood, and how (or whether) it could plug into the sc-app codebase
to give us a browser-side sequencer or an OSC shell that talks to a
running SuperDirt instance.

The submodule lives at `superdirt/` (cloned from
`https://codeberg.org/musikinformatik/SuperDirt.git`). All file paths
in this doc are relative to that folder.

---

## Part 1 — Architecture overview

### TL;DR

SuperDirt is a **sclang-side OSC server** that turns Tidal-style
key/value events (`/dirt/play s "bd" n 1 amp 0.5 cutoff 800`) into
**timetagged OSC bundles** of `/s_new` / `/n_set` commands sent to a
**separately running scsynth**. The clock, the scheduling, and the
musical pattern come from the *client* (TidalCycles or anything that
speaks the same OSC dialect). SuperDirt itself only schedules,
routes, and tears down synths.

It is not a real-time engine in the audio sense — that is scsynth's
job. It is a **dispatcher + voice manager + effect rack** that maps
high-level events onto scsynth node graphs.

### 1. Connection / OSC entry point

SuperDirt opens a UDP listener inside sclang via `OSCFunc`. The
default port is **57120** (`superdirt_startup.scd:32`):

```supercollider
~dirt.start(57120, 0 ! 12);  // 12 orbits, all routing to bus 0
```

The receive side lives in `SuperDirt.sc:282–381` (the `connect`
method). It registers a handful of OSC addresses:

| Address                | Purpose                                             |
|------------------------|-----------------------------------------------------|
| `/dirt/play`           | Main event entry point (key/value pairs)            |
| `/play2`               | Legacy alias                                        |
| `/dirt/hello`          | Heartbeat — server replies `/dirt/hello/reply`      |
| `/dirt/handshake`      | Returns hostname, port, control bus indices         |
| `/dirt/synth-info`     | Returns control names of a named synth              |
| `/dirt/setControlBus`  | Sets a control bus value                            |

`/dirt/play` arguments are **flat key/value pairs**, not positional
(`SuperDirt.sc:315`):

```supercollider
event.putPairs(msg[1..])
```

A single OSC port handles **all orbits**. Routing is by an `orbit`
key inside the event (`SuperDirt.sc:317`):

```supercollider
index = event[\orbit] ? 0;
DirtEvent(orbits @@ index, modules, event).play;
```

### 2. The Orbit abstraction

A `DirtOrbit` (`classes/DirtOrbit.sc`) is one independent **routing
chain** with its own group, buses, and persistent global effects.
A typical setup is 12 orbits, but they all share the same OSC port —
"orbit" is just a number you put in your event.

Each orbit allocates (`DirtOrbit.sc:45–48`):

- a server `group` — parent node for everything in that orbit;
- `synthBus` — where per-event synths chain modules together;
- `dryBus` — output of the gate synth (clean per-event signal);
- `globalEffectBus` — output of orbit-level effects.

It also holds a `defaultParentEvent` (`DirtOrbit.sc:170–214`) with
default values for `cps`, `pan`, `amp`, `fadeTime`, etc. Incoming
events fall back to these for unspecified keys.

### 3. Clock and timing

**SuperDirt has no clock of its own.** All scheduling is driven
by OSC timetags coming from the client.

When `/dirt/play` arrives (`SuperDirt.sc:305–310`):

```supercollider
var latency = time - thisThread.seconds;
if (latency > maxLatency) {  // default 42s
    "scheduling delay too long".warn;
    latency = 0.2;
};
event[\latency] = latency;
```

`time` is the OSC bundle's timetag. `latency` is just "how far
in the future is this event" relative to sclang's clock.

The scheduling itself is **scsynth-native bundle scheduling**
(`DirtEvent.sc:216`):

```supercollider
server.makeBundle(~latency, {
    orbit.globalEffects.do { |x| x.set(currentEnvironment) };
    this.prepareSynthGroup(orbit.group);
    modules.do(_.value(this));
    this.sendGateSynth;
});
```

`Server.makeBundle` collects all `/s_new` / `/n_set` commands inside
the closure into one OSC bundle, stamps it with `Date.now() +
latency`, and ships it. scsynth holds the bundle until the timetag
arrives, then applies every command atomically. Sample-accurate, no
client-side jitter.

`latency` gets further tweaked per event by `lag` and `offset`
(`DirtEvent.sc:138`):

```supercollider
~latency = ~latency + ~lag.value + (~offset.value * ~speed.value.abs);
```

### 4. Sample / buffer management

`DirtSoundLibrary` (`classes/DirtSoundLibrary.sc`) is the sample
catalog. The convention is **folder-name = sample-name**, and every
audio file inside the folder is one buffer in an array indexed by
`n` (`DirtSoundLibrary.sc:180–199`).

Lookup is wrap-around indexed (`DirtSoundLibrary.sc:289–320`):

```supercollider
getEvent { |name, index|
    var allEvents = this.at(name);
    event = allEvents.wrapAt(index.asInteger);
}
```

So `s "bd" n 5` with 3 buffers in the `bd/` folder returns
buffer index `5 % 3 = 2`.

Loading is **eager by default but can be deferred**. With
`doNotReadYet = true`, only the WAV header is read at startup, and
the body is loaded on first play (`DirtSoundLibrary.sc:312–315`):

```supercollider
if (doNotReadYet and: { event[\notYetRead] ? false }) {
    "reading soundfile as needed: %:%".format(name, index).postln;
    this.readFileIfNecessary(event);
}
```

For files larger than 2²⁴ frames (~6 minutes at 48 k), it picks
`dirt_sample_long_*` SynthDefs that use 64-bit-phase `PlayBuf`
instead of 32-bit `BufRd` (`DirtSoundLibrary.sc:354–359`).

**No streaming — everything sits in RAM.** Buffers are kept until
`freeSoundFiles` is called explicitly. There's no LRU eviction.

`DirtRemoteSoundFileInfo` (`classes/DirtRemoteSoundFileInfo.sc`) is a
*query interface* — it ships sample metadata as OSC to a remote
client (e.g. a web UI), so the client can ask "what samples exist?"
without filesystem access.

### 5. Synth architecture — the modules pipeline

Per-event synthesis is a **linear chain of modules**. A `DirtModule`
(`classes/DirtModule.sc`) is a `(test, func)` pair:

```supercollider
DirtModule {
    var <name, <func, <test;
    value { |orbit| if (test.value) { func.value(orbit) } }
}
```

Modules are registered in order via `SuperDirt.addModule`
(`SuperDirt.sc:199–207`). Examples (`synths/core-modules.scd`):

| Module    | Test                       | What it does                               |
|-----------|----------------------------|--------------------------------------------|
| `sound`   | always                     | `/s_new dirt_sample_<chan>_<orbit>`        |
| `vowel`   | `~vowel.notNil`            | `/s_new dirt_vowel_<orbit>`                |
| `lpf`     | `~cutoff.notNil`           | `/s_new dirt_lpf_<orbit>`                  |
| `tremolo` | `~tremolorate.notNil`      | `/s_new dirt_tremolo_<orbit>`              |
| `gate`    | always (last)              | `/s_new dirt_gate_<orbit>` w/ `doneAction:14` |

Each module's synth reads `in: synthBus` and writes `out: synthBus`.
Because they all share `synthBus`, they form a chain — and because
they're all `addToTail` of the per-event `synthGroup`, scsynth runs
them in registration order on every control block.

The final `dirt_gate` synth applies the envelope, writes to
`dryBus`, and (via `doneAction: 14`) **frees the entire synth group**
when the envelope ends. No client-side cleanup needed.

The orbit-level signal flow:

```
                       ┌──────────────┐
   per-event synthGroup│ sample synth │
   (one per /dirt/play)│      ↓       │
                       │ vowel synth  │  reads/writes
                       │      ↓       │  synthBus
                       │ lpf synth    │
                       │      ↓       │
                       │ gate synth   │──→ dryBus
                       └──────────────┘            ↓
                                          ┌────────────────┐
                       persistent          │ delay synth    │──→ globalEffectBus
                       per-orbit effects ──│ reverb synth   │──┘
                                          │ leslie synth   │
                                          └────────────────┘
                                                  ↓
                                          ┌────────────────┐
                                          │ monitor synth  │ reads dryBus + globalEffectBus
                                          └────────────────┘
                                                  ↓
                                              hardware out
```

SynthDefs are pre-compiled at startup. There is one variant per
`(sampleChannels, orbitChannels)` pair — e.g. `dirt_sample_1_2`,
`dirt_sample_2_2`, `dirt_lpf_2`, etc. (`synths/core-synths.scd:24–54`).

### 6. Event flow end-to-end

For `/dirt/play s "bd" n 1 amp 0.5 cutoff 800 orbit 0` with timetag T:

1. **Receive** (`SuperDirt.sc:304–325`). Compute `latency = T - now`.
   Build event from key/value pairs. Dispatch to orbit 0.
2. **Resolve sample** (`DirtEvent.sc:10–29`). Look up `bd` in
   `DirtSoundLibrary`, get `buffers["bd"][1]`. Merge buffer metadata
   (bufnum, channels, sample rate, num frames) into the event.
3. **Compute timing** (`DirtEvent.sc:138`). Apply lag, offset, speed.
   Compute `sustain` from `unit`/`speed`/`begin`/`end`.
4. **Open a bundle** (`DirtEvent.sc:216`). `server.makeBundle(latency, {…})`.
5. **Update orbit effects.** `globalEffects.do(_.set(event))` — sends
   `/n_set delaytime 0.5` etc. to the persistent effect synths.
6. **Create per-event synth group.** `/g_new <newId> 1 <orbit.group>`.
7. **Run modules.** Each module that passes its test sends one
   `/s_new` into the new group: sample → lpf → … → gate.
8. **Send the bundle.** scsynth holds it until T, then runs every
   `/s_new` atomically.
9. **Audible output.** Sample plays through the chain into
   `dryBus`; orbit effects mix wet signal into `globalEffectBus`;
   `monitor` synth sums and writes to hardware out.
10. **Cleanup.** When the gate envelope ends, `doneAction: 14`
    frees the per-event synth group. Done.

### 7. Effects model

Two distinct flavours of effects:

- **Per-event modules** are *short-lived* — created and freed for
  every event. Routed in series via `synthBus`. Examples: `lpf`,
  `hpf`, `vowel`, `crush`, `coarse`, `pshift`, `tremolo`,
  `phaser`, `distortion`. Parameters arrive as `/s_new` args.

- **Per-orbit global effects** are *persistent* — created once at
  orbit init, paused until needed. Live downstream of `dryBus`.
  Examples: `delay`, `reverb`, `leslie`, RMS, monitor.
  Parameters arrive via `/n_set` from
  `GlobalDirtEffect.set` (`GlobalDirtEffect.sc:46–62`):

```supercollider
set { |event|
    paramNames.do { |key|
        var value = event[key];
        if (state[key] != value) { argsChanged = argsChanged.add(key).add(value); state[key] = value; }
    };
    if (argsChanged.notNil and: { synth.notNil }) { synth.set(*argsChanged); }
}
```

There's a CPU-saving trick: the global effects use a custom
`DirtPause` UGen that suspends them when input is silent for a
while.

### 8. State and lifecycle

`SuperDirt.start(port, outBusses)` (`SuperDirt.sc:66–70`) →
allocates orbits → opens OSC listeners. `SuperDirt.stop` frees
all orbits, clears flotsam (cut-group registry), closes OSCFuncs.

`DirtOrbit.free` (`DirtOrbit.sc:160–167`) frees the orbit group
(taking down all child synths via the parent), releases persistent
effects, frees buses, removes the `ServerTree` hook.

**Cut groups** (Flotsam, `classes/Flotsam.sc`): when an event has
`cut != 0`, the orbit remembers the synth's nodeId in a registry.
A new event with the same `cut` value sends `/n_set cut_gate 0`
to the previous synth, releasing it. When scsynth confirms the
release with `/n_end`, an OSCFunc removes the entry from flotsam
(`SuperDirt.sc:363–366`).

### 9. Quirks worth knowing

The bits that matter if you ever try to *port* (rather than just
talk to) SuperDirt:

- Heavy use of sclang's **dynamic environment** (`Environment.use`,
  event proto chains) for parameter merging.
- `Server.makeBundle` is sclang sugar over a manual OSC bundle —
  reproducible from any language.
- `ServerTree` / `CmdPeriod` hooks rebuild state after server
  reboot or panic.
- A handful of **custom UGens** (`SuperDirtUGens.sc`): `DirtPause`,
  `DirtGateCutGroup`, etc. These are compiled into the scsynth
  plugin path; without them, the SynthDefs won't resolve.
- **Vowel formant data** comes from sclang's `Vowel` class.
- Sample lookups are `wrapAt` — out-of-range `n` is never an error.
- No private OSC commands beyond the public five. Everything else
  is `/s_new` / `/n_set` to scsynth directly.
- ProxySpace / NodeProxy not used — flat `Synth` + `Group` only.

---

## Part 2 — Integration ideas for sc-app

sc-app already speaks scsynth fluently. We have a worker-bridged
WS↔UDP transport, an OSC encoder/decoder, a `BufferManager` that
ref-counts shared `(bus, channels, chunkSize)` taps, an
`IdAllocator` for node/bus/buffer IDs, a `ClockController` with a
global tick anchor, and a `SynthDef` compiler in TS.

That changes the cost calculus for several integration paths.
Here are three, ordered from cheapest to most ambitious.

### Option A — "OSC shell" client to a running SuperDirt

**Goal:** the user runs `sclang` with SuperDirt loaded; sc-app sends
`/dirt/play` messages over our existing transport and visualises
the result.

What we'd build:

- `src/dirt/DirtClient.ts` — wraps `WorkerClient` and constructs
  `/dirt/play` bundles. It targets a separate UDP endpoint
  (`127.0.0.1:57120` by default) — that's sclang, not scsynth.
- `src-tauri` adjustment: today the WS bridge speaks to one UDP
  peer (scsynth). We'd need either a second WS path with its own
  peer, or a `target` field on each WS frame so the bridge can
  multiplex destinations. The cleaner option is the latter — keep
  one WS, tag frames with `{ to: "scsynth" | "dirt" }`.
- `src/dirt/DirtEvent.ts` — typed builder for the key/value
  payload (`s`, `n`, `amp`, `cutoff`, `delay`, `room`, `gain`,
  `speed`, `cps`, `orbit`, `cut`, …). Use the parameter list at
  `superdirt/used-parameters.scd` as the source of truth.
- Optional: a small **OSC shell panel** in the UI — text input that
  parses `bd cutoff:800 amp:0.5` Tidal-ish shorthand and fires
  `/dirt/play`. Useful as an interactive REPL while we develop.

What we get for free:

- All synthesis, voice management, and effects are SuperDirt's
  problem. We're a thin client.
- We can already monitor SuperDirt's output bus with our
  `ScopeManager` — point a scope at scsynth bus 0 and you'll see
  Dirt's master output.

What we don't get:

- We don't run sclang from sc-app. The user has to start
  `sclang superdirt_startup.scd` themselves (or we shell out, but
  that drags the whole quarks dependency in).
- This is a *client* of an existing engine, not "our own
  sequencer". Useful as a stepping stone.

**Effort:** ~1 phase. Mostly transport plumbing + a builder.

### Option B — Browser-side sequencer driving SuperDirt

**Goal:** sc-app generates pattern events on its own clock and
emits `/dirt/play` to a running SuperDirt.

Builds on Option A, plus:

- `src/sequencer/PatternController.ts` — a controller that, on each
  tick from `ClockController`, decides which events to fire for
  the upcoming window. Output: `(eventTime, dirtEvent)` pairs.
- `src/sequencer/Pattern.ts` — pattern model. Even a simple
  step-grid (16 steps, per-step `{s, n, amp, …}`) covers a lot of
  ground for an MVP. Tidal's mini-notation is non-trivial to port
  but well-documented.
- Scheduling: convert tick-aligned event times to OSC timetags
  with `tickToTimetag(clock.tick0Ms!, targetTick, tickRate)` —
  this already exists in `@sc-app/server-commands`. SuperDirt
  reads the timetag and forwards it to scsynth as a bundle.
  We get sample-accurate timing without writing a scheduler.
- UI: a `SequencerPanel` with a step grid, sample picker, BPM /
  cps control. The clock is already there; the dropdown just sets
  `cps` per pattern.

Tricky bits:

- **Look-ahead window.** We need to emit events ~50–200 ms ahead
  of when they sound, so SuperDirt + scsynth have time to schedule
  them. Our clock-driven worker already runs slightly ahead of
  audio; the scheduler should fire on tick `N` for events whose
  audio time is `N + lookaheadTicks`. Pick lookahead such that
  `latency` field on the OSC message stays positive but small
  (say, 100 ms).
- **Sample browser.** The user needs to know what `s` strings
  exist. Either ship a hardcoded list of common Dirt-Samples
  folders, or query SuperDirt via `/dirt/handshake` /
  `DirtRemoteSoundFileInfo` if we add a handler for its replies.
- **No mid-event control.** Once a `/dirt/play` is sent, the event
  is in scsynth's bundle queue. We can't "cancel a step" cleanly
  except via the `cut` mechanism (send a fresh event with the
  same `cut` value).

**Effort:** ~2-3 phases. Pattern model + UI is most of the work.

### Option C — Native port: "sc-app SuperDirt" engine

**Goal:** drop the sclang dependency entirely. sc-app loads samples,
allocates orbits, compiles SynthDefs, and dispatches events
directly to scsynth — owning the whole pipeline.

This is realistic *because* of what we already have:

- `BufferManager` — ref-counted buffer + tap synth allocation.
  A `SampleLibrary` controller can sit on top of it: load each
  sample into a buffer once, hand out handles per event.
- `@sc-app/synthdef-compiler` — pure TS SynthDef compilation. We
  can port the SuperDirt SynthDef definitions (`synths/core-*.scd`)
  to TS. The arithmetic is a one-time translation; the UGens we
  need (PlayBuf, BufRd, RLPF, Pan2, Limiter, FreeVerb1, etc.) are
  all in our shipped UGen list.
- `ClockController` + `IdAllocator` already cover the boring bits
  of node/bus/group management.
- `OSC.Bundle` + `tickToTimetag` cover scheduling.

Component-by-component map onto our codebase:

| SuperDirt concept    | sc-app equivalent                                       |
|----------------------|---------------------------------------------------------|
| `SuperDirt`          | `DirtEngine` controller — owns orbits + sample library  |
| `DirtOrbit`          | `OrbitController` — group + 3 buses + global effects    |
| `DirtSoundLibrary`   | `SampleLibrary` on top of `BufferManager`               |
| `DirtModule`         | `Module` interface — test + `(event) => SNew[]`         |
| `DirtEvent.play`     | `playEvent(orbit, event)` — builds bundle, ships it     |
| `GlobalDirtEffect`   | persistent synth in `OrbitController`, set via `/n_set` |
| `Server.makeBundle`  | manual `OSC.Bundle` with `tickToTimetag`                |
| `doneAction: 14`     | same — scsynth-side, no porting needed                  |
| `Flotsam` / cut      | `Map<cutGroup, nodeId>` + `/n_end` listener             |
| Custom UGens         | **blocker — see below**                                 |

Things we'd need to handle ourselves:

- **`DirtPause` and `DirtGateCutGroup` UGens.** These are C++
  scsynth plugins shipped with SuperDirt. Without them, the
  SynthDefs that reference them won't resolve. Two options:
  (a) require the user to install the SuperDirt UGens plugin
  separately; (b) replace them with stock UGens that approximate
  the behaviour (`Pause` for the former, manual `Free` triggered
  by gate-zero detection for the latter). Option (b) is doable but
  loses the CPU-saving sleep behaviour.
- **Vowel formant data.** Sclang's `Vowel` class has a built-in
  formant table. We'd embed the same data as a TS constant.
- **Sample folder discovery.** SuperDirt scans a directory tree of
  WAV/AIFF files. From the browser we can't read the filesystem,
  but the Tauri build has `tauri-plugin-fs`. The Tauri side picks
  the folder and ships filenames to the browser; the browser maps
  `s "bd"` → buffer.
- **Effect chain UI.** Per-orbit global effects need a control
  surface. Per-event modules don't — they're parameterised by
  event keys.
- **`b_allocRead`** — already supported by scsynth, not currently
  used in sc-app. Trivial addition to `@sc-app/server-commands`.

What we gain:

- One process to run (scsynth + sc-app). No sclang.
- Full integration with our existing observability — every
  SuperDirt-style event becomes a node in our `BufferManager`
  refcount inspector, every output is scope-able, every recording
  is grab-able with the existing `RecordingManager`.
- Ability to extend the module list with our own modules
  (modulation matrices, granular voices, whatever) without
  fighting sclang.

What we lose:

- The huge ecosystem of SuperDirt extensions that ship as `.scd`
  files. If someone has a custom `dirt_*` SynthDef, they'd need
  to port it to our SynthDef DSL.
- Compatibility guarantee — when SuperDirt upstream changes
  parameter semantics, we have to chase it.

**Effort:** ~5–8 phases. SynthDef ports + sample library + orbit
controller + event dispatcher + UI. Sequencer (Option B) on top
of that is mechanical.

### Recommendation

If the goal is to *play with SuperDirt from the browser*, **start
with Option A**: build the OSC shell, run `superdirt_startup.scd`
externally, scope its output. You'll learn the parameter space and
discover edge cases without committing to a full port. Two-frame
target field on the WS bridge is the only invasive change.

If the goal is to build *our own sequencer with Dirt-style sample
playback*, the layering is **A → B → (optionally) C**. Each step
is independently useful: A gives you a REPL, B gives you a working
sequencer with a SuperDirt dependency, C removes the dependency.
Going straight to C means a long phase before anything makes
sound.

Open questions for whichever path we pick:

1. Where do samples live? Bundle a small set, point at user-chosen
   folder, or fetch from a CDN? Tauri build vs serve build differs.
2. Is the sequencer step-based, pattern-language-based, or both?
   A step grid is dramatically simpler than a mini-notation parser.
3. Do we want multi-orbit from day one, or single-orbit MVP?
   Multi-orbit is just N copies of the same controller, but the
   UI question (one strip per orbit? tabs? mixer?) is real.
4. How does this coexist with the existing `SynthsPanel`? Are
   Dirt voices a sibling of tone synths in the same parent group,
   or do they live in a separate top-level group?
