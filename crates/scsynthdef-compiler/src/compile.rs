//! High-level entry point: build a SynthDef from an HTML-parsed spec map.
//!
//! Port of `src/lib/synthdef/SynthDefCompiler.ts`. The input shape
//! (`UGenSpec`) mirrors `src/types/parsers.d.ts`'s `UGenSpec`: one entry per
//! `<sc-ugen>` child, with stringly-typed inputs that reference other specs,
//! params, or numeric constants.

use std::collections::{BTreeMap, HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::{
    operators::{binary_op_index, unary_op_index},
    registry::lookup_ugen,
    CompileError, Rate, SynthDef, UGenInput,
};

/// HTML-parsed UGen spec — one per `<sc-ugen>` in a `<sc-synthdef>`.
///
/// `inputs` keys map to the UGen registry's parameter names (case-insensitive
/// match). Values are stringly-typed references:
///
/// - a number literal (e.g. `"440"`) → constant
/// - a spec name (e.g. `"osc"`) → that UGen's default output
/// - `"osc:1"` → specific output of a multi-output UGen
/// - a param name (e.g. `"freq"`) → a control declared in `params`
///
/// The special key `"op"` is consumed for `BinaryOpUGen` / `UnaryOpUGen`
/// `specialIndex` lookup and otherwise ignored as an input.
///
/// `channelsArray` / `inputArray` values are comma-separated lists, and are
/// reordered to the wire-last position in the SCgf output to match SC's
/// `multiNewList` convention.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UGenSpec {
    pub name: String,
    #[serde(rename = "type")]
    pub ugen_type: String,
    pub rate: String,
    pub inputs: BTreeMap<String, String>,
}

/// Compile an HTML-parsed spec map into SCgf v2 binary bytes.
///
/// `params` and `specs` are ordered slices so the caller controls param
/// ordering (which becomes param index) and DFS traversal order during
/// topological sort.
pub fn compile_synthdef(
    name: &str,
    params: &[(String, f32)],
    specs: &[UGenSpec],
) -> Result<Vec<u8>, CompileError> {
    if name.is_empty() {
        return Err(CompileError::EmptyName);
    }
    if specs.is_empty() {
        return Err(CompileError::EmptyGraph(name.to_string()));
    }

    let mut def = SynthDef::new(name);

    // Controls first — order matches `params` slice.
    let mut control_map: HashMap<String, u32> = HashMap::new();
    for (pname, value) in params {
        let idx = def.add_control(pname.clone(), *value, Rate::Control)?;
        control_map.insert(pname.clone(), idx);
    }

    // Build a name → spec index lookup over `specs`.
    let mut spec_index: HashMap<String, usize> = HashMap::new();
    for (i, s) in specs.iter().enumerate() {
        spec_index.insert(s.name.clone(), i);
    }

    // Topological sort preserving input order for deterministic output.
    let sorted_order = topo_sort(specs, &spec_index)?;

    let mut ugen_map: HashMap<String, u32> = HashMap::new();

    for spec_idx in sorted_order {
        let spec = &specs[spec_idx];
        let entry = lookup_ugen(&spec.ugen_type)
            .ok_or_else(|| CompileError::UnknownUGen(spec.ugen_type.clone()))?;
        let rate =
            Rate::parse(&spec.rate).ok_or_else(|| CompileError::UnknownRate(spec.rate.clone()))?;

        let num_outputs = match find_matching_input(&spec.inputs, "numChannels") {
            Some(v) => v
                .parse::<u32>()
                .map_err(|_| CompileError::UnresolvedInput(v.to_string()))?,
            None => entry.num_outputs.unwrap_or(1),
        };

        let inputs = resolve_standard_inputs(spec, entry, &ugen_map, &control_map)?;
        let special_index = resolve_special_index(spec)?;

        let ugen_idx = def.add_ugen(
            spec.ugen_type.clone(),
            rate,
            inputs,
            num_outputs,
            special_index,
        );
        ugen_map.insert(spec.name.clone(), ugen_idx);
    }

    def.to_bytes()
}

fn resolve_special_index(spec: &UGenSpec) -> Result<i16, CompileError> {
    let table: fn(&str) -> Option<i16> = match spec.ugen_type.as_str() {
        "BinaryOpUGen" => binary_op_index,
        "UnaryOpUGen" => unary_op_index,
        _ => return Ok(0),
    };
    let op = spec.inputs.get("op").ok_or_else(|| CompileError::MissingOp {
        class: spec.ugen_type.clone(),
        name: spec.name.clone(),
    })?;
    table(op).ok_or_else(|| CompileError::UnknownOperator {
        class: spec.ugen_type.clone(),
        name: spec.name.clone(),
        op: op.clone(),
    })
}

