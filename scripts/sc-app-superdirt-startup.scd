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
