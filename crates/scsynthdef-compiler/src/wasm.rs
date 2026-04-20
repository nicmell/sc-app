//! WASM bindings, gated behind the `wasm` Cargo feature.
//!
//! Exposes a JSON-in / bytes-out entry point to avoid leaking Rust structs
//! across the FFI boundary.

use wasm_bindgen::prelude::*;

use crate::{compile_synthdef, UGenSpec};

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
