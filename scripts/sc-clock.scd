// Shared `\scAppClock` SynthDef declaration.
//
// Loaded by `sc-startup.scd` (flavor-agnostic) on every sclang
// boot — both the SuperDirt and the StrudelDirt launcher paths
// share this file. Extracted out so the per-flavor boot scripts
// don't duplicate it.
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
