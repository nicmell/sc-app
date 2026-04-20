use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::Rate;

/// One UGen's registry entry — the data the compiler needs to resolve inputs
/// and determine output count. This is the Rust analogue of `UGenSpec` in
/// `src/lib/ugen/registry.ts`.
#[derive(Debug, Clone)]
pub struct UGenRegistryEntry {
    pub name: String,
    pub rates: Vec<Rate>,
    /// Declared parameter order (name, optional default). Matches SC's wire
    /// order with the usual caveat that `channelsArray` / `inputArray` are
    /// reordered to the end of the input list at compile time.
    pub defaults: Vec<(String, Option<f32>)>,
    /// Output count. Scsynth treats `None` as 1.
    pub num_outputs: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct JsonUGen {
    name: String,
    rates: Vec<String>,
    defaults: Vec<(String, Option<f32>)>,
    #[serde(default, rename = "numOutputs")]
    num_outputs: Option<u32>,
    // extends / summary / doc / argDocs / signalRange are ignored — inheritance
    // is already materialized by `scripts/generate_ugen_db.mjs`.
}

macro_rules! bundled_ugens {
    ($($name:literal),* $(,)?) => {
        &[$(
            ($name, include_str!(concat!("../assets/ugens/", $name, ".json"))),
        )*]
    };
}

const UGEN_JSON_FILES: &[(&str, &str)] = bundled_ugens!(
    "basicops",
    "beq_suite",
    "buf_io",
    "chaos",
    "compander",
    "delay",
    "demand",
    "envgen",
    "ff_osc",
    "fft",
    "fft2",
    "filter",
    "grain",
    "info",
    "input",
    "io",
    "line",
    "machine_listening",
    "misc",
    "noise",
    "osc",
    "pan",
    "random",
    "trig",
);

static REGISTRY: OnceLock<HashMap<String, UGenRegistryEntry>> = OnceLock::new();

fn registry() -> &'static HashMap<String, UGenRegistryEntry> {
    REGISTRY.get_or_init(build_registry)
}

fn build_registry() -> HashMap<String, UGenRegistryEntry> {
    let mut map = HashMap::new();
    for (file, json) in UGEN_JSON_FILES {
        let entries: Vec<JsonUGen> = serde_json::from_str(json)
            .unwrap_or_else(|e| panic!("invalid UGen JSON {}.json: {}", file, e));
        for e in entries {
            let rates: Vec<Rate> = e.rates.iter().filter_map(|r| Rate::parse(r)).collect();
            map.insert(
                e.name.clone(),
                UGenRegistryEntry {
                    name: e.name,
                    rates,
                    defaults: e.defaults,
                    num_outputs: e.num_outputs,
                },
            );
        }
    }
    map
}

/// Look up a UGen by its class name (e.g. `"SinOsc"`). Returns `None` if the
/// UGen isn't in the bundled registry.
pub fn lookup_ugen(name: &str) -> Option<&'static UGenRegistryEntry> {
    registry().get(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_populated() {
        // Sanity check — the generation script emits ~367 UGens.
        assert!(registry().len() > 300);
    }

    #[test]
    fn common_ugens_present() {
        for class in ["SinOsc", "Out", "BinaryOpUGen", "RecordBuf", "Phasor"] {
            assert!(
                lookup_ugen(class).is_some(),
                "expected {class} in registry"
            );
        }
    }

    #[test]
    fn out_has_zero_outputs() {
        let entry = lookup_ugen("Out").expect("Out in registry");
        assert_eq!(entry.num_outputs, Some(0));
    }

    #[test]
    fn sinosc_has_freq_default_440() {
        let entry = lookup_ugen("SinOsc").expect("SinOsc in registry");
        let freq = entry.defaults.iter().find(|(n, _)| n == "freq").unwrap();
        assert_eq!(freq.1, Some(440.0));
    }
}
