// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// audio rate to control rate converter via linear interpolation
pub struct A2K {
    _rate: Rate,
    r#in: UGenInput,
}

impl A2K {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// input signal
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
        let idx = def.add_ugen(r"A2K", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Basic psychoacoustic amplitude compensation." , :rates #{:ir :ar :kr} :check
/// (when-ar (first-input-ar "freq must be audio rate")) :doc "amplitude
/// compensation: because higher frequencies are normally perceived as louder.
/// Note that for frequencies very much smaller than root the amplitudes can
/// become very high. In this case limit the freqor use amp-comp-a Implements the
/// (optimized) formula: compensationFactor = (root / freq) ** exp
/// 
/// amplitude compensation: because higher frequencies are normally perceived as
/// louder. Note that for frequencies very much smaller than root the amplitudes
/// can become very high. In this case limit the freqor use amp-comp-a Implements
/// the (optimized) formula: compensationFactor = (root / freq) ** exp
pub struct AmpComp {
    _rate: Rate,
    freq: UGenInput,
    root: UGenInput,
    exp: UGenInput,
}

impl AmpComp {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            freq: UGenInput::Constant(261.6256),
            root: UGenInput::Constant(261.6256),
            exp: UGenInput::Constant(0.3333),
        }
    }

    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(261.6256),
            root: UGenInput::Constant(261.6256),
            exp: UGenInput::Constant(0.3333),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(261.6256),
            root: UGenInput::Constant(261.6256),
            exp: UGenInput::Constant(0.3333),
        }
    }

    /// Input frequency value. For freq == root, the output is 1.0.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Root freq relative to which the curve is calculated (usually lowest freq)
    pub fn root(mut self, v: impl Into<UGenInput>) -> Self {
        self.root = v.into();
        self
    }

    /// Exponent: how steep the curve decreases for increasing freq
    pub fn exp(mut self, v: impl Into<UGenInput>) -> Self {
        self.exp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.root);
        inputs.push(self.exp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"AmpComp", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Basic psychoacoustic amplitude compensation (ANSI A-weighting curve).
/// 
/// Higher frequencies are normally perceived as louder, which amp-comp-a
/// compensates. Following the measurings by Fletcher and Munson, the ANSI
/// standard describes a function for loudness vs. frequency. Note that this curve
/// is only valid for standardized amplitude. 1 For a simpler but more flexible
/// curve, see amp-comp
pub struct AmpCompA {
    _rate: Rate,
    freq: UGenInput,
    root: UGenInput,
    min_amp: UGenInput,
    root_amp: UGenInput,
}

impl AmpCompA {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            freq: UGenInput::Constant(1000.0),
            root: UGenInput::Constant(0.0),
            min_amp: UGenInput::Constant(0.32),
            root_amp: UGenInput::Constant(1.0),
        }
    }

    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(1000.0),
            root: UGenInput::Constant(0.0),
            min_amp: UGenInput::Constant(0.32),
            root_amp: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(1000.0),
            root: UGenInput::Constant(0.0),
            min_amp: UGenInput::Constant(0.32),
            root_amp: UGenInput::Constant(1.0),
        }
    }

    /// Input frequency value. For freq == root, the output is root-amp
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Root freq relative to which the curve is calculated (usually lowest freq)
    pub fn root(mut self, v: impl Into<UGenInput>) -> Self {
        self.root = v.into();
        self
    }

    /// Amplitude at the minimum point of the curve (around 2512 Hz)
    pub fn min_amp(mut self, v: impl Into<UGenInput>) -> Self {
        self.min_amp = v.into();
        self
    }

    /// Amplitude at the root frequency.
    pub fn root_amp(mut self, v: impl Into<UGenInput>) -> Self {
        self.root_amp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.root);
        inputs.push(self.min_amp);
        inputs.push(self.root_amp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"AmpCompA", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// outputs the initial value you give it.
pub struct DC {
    _rate: Rate,
    r#in: UGenInput,
}

impl DC {
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

    /// constant value to output, cannot be modulated, set at initialisation time
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
        let idx = def.add_ugen(r"DC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// control rate to audio rate converter via linear interpolation.
pub struct K2A {
    _rate: Rate,
    r#in: UGenInput,
}

impl K2A {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// input signal
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
        let idx = def.add_ugen(r"K2A", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Line generator.
/// 
/// Generates a line from the start value to the end value.
pub struct Line {
    _rate: Rate,
    start: UGenInput,
    end: UGenInput,
    dur: UGenInput,
    action: UGenInput,
}

impl Line {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            start: UGenInput::Constant(0.0),
            end: UGenInput::Constant(1.0),
            dur: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            start: UGenInput::Constant(0.0),
            end: UGenInput::Constant(1.0),
            dur: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Starting value
    pub fn start(mut self, v: impl Into<UGenInput>) -> Self {
        self.start = v.into();
        self
    }

    /// Ending value
    pub fn end(mut self, v: impl Into<UGenInput>) -> Self {
        self.end = v.into();
        self
    }

    /// Duration in seconds
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// A done action to be evaluated when the line is completed. Default: NO-ACTION
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.start);
        inputs.push(self.end);
        inputs.push(self.dur);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Line", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Map a linear range to an exponential range
/// 
/// Convert from a linear range to an exponential range. The dstlo and dsthi
/// arguments must be nonzero and have the same sign.
pub struct LinExp {
    _rate: Rate,
    r#in: UGenInput,
    srclo: UGenInput,
    srchi: UGenInput,
    dstlo: UGenInput,
    dsthi: UGenInput,
}

impl LinExp {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            srclo: UGenInput::Constant(0.0),
            srchi: UGenInput::Constant(1.0),
            dstlo: UGenInput::Constant(1.0),
            dsthi: UGenInput::Constant(2.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            srclo: UGenInput::Constant(0.0),
            srchi: UGenInput::Constant(1.0),
            dstlo: UGenInput::Constant(1.0),
            dsthi: UGenInput::Constant(2.0),
        }
    }

    /// Input to convert
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Lower limit of input range
    pub fn srclo(mut self, v: impl Into<UGenInput>) -> Self {
        self.srclo = v.into();
        self
    }

    /// Upper limit of input range
    pub fn srchi(mut self, v: impl Into<UGenInput>) -> Self {
        self.srchi = v.into();
        self
    }

    /// Lower limit of output range
    pub fn dstlo(mut self, v: impl Into<UGenInput>) -> Self {
        self.dstlo = v.into();
        self
    }

    /// Upper limit of output range
    pub fn dsthi(mut self, v: impl Into<UGenInput>) -> Self {
        self.dsthi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.srclo);
        inputs.push(self.srchi);
        inputs.push(self.dstlo);
        inputs.push(self.dsthi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LinExp", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Continuously outputs 0
pub struct Silent {
    _rate: Rate,
    num_channels: u32,
}

impl Silent {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            num_channels: 1,
        }
    }

    /// Number of channels of silence.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"Silent", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// control rate trigger to audio rate trigger converter (maximally one per
/// control period).
pub struct T2A {
    _rate: Rate,
    r#in: UGenInput,
    offset: UGenInput,
}

impl T2A {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            offset: UGenInput::Constant(0.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// sample offset within control period
    pub fn offset(mut self, v: impl Into<UGenInput>) -> Self {
        self.offset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.offset);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"T2A", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// audio rate trigger to control rate trigger converter. Uses the maxiumum
/// trigger in the input during each control period.
pub struct T2K {
    _rate: Rate,
    r#in: UGenInput,
}

impl T2K {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// input signal
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
        let idx = def.add_ugen(r"T2K", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Exponential line generator.
/// 
/// Generates an exponential curve from the start value to the end value. Both the
/// start and end values must be non-zero and have the same sign.
pub struct XLine {
    _rate: Rate,
    start: UGenInput,
    end: UGenInput,
    dur: UGenInput,
    action: UGenInput,
}

impl XLine {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            start: UGenInput::Constant(1.0),
            end: UGenInput::Constant(2.0),
            dur: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            start: UGenInput::Constant(1.0),
            end: UGenInput::Constant(2.0),
            dur: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Starting value
    pub fn start(mut self, v: impl Into<UGenInput>) -> Self {
        self.start = v.into();
        self
    }

    /// Ending value
    pub fn end(mut self, v: impl Into<UGenInput>) -> Self {
        self.end = v.into();
        self
    }

    /// Duration in seconds
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// A done action to be evaluated when the line is completed. Default: NO-ACTION
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.start);
        inputs.push(self.end);
        inputs.push(self.dur);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"XLine", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
