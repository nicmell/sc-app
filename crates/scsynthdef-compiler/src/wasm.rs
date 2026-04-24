//! WASM bindings, gated behind the `wasm` Cargo feature.
//!
//! Exposes a JSON read-out of the bundled UGen registry so a browser can
//! render a reference page without re-parsing the source JSON catalogue.
//! Every other WASM interaction goes through the component model (WIT)
//! build — see `crates/scsynthdef-compiler/wit/` and
//! `crates/scsynthdef-compiler/examples/frontend/` for the end-to-end flow.

use wasm_bindgen::prelude::*;

use crate::ugens_by_category;

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
