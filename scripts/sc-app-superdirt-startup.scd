// sc-app's SuperDirt startup — attach mode.
//
// scsynth's lifecycle is OUTSIDE sclang's control:
//   - dev (Mac):   started manually in a separate terminal,
//                  typically via `yarn scsynth-only`.
//   - prod (Pi):   systemd service. See scripts/sc-app-scsynth.service.
//
// This .scd does NOT call s.reboot{} / s.boot{}. It just opens an
// alive thread, waits for scsynth's /status reply, registers /notify,
// and mounts SuperDirt on top. sc-app is an independent OSC client
// of the same scsynth.
//
// Sample path comes from SC_APP_DIRT_SAMPLES (set by the launch
// script to superdirt-deps/Dirt-Samples/*).
//
// Three things this file's structure reflects (read CLAUDE.md's
// "SuperDirt launch gotchas" section for full context):
//
//   1. Single top-level statement wrapped in Routine.run({...}).
//      sclang's command-line file parser rejects multi-statement
//      + top-level `var` inside (...);. The routine wrapper also
//      gives us .wait for the liveness poll.
//
//   2. s.options.* mirror scsynth's command-line flags. In attach
//      mode sclang doesn't push these to scsynth — but they STILL
//      govern sclang's local allocator ranges (bufferAllocator
//      uses options.numBuffers). Without this block, sclang's
//      allocator stays at default 1024 and Dirt-Samples loading
//      fails partway through with "No more buffer numbers".
//      MUST match scripts/start-scsynth-only.sh + sc-app-scsynth.service.
//
//   3. s.newAllocators after setting options. sclang's allocators
//      are constructed at Server.local init time (before this .scd
//      runs) using whatever options were in effect then — i.e.
//      defaults. Setting options now doesn't retroactively resize.
//      newAllocators rebuilds them with the current option values.

(
Routine.run({
    var samplesPath = "SC_APP_DIRT_SAMPLES".getenv;
    var attempts = 20;  // 10 s @ 0.5 s polling

    // Mirror scsynth's command-line flags into sclang's local
    // ServerOptions, then recreate sclang's allocators so they have
    // matching ranges. ServerOptions has a dual role:
    //   - At s.boot time: pushed to scsynth as `-b -m -l ...` flags.
    //   - At runtime:      governs sclang-side allocator sizes
    //                      (bufferAllocator uses options.numBuffers,
    //                       node/bus allocators use clientID +
    //                       maxLogins, etc.)
    // In attach mode we don't boot scsynth — but the second role
    // still matters. Without these, sclang's bufferAllocator stays
    // at default 1024 (Server.local was constructed before this .scd
    // ran), and SuperDirt's sample loading fails with 'No more
    // buffer numbers' around the 15th Dirt-Samples folder. Most
    // sample banks (including 'bd', 'sn', etc.) never load.
    //
    // Values must match scripts/start-scsynth-only.sh and the systemd
    // unit (scripts/sc-app-scsynth.service); change all three
    // together.
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

    s.addr = NetAddr("127.0.0.1", 57110);
    s.startAliveThread;

    while({ s.serverRunning.not and: { attempts > 0 } }) {
        0.5.wait;
        attempts = attempts - 1;
    };

    if(s.serverRunning.not) {
        "[sc-app] scsynth not reachable on 127.0.0.1:57110 after 10s.\n  Start it first: yarn scsynth-only (dev) or your systemd unit (prod).".error;
    } {
        // Register for async notifications (/n_go, /n_end, /done, …)
        // and wait for /done /notify via a /sync round-trip.
        s.notify;
        s.sync;

        ~dirt = SuperDirt(2, s);   // stereo
        ~dirt.loadSoundFiles(samplesPath);
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
    };
});
);
