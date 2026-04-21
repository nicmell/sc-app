// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Toggles between two values when a key on the keyboard is up or down. Note that
/// this ugen does not prevent normal typing.
pub struct KeyState {
    _rate: Rate,
    keycode: UGenInput,
    minval: UGenInput,
    maxval: UGenInput,
    lag: UGenInput,
}

impl KeyState {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            keycode: UGenInput::Constant(0.0),
            minval: UGenInput::Constant(0.0),
            maxval: UGenInput::Constant(1.0),
            lag: UGenInput::Constant(0.2),
        }
    }

    /// The keycode value of the key to check.
    pub fn keycode(mut self, v: impl Into<UGenInput>) -> Self {
        self.keycode = v.into();
        self
    }

    /// The value to output when the key is not pressed.
    pub fn minval(mut self, v: impl Into<UGenInput>) -> Self {
        self.minval = v.into();
        self
    }

    /// The value to output when the key is pressed.
    pub fn maxval(mut self, v: impl Into<UGenInput>) -> Self {
        self.maxval = v.into();
        self
    }

    /// lag factor
    pub fn lag(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.keycode);
        inputs.push(self.minval);
        inputs.push(self.maxval);
        inputs.push(self.lag);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"KeyState", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// toggles between two values when the left mouse button is up or down
pub struct MouseButton {
    _rate: Rate,
    up: UGenInput,
    down: UGenInput,
    lag: UGenInput,
}

impl MouseButton {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            up: UGenInput::Constant(0.0),
            down: UGenInput::Constant(1.0),
            lag: UGenInput::Constant(0.2),
        }
    }

    /// value when the key is not pressed
    pub fn up(mut self, v: impl Into<UGenInput>) -> Self {
        self.up = v.into();
        self
    }

    /// value when the key is pressed
    pub fn down(mut self, v: impl Into<UGenInput>) -> Self {
        self.down = v.into();
        self
    }

    /// lag factor
    pub fn lag(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.up);
        inputs.push(self.down);
        inputs.push(self.lag);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MouseButton", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// maps the current mouse X coordinate to a value between min and max
pub struct MouseX {
    _rate: Rate,
    min: UGenInput,
    max: UGenInput,
    warp: UGenInput,
    lag: UGenInput,
}

impl MouseX {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            min: UGenInput::Constant(0.0),
            max: UGenInput::Constant(1.0),
            warp: UGenInput::Constant(0.0),
            lag: UGenInput::Constant(0.2),
        }
    }

    /// minimum value (when mouse is at the left of the screen)
    pub fn min(mut self, v: impl Into<UGenInput>) -> Self {
        self.min = v.into();
        self
    }

    /// maximum value (when mouse is at the right of the screen)
    pub fn max(mut self, v: impl Into<UGenInput>) -> Self {
        self.max = v.into();
        self
    }

    /// mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are
    /// allowed). Default is LINEAR.
    pub fn warp(mut self, v: impl Into<UGenInput>) -> Self {
        self.warp = v.into();
        self
    }

    /// lag factor to dezipper cursor movement.
    pub fn lag(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.min);
        inputs.push(self.max);
        inputs.push(self.warp);
        inputs.push(self.lag);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MouseX", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// maps the current mouse Y coordinate to a value between min and max
pub struct MouseY {
    _rate: Rate,
    min: UGenInput,
    max: UGenInput,
    warp: UGenInput,
    lag: UGenInput,
}

impl MouseY {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            min: UGenInput::Constant(0.0),
            max: UGenInput::Constant(1.0),
            warp: UGenInput::Constant(0.0),
            lag: UGenInput::Constant(0.2),
        }
    }

    /// minimum value (when mouse is at the top of the screen)
    pub fn min(mut self, v: impl Into<UGenInput>) -> Self {
        self.min = v.into();
        self
    }

    /// maximum value (when mouse is at the bottom of the screen)
    pub fn max(mut self, v: impl Into<UGenInput>) -> Self {
        self.max = v.into();
        self
    }

    /// mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are
    /// allowed). Default is LINEAR
    pub fn warp(mut self, v: impl Into<UGenInput>) -> Self {
        self.warp = v.into();
        self
    }

    /// lag factor to smooth out cursor movement.
    pub fn lag(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.min);
        inputs.push(self.max);
        inputs.push(self.warp);
        inputs.push(self.lag);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MouseY", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
