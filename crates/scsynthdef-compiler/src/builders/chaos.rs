// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// a linear-interpolating (cusp map chaotic) sound generator based on the
/// difference equation: xn+1 = a - b*sqrt(|xn|)
pub struct CuspL {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    xi: UGenInput,
}

impl CuspL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(1.9),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(1.9),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// first coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CuspL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-interpolating (cusp map chaotic) sound generator based on the difference
/// equation: xn+1 = a - b*sqrt(|xn|)
pub struct CuspN {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    xi: UGenInput,
}

impl CuspN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(1.9),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(1.9),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// first coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CuspN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a cubic-interpolating feedback sine with chaotic phase indexing sound
/// generator. This uses a linear congruential function to drive the phase
/// indexing of a sine wave. For im = 1, fb = 0, and a = 1 a normal sinewave
/// results.
pub struct FBSineC {
    _rate: Rate,
    freq: UGenInput,
    im: UGenInput,
    fb: UGenInput,
    a: UGenInput,
    c: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl FBSineC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            im: UGenInput::Constant(1.0),
            fb: UGenInput::Constant(0.1),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            im: UGenInput::Constant(1.0),
            fb: UGenInput::Constant(0.1),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.1),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// index multiplier amount
    pub fn im(mut self, v: impl Into<UGenInput>) -> Self {
        self.im = v.into();
        self
    }

    /// feedback amount
    pub fn fb(mut self, v: impl Into<UGenInput>) -> Self {
        self.fb = v.into();
        self
    }

    /// phase multiplier amount
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// phase increment amount
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.im);
        inputs.push(self.fb);
        inputs.push(self.a);
        inputs.push(self.c);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FBSineC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a linear-interpolating feedback sine with chaotic phase indexing sound
/// generator. This uses a linear congruential function to drive the phase
/// indexing of a sine wave. For im = 1, fb = 0, and a = 1 a normal sinewave
/// results.
pub struct FBSineL {
    _rate: Rate,
    freq: UGenInput,
    im: UGenInput,
    fb: UGenInput,
    a: UGenInput,
    c: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl FBSineL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            im: UGenInput::Constant(1.0),
            fb: UGenInput::Constant(0.1),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            im: UGenInput::Constant(1.0),
            fb: UGenInput::Constant(0.1),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.1),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// index multiplier amount
    pub fn im(mut self, v: impl Into<UGenInput>) -> Self {
        self.im = v.into();
        self
    }

    /// feedback amount
    pub fn fb(mut self, v: impl Into<UGenInput>) -> Self {
        self.fb = v.into();
        self
    }

    /// phase multiplier amount
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// phase increment amount
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.im);
        inputs.push(self.fb);
        inputs.push(self.a);
        inputs.push(self.c);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FBSineL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-interpolating feedback sine with chaotic phase indexing sound generator.
/// This uses a linear congruential function to drive the phase indexing of a sine
/// wave. For im = 1, fb = 0, and a = 1 a normal sinewave results.
pub struct FBSineN {
    _rate: Rate,
    freq: UGenInput,
    im: UGenInput,
    fb: UGenInput,
    a: UGenInput,
    c: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl FBSineN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            im: UGenInput::Constant(1.0),
            fb: UGenInput::Constant(0.1),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            im: UGenInput::Constant(1.0),
            fb: UGenInput::Constant(0.1),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.1),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// index multiplier amount
    pub fn im(mut self, v: impl Into<UGenInput>) -> Self {
        self.im = v.into();
        self
    }

    /// feedback amount
    pub fn fb(mut self, v: impl Into<UGenInput>) -> Self {
        self.fb = v.into();
        self
    }

    /// phase multiplier amount
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// phase increment amount
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.im);
        inputs.push(self.fb);
        inputs.push(self.a);
        inputs.push(self.c);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FBSineN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A linear-interpolating (gingerbreadman map chaotic) sound generator based on
