//! SuperCollider SynthDef (SCgf v2) compiler.
//!
//! Library-only crate that writes and reads the [SynthDef File Format v2]
//! binary, matching the byte-for-byte output of `sclang`'s built-in
//! SynthDef encoder. See [`SynthDef`] for the programmatic builder.
//!
//! [SynthDef File Format v2]: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html

pub mod builders;
mod error;
mod operators;
mod rate;
mod registry;
mod specs;
mod synthdef;

#[cfg(feature = "wasm")]
mod wasm;

#[cfg(feature = "component")]
mod component;

pub use error::CompileError;
pub use operators::{binary_op_index, unary_op_index};
pub use rate::Rate;
pub use registry::{lookup_ugen, ugens_by_category, UGenRegistryEntry};
pub use synthdef::{
    parse_scgf, InputSpec, OutputSpec, ParamName, Parameters, SynthDef, SynthDefJson, UGenInput,
    UGenJson,
};
