// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

use crate::registry::UGenRegistryEntry;

pub(crate) mod basicops;
pub(crate) mod beq_suite;
pub(crate) mod buf_io;
pub(crate) mod chaos;
pub(crate) mod compander;
pub(crate) mod delay;
pub(crate) mod demand;
pub(crate) mod envgen;
pub(crate) mod ff_osc;
pub(crate) mod fft;
pub(crate) mod fft2;
pub(crate) mod filter;
pub(crate) mod grain;
pub(crate) mod info;
pub(crate) mod input;
pub(crate) mod io;
pub(crate) mod line;
pub(crate) mod machine_listening;
pub(crate) mod misc;
pub(crate) mod noise;
pub(crate) mod osc;
pub(crate) mod pan;
pub(crate) mod random;
pub(crate) mod trig;

/// Every registry entry, grouped by the JSON source file it came from.
/// Each inner slice is sorted by UGen name so `lookup_ugen` can binary
/// search per slice.
pub(crate) const ALL_SLICES: &[&[UGenRegistryEntry]] = &[
    basicops::UGENS,
    beq_suite::UGENS,
    buf_io::UGENS,
    chaos::UGENS,
    compander::UGENS,
    delay::UGENS,
    demand::UGENS,
    envgen::UGENS,
    ff_osc::UGENS,
    fft::UGENS,
    fft2::UGENS,
    filter::UGENS,
    grain::UGENS,
    info::UGENS,
    input::UGENS,
    io::UGENS,
    line::UGENS,
    machine_listening::UGENS,
    misc::UGENS,
    noise::UGENS,
    osc::UGENS,
    pan::UGENS,
    random::UGENS,
    trig::UGENS,
];
