// Phase 31: scope buffer index allocation responders. The bridge
// owns the SHM read path for scope/recording data (Phase 31).
// Frontend asks sclang for a scope buffer index before /s_new'ing
// a tap synth that ScopeOut2's into it.
//
// sclang's `s.scopeBufferAllocator` is a StackNumberAllocator
// with range 0..127 — 128 scope buffer slots in scsynth's SHM
// segment. Each ScopeOut2 call uses one slot (multi-channel
// ScopeOut2 stores all channels interleaved in one slot).
//
// /scope/hello → /scope/info: informational (slot count, plus
//   any future layout knobs the bridge needs).
// /scope/allocate → /scope/allocated <idx>: pulls the next free
//   index. Replies on /scope/allocateFailed with an error string
//   when the allocator is exhausted.
// /scope/free <idx>: returns the index to the free list. No
//   reply (fire-and-forget; mirrors how SC's ScopeBuffer.free
//   itself doesn't round-trip).
(
~scAppInstallScopeResponders = {
    // Phase 39b: contribute scope metadata to the bootstrap
    // context. The bridge reads numScopeBuffers from the
    // bootstrap reply at boot.
    ~scAppBootstrapCtx[\scope] = (
        numScopeBuffers: 128
    );

    OSCdef(\scAppScopeHello, { |msg, time, addr|
        addr.sendMsg('/scope/info', "numScopeBuffers", 128);
    }, '/scope/hello');
    "[sc-app] /scope/hello responder installed".postln;

    OSCdef(\scAppScopeAllocate, { |msg, time, addr|
        var idx = s.scopeBufferAllocator.alloc;
        if(idx.notNil) {
            addr.sendMsg('/scope/allocated', idx);
        } {
            addr.sendMsg('/scope/allocateFailed',
                "scope buffer allocator exhausted (max 128)");
        };
    }, '/scope/allocate');
    "[sc-app] /scope/allocate responder installed".postln;

    OSCdef(\scAppScopeFree, { |msg, time, addr|
        var idx = msg[1];
        if(idx.notNil and: { idx.isNumber }) {
            s.scopeBufferAllocator.free(idx);
        };
        // No reply; fire-and-forget. Bogus index → silent no-op
        // (StackNumberAllocator.free just appends to its free
        // list without validation).
    }, '/scope/free');
    "[sc-app] /scope/free responder installed".postln;
};
)
