// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

use crate::registry::UGenRegistryEntry;
use crate::Rate;

pub(crate) const UGENS: &[UGenRegistryEntry] = &[
    UGenRegistryEntry {
        name: r"BinaryOpUGen",
        rates: &[Rate::Scalar, Rate::Audio, Rate::Control],
        defaults: &[(r"a", None), (r"b", None)],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Multi-function binary ugen representing many operations (e.g. +, *, <, min, max, etc...)"),
        signal_range: None,
        arg_docs: &[(r"a", r"First input"), (r"b", r"Second input")],
    },
    UGenRegistryEntry {
        name: r"MulAdd",
        rates: &[Rate::Scalar, Rate::Audio, Rate::Control],
        defaults: &[(r"in", None), (r"mul", None), (r"add", None)],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Multiply the input source by mul then add the add value. Equivalent to, but more efficient than, (+ add (* mul in))"),
        signal_range: None,
        arg_docs: &[(r"add", r"Addition Value"), (r"in", r"Input to modify"), (r"mul", r"Multiplier Value")],
    },
    UGenRegistryEntry {
        name: r"UnaryOpUGen",
        rates: &[Rate::Scalar, Rate::Audio, Rate::Control],
        defaults: &[(r"a", None)],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Multi-function unary ugen representing many operations (e.g. neg, abs, floor, sqrt, midicps, etc...)"),
        signal_range: None,
        arg_docs: &[(r"a", r"input")],
    },
];
