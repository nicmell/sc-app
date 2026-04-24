// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Multiply the input source by mul then add the add value. Equivalent to, but
/// more efficient than, (+ add (* mul in))
pub struct MulAdd {
    _rate: Rate,
    r#in: UGenInput,
    mul: UGenInput,
    add: UGenInput,
}

impl MulAdd {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            r#in: UGenInput::Constant(0.0),
            mul: UGenInput::Constant(0.0),
            add: UGenInput::Constant(0.0),
        }
    }

    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            mul: UGenInput::Constant(0.0),
            add: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            mul: UGenInput::Constant(0.0),
            add: UGenInput::Constant(0.0),
        }
    }

    /// Input to modify
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Multiplier Value
    pub fn mul(mut self, v: impl Into<UGenInput>) -> Self {
        self.mul = v.into();
        self
    }

    /// Addition Value
    pub fn add(mut self, v: impl Into<UGenInput>) -> Self {
        self.add = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.mul);
        inputs.push(self.add);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MulAdd", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
