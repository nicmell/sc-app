use crate::{CompileError, Rate};

/// Input to a UGen: a constant, the default output of another UGen, or a
/// specific output of a multi-output UGen.
///
/// UGen indices refer to positions in the `SynthDef`'s node list, returned by
/// [`SynthDef::add_ugen`] and [`SynthDef::add_control`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UGenInput {
    Constant(f32),
    UGen(u32),
    UGenOutput(u32, u32),
}

impl UGenInput {
    fn ugen_index(&self) -> Option<u32> {
        match self {
            UGenInput::Constant(_) => None,
            UGenInput::UGen(i) => Some(*i),
            UGenInput::UGenOutput(i, _) => Some(*i),
        }
    }

    fn output_index(&self) -> u32 {
        match self {
            UGenInput::Constant(_) => 0,
            UGenInput::UGen(_) => 0,
            UGenInput::UGenOutput(_, o) => *o,
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Node {
    pub class_name: String,
    pub rate: Rate,
    pub inputs: Vec<UGenInput>,
    pub num_outputs: u32,
    pub special_index: i16,
}

#[derive(Debug, Clone)]
struct ParamInfo {
    name: String,
    default_value: f32,
}

/// A SynthDef being built. Add controls and UGens, then encode to SCgf v2
/// bytes with [`SynthDef::to_bytes`].
#[derive(Debug, Clone)]
pub struct SynthDef {
    name: String,
    nodes: Vec<Node>,
    params: Vec<ParamInfo>,
}

impl SynthDef {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            nodes: Vec::new(),
            params: Vec::new(),
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    /// Add a named control (parameter). The returned index can be used as an
    /// [`UGenInput::UGen`] input to wire this parameter into the graph.
    ///
    /// Each call emits a Control/AudioControl UGen with `special_index` equal
    /// to the parameter's position — mirroring the TS compiler's output.
    pub fn add_control(
        &mut self,
        name: impl Into<String>,
        default_value: f32,
        rate: Rate,
    ) -> Result<u32, CompileError> {
        let name = name.into();
        if self.params.iter().any(|p| p.name == name) {
            return Err(CompileError::DuplicateParam(name));
        }
        let param_idx = self.params.len() as i16;
        self.params.push(ParamInfo {
            name,
            default_value,
        });
        let class_name = if rate == Rate::Audio {
            "AudioControl"
        } else {
            "Control"
        };
        let node_idx = self.nodes.len() as u32;
        self.nodes.push(Node {
            class_name: class_name.to_string(),
            rate,
            inputs: Vec::new(),
            num_outputs: 1,
            special_index: param_idx,
        });
        Ok(node_idx)
    }

    /// Add a UGen node. Returns its index in the node list.
    pub fn add_ugen(
        &mut self,
        class_name: impl Into<String>,
        rate: Rate,
        inputs: Vec<UGenInput>,
        num_outputs: u32,
        special_index: i16,
    ) -> u32 {
        let idx = self.nodes.len() as u32;
        self.nodes.push(Node {
            class_name: class_name.into(),
            rate,
            inputs,
            num_outputs,
            special_index,
        });
        idx
    }

    /// Encode the SynthDef as a complete SCgf version 2 binary file.
    pub fn to_bytes(&self) -> Result<Vec<u8>, CompileError> {
        if self.name.is_empty() {
            return Err(CompileError::EmptyName);
        }
        self.validate()?;

        let (constants, constant_map) = self.collect_constants();

        let mut w = ByteWriter::new();

        // File header
        w.i32(0x53436766); // "SCgf"
        w.i32(2); // version
        w.i16(1); // number of synth definitions

        // Name
        w.pstring(&self.name)?;

        // Constants
        w.i32(constants.len() as i32);
        for c in &constants {
            w.f32(*c);
        }

        // Parameter defaults
        w.i32(self.params.len() as i32);
        for p in &self.params {
            w.f32(p.default_value);
        }

        // Parameter names
        w.i32(self.params.len() as i32);
        for (idx, p) in self.params.iter().enumerate() {
            w.pstring(&p.name)?;
            w.i32(idx as i32);
        }

        // UGens
        w.i32(self.nodes.len() as i32);
        for node in &self.nodes {
            w.pstring(&node.class_name)?;
            w.i8(node.rate.as_i8());
            w.i32(node.inputs.len() as i32);
            w.i32(node.num_outputs as i32);
            w.i16(node.special_index);

            for input in &node.inputs {
                match input {
                    UGenInput::Constant(v) => {
                        let idx = constant_map
                            .iter()
                            .find(|(k, _)| k.to_bits() == v.to_bits())
                            .map(|(_, i)| *i)
                            .expect("constant not collected");
                        w.i32(-1);
                        w.i32(idx as i32);
                    }
                    UGenInput::UGen(ugen_idx) => {
                        w.i32(*ugen_idx as i32);
                        w.i32(0);
                    }
                    UGenInput::UGenOutput(ugen_idx, out_idx) => {
                        w.i32(*ugen_idx as i32);
                        w.i32(*out_idx as i32);
                    }
                }
            }

            for _ in 0..node.num_outputs {
                w.i8(node.rate.as_i8());
            }
        }

        // Variants (none)
        w.i16(0);

        Ok(w.finish())
    }

    fn validate(&self) -> Result<(), CompileError> {
        for (idx, node) in self.nodes.iter().enumerate() {
            let node_idx = idx as u32;
            for input in &node.inputs {
                let ref_idx = match input.ugen_index() {
                    Some(i) => i,
                    None => continue,
                };
                if ref_idx >= self.nodes.len() as u32 {
                    return Err(CompileError::UGenIndexOutOfRange(ref_idx));
                }
                if ref_idx >= node_idx {
                    let referenced = &self.nodes[ref_idx as usize];
                    return Err(CompileError::ForwardReference {
                        from_class: node.class_name.clone(),
                        from_idx: node_idx,
                        to_class: referenced.class_name.clone(),
                        to_idx: ref_idx,
                    });
                }
                let out = input.output_index();
                let referenced = &self.nodes[ref_idx as usize];
                if out >= referenced.num_outputs {
                    return Err(CompileError::OutputOutOfRange {
                        class: referenced.class_name.clone(),
                        out,
                        num_outputs: referenced.num_outputs,
                    });
                }
            }
        }
        Ok(())
    }

    /// Collect constants in first-seen order, returning the ordered list and a
    /// parallel `(value, index)` lookup table. `f32` is compared by bit
    /// pattern to match the TS `Map<number,number>` semantics around NaN.
    fn collect_constants(&self) -> (Vec<f32>, Vec<(f32, u32)>) {
        let mut list = Vec::new();
        let mut map: Vec<(f32, u32)> = Vec::new();
        for node in &self.nodes {
            for input in &node.inputs {
                if let UGenInput::Constant(v) = input {
                    if !map.iter().any(|(k, _)| k.to_bits() == v.to_bits()) {
                        let idx = list.len() as u32;
                        list.push(*v);
                        map.push((*v, idx));
                    }
                }
            }
        }
        (list, map)
    }

}

// ---------------------------------------------------------------------------
// ByteWriter — big-endian SCgf binary writer
// ---------------------------------------------------------------------------

struct ByteWriter {
    buf: Vec<u8>,
}

impl ByteWriter {
    fn new() -> Self {
        Self {
            buf: Vec::with_capacity(4096),
        }
    }

    fn i8(&mut self, v: i8) {
        self.buf.push(v as u8);
    }

    fn i16(&mut self, v: i16) {
        self.buf.extend_from_slice(&v.to_be_bytes());
    }

    fn i32(&mut self, v: i32) {
        self.buf.extend_from_slice(&v.to_be_bytes());
    }

    fn f32(&mut self, v: f32) {
        self.buf.extend_from_slice(&v.to_be_bytes());
    }

    fn pstring(&mut self, s: &str) -> Result<(), CompileError> {
        if s.len() > 255 {
            return Err(CompileError::PStringTooLong(s.len()));
        }
        self.buf.push(s.len() as u8);
        // TS encodes with `charCodeAt(i) & 0xff` — truncating to Latin-1.
        // All SC class/param names are ASCII in practice; match that by
        // writing bytes directly.
        for byte in s.as_bytes() {
            self.buf.push(*byte);
        }
        Ok(())
    }

    fn finish(self) -> Vec<u8> {
        self.buf
    }
}
