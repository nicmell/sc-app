SynthDef(\sine, { |freq=440, amp=0.2|
    Out.ar(0, SinOsc.ar(freq, 0) * amp)
}).writeDefFile(thisProcess.argv[0]);
0.exit;
