// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

//! Typed builders for every documented SuperCollider server command.
//! Auto-generated from `src/assets/commands/*.json`.

/// Holder for one element of a command's repeated-tail group.
#[derive(Debug, Clone, Default)]
pub struct TailArgs(pub Vec<rosc::OscType>);

pub mod buffer;
pub mod control;
pub mod group;
pub mod master;
pub mod node;
pub mod nrt;
pub mod synth;
pub mod synthdef;
pub mod unit;

pub use buffer::*;
pub use control::*;
pub use group::*;
pub use master::*;
pub use node::*;
pub use nrt::*;
pub use synth::*;
pub use synthdef::*;
pub use unit::*;
