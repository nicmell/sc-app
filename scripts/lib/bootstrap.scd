// Phase 39b: bootstrap responder.
//
// Replaces the per-session /clock/hello + /scope/hello +
// /dirt/listSamples round-trips with a single bridge-to-sclang
// handshake at bridge boot. Bridge sends
// `/sc-app/bootstrap/hello`; sclang responds with a bundle:
//
//   /sc-app/bootstrap/info
//     "clockBus", <int>,
//     "clockNodeId", <int>,
//     "tickRate", <float>,
//     "chunkSize", <int>,
//     "sampleRate", <float>,
//     "numScopeBuffers", <int>
//
//   /sc-app/bootstrap/samples
//     name1, count1, name2, count2, ...
//
// Each install function (`~scAppInstallX(bootstrapCtx)`)
// contributes its keys to `bootstrapCtx` at install time;
// the responder serializes the dict on demand.
//
// `~scAppBootstrapCtx` is initialized empty; the orchestrator
// fills it via the install functions, then installs the
// responder. After install, mutations are not expected (bridge
// reads once at boot).

(
~scAppBootstrapCtx = (
    clock: (),
    scope: (),
    dirt: ()
);

~scAppInstallBootstrap = {
    OSCdef(\scAppBootstrapHello, { |msg, time, addr|
        var ctx = ~scAppBootstrapCtx;
        var infoArgs = List.new;
        var samplesArgs = List.new;

        // Clock metadata. Some keys may be missing if the clock
        // wasn't installed (e.g., scsynth wasn't reachable);
        // the bridge tolerates missing keys.
        ctx[\clock].keysValuesDo { |k, v|
            infoArgs.add(k.asString);
            infoArgs.add(v);
        };
        // Scope metadata.
        ctx[\scope].keysValuesDo { |k, v|
            infoArgs.add(k.asString);
            infoArgs.add(v);
        };

        // Dirt sample list (interleaved name/count).
        if(~dirt.notNil) {
            ~dirt.buffers.keysValuesDo { |name, list|
                samplesArgs.add(name.asString);
                samplesArgs.add(list.size);
            };
        };

        addr.sendMsg('/sc-app/bootstrap/info', *infoArgs);
        addr.sendMsg('/sc-app/bootstrap/samples', *samplesArgs);
    }, '/sc-app/bootstrap/hello');

    "[sc-app] /sc-app/bootstrap/hello responder installed (% clock keys, % scope keys, % dirt samples)".format(
        ~scAppBootstrapCtx[\clock].size,
        ~scAppBootstrapCtx[\scope].size,
        if(~dirt.notNil) { ~dirt.buffers.size } { 0 }
    ).postln;
};
)
