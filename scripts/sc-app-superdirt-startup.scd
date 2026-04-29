// sc-app's SuperDirt startup — attach mode.
//
// scsynth's lifecycle is OUTSIDE sclang's control:
//   - dev (Mac):   started manually in a separate terminal,
//                  typically via `yarn scsynth`.
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
// Wrapping note: the entire body lives inside Routine.run({…}) — a
// single top-level statement. sclang's command-line file parser
// rejects multiple top-level statements + `var` declarations inside
// the outer (...);. The routine context also gives us .wait for the
// liveness poll.

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
    // Values must match scripts/start-scsynth.sh and the systemd
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
        "[sc-app] scsynth not reachable on 127.0.0.1:57110 after 10s.\n  Start it first: yarn scsynth (dev) or your systemd unit (prod).".error;
    } {
        // Register for async notifications (/n_go, /n_end, /done, …)
        // and wait for /done /notify via a /sync round-trip.
        s.notify;
        s.sync;

        ~dirt = SuperDirt(2, s);   // stereo
        ~dirt.loadSoundFiles(samplesPath);
        ~dirt.start(57120, 0 ! 12); // 12 orbits, all routing to bus 0
        "[sc-app] SuperDirt ready on UDP 57120".postln;
    };
});
);
