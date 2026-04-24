// UGen specs — one module per source category, each exporting a
// `const UGENS: &[UGenRegistryEntry]` slice sorted by UGen name.

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
/// search per slice. The first tuple element is the category name.
pub(crate) const ALL_SLICES: &[(&str, &[UGenRegistryEntry])] = &[
    ("basicops", basicops::UGENS),
    ("beq_suite", beq_suite::UGENS),
    ("buf_io", buf_io::UGENS),
    ("chaos", chaos::UGENS),
    ("compander", compander::UGENS),
    ("delay", delay::UGENS),
    ("demand", demand::UGENS),
    ("envgen", envgen::UGENS),
    ("ff_osc", ff_osc::UGENS),
    ("fft", fft::UGENS),
    ("fft2", fft2::UGENS),
    ("filter", filter::UGENS),
    ("grain", grain::UGENS),
    ("info", info::UGENS),
    ("input", input::UGENS),
    ("io", io::UGENS),
    ("line", line::UGENS),
    ("machine_listening", machine_listening::UGENS),
    ("misc", misc::UGENS),
    ("noise", noise::UGENS),
    ("osc", osc::UGENS),
    ("pan", pan::UGENS),
    ("random", random::UGENS),
    ("trig", trig::UGENS),
];
