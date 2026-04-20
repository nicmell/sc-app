SynthDef(\__global_clock__, {
    var phase, pkr, tick;
    phase = Phasor.ar(0, 1, 0, 8192, 0);
    Out.ar(1000, phase);
    pkr = A2K.kr(phase);
    tick = Impulse.kr(10, 0);
    SendTrig.kr(tick, 4242, pkr);
}).writeDefFile(thisProcess.nowExecutingPath.dirname);
0.exit;
