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
// ── Sub-modules under lib/ ───────────────────────────────────────────
//
//   - lib/chunk-size.scd          parses SC_APP_CLOCK_CHUNK_SIZE
//   - lib/clock.scd               Phase 30 shared clock + /clock/hello
//   - lib/superdirt.scd           SuperDirt boot
//   - lib/dirt-list-samples.scd   Phase 27a /dirt/listSamples responder
//   - lib/scope.scd               Phase 31 /scope/* responders
//
// Each sub-file defines exactly one `~scAppInstallX = { ... }`
// (or `~scAppParseX`) function in the global env via `.load`. This
// orchestrator loads them all at pre-boot, then calls them in
// sequence inside `s.doWhenBooted`.
//
// Why functions, not inline `executeFile` at point-of-need: the
// install steps need to run inside the doWhenBooted callback (so
// scsynth is alive + /notify has gone through), but the file
// loading itself happens earlier when we're in the pre-boot
// orchestrator scope. Defining functions then calling them later
// keeps the load-time vs run-time separation explicit.
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
// `~scAppInstallX` (or `~scAppParseX`) function in the global
// env; nothing runs yet. `.load` evaluates the file in the
// current interpreter context, so the env-var assignments land
// in the same `currentEnvironment` this orchestrator uses below.
[
    "chunk-size.scd",
    "bootstrap.scd",
    "clock.scd",
    "superdirt.scd",
    "dirt-list-samples.scd"
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
    var clockChunkSize = ~scAppParseChunkSize.();

    // Register for async notifications (/n_go, /n_end, /done, …)
    // and wait for /done /notify via a /sync round-trip.
    s.notify;
    s.sync;

    ~scAppInstallClock.(clockChunkSize);
    ~scAppInstallSuperDirt.();
    ~scAppInstallDirtListSamples.();
    // Phase 39c: scope responders moved to the bridge.
    // ~scAppBootstrapCtx[\scope][\numScopeBuffers] is set by
    // bootstrap.scd as the canonical default (128).
    ~scAppBootstrapCtx[\scope] = (numScopeBuffers: 128);
    ~scAppInstallBootstrap.();
}, 50, {
    "[sc-app] scsynth not reachable on 127.0.0.1:57110 after 10s.\n  Start it first: yarn scsynth-only (dev) or your systemd unit (prod).".error;
});
)
