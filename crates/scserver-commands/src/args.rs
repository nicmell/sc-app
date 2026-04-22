//! Typed argument enums for commands whose wire types are polymorphic —
//! a control identifier that is either an `int` index or a `string` name,
//! a numeric value that accepts `int` or `float`, and the `/s_new` control
//! value that accepts `float` / `int` / `string` (bus reference).
//!
//! Each enum implements `Into<rosc::OscType>` plus ergonomic `From` impls
//! for the common scalar sources — so call sites can write
//! `("freq".into(), 440.0f32.into())` without spelling out the variant.

use rosc::OscType;

/// Identifier used to address a synth control: either its index in the
/// control list, or its declared name.
///
/// Appears in every `/n_*` / `/s_*` command that mutates controls.
#[derive(Debug, Clone, PartialEq)]
pub enum ControlId {
    Index(i32),
    Name(String),
}

impl From<i32> for ControlId {
    fn from(v: i32) -> Self {
        ControlId::Index(v)
    }
}

impl From<&str> for ControlId {
    fn from(v: &str) -> Self {
        ControlId::Name(v.to_string())
    }
}

impl From<String> for ControlId {
    fn from(v: String) -> Self {
        ControlId::Name(v)
    }
}

impl From<ControlId> for OscType {
    fn from(v: ControlId) -> Self {
        match v {
            ControlId::Index(i) => OscType::Int(i),
            ControlId::Name(s) => OscType::String(s),
        }
    }
}

/// A numeric value that the server accepts as either `int` or `float`.
/// Used by `/c_set`, `/c_setn`, `/c_fill`, `/n_set`, `/n_setn`, `/n_fill`,
/// `/b_set`, `/b_setn`, `/b_fill`, etc.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NumericValue {
    Float(f32),
    Int(i32),
}

impl From<f32> for NumericValue {
    fn from(v: f32) -> Self {
        NumericValue::Float(v)
    }
}

impl From<i32> for NumericValue {
    fn from(v: i32) -> Self {
        NumericValue::Int(v)
    }
}

impl From<NumericValue> for OscType {
    fn from(v: NumericValue) -> Self {
        match v {
            NumericValue::Float(f) => OscType::Float(f),
            NumericValue::Int(i) => OscType::Int(i),
        }
    }
}

/// The `/s_new` control-value alternative: a float, an int, or a bus
/// reference string (e.g. `"c10"` for control bus 10, `"a0"` for audio
/// bus 0).
#[derive(Debug, Clone, PartialEq)]
pub enum ControlValue {
    Float(f32),
    Int(i32),
    /// Bus reference — a symbol like `"c10"` or `"a0"` that instructs the
    /// server to map the control to that bus at synth creation.
    Bus(String),
}

impl From<f32> for ControlValue {
    fn from(v: f32) -> Self {
        ControlValue::Float(v)
    }
}

impl From<i32> for ControlValue {
    fn from(v: i32) -> Self {
        ControlValue::Int(v)
    }
}

impl From<&str> for ControlValue {
    fn from(v: &str) -> Self {
        ControlValue::Bus(v.to_string())
    }
}

impl From<String> for ControlValue {
    fn from(v: String) -> Self {
        ControlValue::Bus(v)
    }
}

impl From<ControlValue> for OscType {
    fn from(v: ControlValue) -> Self {
        match v {
            ControlValue::Float(f) => OscType::Float(f),
            ControlValue::Int(i) => OscType::Int(i),
            ControlValue::Bus(s) => OscType::String(s),
        }
    }
}
