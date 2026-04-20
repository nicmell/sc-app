//! WASM bindings, gated behind the `wasm` Cargo feature.
//!
//! Exposes a JSON-in / bytes-out entry point to avoid leaking Rust structs
//! across the FFI boundary.

use wasm_bindgen::prelude::*;

use crate::{compile_synthdef, ugens_by_category, UGenSpec};

/// Compile a SynthDef from JSON inputs.
///
/// `params_json`: `[[name, default], …]`.
/// `specs_json`: `[{name, type, rate, inputs: {…}}, …]`.
#[wasm_bindgen(js_name = compileSynthDef)]
pub fn compile_synthdef_wasm(
    name: &str,
    params_json: &str,
    specs_json: &str,
) -> Result<Vec<u8>, JsError> {
    let params: Vec<(String, f32)> =
        serde_json::from_str(params_json).map_err(|e| JsError::new(&e.to_string()))?;
    let specs: Vec<UGenSpec> =
        serde_json::from_str(specs_json).map_err(|e| JsError::new(&e.to_string()))?;

    compile_synthdef(name, &params, &specs).map_err(|e| JsError::new(&e.to_string()))
}

/// Return the full bundled UGen registry as JSON, grouped by source-file
/// category. Shape:
///
/// ```json
/// [
///   ["basicops", [ { "name": "BinaryOpUGen", "rates": [...], ... }, ... ]],
///   ["beq_suite", [ ... ]],
///   ...
/// ]
/// ```
#[wasm_bindgen(js_name = ugenRegistryJson)]
pub fn ugen_registry_json() -> Result<String, JsError> {
    // Flatten the `&'static` structure into an owned Vec so serde handles it
    // without any lifetime gymnastics.
    let grouped: Vec<(String, Vec<&_>)> = ugens_by_category()
        .iter()
        .map(|(cat, slice)| (cat.to_string(), slice.iter().collect()))
        .collect();
    serde_json::to_string(&grouped).map_err(|e| JsError::new(&e.to_string()))
}
