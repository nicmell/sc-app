// sc-app's SuperDirt startup.
//
// Adapted from superdirt/superdirt_startup.scd (the example shipped
// with the SuperDirt quark) but two structural changes:
//
//   1. **Attach mode, not reboot.** scsynth is expected to be
//      already running externally (scripts/start-scsynth.sh, or
//      `scsynth -u 57110` directly). sclang doesn't manage its
//      lifecycle — sc-app may already be connected, and rebooting
//      scsynth would kill that. We start an alive thread, wait for
//      the server to reply, then build SuperDirt on top.
//
//   2. **Sample path from env var.** start-superdirt.sh sets
//      SC_APP_DIRT_SAMPLES to superdirt-deps/Dirt-Samples/*.
//      The vendored upstream startup is left untouched.
//
// Note: sclang is launched with `-l <generated-conf.yaml>` so the
// only quark paths in scope are SCClassLibrary, our vendored
// superdirt/, and superdirt-deps/{Vowel,sc3-plugins}. Whatever
// else lives in ~/Library/.../downloaded-quarks is invisible.
//
// Note 2: scsynth's UGen plugin path (`-U` flag) is *its* concern,
// not sclang's — for sc3-plugins UGens to actually load at runtime,
// scsynth must have been started with the right -U list. See
// scripts/start-scsynth.sh.

(
var samplesPath = "SC_APP_DIRT_SAMPLES".getenv;

// Default `s` already targets 127.0.0.1:57110 — make it explicit
// so misconfigured environments fail loudly rather than silently
// connecting to "localhost"-as-something-else.
s.addr = NetAddr("127.0.0.1", 57110);

// Watch for /status replies. When scsynth answers, s.serverRunning
// flips to true. Doesn't try to boot anything.
s.startAliveThread;

fork {
    var attemptsLeft = 20;  // 10 s @ 0.5 s polling
    while({ s.serverRunning.not and: { attemptsLeft > 0 } }) {
        0.5.wait;
        attemptsLeft = attemptsLeft - 1;
    };
    if(s.serverRunning.not) {
        "[sc-app] scsynth not reachable on % after 10s — start it first:\n  yarn scsynth   (or: scsynth -u 57110)".format(s.addr).error;
    } {
        // Register for async notifications (/n_go, /n_end, /done, …)
        // and wait for the /done /notify reply via a /sync round-trip.
        s.notify;
        s.sync;

        ~dirt = SuperDirt(2, s);   // stereo
        ~dirt.loadSoundFiles(samplesPath);
        ~dirt.start(57120, 0 ! 12); // 12 orbits, all routing to bus 0
        "[sc-app] SuperDirt ready on UDP 57120".postln;
    };
};
);
