//! End-to-end tests: verify SCgf bytes structurally and against hand-computed
//! expectations for representative SynthDefs.
//!
//! These tests ensure the encoder is format-correct. Byte-for-byte parity
//! against the TS compiler for the full plugin set is a follow-up — see the
//! crate README.

use std::collections::BTreeMap;

use scsynthdef_compiler::{
    compile_synthdef, dump_specs_json, parse_specs_json, Rate, SynthDef, UGenInput, UGenSpec,
};

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

/// Same graph via the HTML-driven `compile_synthdef` — asserts the high-level
/// path agrees with the programmatic path for identical graphs.
#[test]
fn sinosc_out_via_compile_synthdef() {
    let specs = vec![
        UGenSpec {
            name: "osc".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "freq"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "out".into(),
            ugen_type: "Out".into(),
            rate: "ar".into(),
            inputs: [("bus", "0"), ("channelsArray", "osc")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
    ];
    let params = vec![("freq".to_string(), 440.0f32)];

    let bytes = compile_synthdef("simpleSine", &params, &specs).expect("compile");

    let mut r = Reader::new(&bytes);
    assert_eq!(r.i32(), 0x53436766);
    assert_eq!(r.i32(), 2);
    assert_eq!(r.i16(), 1);
    assert_eq!(r.pstring(), "simpleSine");

    // Constants: only 0.0 (from phase default and Out's bus=0 — deduped).
    assert_eq!(r.i32(), 1, "#constants");
    assert_eq!(r.f32(), 0.0);

    // Params: freq=440
    assert_eq!(r.i32(), 1, "#param defaults");
    assert_eq!(r.f32(), 440.0);
    assert_eq!(r.i32(), 1, "#param names");
    assert_eq!(r.pstring(), "freq");
    assert_eq!(r.i32(), 0);

    // UGens: [Control(freq), SinOsc, Out]
    assert_eq!(r.i32(), 3, "#ugens");

    // Control UGen for freq.
    assert_eq!(r.pstring(), "Control");
    assert_eq!(r.i8(), Rate::Control.as_i8());
    assert_eq!(r.i32(), 0, "control #inputs");
    assert_eq!(r.i32(), 1, "control #outputs");
    assert_eq!(r.i16(), 0, "control specialIndex=param 0");
    assert_eq!(r.i8(), Rate::Control.as_i8(), "control output rate");

    // SinOsc
    assert_eq!(r.pstring(), "SinOsc");
    assert_eq!(r.i8(), Rate::Audio.as_i8());
    assert_eq!(r.i32(), 2, "sinosc #inputs");
    assert_eq!(r.i32(), 1, "sinosc #outputs");
    assert_eq!(r.i16(), 0);
    // freq → control ugen 0 output 0
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i32(), 0);
    // phase → constant 0.0 (index 0)
    assert_eq!(r.i32(), -1);
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i8(), Rate::Audio.as_i8());

    // Out
    assert_eq!(r.pstring(), "Out");
    assert_eq!(r.i8(), Rate::Audio.as_i8());
    assert_eq!(r.i32(), 2, "out #inputs (bus + channelsArray)");
    assert_eq!(r.i32(), 0, "out #outputs");
    assert_eq!(r.i16(), 0);
    // bus=0 constant
    assert_eq!(r.i32(), -1);
    assert_eq!(r.i32(), 0);
    // channelsArray → sinosc (wire-last in inputs vector)
    assert_eq!(r.i32(), 1);
    assert_eq!(r.i32(), 0);

    assert_eq!(r.i16(), 0);
    assert_eq!(r.pos, bytes.len(), "consumed all bytes");
}

