// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

use crate::registry::UGenRegistryEntry;
use crate::Rate;

pub(crate) const UGENS: &[UGenRegistryEntry] = &[
    UGenRegistryEntry {
        name: r"KeyState",
        rates: &[Rate::Control],
        defaults: &[(r"keycode", Some(0.0)), (r"minval", Some(0.0)), (r"maxval", Some(1.0)), (r"lag", Some(0.2))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Toggles between two values when a key on the keyboard is up or down. Note that this ugen does not prevent normal typing."),
        signal_range: None,
        arg_docs: &[(r"keycode", r"The keycode value of the key to check."), (r"lag", r"lag factor"), (r"maxval", r"The value to output when the key is pressed."), (r"minval", r"The value to output when the key is not pressed.")],
    },
    UGenRegistryEntry {
        name: r"MouseButton",
        rates: &[Rate::Control],
        defaults: &[(r"up", Some(0.0)), (r"down", Some(1.0)), (r"lag", Some(0.2))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"toggles between two values when the left mouse button is up or down"),
        signal_range: None,
        arg_docs: &[(r"down", r"value when the key is pressed"), (r"lag", r"lag factor"), (r"up", r"value when the key is not pressed")],
    },
    UGenRegistryEntry {
        name: r"MouseX",
        rates: &[Rate::Control],
        defaults: &[(r"min", Some(0.0)), (r"max", Some(1.0)), (r"warp", Some(0.0)), (r"lag", Some(0.2))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"maps the current mouse X coordinate to a value between min and max"),
        signal_range: None,
        arg_docs: &[(r"lag", r"lag factor to dezipper cursor movement."), (r"max", r"maximum value (when mouse is at the right of the screen)"), (r"min", r"minimum value (when mouse is at the left of the screen)"), (r"warp", r"mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are allowed). Default is LINEAR.")],
    },
    UGenRegistryEntry {
        name: r"MouseY",
        rates: &[Rate::Control],
        defaults: &[(r"min", Some(0.0)), (r"max", Some(1.0)), (r"warp", Some(0.0)), (r"lag", Some(0.2))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"maps the current mouse Y coordinate to a value between min and max"),
        signal_range: None,
        arg_docs: &[(r"lag", r"lag factor to smooth out cursor movement."), (r"max", r"maximum value (when mouse is at the bottom of the screen)"), (r"min", r"minimum value (when mouse is at the top of the screen)"), (r"warp", r"mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are allowed). Default is LINEAR")],
    },
];
