// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

//! Typed UGen builders, one struct per bundled UGen. See the
//! per-module documentation for the full catalogue — each struct's
//! doc comment comes from `src/assets/ugens/*.json`.

pub mod basicops;
pub mod beq_suite;
pub mod buf_io;
pub mod chaos;
pub mod compander;
pub mod delay;
pub mod demand;
pub mod envgen;
pub mod ff_osc;
pub mod fft;
pub mod fft2;
pub mod filter;
pub mod grain;
pub mod info;
pub mod input;
pub mod io;
pub mod line;
pub mod machine_listening;
pub mod misc;
pub mod noise;
pub mod osc;
pub mod pan;
pub mod random;
pub mod trig;

pub use basicops::*;
pub use beq_suite::*;
pub use buf_io::*;
pub use chaos::*;
pub use compander::*;
pub use delay::*;
pub use demand::*;
pub use envgen::*;
pub use ff_osc::*;
pub use fft::*;
pub use fft2::*;
pub use filter::*;
pub use grain::*;
pub use info::*;
pub use input::*;
pub use io::*;
pub use line::*;
pub use machine_listening::*;
pub use misc::*;
pub use noise::*;
pub use osc::*;
pub use pan::*;
pub use random::*;
pub use trig::*;
