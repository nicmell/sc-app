// sc-app's sclang startup — attach mode.
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
// script to superdirt-deps/Dirt-Samples/*). The bridge reads the
// same env var (or falls back to ./superdirt-deps/Dirt-Samples
// relative to its CWD) and walks the directory itself to populate
// SessionInfo.dirtSamples — sclang no longer reports the list
// back over OSC (Phase 40).
//
// ── Pattern: "sclang declares, bridge instantiates" (Phase 40) ──
//
// Sclang's role is intentionally minimal: declare the
// `\scAppClock` SynthDef and boot SuperDirt. Everything else
// — clock /s_new, clock audio-bus index, clock nodeId, scope
// buffer pool size, scsynth /version, dirt-samples list — is
// owned by the bridge via `config.json` + direct scsynth
// handshakes + a disk walk of `SC_APP_DIRT_SAMPLES`.
//
// To override a runtime value, edit `config.json` (the bridge's
// config file). Pre-40 a `scripts/lib/` directory held separate
// install functions (bootstrap.scd, version.scd, clock.scd,
// superdirt.scd); Phase 40 retired the bootstrap + version
// scripts, and a follow-up inlined the remaining two into this
// single file. See docs/history.md.
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
    // takes one /notify slot; the bridge takes another.
    s.notify;
    s.sync;

    // ── Shared global clock SynthDef ─────────────────────────────────
    //
    // Pattern: "sclang declares, bridge instantiates". Sclang just
    // `.add()`s the def; the bridge picks the audio bus + nodeId
    // from config and runs `/s_new \scAppClock <nodeId> 0 0
    // clockBus <bus> chunkSize <cs>` itself.
    //
    // SynthDef args (all bridge-supplied via /s_new):
    //   - clockBus: audio bus the sample-counting Phasor writes to.
    //     OSC-fallback tap SynthDefs read it via In.ar(clockBus) to
    //     derive a sample-aligned ring-buffer writeIdx. SHM mode
    //     ignores the bus.
    //   - chunkSize: audio frames per tick. tickRate derives from
    //     SampleRate.ir / chunkSize at synth-construction time.
    //
    // `scApp` namespace prefix on the def name is deliberate:
    // SynthDefs share scsynth's global in-memory dict across every
    // client on the same scsynth, so a bare `\clock` would collide
    // with anything else (current or future) registering a clock def.
    //
    // SendReply.kr emits `/clock/tick <nodeID> <replyID> <count>`
    // (replyID = -1 by default). scsynth multicasts to every
    // /notify'd client; the bridge sees them on its single /notify
    // slot and fans to all attached WSs.
    SynthDef(\scAppClock, { |clockBus = 0, chunkSize = 1024|
        var tickRate = SampleRate.ir / chunkSize;
        var tick = Impulse.kr(tickRate);
        var count = PulseCount.kr(tick);
        // Sample-counting phasor wrapping every 2 × chunkSize
        // samples — gives the OSC-fallback tap SynthDef a
        // writeIdx aligned with global tick parity.
        var samplePhase = Phasor.ar(0, 1, 0, 2 * chunkSize);
        SendReply.kr(tick, '/clock/tick', count);
        Out.ar(clockBus, samplePhase);
    }).add;
    s.sync;
    "scAppClock SynthDef added (bridge will /s_new)".postln;

    // ── SuperDirt boot ───────────────────────────────────────────────
    //
    // 12 orbits, all routing to bus 0 (stereo). Sample path comes
    // from SC_APP_DIRT_SAMPLES (set by the launch script to
    // superdirt-deps/Dirt-Samples/*). Listens on UDP 57120 — the
    // bridge's `/dirt/* → 127.0.0.1:57120` route forwards
    // `/dirt/play` and friends here.
    ~dirt = SuperDirt(2, s);
    ~dirt.loadSoundFiles("SC_APP_DIRT_SAMPLES".getenv);
    ~dirt.start(57120, 0 ! 12);
    "SuperDirt ready on UDP 57120".postln;
}, 50, {
    "scsynth not reachable on 127.0.0.1:57110 after 10s.\n  Start it first: yarn scsynth-only (dev) or your systemd unit (prod).".error;
});
)
