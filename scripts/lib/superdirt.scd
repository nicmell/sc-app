// SuperDirt boot: 12 orbits, all routing to bus 0 (stereo).
// Sample path comes from SC_APP_DIRT_SAMPLES (set by the launch
// script to superdirt-deps/Dirt-Samples/*).
//
// Listens on UDP 57120 — the bridge's `/dirt/* → 127.0.0.1:57120`
// route forwards `/dirt/play` and friends here.
(
~installSuperDirt = {
    ~dirt = SuperDirt(2, s);
    ~dirt.loadSoundFiles("SC_APP_DIRT_SAMPLES".getenv);
    ~dirt.start(57120, 0 ! 12);
    "SuperDirt ready on UDP 57120".postln;
};
)
