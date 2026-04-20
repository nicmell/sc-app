use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy)]
struct ControlGroup {
    node_index: u32,
    output_count: u32,
}

/// A SynthDef being built. Add controls and UGens, then encode to SCgf v2
/// bytes with [`SynthDef::to_bytes`] or to a structured JSON form with
/// [`SynthDef::to_json`].
#[derive(Debug, Clone)]
pub struct SynthDef {
    name: String,
    nodes: Vec<Node>,
    params: Vec<ParamInfo>,
    /// All kr parameters funnel into a single `Control` UGen, matching
    /// sclang's convention. Created lazily on the first `add_control(_, _,
    /// Control)` call.
    control_group: Option<ControlGroup>,
    /// Same, for ar parameters via `AudioControl`.
    audio_control_group: Option<ControlGroup>,
    /// Rate of the most recent `add_control` call — used to enforce that
    /// params of a given rate stay contiguous in the params table (a
    /// requirement for `special_index + output_slot` to map back to a valid
    /// params index).
    last_param_rate: Option<Rate>,
}

impl SynthDef {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            nodes: Vec::new(),
            params: Vec::new(),
            control_group: None,
            audio_control_group: None,
            last_param_rate: None,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    /// Add a named control (parameter). The returned [`UGenInput`] can be
    /// used directly as an input to other UGens; it resolves to the right
    /// output slot of the rate-grouped `Control` / `AudioControl` UGen.
    ///
    /// Matches sclang's convention: all kr params share a single `Control`
    /// UGen (one output per param); ar params likewise share a single
    /// `AudioControl` UGen.
    ///
    /// Returns [`CompileError::DuplicateParam`] on repeated names, and errors
    /// if the caller interleaves rates in a way that would put a group's
    /// params non-contiguously in the params table (no real call site in
    /// this repo does that).
    pub fn add_control(
        &mut self,
        name: impl Into<String>,
        default_value: f32,
        rate: Rate,
    ) -> Result<UGenInput, CompileError> {
        let name = name.into();
        if self.params.iter().any(|p| p.name == name) {
            return Err(CompileError::DuplicateParam(name));
        }

        // Contiguity guard: once we've moved on to a different rate, we can't
        // append to the earlier rate's group without splitting the params
        // table.
        let is_audio = rate == Rate::Audio;
        let already_has_this_rate = if is_audio {
            self.audio_control_group.is_some()
        } else {
            self.control_group.is_some()
        };
        if already_has_this_rate
            && self.last_param_rate.map_or(false, |r| (r == Rate::Audio) != is_audio)
        {
            return Err(CompileError::DuplicateParam(format!(
                "{name}: rate-interleaved controls are not supported — group all kr params, then all ar params"
            )));
        }

        let param_index = self.params.len() as u32;
        self.params.push(ParamInfo {
            name,
            default_value,
        });
        self.last_param_rate = Some(rate);

        // Pick the matching group; create on first call, otherwise grow.
        if is_audio {
            Self::grow_group(
                &mut self.nodes,
                &mut self.audio_control_group,
                "AudioControl",
                Rate::Audio,
                param_index,
            )
        } else {
            Self::grow_group(
                &mut self.nodes,
                &mut self.control_group,
                "Control",
                Rate::Control,
                param_index,
            )
        }
    }

    fn grow_group(
        nodes: &mut Vec<Node>,
        group: &mut Option<ControlGroup>,
        class_name: &str,
        rate: Rate,
        param_index: u32,
    ) -> Result<UGenInput, CompileError> {
        match group {
            Some(g) => {
                let slot = g.output_count;
                g.output_count += 1;
                nodes[g.node_index as usize].num_outputs = g.output_count;
                Ok(UGenInput::UGenOutput(g.node_index, slot))
            }
            None => {
                let node_index = nodes.len() as u32;
                nodes.push(Node {
                    class_name: class_name.to_string(),
                    rate,
                    inputs: Vec::new(),
                    num_outputs: 1,
                    special_index: param_index as i16,
                });
                *group = Some(ControlGroup {
                    node_index,
                    output_count: 1,
                });
                Ok(UGenInput::UGenOutput(node_index, 0))
            }
        }
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
                let spec = resolve_input_spec(input, &constant_map);
                w.i32(spec.ugen_index);
                w.i32(spec.output_index as i32);
            }

