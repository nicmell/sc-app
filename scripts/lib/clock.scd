// Shared global clock SynthDef.
//
// Phase 30 introduced the synth (sclang owned both definition AND
// instantiation). Phase 39d split it: sclang DEFINES (.add()) and
// reports the clockBus + clockNodeId via the bootstrap reply; the
// BRIDGE INSTANTIATES (/s_new) at boot. The pattern: "sclang
// declares, bridge creates" — it makes chunkSize a bridge-config
// concern (no more SC_APP_CLOCK_CHUNK_SIZE env var) and lets the
// bridge synchronously verify creation via /sync.
//
// SynthDef args:
//   - clockBus: the audio bus the sample-counting Phasor writes to.
//     OSC-fallback tap SynthDefs read via In.ar(clockBus) to derive
//     a sample-aligned ring-buffer writeIdx. SHM mode ignores it.
//   - chunkSize: audio frames per tick. tickRate derives from
//     SampleRate.ir / chunkSize at synth-construction time.
//
// nodeId 999 is reserved by convention; the bridge pins it on
// /s_new. Out of range for client IdAllocators (clientId *
// 1_000_000 + 1000).
//
// The SynthDef name keeps the `scApp` prefix (`\scAppClock`)
// because SynthDefs are stored in scsynth's shared in-memory
// dict — namespaced across every client connected to that
// scsynth, not just this sclang. A bare `\clock` would
// collide with anything else (current or future) registering a
// clock def on the same scsynth. Sclang-private bindings
// (env vars, OSCdef names) drop the prefix because their
// namespace is sclang-internal.
//
// SendReply.kr emits `/clock/tick <nodeID> <replyID> <count>`
// (replyID = -1 by default). scsynth multicasts to every /notify'd
// client; the bridge sees them on its single /notify slot and
// fans to all attached WSs.
(
~installClock = {
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

    // Bus.audio lets sclang's allocator pick a free bus (avoids
    // colliding with SuperDirt's allocations later in the boot
    // sequence). The bridge reads the chosen index from the
    // bootstrap reply and passes it as a /s_new arg.
    ~clockBus = Bus.audio(s, 1);
    ~clockNodeId = 999;

    "clock SynthDef added on bus % (nodeId % — bridge will /s_new)".format(
        ~clockBus.index,
        ~clockNodeId
    ).postln;

    // Phase 39d: sclang DECLARES; bridge INSTANTIATES.
    // bootstrapCtx carries clockBus + clockNodeId; the bridge
    // supplies chunkSize from config and synthesizes the rest
    // (tickRate, sampleRate) post-/s_new.
    ~bootstrapCtx[\clock] = (
        clockBus: ~clockBus.index,
        clockNodeId: ~clockNodeId
    );
};
)
