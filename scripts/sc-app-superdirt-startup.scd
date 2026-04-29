// sc-app's SuperDirt startup.
//
// Adapted from superdirt/superdirt_startup.scd (the example file
// shipped with the SuperDirt quark) but changed in two ways:
//
//   1. Sample path comes from the SC_APP_DIRT_SAMPLES env var, set
//      by scripts/start-superdirt.sh. This decouples the script
//      from any assumption about where Dirt-Samples lives in the
//      user's quark folder — sc-app pins it under superdirt-deps/.
//
//   2. No SuperDirt.default = ~dirt convenience handle is set; the
//      project doesn't use sclang interactively after boot.
//
// Note: sclang is launched with `-l <generated-conf.yaml>` so the
// only quark paths in scope are SCClassLibrary, our vendored
// superdirt/, and superdirt-deps/{Vowel, sc3-plugins}. Whatever
// else lives in ~/Library/.../downloaded-quarks is invisible to
// this run.

(
var samplesPath = "SC_APP_DIRT_SAMPLES".getenv;
if(samplesPath.isNil or: { samplesPath.size == 0 }) {
    "SC_APP_DIRT_SAMPLES env var not set — start-superdirt.sh should set this".error;
};

s.reboot {
    // Server options — only applied on (re)boot.
    s.options.numBuffers = 1024 * 256;
    s.options.memSize = 8192 * 32;
    s.options.numWireBufs = 2048;
    s.options.maxNodes = 1024 * 32;
    s.options.numOutputBusChannels = 2;
    s.options.numInputBusChannels = 2;

    s.waitForBoot {
        ~dirt.stop; // tear down a prior instance, if any
        ~dirt = SuperDirt(2, s);   // stereo
        ~dirt.loadSoundFiles(samplesPath);
        ~dirt.start(57120, 0 ! 12); // 12 orbits, all routing to bus 0
    };

    s.latency = 0.3;
};
);
