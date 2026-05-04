// Phase 30: shared global clock. SynthDef + /s_new at scsynth's
// root group head + /clock/hello → /clock/info responder.
//
// nodeId 999 is reserved by convention (off-limits to client
// IdAllocator ranges, which start at clientId * 1_000_000 + 1000).
//
// tickRate is baked into the SynthDef bytes as a literal Hz —
// changing chunkSize requires re-running the startup script.
//
// SendReply is used instead of SendTrig (post-Phase-30 cleanup),
// with the custom OSC address `/clock/tick`. Reasons:
//   - Address-based namespacing matches the rest of the bridge's
//     OSC routing (`/dirt/*`, `/clock/*`).
//   - Removes the app-wide "no synth may use trigID 1000"
//     reservation — anyone can SendTrig now without colliding.
//   - Worker-side decoding collapses into the regular
//     address-match path; no special trigID demux.
// Wire payload: `/clock/tick nodeID replyID count` (SendReply's
// default replyID = -1; we don't use it).
//
// Phase 36: clockBus is back. Pre-31 the SynthDef wrote a
// sample-counting `Phasor.ar` to a dedicated `clockBus`, read by
// the per-session tap synths to keep their ring-buffer
// `writeIdx` aligned with global tick parity (see Phase 6 / 8 in
// docs/history.md). Phase 31 switched tap synths to
// `ScopeOut2.ar`, which manages its own slot timing internally;
// the bus + the `Out.ar` were retired in a post-34 tidy. Phase 36
// brings the OSC `/b_getn` fallback back into play (in the Rust
// bridge this time), and that path needs the same clockBus-driven
// writeIdx for sample-aligned reads. So the bus is back. SHM mode
// ignores it; OSC fallback mode reads it via In.ar.
(
~scAppInstallClock = { |clockChunkSize|
    var clockTickRate = s.sampleRate / clockChunkSize;

    SynthDef(\scAppClock, { |clockBus = 0|
        var tick = Impulse.kr(clockTickRate);
        var count = PulseCount.kr(tick);
        // Sample-counting phasor wrapping every 2 × chunkSize
        // samples. The OSC-fallback tap SynthDef reads this via
        // In.ar(clockBus) and computes
        //   writeIdx = clockPhase % (2 × chunkSize)
        // which gives a writeIdx that alternates between two ring
        // halves, aligned with global tick parity (the bridge can
        // figure out which half just completed by looking at the
        // tickIndex from /clock/tick). SHM mode doesn't read this.
        var wrap = SampleRate.ir * (2 / clockTickRate);
        var samplePhase = Phasor.ar(0, 1, 0, wrap);
        SendReply.kr(tick, '/clock/tick', count);
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

    // Raw OSC /s_new so we can pin the nodeId (Synth.new auto-
    // allocates from sclang's node allocator).
    // addAction 0 = \addToHead, target 0 = root group.
    s.sendMsg('/s_new', 'scAppClock',
        ~scAppClockNodeId, 0, 0,
        'clockBus', ~scAppClockBus.index);
    s.sync;

    "[sc-app] clock running on bus % (nodeId %, tickRate %, chunkSize %)".format(
        ~scAppClockBus.index,
        ~scAppClockNodeId,
        ~scAppClockTickRate.round(0.01),
        ~scAppClockChunkSize
    ).postln;

    // Phase 39b: contribute to the bootstrap context. Replaces
    // the pre-39 /clock/hello → /clock/info round-trip; bridge
    // fetches once at boot via /sc-app/bootstrap/hello and
    // exposes the values on SessionInfo.
    ~scAppBootstrapCtx[\clock] = (
        clockBus: ~scAppClockBus.index,
        clockNodeId: ~scAppClockNodeId,
        tickRate: ~scAppClockTickRate,
        chunkSize: ~scAppClockChunkSize,
        sampleRate: s.sampleRate
    );
};
)