/// BinaryOpUGen honours the `op` input for specialIndex lookup.
#[test]
fn binary_op_special_index() {
    let specs = vec![
        UGenSpec {
            name: "a".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "220"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "mul".into(),
            ugen_type: "BinaryOpUGen".into(),
            rate: "ar".into(),
            inputs: [("a", "a"), ("b", "0.5"), ("op", "*")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "out".into(),
            ugen_type: "Out".into(),
            rate: "ar".into(),
            inputs: [("bus", "0"), ("channelsArray", "mul")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
    ];
    let bytes = compile_synthdef("binop", &[], &specs).expect("compile");

    // Find the BinaryOpUGen in the output and assert its specialIndex == 2 (`*`).
    let mut r = Reader::new(&bytes);
    r.i32(); r.i32(); r.i16(); // header
    r.pstring(); // name
    let nconst = r.i32();
    for _ in 0..nconst { r.f32(); }
    let nparams = r.i32();
    for _ in 0..nparams { r.f32(); }
    let nnames = r.i32();
    for _ in 0..nnames { r.pstring(); r.i32(); }
    let nugens = r.i32();
    let mut saw_binop = false;
    for _ in 0..nugens {
        let class = r.pstring();
        let _rate = r.i8();
        let ninputs = r.i32();
        let nouts = r.i32();
        let special = r.i16();
        for _ in 0..ninputs { r.i32(); r.i32(); }
        for _ in 0..nouts { r.i8(); }
        if class == "BinaryOpUGen" {
            assert_eq!(special, 2, "`*` specialIndex");
            saw_binop = true;
        }
    }
    assert!(saw_binop);
}

/// Forward references (spec X referencing spec Y defined after X in source
/// order but as a topo-prior node) must compile — topo sort handles it.
#[test]
fn forward_reference_resolves_via_toposort() {
    // `out` appears before `osc` in source order but depends on it.
    let specs = vec![
        UGenSpec {
            name: "out".into(),
            ugen_type: "Out".into(),
            rate: "ar".into(),
            inputs: [("bus", "0"), ("channelsArray", "osc")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "osc".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "440"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
    ];
    let bytes = compile_synthdef("forward", &[], &specs).expect("compile");
    assert!(!bytes.is_empty());
}

/// Circular dependency must be detected as an error.
#[test]
fn circular_reference_errors() {
    let specs = vec![
        UGenSpec {
            name: "a".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "b"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "b".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "a"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
    ];
    let err = compile_synthdef("circ", &[], &specs).unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("Circular"), "expected circular error, got: {msg}");
}

/// `to_json → from_json → to_bytes` is byte-identical to the original
/// `to_bytes`. Exercises constants dedup, param encoding, and multi-output
/// refs.
#[test]
fn synthdef_json_round_trip() {
    // Two kr controls → one grouped Control UGen. `add_control` returns a
    // `UGenInput` that already encodes (controlUGen, outputSlot).
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
    // camelCase field names line up with the TS shape.
    assert!(s.contains("\"className\""));
    assert!(s.contains("\"numInputs\""));

    let parsed: scsynthdef_compiler::SynthDefJson = serde_json::from_str(&s).unwrap();
    assert_eq!(parsed.name, "json_string");
    assert_eq!(parsed.parameters.values, vec![220.0]);
}

/// `UGenSpec` JSON helpers round-trip a spec vector through a string, and
/// the resulting bytes from both match.
#[test]
fn ugenspec_json_round_trip() {
    let specs = vec![
        UGenSpec {
            name: "osc".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "440"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "out".into(),
            ugen_type: "Out".into(),
            rate: "ar".into(),
            inputs: [("bus", "0"), ("channelsArray", "osc")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
    ];

    let s = dump_specs_json(&specs).unwrap();
    let parsed = parse_specs_json(&s).unwrap();

    let a = compile_synthdef("x", &[], &specs).unwrap();
    let b = compile_synthdef("x", &[], &parsed).unwrap();
    assert_eq!(a, b, "round-tripped specs produce identical bytes");
}

/// Two kr params must emit a **single** `Control` UGen with `num_outputs=2`
/// and `special_index=0` — matching sclang's grouped-Control convention.
#[test]
fn two_kr_controls_produce_one_grouped_control_ugen() {
    let specs = vec![
        UGenSpec {
            name: "osc".into(),
            ugen_type: "SinOsc".into(),
            rate: "ar".into(),
            inputs: [("freq", "freq"), ("phase", "0")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "scaled".into(),
            ugen_type: "BinaryOpUGen".into(),
            rate: "ar".into(),
            inputs: [("a", "osc"), ("b", "amp"), ("op", "*")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
        UGenSpec {
            name: "out".into(),
            ugen_type: "Out".into(),
            rate: "ar".into(),
            inputs: [("bus", "0"), ("channelsArray", "scaled")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        },
    ];
    let params = vec![("freq".to_string(), 440.0f32), ("amp".to_string(), 0.5f32)];
    let bytes = compile_synthdef("grouped", &params, &specs).expect("compile");

    // Walk the header enough to read the ugen list structurally.
    let mut r = scanner::Reader::new(&bytes);
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
    assert_eq!(r.i8(), Rate::Control.as_i8(), "output 0 rate");
    assert_eq!(r.i8(), Rate::Control.as_i8(), "output 1 rate");

    // SinOsc's freq input → Control output 0 (ugen 0, output 0); phase → const 0.0.
    assert_eq!(r.pstring(), "SinOsc");
    assert_eq!(r.i8(), Rate::Audio.as_i8());
    assert_eq!(r.i32(), 2); // ninputs
    assert_eq!(r.i32(), 1); // noutputs
    assert_eq!(r.i16(), 0);
    // freq → Control@0
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i32(), 0);
    // phase → constant index 0 (0.0 is the only constant)
    assert_eq!(r.i32(), -1);
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i8(), Rate::Audio.as_i8());

    // BinaryOpUGen (*) — a: SinOsc@0 (ugen 1, output 0); b: Control@1 (ugen 0, output 1).
    assert_eq!(r.pstring(), "BinaryOpUGen");
    assert_eq!(r.i8(), Rate::Audio.as_i8());
    assert_eq!(r.i32(), 2);
    assert_eq!(r.i32(), 1);
    assert_eq!(r.i16(), 2); // * specialIndex
    assert_eq!(r.i32(), 1);
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i32(), 0);
    assert_eq!(r.i32(), 1);
}

mod scanner {
    pub struct Reader<'a> {
        buf: &'a [u8],
        pos: usize,
    }
    impl<'a> Reader<'a> {
        pub fn new(buf: &'a [u8]) -> Self { Self { buf, pos: 0 } }
        pub fn i8(&mut self) -> i8 { let v = self.buf[self.pos] as i8; self.pos += 1; v }
        pub fn i16(&mut self) -> i16 {
            let v = i16::from_be_bytes(self.buf[self.pos..self.pos + 2].try_into().unwrap());
            self.pos += 2; v
        }
        pub fn i32(&mut self) -> i32 {
            let v = i32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
            self.pos += 4; v
        }
        pub fn f32(&mut self) -> f32 {
            let v = f32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
            self.pos += 4; v
        }
        pub fn pstring(&mut self) -> String {
            let len = self.buf[self.pos] as usize;
            self.pos += 1;
            let s = std::str::from_utf8(&self.buf[self.pos..self.pos + len]).unwrap().to_string();
            self.pos += len; s
        }
    }
}

/// Missing required input (null default) surfaces as MissingInput.
#[test]
fn missing_required_input_errors() {
    // RecordBuf has a required `bufnum` input with default=null.
    let specs = vec![UGenSpec {
        name: "rec".into(),
        ugen_type: "RecordBuf".into(),
        rate: "ar".into(),
        // Deliberately omit bufnum and inputArray.
        inputs: BTreeMap::new(),
    }];
    let err = compile_synthdef("missing", &[], &specs).unwrap_err();
    let msg = err.to_string();
    assert!(msg.contains("missing required input"), "got: {msg}");
}