            for _ in 0..node.num_outputs {
                w.i8(node.rate.as_i8());
            }
        }

        // Variants (none)
        w.i16(0);

        Ok(w.finish())
    }

    /// Structured JSON representation mirroring the SCgf binary layout.
    ///
    /// Useful for inspection, debugging, and cross-tool comparison (the field
    /// names line up with the TS `SynthDefJson` in `src/lib/ugen/synthdef.ts`
    /// via `#[serde(rename_all = "camelCase")]` on the field types).
    pub fn to_json(&self) -> Result<SynthDefJson, CompileError> {
        if self.name.is_empty() {
            return Err(CompileError::EmptyName);
        }
        self.validate()?;

        let (constants, constant_map) = self.collect_constants();

        let ugens = self
            .nodes
            .iter()
            .map(|n| UGenJson {
                class_name: n.class_name.clone(),
                rate: n.rate.as_i8(),
                num_inputs: n.inputs.len() as u32,
                num_outputs: n.num_outputs,
                special_index: n.special_index,
                inputs: n
                    .inputs
                    .iter()
                    .map(|i| resolve_input_spec(i, &constant_map))
                    .collect(),
                outputs: (0..n.num_outputs)
                    .map(|_| OutputSpec { rate: n.rate.as_i8() })
                    .collect(),
            })
            .collect();

        Ok(SynthDefJson {
            name: self.name.clone(),
            constants,
            parameters: Parameters {
                values: self.params.iter().map(|p| p.default_value).collect(),
                names: self
                    .params
                    .iter()
                    .enumerate()
                    .map(|(i, p)| ParamName {
                        name: p.name.clone(),
                        index: i as u32,
                    })
                    .collect(),
            },
            ugens,
            variants: Vec::new(),
        })
    }

    /// Reconstruct a `SynthDef` from its JSON representation.
    ///
    /// `to_json() → from_json() → to_bytes()` round-trips byte-for-byte against
    /// `to_bytes()` on the original.
    pub fn from_json(j: &SynthDefJson) -> Result<SynthDef, CompileError> {
        let mut def = SynthDef::new(&j.name);

        // The JSON's ugen list already contains Control/AudioControl nodes at
        // their exact positions, so we don't use `add_control` (which would
        // push another Control node). We rebuild `params` separately and
        // append every ugen — Control and otherwise — directly.
        for name in &j.parameters.names {
            let idx = name.index as usize;
            let default = j
                .parameters
                .values
                .get(idx)
                .copied()
                .ok_or_else(|| CompileError::UnknownUGenId(name.name.clone()))?;
            def.params.push(ParamInfo {
                name: name.name.clone(),
                default_value: default,
            });
        }

        for u in &j.ugens {
            let rate = match u.rate {
                0 => Rate::Scalar,
                1 => Rate::Control,
                2 => Rate::Audio,
                other => return Err(CompileError::UnknownRate(other.to_string())),
            };
            let inputs = u
                .inputs
                .iter()
                .map(|i| {
                    if i.ugen_index < 0 {
                        let c_idx = i.output_index as usize;
                        let c = j
                            .constants
                            .get(c_idx)
                            .copied()
                            .ok_or_else(|| CompileError::UGenIndexOutOfRange(c_idx as u32))?;
                        Ok(UGenInput::Constant(c))
                    } else {
                        Ok(UGenInput::UGenOutput(i.ugen_index as u32, i.output_index))
                    }
                })
                .collect::<Result<Vec<_>, CompileError>>()?;
            def.nodes.push(Node {
                class_name: u.class_name.clone(),
                rate,
                inputs,
                num_outputs: u.num_outputs,
                special_index: u.special_index,
            });
        }

        Ok(def)
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
// Structured JSON representation — mirrors TS `SynthDefJson` field-for-field.
// ---------------------------------------------------------------------------

/// JSON view of a compiled SynthDef. Shape matches TS `SynthDefJson` in
/// `src/lib/ugen/synthdef.ts` (via camelCase field renames).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthDefJson {
    pub name: String,
    pub constants: Vec<f32>,
    pub parameters: Parameters,
    pub ugens: Vec<UGenJson>,
    /// Always empty — the SCgf v2 format reserves a variants section, but we
    /// never emit variants.
    pub variants: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameters {
    pub values: Vec<f32>,
    pub names: Vec<ParamName>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamName {
    pub name: String,
    pub index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UGenJson {
    pub class_name: String,
    pub rate: i8,
    pub num_inputs: u32,
    pub num_outputs: u32,
    pub special_index: i16,
    pub inputs: Vec<InputSpec>,
    pub outputs: Vec<OutputSpec>,
}

/// Wire-format input reference. `ugen_index == -1` means the value is a
/// constant at `output_index` in the constants table.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputSpec {
    pub ugen_index: i32,
    pub output_index: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct OutputSpec {
    pub rate: i8,
}

fn resolve_input_spec(input: &UGenInput, constant_map: &[(f32, u32)]) -> InputSpec {
    match input {
        UGenInput::Constant(v) => {
            let idx = constant_map
                .iter()
                .find(|(k, _)| k.to_bits() == v.to_bits())
                .map(|(_, i)| *i)
                .expect("constant not collected");
            InputSpec {
                ugen_index: -1,
                output_index: idx,
            }
        }
        UGenInput::UGen(i) => InputSpec {
            ugen_index: *i as i32,
            output_index: 0,
        },
        UGenInput::UGenOutput(i, o) => InputSpec {
            ugen_index: *i as i32,
            output_index: *o,
        },
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
