// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// all pass delay line, cubic interpolation
pub struct AllpassC {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl AllpassC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"AllpassC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// all pass delay line, linear interpolation
pub struct AllpassL {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl AllpassL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"AllpassL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// all pass delay line, no interpolation. See also AllpassC which uses cubic
/// interpolation, and AllpassL which uses linear interpolation. Cubic
/// interpolation is more computationally expensive than linear, but more
/// accurate.
pub struct AllpassN {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl AllpassN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"AllpassN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based all pass delay line with cubic interpolation
pub struct BufAllpassC {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl BufAllpassC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufAllpassC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based all pass delay line with linear interpolation
pub struct BufAllpassL {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl BufAllpassL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufAllpassL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based all pass delay line with no interpolation. See also BufAllpassC
/// which uses cubic interpolation, and BufAllpassL which uses linear
/// interpolation. Cubic interpolation is more computationally expensive than
/// linear, but more accurate.
pub struct BufAllpassN {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl BufAllpassN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufAllpassN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based comb delay line with cubic interpolation
pub struct BufCombC {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl BufCombC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufCombC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based comb delay line with linear interpolation
pub struct BufCombL {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl BufCombL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufCombL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based comb delay line with no interpolation. See also [BufCombL] which
/// uses linear interpolation, and BufCombC which uses cubic interpolation. Cubic
/// interpolation is more computationally expensive than linear, but more
/// accurate.
pub struct BufCombN {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl BufCombN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufCombN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based simple delay line with cubic interpolation
pub struct BufDelayC {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
}

impl BufDelayC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufDelayC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based simple delay line with linear interpolation
pub struct BufDelayL {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
}

impl BufDelayL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufDelayL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// buffer based simple delay line with no interpolation. See also BufDelayL which
/// uses linear interpolation, and BufDelayC which uses cubic interpolation. Cubic
/// interpolation is more computationally expensive than linear, but more
/// accurate.
pub struct BufDelayN {
    _rate: Rate,
    buf: UGenInput,
    r#in: UGenInput,
    delay_time: UGenInput,
}

impl BufDelayN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// buffer number
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.r#in);
        inputs.push(self.delay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufDelayN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// comb delay line, cubic interpolation
pub struct CombC {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl CombC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CombC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// comb delay line, linear interpolation
pub struct CombL {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl CombL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CombL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// comb delay line, no interpolation. See also CombL which uses linear
/// interpolation, and CombC which uses cubic interpolation. Cubic interpolation
/// is more computationally expensive than linear, but more accurate.
pub struct CombN {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
    decay_time: UGenInput,
}

impl CombN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// time for the echoes to decay by 60 decibels. If this time is negative then the
    /// feedback coefficient will be negative, thus emphasizing only odd harmonics at
    /// an octave lower.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CombN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// delay input signal by one frame of samples. Note: for audio-rate signals the
/// delay is 1 audio frame, and for control-rate signals the delay is 1 control
/// period.
pub struct Delay1 {
    _rate: Rate,
    r#in: UGenInput,
}

impl Delay1 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// input to be delayed.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Delay1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// delay input signal by two frames of samples
pub struct Delay2 {
    _rate: Rate,
    r#in: UGenInput,
}

impl Delay2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// input to be delayed.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Delay2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// simple delay line, cubic interpolation.
pub struct DelayC {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
}

impl DelayC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DelayC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// simple delay line, linear interpolation.
pub struct DelayL {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
}

impl DelayL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DelayL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// simple delay line, no interpolation. See also DelayL which uses linear
/// interpolation, and DelayC which uses cubic interpolation. Cubic interpolation
/// is more computationally expensive than linear, but more accurate.
pub struct DelayN {
    _rate: Rate,
    r#in: UGenInput,
    max_delay_time: UGenInput,
    delay_time: UGenInput,
}

impl DelayN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            max_delay_time: UGenInput::Constant(0.2),
            delay_time: UGenInput::Constant(0.2),
        }
    }

    /// the input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the maximum delay time in seconds. Used to initialize the delay buffer size
    pub fn max_delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_delay_time = v.into();
        self
    }

    /// delay time in seconds
    pub fn delay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.max_delay_time);
        inputs.push(self.delay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DelayN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Tap a delay line from a del-tap-wr UGen
pub struct DelTapRd {
    _rate: Rate,
    buffer: UGenInput,
    phase: UGenInput,
    delay: UGenInput,
    interp: UGenInput,
}

impl DelTapRd {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buffer: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            delay: UGenInput::Constant(0.0),
            interp: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            delay: UGenInput::Constant(0.0),
            interp: UGenInput::Constant(1.0),
        }
    }

    /// buffer where del-tap-wr has written signal. Max delay time is based on buffer
    /// size.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// the current phase of the del-tap-wr UGen. This is the output of DelTapWr.
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// A delay time in seconds.
    pub fn delay(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay = v.into();
        self
    }

    /// the kind of interpolation to be used. 1 is none, 2 is linear, 4 is cubic.
    pub fn interp(mut self, v: impl Into<UGenInput>) -> Self {
        self.interp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.phase);
        inputs.push(self.delay);
        inputs.push(self.interp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DelTapRd", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Tap a delay line from a del-tap-wr UGen
pub struct DelTapWr {
    _rate: Rate,
    buffer: UGenInput,
    r#in: UGenInput,
}

impl DelTapWr {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buffer: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// the buffer to write signal into. Max delay time is based on buffer size.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// the signal to write to the buffer.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DelTapWr", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
