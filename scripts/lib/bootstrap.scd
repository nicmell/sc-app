// Phase 39b: bootstrap responder.
//
// Replaces the per-session /clock/hello + /scope/hello +
// /dirt/listSamples round-trips with a single bridge-to-sclang
// handshake at bridge boot. Bridge sends `/bootstrap/hello`;
// sclang responds with three messages:
//
//   /bootstrap/info
//     "clockBus", <int>,
//     "clockNodeId", <int>,
//     "tickRate", <float>,
//     "chunkSize", <int>,
//     "sampleRate", <float>,
//     "numScopeBuffers", <int>
//
//   /bootstrap/samples
//     name1, count1, name2, count2, ...
//
//   /bootstrap/scsynth-version
//     progName, major, minor, patch, branch, commitHash
//     (or empty args if /version timed out at sclang boot —
//      bridge tolerates and reports version=null)
//
// Each install function (`~installX(bootstrapCtx)`)
// contributes its keys to `bootstrapCtx` at install time;
// the responder serializes the dict on demand.
//
// `~bootstrapCtx` is initialized empty; the orchestrator
// fills it via the install functions, then installs the
// responder. After install, mutations are not expected (bridge
// reads once at boot).

(
~bootstrapCtx = (
    clock: (),
    scope: (),
    dirt: ()
);

~installBootstrap = {
    OSCdef(\bootstrapHello, { |msg, time, addr|
        var ctx = ~bootstrapCtx;
        var infoArgs = List.new;
        var samplesArgs = List.new;
        var versionArgs = List.new;

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

        // scsynth /version snapshot captured by ~installVersion
        // (lib/version.scd). Sent unconditionally so the bridge's
        // bootstrap waiter has a deterministic third message; empty
        // args = timed out at sclang boot, bridge falls back to None.
        ctx[\scsynthVersion] !? { |v|
            versionArgs.add(v[\progName]);
            versionArgs.add(v[\major]);
            versionArgs.add(v[\minor]);
            versionArgs.add(v[\patch]);
            versionArgs.add(v[\branch]);
            versionArgs.add(v[\commitHash]);
        };

        addr.sendMsg('/bootstrap/info', *infoArgs);
        addr.sendMsg('/bootstrap/samples', *samplesArgs);
        addr.sendMsg('/bootstrap/scsynth-version', *versionArgs);
    }, '/bootstrap/hello');

    "/bootstrap/hello responder installed (% clock keys, % scope keys, % dirt samples, version=%)".format(
        ~bootstrapCtx[\clock].size,
        ~bootstrapCtx[\scope].size,
        if(~dirt.notNil) { ~dirt.buffers.size } { 0 },
        ~bootstrapCtx[\scsynthVersion].notNil
    ).postln;
};
)
