//! End-to-end tests for the spec-level SynthDef encoder / decoder.
//!
//! Every test exercises the programmatic builder (`SynthDef::add_control`,
//! `SynthDef::add_ugen`) and the encode / parse round-trips. The high-level
//! typed UGen API is covered by its own tests alongside the generator that
//! emits it.

use scsynthdef_compiler::{Rate, SynthDef, UGenInput};

/// Reader that chews through SCgf v2 bytes sequentially.
struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }
    fn i8(&mut self) -> i8 {
        let v = self.buf[self.pos] as i8;
        self.pos += 1;
        v
    }
    fn i16(&mut self) -> i16 {
        let v = i16::from_be_bytes(self.buf[self.pos..self.pos + 2].try_into().unwrap());
        self.pos += 2;
        v
    }
    fn i32(&mut self) -> i32 {
        let v = i32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        v
    }
    fn f32(&mut self) -> f32 {
        let v = f32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
        self.pos += 4;
        v
    }
    fn pstring(&mut self) -> String {
        let len = self.buf[self.pos] as usize;
        self.pos += 1;
        let s = std::str::from_utf8(&self.buf[self.pos..self.pos + len])
            .unwrap()
            .to_string();
        self.pos += len;
        s
    }
}

/// Minimal `SinOsc.ar(440) → Out.ar(0, …)` built programmatically.
#[test]
fn minimal_sinosc_out_via_builder() {
    let mut def = SynthDef::new("minimal");
    let sin = def.add_ugen(
        "SinOsc",
        Rate::Audio,
        vec![UGenInput::Constant(440.0), UGenInput::Constant(0.0)],
        1,
        0,
    );
    def.add_ugen(
        "Out",
        Rate::Audio,
        vec![UGenInput::Constant(0.0), UGenInput::UGen(sin)],
        0,
        0,
    );
    let bytes = def.to_bytes().expect("encode");

    let mut r = Reader::new(&bytes);
    assert_eq!(r.i32(), 0x53436766, "magic");
    assert_eq!(r.i32(), 2, "version");
    assert_eq!(r.i16(), 1, "#synthdefs");
    assert_eq!(r.pstring(), "minimal");

    // Constants: 440.0 and 0.0 (first-seen order).
    assert_eq!(r.i32(), 2, "#constants");
    assert_eq!(r.f32(), 440.0);
    assert_eq!(r.f32(), 0.0);

    // No params.
    assert_eq!(r.i32(), 0, "#param defaults");
    assert_eq!(r.i32(), 0, "#param names");

    // UGens.
    assert_eq!(r.i32(), 2, "#ugens");

    // SinOsc
    assert_eq!(r.pstring(), "SinOsc");
    assert_eq!(r.i8(), Rate::Audio.as_i8());
    assert_eq!(r.i32(), 2, "sinosc #inputs");
    assert_eq!(r.i32(), 1, "sinosc #outputs");
    assert_eq!(r.i16(), 0, "sinosc specialIndex");
    assert_eq!(r.i32(), -1);
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i32(), -1);
    assert_eq!(r.i32(), 1);
    assert_eq!(r.i8(), Rate::Audio.as_i8(), "sinosc output rate");

    // Out
    assert_eq!(r.pstring(), "Out");
    assert_eq!(r.i8(), Rate::Audio.as_i8());
    assert_eq!(r.i32(), 2, "out #inputs");
    assert_eq!(r.i32(), 0, "out #outputs");
    assert_eq!(r.i16(), 0, "out specialIndex");
    // bus=0 constant (index 1 in constants table)
    assert_eq!(r.i32(), -1);
    assert_eq!(r.i32(), 1);
    // sinosc output 0
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i32(), 0);

    // Variants terminator
    assert_eq!(r.i16(), 0, "variants");
    assert_eq!(r.pos, bytes.len(), "consumed all bytes");
}

/// Two kr controls → one grouped `Control` UGen with `num_outputs = 2`,
/// `special_index = 0` (matches sclang's convention).
#[test]
fn two_kr_controls_produce_one_grouped_control_ugen() {
    let mut def = SynthDef::new("grouped");
    let freq = def.add_control("freq", 440.0, Rate::Control).unwrap();
    let amp = def.add_control("amp", 0.5, Rate::Control).unwrap();
    let sin = def.add_ugen(
        "SinOsc",
        Rate::Audio,
        vec![freq, UGenInput::Constant(0.0)],
        1,
        0,
    );
    let scaled = def.add_ugen(
        "BinaryOpUGen",
        Rate::Audio,
        vec![UGenInput::UGen(sin), amp],
        1,
        2, // *
    );
    def.add_ugen(
        "Out",
        Rate::Audio,
        vec![UGenInput::Constant(0.0), UGenInput::UGen(scaled)],
        0,
        0,
    );

    let bytes = def.to_bytes().expect("encode");

    let mut r = Reader::new(&bytes);
    assert_eq!(r.i32(), 0x53436766);
    assert_eq!(r.i32(), 2);
    assert_eq!(r.i16(), 1);
    assert_eq!(r.pstring(), "grouped");
    let nconst = r.i32();
    for _ in 0..nconst {
        r.f32();
    }
    let nparams = r.i32();
    for _ in 0..nparams {
        r.f32();
    }
    let nnames = r.i32();
    for _ in 0..nnames {
        r.pstring();
        r.i32();
    }
    let nugens = r.i32();
    assert_eq!(nugens, 4, "expected [Control(grouped), SinOsc, BinaryOpUGen, Out]");

    // First UGen must be the grouped Control with num_outputs=2,
    // special_index=0.
    assert_eq!(r.pstring(), "Control");
    assert_eq!(r.i8(), Rate::Control.as_i8());
    assert_eq!(r.i32(), 0, "Control has no inputs");
    assert_eq!(r.i32(), 2, "Control num_outputs = number of kr params");
    assert_eq!(r.i16(), 0, "Control special_index = 0 (first param offset)");
}