/// the difference equations: xn+1 = 1 - yn + |xn| yn+1 = xn
pub struct GbmanL {
    _rate: Rate,
    freq: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl GbmanL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            xi: UGenInput::Constant(1.2),
            yi: UGenInput::Constant(2.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            xi: UGenInput::Constant(1.2),
            yi: UGenInput::Constant(2.1),
        }
    }

    /// iteration frequency in Hz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"GbmanL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A non-interpolating (gingerbreadman map chaotic) sound generator based on the
/// difference equations: xn+1 = 1 - yn + |xn| yn+1 = xn
pub struct GbmanN {
    _rate: Rate,
    freq: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl GbmanN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            xi: UGenInput::Constant(1.2),
            yi: UGenInput::Constant(2.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            xi: UGenInput::Constant(1.2),
            yi: UGenInput::Constant(2.1),
        }
    }

    /// iteration frequency in Hz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"GbmanN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a cubic-interpolating (henon map chaotic) sound generator based on the
/// difference equation: x[n+2] = 1 - a*(x[n+1]^)2 + bx[n]. This equation was
/// discovered by French astronomer Michel Hénon while studying the orbits of
/// stars in globular clusters.
pub struct HenonC {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    x0: UGenInput,
    x1: UGenInput,
}

impl HenonC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.4),
            b: UGenInput::Constant(0.3),
            x0: UGenInput::Constant(0.0),
            x1: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.4),
            b: UGenInput::Constant(0.3),
            x0: UGenInput::Constant(0.0),
            x1: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// initial value of x
    pub fn x0(mut self, v: impl Into<UGenInput>) -> Self {
        self.x0 = v.into();
        self
    }

    /// second value of x
    pub fn x1(mut self, v: impl Into<UGenInput>) -> Self {
        self.x1 = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.x0);
        inputs.push(self.x1);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"HenonC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a linear-interpolating (henon map chaotic) sound generator based on the
/// difference equation: x[n+2] = 1 - a*(x[n+1]^)2 + bx[n]. This equation was
/// discovered by French astronomer Michel Hénon while studying the orbits of
/// stars in globular clusters.
pub struct HenonL {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    x0: UGenInput,
    x1: UGenInput,
}

impl HenonL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.4),
            b: UGenInput::Constant(0.3),
            x0: UGenInput::Constant(0.0),
            x1: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.4),
            b: UGenInput::Constant(0.3),
            x0: UGenInput::Constant(0.0),
            x1: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// initial value of x
    pub fn x0(mut self, v: impl Into<UGenInput>) -> Self {
        self.x0 = v.into();
        self
    }

    /// second value of x
    pub fn x1(mut self, v: impl Into<UGenInput>) -> Self {
        self.x1 = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.x0);
        inputs.push(self.x1);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"HenonL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-interpolating (henon map chaotic) sound generator based on the
/// difference equation: x[n+2] = 1 - a*(x[n+1]^)2 + bx[n]. This equation was
/// discovered by French astronomer Michel Hénon while studying the orbits of
/// stars in globular clusters.
pub struct HenonN {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    x0: UGenInput,
    x1: UGenInput,
}

impl HenonN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.4),
            b: UGenInput::Constant(0.3),
            x0: UGenInput::Constant(0.0),
            x1: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.4),
            b: UGenInput::Constant(0.3),
            x0: UGenInput::Constant(0.0),
            x1: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// initial value of x
    pub fn x0(mut self, v: impl Into<UGenInput>) -> Self {
        self.x0 = v.into();
        self
    }

    /// second value of x
    pub fn x1(mut self, v: impl Into<UGenInput>) -> Self {
        self.x1 = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.x0);
        inputs.push(self.x1);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"HenonN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a cubic-interpolating (latoocarfian chaotic) sound generator. Parameters a and
