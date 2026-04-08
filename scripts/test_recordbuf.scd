// Run in sclang: generates a reference .scsyndef and tests RecordBuf
// Execute line by line (Cmd+Enter on each expression)

// 1. Boot server
s.boot;

// 2. Compile and write reference synthdef to Desktop
(
SynthDef(\ref_test_rec, { |bufnum=0|
    RecordBuf.ar(SinOsc.ar(440), bufnum);
}).writeDefFile(Platform.userHomeDir +/+ "Desktop");
)

// 3. Also test it live — allocate buffer, play synth, read back
(
b = Buffer.alloc(s, 44100, 1);
s.sync;
x = Synth(\ref_test_rec, [\bufnum, b]);
)

// 4. After ~2 seconds, check buffer content
b.getn(0, 10, { |data| data.postln });

// 5. Cleanup
x.free;
b.free;

// 6. Hex dump of the reference file for comparison
(
var path = Platform.userHomeDir +/+ "Desktop" +/+ "ref_test_rec.scsyndef";
var file = File(path, "rb");
var bytes = Int8Array.newClear(file.length);
file.read(bytes);
file.close;
bytes.collect({ |b| b.asInteger.asHexString(2) }).join(" ").postln;
)