fn resolve_standard_inputs(
    spec: &UGenSpec,
    entry: &crate::registry::UGenRegistryEntry,
    ugen_map: &HashMap<String, u32>,
    control_map: &HashMap<String, u32>,
) -> Result<Vec<UGenInput>, CompileError> {
    let mut result: Vec<UGenInput> = Vec::new();
    let mut array_inputs: Vec<UGenInput> = Vec::new();

    for (def_name, def_value) in &entry.defaults {
        if def_name == "numChannels" {
            continue;
        }
        match find_matching_input(&spec.inputs, def_name) {
            Some(attr) => {
                if def_name == "channelsArray" || def_name == "inputArray" {
                    for part in attr.split(',') {
                        let part = part.trim();
                        array_inputs.push(resolve_input(part, ugen_map, control_map)?);
                    }
                } else {
                    result.push(resolve_input(attr.trim(), ugen_map, control_map)?);
                }
            }
            None => match def_value {
                Some(v) => result.push(UGenInput::Constant(*v)),
                None => {
                    return Err(CompileError::MissingInput {
                        name: spec.name.clone(),
                        class: spec.ugen_type.clone(),
                        param: def_name.clone(),
                    });
                }
            },
        }
    }

    result.extend(array_inputs);
    Ok(result)
}

fn find_matching_input<'a>(
    inputs: &'a BTreeMap<String, String>,
    param_name: &str,
) -> Option<&'a str> {
    let lower = param_name.to_ascii_lowercase();
    for (key, value) in inputs {
        if key == "op" {
            continue;
        }
        if key.to_ascii_lowercase() == lower {
            return Some(value.as_str());
        }
    }
    None
}

fn resolve_input(
    value: &str,
    ugen_map: &HashMap<String, u32>,
    control_map: &HashMap<String, u32>,
) -> Result<UGenInput, CompileError> {
    if !value.is_empty() {
        if let Ok(n) = value.parse::<f32>() {
            return Ok(UGenInput::Constant(n));
        }
    }

    if let Some((ref_id, index_str)) = value.split_once(':') {
        if let Some(&ugen_idx) = ugen_map.get(ref_id) {
            let out_idx = index_str
                .parse::<u32>()
                .map_err(|_| CompileError::UnresolvedInput(value.to_string()))?;
            return Ok(UGenInput::UGenOutput(ugen_idx, out_idx));
        }
        return Err(CompileError::UnknownUGenRef {
            ref_id: ref_id.to_string(),
            value: value.to_string(),
        });
    }

    if let Some(&idx) = ugen_map.get(value) {
        return Ok(UGenInput::UGen(idx));
    }
    if let Some(&idx) = control_map.get(value) {
        return Ok(UGenInput::UGen(idx));
    }
    Err(CompileError::UnresolvedInput(value.to_string()))
}

fn topo_sort(
    specs: &[UGenSpec],
    spec_index: &HashMap<String, usize>,
) -> Result<Vec<usize>, CompileError> {
    let mut sorted = Vec::with_capacity(specs.len());
    let mut visited = HashSet::new();
    let mut visiting = HashSet::new();

    for spec in specs {
        visit(spec, specs, spec_index, &mut visited, &mut visiting, &mut sorted)?;
    }
    Ok(sorted)
}

fn visit(
    spec: &UGenSpec,
    specs: &[UGenSpec],
    spec_index: &HashMap<String, usize>,
    visited: &mut HashSet<String>,
    visiting: &mut HashSet<String>,
    sorted: &mut Vec<usize>,
) -> Result<(), CompileError> {
    if visited.contains(&spec.name) {
        return Ok(());
    }
    if visiting.contains(&spec.name) {
        return Err(CompileError::CircularDependency(spec.name.clone()));
    }
    visiting.insert(spec.name.clone());

    for value in spec.inputs.values() {
        let ref_id = value.split(':').next().unwrap_or(value);
        if let Some(&idx) = spec_index.get(ref_id) {
            visit(&specs[idx], specs, spec_index, visited, visiting, sorted)?;
        }
    }

    visiting.remove(&spec.name);
    visited.insert(spec.name.clone());
    sorted.push(spec_index[&spec.name]);
    Ok(())
}
