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
// Phase 30: this script ALSO owns the shared global clock. One
// `\scAppClock` synth at scsynth's root group emits `/tr` triggers
// (trigId 1000) and writes a sample-rate phasor to a dedicated
// audio bus. Every sc-app session reads the same `/tr` stream and
// the same `clockBus`, replacing the per-session clocks each tab
// previously owned. The clock lives outside any client's parent
// group so /g_freeAll / /n_free from a client cannot touch it.
// chunkSize comes from `SC_APP_CLOCK_CHUNK_SIZE` (default 1024).
//
// Two things this file's structure reflects (read CLAUDE.md's
// "SuperDirt launch gotchas" section for full context):
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
var clockChunkSize, clockChunkSizeEnv;

s.options.numBuffers = 1024 * 256;        // -b 262144
s.options.memSize = 8192 * 32;             // -m 262144 KB
s.options.numWireBufs = 2048;              // -w 2048
s.options.maxNodes = 1024 * 32;            // -n 32768
s.options.maxLogins = 8;                   // -l 8
s.options.numInputBusChannels = 2;         // -i 2
s.options.numOutputBusChannels = 2;        // -o 2

// Recreate sclang's allocators with the new option values. The
// notify-handler also calls this if maxLogins/clientID change
// mid-flight, but pre-setting maxLogins suppresses that path —
// be explicit instead of relying on a side effect.
s.newAllocators;

// Phase 30 clock chunkSize. Read once here so the value is captured
// before the doWhenBooted closure runs. Power of 2 recommended (FFT-
// friendly, page-aligned recordings); see CLAUDE.md's chunkSize
// reference table for the practical range.
clockChunkSizeEnv = "SC_APP_CLOCK_CHUNK_SIZE".getenv;
clockChunkSize = if(clockChunkSizeEnv.isNil or: { clockChunkSizeEnv.size == 0 }) {
    1024
} {
    clockChunkSizeEnv.asInteger
};
if(clockChunkSize < 1) {
    "[sc-app] SC_APP_CLOCK_CHUNK_SIZE = % invalid; falling back to 1024".format(clockChunkSizeEnv).warn;
    clockChunkSize = 1024;
};

s.addr = NetAddr("127.0.0.1", 57110);
s.startAliveThread;

// Wait up to ~10 s (50 ticks × 0.2 s) for scsynth's first
// /status reply to flip serverRunning. limit/onFailure are
// positional: (onComplete, limit=100, onFailure). 100 = 20 s
// default; 50 keeps the original script's 10 s window.
s.doWhenBooted({
    var clockTickRate;

    // Register for async notifications (/n_go, /n_end, /done, …)
    // and wait for /done /notify via a /sync round-trip.
    s.notify;
    s.sync;

    // ── Phase 30: shared global clock ────────────────────────────────
    // The SynthDef is structurally identical to the pre-30 frontend
    // version (see Phase 6 / 8 in docs/history.md). Owned by sclang
    // here so all clients share the same /tr stream and the same
    // clockBus. trigId 1000 is reserved app-wide; nodeId 999 is
    // reserved by convention (off-limits to client IdAllocator
    // ranges, which start at clientId * 1_000_000 + 1000).
    //
    // tickRate is baked into the SynthDef bytes as a literal Hz —
    // changing chunkSize requires re-running this script. clockBus
    // is a synth control so we can re-use the same SynthDef across
    // restarts that get a different bus allocation.
    clockTickRate = s.sampleRate / clockChunkSize;
    SynthDef(\scAppClock, { |clockBus = 0|
        var tick = Impulse.kr(clockTickRate);
        var count = PulseCount.kr(tick);
        var wrap = SampleRate.ir * (2 / clockTickRate);
        var samplePhase = Phasor.ar(0, 1, 0, wrap);
        SendTrig.kr(tick, 1000, count);
        Out.ar(clockBus, samplePhase);
    }).add;
    s.sync;

    // Bus.audio lets sclang's allocator pick a free bus (avoids
    // colliding with SuperDirt's later allocations). Frontend reads
    // the chosen index from /clock/info — never assumes a number.
    ~scAppClockBus = Bus.audio(s, 1);
    ~scAppClockNodeId = 999;
    ~scAppClockChunkSize = clockChunkSize;
    ~scAppClockTickRate = clockTickRate;
    ~scAppClockTrigId = 1000;

    // /s_new sent as a raw OSC message so we can pin the nodeId
    // (Synth.new auto-allocates from sclang's node allocator).
    // addAction 0 = \addToHead, target 0 = root group.
    s.sendMsg('/s_new', 'scAppClock',
        ~scAppClockNodeId, 0, 0,
        'clockBus', ~scAppClockBus.index);
    s.sync;

    "[sc-app] clock running on bus % (trigId %, nodeId %, tickRate %, chunkSize %)".format(
        ~scAppClockBus.index,
        ~scAppClockTrigId,
        ~scAppClockNodeId,
        ~scAppClockTickRate.round(0.01),
        ~scAppClockChunkSize
    ).postln;

    ~dirt = SuperDirt(2, s);   // stereo
    ~dirt.loadSoundFiles("SC_APP_DIRT_SAMPLES".getenv);
    ~dirt.start(57120, 0 ! 12); // 12 orbits, all routing to bus 0
    "[sc-app] SuperDirt ready on UDP 57120".postln;

    // sc-app extension (Phase 27a). The frontend's sequencer
    // panel populates a sample-name autocomplete from the
    // banks SuperDirt actually has loaded. SuperDirt itself
    // exposes nothing for this — the dict lives on
    // ~dirt.buffers, keyed by Symbol with Array-of-BufferProxy
    // values. We flatten it into an interleaved
    // [name1, count1, name2, count2, …] reply on /dirt/samples.
    // `addr` is the sender (the bridge's per-route UDP socket
    // in Phase 26 deployments); sendMsg back there and the
    // bridge fans it onto the WebSocket the original request
    // came in on.
    OSCdef(\scAppListSamples, { |msg, time, addr|
        var args = List.new;
        if(~dirt.notNil) {
            ~dirt.buffers.keysValuesDo { |name, list|
                args.add(name.asString);
                args.add(list.size);
            };
        };
        addr.sendMsg('/dirt/samples', *args);
    }, '/dirt/listSamples');
    "[sc-app] /dirt/listSamples responder installed".postln;

    // Phase 30. Reply to /clock/hello with the current clock
    // configuration as interleaved [key, value, key, value, …]
    // pairs — same wire shape as /dirt/samples so the bridge's
    // existing reply-routing fans it back to the requesting WS.
    // Frontend (Phase 30b) parses the pairs into a typed
    // ClockInfo object.
    OSCdef(\scAppClockHello, { |msg, time, addr|
        addr.sendMsg('/clock/info',
            "tickRate", ~scAppClockTickRate,
            "chunkSize", ~scAppClockChunkSize,
            "sampleRate", s.sampleRate,
            "clockBus", ~scAppClockBus.index,
            "clockNodeId", ~scAppClockNodeId,
            "trigId", ~scAppClockTrigId
        );
    }, '/clock/hello');
    "[sc-app] /clock/hello responder installed".postln;
}, 50, {
    "[sc-app] scsynth not reachable on 127.0.0.1:57110 after 10s.\n  Start it first: yarn scsynth-only (dev) or your systemd unit (prod).".error;
});
)