/// b should be in the range from -3 to +3, and parameters c and d should be in
/// the range from 0.5 to 1.5. The function can, depending on the parameters
/// given, give continuous chaotic output, converge to a single value (silence) or
/// oscillate in a cycle (tone).
pub struct LatoocarfianC {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    d: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl LatoocarfianC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(3.0),
            c: UGenInput::Constant(0.5),
            d: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(3.0),
            c: UGenInput::Constant(0.5),
            d: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.5),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// 3rd coefficient
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// 4th coefficient
    pub fn d(mut self, v: impl Into<UGenInput>) -> Self {
        self.d = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.d);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LatoocarfianC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a linear-interpolating (latoocarfian chaotic) sound generator. Parameters a
/// and b should be in the range from -3 to +3, and parameters c and d should be
/// in the range from 0.5 to 1.5. The function can, depending on the parameters
/// given, give continuous chaotic output, converge to a single value (silence) or
/// oscillate in a cycle (tone).
pub struct LatoocarfianL {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    d: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl LatoocarfianL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(3.0),
            c: UGenInput::Constant(0.5),
            d: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(3.0),
            c: UGenInput::Constant(0.5),
            d: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.5),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// 3rd coefficient
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// 4th coefficient
    pub fn d(mut self, v: impl Into<UGenInput>) -> Self {
        self.d = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.d);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LatoocarfianL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-interpolating (latoocarfian chaotic) sound generator. Parameters a and b
/// should be in the range from -3 to +3, and parameters c and d should be in the
/// range from 0.5 to 1.5. The function can, depending on the parameters given,
/// give continuous chaotic output, converge to a single value (silence) or
/// oscillate in a cycle (tone).
pub struct LatoocarfianN {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    d: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl LatoocarfianN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(3.0),
            c: UGenInput::Constant(0.5),
            d: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(3.0),
            c: UGenInput::Constant(0.5),
            d: UGenInput::Constant(0.5),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.5),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// 3rd coefficient
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// 4th coefficient
    pub fn d(mut self, v: impl Into<UGenInput>) -> Self {
        self.d = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.d);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LatoocarfianN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a cubic-interpolating (linear congruential chaotic) sound generator. The
/// output signal is automatically scaled to a range of [-1, 1].
pub struct LinCongC {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    c: UGenInput,
    m: UGenInput,
    xi: UGenInput,
}

impl LinCongC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.13),
            m: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.13),
            m: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// multiplier amount
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// increment amount
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// modulus amount
    pub fn m(mut self, v: impl Into<UGenInput>) -> Self {
        self.m = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.c);
        inputs.push(self.m);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LinCongC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a linear-interpolating (linear congruential chaotic) sound generator. The
/// output signal is automatically scaled to a range of [-1, 1].
pub struct LinCongL {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    c: UGenInput,
    m: UGenInput,
    xi: UGenInput,
}

impl LinCongL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.13),
            m: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.13),
            m: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// multiplier amount
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// increment amount
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// modulus amount
    pub fn m(mut self, v: impl Into<UGenInput>) -> Self {
        self.m = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.c);
        inputs.push(self.m);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LinCongL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-interpolating (linear congruential chaotic) sound generator. The output
/// signal is automatically scaled to a range of [-1, 1].
pub struct LinCongN {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    c: UGenInput,
    m: UGenInput,
    xi: UGenInput,
}

impl LinCongN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.13),
            m: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.1),
            c: UGenInput::Constant(0.13),
            m: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// multiplier amount
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// increment amount
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// modulus amount
    pub fn m(mut self, v: impl Into<UGenInput>) -> Self {
        self.m = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.c);
        inputs.push(self.m);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LinCongN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// lorenz chaotic generator. A strange attractor discovered by Edward N. Lorenz
/// while studying mathematical models of the atmosphere. The time step amount h
/// determines the rate at which the ODE is evaluated. Higher values will increase
/// the rate, but cause more instability. A safe choice is the default amount of
/// 0.05.
pub struct LorenzL {
    _rate: Rate,
    freq: UGenInput,
    s: UGenInput,
    r: UGenInput,
    b: UGenInput,
    h: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
    zi: UGenInput,
}

