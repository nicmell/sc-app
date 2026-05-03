// Parse SC_APP_CLOCK_CHUNK_SIZE env var with validation +
// fallback to 1024. Used by the main orchestrator to derive the
// clock SynthDef's tickRate before booting it.
//
// Power of 2 strongly recommended (FFT-friendly, page-aligned
// recordings). See CLAUDE.md's chunkSize × sampleRate reference
// table for the practical range; this parser doesn't enforce
// power-of-2 because some valid configs use non-pow2 values.
//
// Defines `~scAppParseChunkSize` as a thunk so the env var read
// happens at orchestrator-call time, not at load time. Either
// would work for our case (no env-var mutation between load and
// boot), but the thunk shape is consistent with the other
// install* functions and stays correct if someone later wraps
// the parse in a closure that takes an override arg.
(
~scAppParseChunkSize = {
    var raw, n;
    raw = "SC_APP_CLOCK_CHUNK_SIZE".getenv;
    n = if(raw.isNil or: { raw.size == 0 }) {
        1024
    } {
        raw.asInteger
    };
    if(n < 1) {
        "[sc-app] SC_APP_CLOCK_CHUNK_SIZE = % invalid; falling back to 1024".format(raw).warn;
        n = 1024;
    };
    n
};
)
