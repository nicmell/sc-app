// sc-app's SuperDirt startup.
//
// Adapted from superdirt/superdirt_startup.scd (the example shipped
// with the SuperDirt quark). Two changes vs. upstream:
//
//   1. Sample path comes from SC_APP_DIRT_SAMPLES env var (set by
//      scripts/start-superdirt.sh to superdirt-deps/Dirt-Samples/*).
//      The vendored upstream startup is left untouched.
//
//   2. UGen plugin paths come from SC_APP_STOCK_PLUGINS_PATH and
//      SC_APP_SC3_PLUGINS_PATH env vars (macOS only). On Linux,
//      apt-installed sc3-plugins lives in scsynth's compiled-in
//      default path so we leave ugenPluginsPath at its default.
//
// sclang owns scsynth's lifecycle here — `s.reboot { ... }` sends
// /quit to any existing scsynth on 57110 (graceful), then boots a
// fresh one with the options below. sc-app then connects to that
// scsynth as a normal OSC client. SuperDirt + sc-app + anything
// else all share one scsynth instance.
//
// sclang is launched with `-l <generated-conf.yaml>` so the only
// quark paths in scope are SCClassLibrary, our vendored superdirt/
// submodule, and superdirt-deps/{Vowel,sc3-plugins}. Whatever else
// lives in ~/Library/.../downloaded-quarks is invisible.

(
s.reboot {
    // `var` declarations live at the top of s.reboot's function
    // body — sclang's command-line file parser refuses them
    // anywhere else inside the outer (...);. The s.waitForBoot
    // closure below picks them up via lexical capture.
    var samplesPath = "SC_APP_DIRT_SAMPLES".getenv;
    var stockPlugins = "SC_APP_STOCK_PLUGINS_PATH".getenv;
    var sc3Plugins = "SC_APP_SC3_PLUGINS_PATH".getenv;

    // Plugin search path for scsynth (-U flag). Setting this BEFORE
    // s.waitForBoot is critical — sclang passes the option to scsynth
    // at boot time, and scsynth scans the path when it starts up.
    // If both env vars are absent (Linux apt path, or sc3-plugins
    // skipped), leave the option at default and scsynth uses its
    // compiled-in plugin path.
    if(stockPlugins.notNil and: { sc3Plugins.notNil }) {
        s.options.ugenPluginsPath = [stockPlugins, sc3Plugins];
    };

    // SuperDirt-required server sizing. Defaults are far too small —
    // Dirt-Samples alone exceeds the default 1024 buffers, and the
    // per-orbit graph needs tens of MB of real-time memory.
    s.options.numBuffers = 1024 * 256;        // -b 262144
    s.options.memSize = 8192 * 32;             // -m 262144 KB
    s.options.numWireBufs = 2048;
    s.options.maxNodes = 1024 * 32;
    s.options.numOutputBusChannels = 2;
    s.options.numInputBusChannels = 2;
    // sclang's hardcoded cap is 32; SC 3.14's scsynth default is 64
    // which trips that mirror check during /notify. Pin to a safe
    // value below the cap.
    s.options.maxLogins = 8;

    s.waitForBoot {
        ~dirt.stop; // tear down a prior instance, if any
        ~dirt = SuperDirt(2, s);   // stereo
        ~dirt.loadSoundFiles(samplesPath);
        ~dirt.start(57120, 0 ! 12); // 12 orbits, all routing to bus 0
        "[sc-app] SuperDirt ready on UDP 57120".postln;
    };

    s.latency = 0.3;
};
);
