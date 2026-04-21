// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// When it receives a trigger, it tosses a coin, and either passes the trigger or
/// doesn't.
pub struct CoinGate {
    _rate: Rate,
    prob: UGenInput,
    trig: UGenInput,
}

impl CoinGate {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            prob: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            prob: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Value between 0 and 1 determines probability of either possibilities
    pub fn prob(mut self, v: impl Into<UGenInput>) -> Self {
        self.prob = v.into();
        self
    }

    /// Trigger signal
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.prob);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CoinGate", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a single random float value in an exponential distributions from lo
/// to hi.
pub struct ExpRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
}

impl ExpRand {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            lo: UGenInput::Constant(0.01),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// Minimum value of generated float
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated float
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ExpRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a single random integer value in uniform distribution from lo to hi
pub struct IRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
}

impl IRand {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(127.0),
        }
    }

    /// Minimum value of generated integer
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated integer
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"IRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a single random float value in linear distribution from lo to hi,
/// skewed towards lo if minmax < 0, otherwise skewed towards hi.
pub struct LinRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
    minmax: UGenInput,
}

impl LinRand {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
            minmax: UGenInput::Constant(0.0),
        }
    }

    /// Minimum value of generated float
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated float
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Skew direction (towards lo if negative otherwise hi)
    pub fn minmax(mut self, v: impl Into<UGenInput>) -> Self {
        self.minmax = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.minmax);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LinRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a single random float value in a sum of n uniform distributions from
/// lo to hi. n = 1 : uniform distribution - same as Rand n = 2 : triangular
/// distribution n = 3 : smooth hump As n increases, distribution converges
/// towards gaussian
pub struct NRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
    n: UGenInput,
}

impl NRand {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
            n: UGenInput::Constant(0.0),
        }
    }

    /// Minimum value of generated float
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated float
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Distribution choice
    pub fn n(mut self, v: impl Into<UGenInput>) -> Self {
        self.n = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.n);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"NRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct Rand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
}

impl Rand {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Rand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Choose which random number generator to use for this synth. All synths that
/// use the same generator reproduce the same sequence of numbers when the same
/// seed is set again.
pub struct RandID {
    _rate: Rate,
    seed: UGenInput,
}

impl RandID {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            seed: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            seed: UGenInput::Constant(0.0),
        }
    }

    /// Seed id
    pub fn seed(mut self, v: impl Into<UGenInput>) -> Self {
        self.seed = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.seed);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RandID", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// When the trigger signal changes from nonpositive to positive, the synth's
/// random generator seed is reset to the given value. All synths that use the
/// same random number generator reproduce the same sequence of numbers again.
pub struct RandSeed {
    _rate: Rate,
    trig: UGenInput,
    seed: UGenInput,
}

impl RandSeed {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            trig: UGenInput::Constant(0.0),
            seed: UGenInput::Constant(56789.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            seed: UGenInput::Constant(56789.0),
        }
    }

    /// Trigger signal
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Seed value
    pub fn seed(mut self, v: impl Into<UGenInput>) -> Self {
        self.seed = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.seed);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RandSeed", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a random float value in exponential distribution from lo to hi each
/// time the trig signal changes from nonpositive to positive values lo and hi
/// must both have the same sign and be non-zero.
pub struct TExpRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
    trig: UGenInput,
}

impl TExpRand {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            lo: UGenInput::Constant(0.01),
            hi: UGenInput::Constant(1.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            lo: UGenInput::Constant(0.01),
            hi: UGenInput::Constant(1.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Minimum value of generated float
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated float
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Trigger signal
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TExpRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a random integer value in uniform distribution from lo to hi each
/// time the trig signal changes from nonpositive to positive values
pub struct TIRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
    trig: UGenInput,
}

impl TIRand {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(127.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(127.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Minimum value of generated integer
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated integer
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Trigger signal
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TIRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a random float value in uniform distribution from lo to hi each time
/// the trig signal changes from nonpositive to positive values
pub struct TRand {
    _rate: Rate,
    lo: UGenInput,
    hi: UGenInput,
    trig: UGenInput,
}

impl TRand {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Minimum value of generated float
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// Maximum value of generated float
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Trigger signal
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TRand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
