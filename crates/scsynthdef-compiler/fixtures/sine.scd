SynthDef(\sine, { |freq = 440|
    Out.ar(0, SinOsc.ar(freq, 0))
}).writeDefFile(thisProcess.nowExecutingPath.dirname);
0.exit;
