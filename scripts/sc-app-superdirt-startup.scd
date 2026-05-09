// sc-app's SuperDirt startup — attach mode.
//
// scsynth's lifecycle is OUTSIDE sclang's control:
//   - dev (Mac):   started manually in a separate terminal,
//                  typically via `yarn scsynth-only`.
//   - prod (Pi):   systemd service. See scripts/sc-app-scsynth.service.
//
// This .scd does NOT call s.reboot{} / s.boot{} — and that's why
// it uses `s.doWhenBooted` rather than `s.waitForBoot`. waitForBoot
// would call s.boot if the server isn't already responding, which
// would spawn a SECOND scsynth on top of the externally-managed
// one and fail. doWhenBooted just polls for serverRunning (driven
// by the alive thread we start below) and runs the callback when
// scsynth's first /status reply lands; on timeout, onFailure fires.
//
// Sample path comes from SC_APP_DIRT_SAMPLES (set by the launch
// script to superdirt-deps/Dirt-Samples/*).
//
// ── Pattern: "sclang declares, bridge instantiates" (Phase 39) ──
//
// As of Phase 39, sclang owns the DECLARATIONS — SynthDef.add(),
// allocator state, OSCdef responders — while the bridge owns
// INSTANCE creation (clock /s_new, scope-buffer allocation) and
// runtime config (chunkSize, num scope buffers, sample rate).
// Each install function contributes its keys to
// `~bootstrapCtx`; the bootstrap responder serializes the
// dict on demand. The bridge fetches once at boot via
// `/bootstrap/hello` and surfaces the values via SessionInfo +
// uses them to drive its own /s_new of any shared synths.
//
// To add a new shared synth following this pattern:
//   1. Create lib/<name>.scd that defines `~install<Name>`
//      = { ... }`. Inside: SynthDef.add() the def, allocate any
//      needed buses, contribute (name, value) keys to
//      `~bootstrapCtx[\<name>]`. DON'T /s_new — that's the
//      bridge's job.
//   2. Add the file to the load list below.
//   3. Add a call in `s.doWhenBooted` BEFORE
//      `~installBootstrap.()` so the new keys are available
//      when the responder serializes.
//   4. On the bridge side (`src-tauri/src/server/server.rs`),
//      extend `apply_info_args` to parse the new keys and
//      `instantiate_bridge_clock`-style helper to /s_new + write
//      back to `ServerMetadata`.
//
// ── Sub-modules under lib/ ───────────────────────────────────────────
//
//   - lib/bootstrap.scd           /bootstrap/hello responder
//   - lib/clock.scd               Phase 30 shared clock SynthDef
//   - lib/superdirt.scd           SuperDirt boot
//   - lib/version.scd             scsynth /version capture
//
// (Pre-39 lib/chunk-size.scd, lib/dirt-list-samples.scd, and
// lib/scope.scd were retired during Phase 39's "bridge takes
// ownership" sweeps. See docs/history.md.)
//
// ── Two structural points (read CLAUDE.md's "SuperDirt launch
//    gotchas" section for full context) ──────────────────────────────
//
//   1. s.options.* mirror scsynth's command-line flags. In attach
//      mode sclang doesn't push these to scsynth — but they STILL
//      govern sclang's local allocator ranges (bufferAllocator
//      uses options.numBuffers). Without this block, sclang's
//      allocator stays at default 1024 and Dirt-Samples loading
//      fails partway through with "No more buffer numbers".
//      MUST match scripts/start-scsynth-only.sh + sc-app-scsynth.service.
//
//   2. s.newAllocators after setting options. sclang's allocators
//      are constructed at Server.local init time (before this .scd
//      runs) using whatever options were in effect then — i.e.
//      defaults. Setting options now doesn't retroactively resize.
//      newAllocators rebuilds them with the current option values.

(
var libDir = PathName(thisProcess.nowExecutingPath).pathOnly +/+ "lib";

// Load sub-module definitions. Each file just sets a
// `~install<Name>` function in the global env via `.load`.
// Nothing runs yet — the install functions are called inside
// `s.doWhenBooted` once scsynth is reachable.
[
    "bootstrap.scd",
    "clock.scd",
    "superdirt.scd",
    "version.scd"
].do { |f|
    (libDir +/+ f).load;
};

// scsynth options + sclang allocators. Mirror the flags scsynth
// is launched with (start-scsynth-only.sh / systemd unit); the
// values must match.
s.options.numBuffers = 1024 * 256;        // -b 262144
s.options.memSize = 8192 * 32;             // -m 262144 KB
s.options.numWireBufs = 2048;              // -w 2048
s.options.maxNodes = 1024 * 32;            // -n 32768
s.options.maxLogins = 8;                   // -l 8
s.options.numInputBusChannels = 2;         // -i 2
s.options.numOutputBusChannels = 2;        // -o 2
s.newAllocators;

s.addr = NetAddr("127.0.0.1", 57110);
s.startAliveThread;

// Wait up to ~10 s (50 ticks × 0.2 s) for scsynth's first
// /status reply to flip serverRunning. limit/onFailure are
// positional: (onComplete, limit=100, onFailure). 100 = 20 s
// default; 50 keeps the original 10 s window.
s.doWhenBooted({
    // Register for async notifications (/n_go, /n_end, /done, …)
    // and wait for /done /notify via a /sync round-trip. Sclang
    // takes one /notify slot; the bridge takes another (Phase 39a:
    // bridge runs /notify 1 once at its own boot for ALL its
    // sessions, instead of one per session).
    s.notify;
    s.sync;

    ~installClock.();
    ~installSuperDirt.();
    ~bootstrapCtx[\scope] = (numScopeBuffers: 128);
    ~installVersion.();
    ~installBootstrap.();
}, 50, {
    "scsynth not reachable on 127.0.0.1:57110 after 10s.\n  Start it first: yarn scsynth-only (dev) or your systemd unit (prod).".error;
});
)