/// `to_bytes → from_json → to_bytes` is byte-identical to the original.
/// Exercises constants dedup, param encoding, and multi-output refs.
#[test]
fn synthdef_json_round_trip() {
    let mut def = SynthDef::new("roundtrip");
    let freq = def.add_control("freq", 440.0, Rate::Control).unwrap();
    let amp = def.add_control("amp", 0.5, Rate::Control).unwrap();
    let sin = def.add_ugen(
        "SinOsc",
        Rate::Audio,
        vec![freq, UGenInput::Constant(0.0)],
        1,
        0,
    );
    let scaled = def.add_ugen(
        "BinaryOpUGen",
        Rate::Audio,
        vec![UGenInput::UGen(sin), amp],
        1,
        2, // *
    );
    def.add_ugen(
        "Out",
        Rate::Audio,
        vec![UGenInput::Constant(0.0), UGenInput::UGen(scaled)],
        0,
        0,
    );

    let original_bytes = def.to_bytes().expect("encode");
    let json = def.to_json().expect("to_json");
    let reconstructed = SynthDef::from_json(&json).expect("from_json");
    let round_trip_bytes = reconstructed.to_bytes().expect("encode reconstructed");

    assert_eq!(
        original_bytes, round_trip_bytes,
        "round-tripped bytes must match original"
    );
}

/// `to_bytes → from_bytes → to_bytes` is byte-identical to the original.
/// Exercises the library's SCgf parser end-to-end.
#[test]
fn synthdef_bytes_round_trip() {
    let mut def = SynthDef::new("bytes_roundtrip");
    let freq = def.add_control("freq", 220.0, Rate::Control).unwrap();
    let amp = def.add_control("amp", 0.8, Rate::Control).unwrap();
    let sin = def.add_ugen(
        "SinOsc",
        Rate::Audio,
        vec![freq, UGenInput::Constant(0.0)],
        1,
        0,
    );
    let scaled = def.add_ugen(
        "BinaryOpUGen",
        Rate::Audio,
        vec![UGenInput::UGen(sin), amp],
        1,
        2, // *
    );
    def.add_ugen(
        "Out",
        Rate::Audio,
        vec![UGenInput::Constant(0.0), UGenInput::UGen(scaled)],
        0,
        0,
    );

    let a = def.to_bytes().expect("encode");
    let b = SynthDef::from_bytes(&a)
        .expect("parse")
        .to_bytes()
        .expect("re-encode");
    assert_eq!(a, b, "bytes round-trip must be identical");
}

/// Typed UGen builders produce the exact same bytes as the low-level
/// `add_ugen` path for an equivalent graph. Exercises the generated
/// `builders::*` structs end-to-end.
#[test]
fn typed_builders_match_low_level_path() {
    use scsynthdef_compiler::builders::{Out, SinOsc};

    // Reference: hand-assembled via add_ugen.
    let mut reference = SynthDef::new("typed");
    let freq = reference.add_control("freq", 440.0, Rate::Control).unwrap();
    let sin_ref = reference.add_ugen(
        "SinOsc",
        Rate::Audio,
        vec![freq, UGenInput::Constant(0.0)],
        1,
        0,
    );
    reference.add_ugen(
        "Out",
        Rate::Audio,
        vec![UGenInput::Constant(0.0), UGenInput::UGen(sin_ref)],
        0,
        0,
    );
    let ref_bytes = reference.to_bytes().expect("encode reference");

    // Same graph via the generated typed builders.
    let mut def = SynthDef::new("typed");
    let freq = def.add_control("freq", 440.0, Rate::Control).unwrap();
    let osc = SinOsc::ar().freq(freq).phase(0.0).build(&mut def);
    Out::ar().bus(0.0).channels_array([osc]).build(&mut def);
    let built_bytes = def.to_bytes().expect("encode builders");

    assert_eq!(ref_bytes, built_bytes, "builder bytes must match low-level");
}

/// `SynthDefJson` survives a pass through serde_json as pretty-printed text.
#[test]
fn synthdef_json_serializes_and_parses() {
    let mut def = SynthDef::new("json_string");
    let f = def.add_control("freq", 220.0, Rate::Control).unwrap();
    def.add_ugen(
        "SinOsc",
        Rate::Audio,
        vec![f, UGenInput::Constant(0.0)],
        1,
        0,
    );

    let json = def.to_json().unwrap();
    let s = serde_json::to_string_pretty(&json).unwrap();
    assert!(s.contains("\"SinOsc\""));
    assert!(s.contains("\"freq\""));
    // camelCase field names line up with sclang's JSON convention.
    assert!(s.contains("\"className\""));
    assert!(s.contains("\"numInputs\""));

    let parsed: scsynthdef_compiler::SynthDefJson = serde_json::from_str(&s).unwrap();
    assert_eq!(parsed.name, "json_string");
    assert_eq!(parsed.parameters.values, vec![220.0]);
}
