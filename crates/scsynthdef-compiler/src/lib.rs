//! SuperCollider SynthDef (SCgf v2) compiler.
//!
//! See [`compile_synthdef`] for the HTML-driven entry point, and [`SynthDef`]
//! for the programmatic builder.

mod compile;
mod error;
mod operators;
mod rate;
mod registry;
mod synthdef;

#[cfg(feature = "wasm")]
mod wasm;

pub use compile::{compile_synthdef, UGenSpec};
pub use error::CompileError;
pub use operators::{binary_op_index, unary_op_index};
pub use rate::Rate;
pub use registry::{lookup_ugen, UGenRegistryEntry};
pub use synthdef::{SynthDef, UGenInput};
