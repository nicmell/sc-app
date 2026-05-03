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
// Post-Phase-31 cleanup: this SynthDef previously also wrote a
// sample-counting `Phasor.ar` to a dedicated `clockBus`, read by
// the per-session tap synths to keep their ring-buffer
// `writeIdx` aligned with global tick parity (see Phase 6 / 8 in
// docs/history.md). Phase 31 switched tap synths to
// `ScopeOut2.ar`, which manages its own slot timing internally
// and doesn't need the clockBus. The bus + the `Out.ar` were
// retired in a post-34 tidy — nothing in the codebase reads them.
(
~scAppInstallClock = { |clockChunkSize|
    var clockTickRate = s.sampleRate / clockChunkSize;

    SynthDef(\scAppClock, {
        var tick = Impulse.kr(clockTickRate);
        var count = PulseCount.kr(tick);
        SendReply.kr(tick, '/clock/tick', count);
    }).add;
    s.sync;

    ~scAppClockNodeId = 999;
    ~scAppClockChunkSize = clockChunkSize;
    ~scAppClockTickRate = clockTickRate;

    // Raw OSC /s_new so we can pin the nodeId (Synth.new auto-
    // allocates from sclang's node allocator).
    // addAction 0 = \addToHead, target 0 = root group.
    s.sendMsg('/s_new', 'scAppClock', ~scAppClockNodeId, 0, 0);
    s.sync;

    "[sc-app] clock running (nodeId %, tickRate %, chunkSize %)".format(
        ~scAppClockNodeId,
        ~scAppClockTickRate.round(0.01),
        ~scAppClockChunkSize
    ).postln;

    // /clock/hello → /clock/info responder. Wire shape:
    // interleaved [key, value, key, value, …] — same as
    // /dirt/samples so the bridge's reply-routing fans it back to
    // the requesting WS unchanged. Frontend (Phase 30b) parses
    // the pairs into a typed ClockInfo object.
    OSCdef(\scAppClockHello, { |msg, time, addr|
        addr.sendMsg('/clock/info',
            "tickRate", ~scAppClockTickRate,
            "chunkSize", ~scAppClockChunkSize,
            "sampleRate", s.sampleRate,
            "clockNodeId", ~scAppClockNodeId
        );
    }, '/clock/hello');
    "[sc-app] /clock/hello responder installed".postln;
};
)