impl LorenzL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            s: UGenInput::Constant(10.0),
            r: UGenInput::Constant(28.0),
            b: UGenInput::Constant(2.667),
            h: UGenInput::Constant(0.05),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.0),
            zi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            s: UGenInput::Constant(10.0),
            r: UGenInput::Constant(28.0),
            b: UGenInput::Constant(2.667),
            h: UGenInput::Constant(0.05),
            xi: UGenInput::Constant(0.1),
            yi: UGenInput::Constant(0.0),
            zi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st variable
    pub fn s(mut self, v: impl Into<UGenInput>) -> Self {
        self.s = v.into();
        self
    }

    /// 2nd variable
    pub fn r(mut self, v: impl Into<UGenInput>) -> Self {
        self.r = v.into();
        self
    }

    /// 3rd variable
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// integration time stamp
    pub fn h(mut self, v: impl Into<UGenInput>) -> Self {
        self.h = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// initial value of z
    pub fn zi(mut self, v: impl Into<UGenInput>) -> Self {
        self.zi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.s);
        inputs.push(self.r);
        inputs.push(self.b);
        inputs.push(self.h);
        inputs.push(self.xi);
        inputs.push(self.yi);
        inputs.push(self.zi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LorenzL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a cubic-interpolating (general quadratic map chaotic) sound generator based on
/// the difference equation: xn+1 = axn2 + bxn + c
pub struct QuadC {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    xi: UGenInput,
}

impl QuadC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(-1.0),
            c: UGenInput::Constant(-0.75),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(-1.0),
            c: UGenInput::Constant(-0.75),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// 3rd coefficient
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"QuadC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a linear-interpolating (general quadratic map chaotic) sound generator based
/// on the difference equation: xn+1 = axn2 + bxn + c
pub struct QuadL {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    xi: UGenInput,
}

impl QuadL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(-1.0),
            c: UGenInput::Constant(-0.75),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(-1.0),
            c: UGenInput::Constant(-0.75),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// 3rd coefficient
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"QuadL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-interpolating (general quadratic map chaotic) sound generator based on
/// the difference equation: xn+1 = axn2 + bxn + c
pub struct QuadN {
    _rate: Rate,
    freq: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    xi: UGenInput,
}

impl QuadN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(-1.0),
            c: UGenInput::Constant(-0.75),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            a: UGenInput::Constant(1.0),
            b: UGenInput::Constant(-1.0),
            c: UGenInput::Constant(-0.75),
            xi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 1st coefficient
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// 2nd coefficient
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// 3rd coefficient
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.xi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"QuadN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// linear-interpolating standard map chaotic generator. The standard map is an
/// area preserving map of a cylinder discovered by the plasma physicist Boris
/// Chirikov.
pub struct StandardL {
    _rate: Rate,
    freq: UGenInput,
    k: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl StandardL {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            k: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            k: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// perturbation amount
    pub fn k(mut self, v: impl Into<UGenInput>) -> Self {
        self.k = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.k);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"StandardL", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// standard map chaotic generator. The standard map is an area preserving map of
/// a cylinder discovered by the plasma physicist Boris Chirikov.
pub struct StandardN {
    _rate: Rate,
    freq: UGenInput,
    k: UGenInput,
    xi: UGenInput,
    yi: UGenInput,
}

impl StandardN {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(22050.0),
            k: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(22050.0),
            k: UGenInput::Constant(1.0),
            xi: UGenInput::Constant(0.5),
            yi: UGenInput::Constant(0.0),
        }
    }

    /// iteration frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// perturbation amount
    pub fn k(mut self, v: impl Into<UGenInput>) -> Self {
        self.k = v.into();
        self
    }

    /// initial value of x
    pub fn xi(mut self, v: impl Into<UGenInput>) -> Self {
        self.xi = v.into();
        self
    }

    /// initial value of y
    pub fn yi(mut self, v: impl Into<UGenInput>) -> Self {
        self.yi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.k);
        inputs.push(self.xi);
        inputs.push(self.yi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"StandardN", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
