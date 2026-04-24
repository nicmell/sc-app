// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Noise whose spectrum falls off in power by 6 dB per octave.
/// 
/// Useful for generating percussive sounds such as snares and hand claps. Also
/// useful for simulating wind or sea effects, for producing breath effects in
/// wind instrument timbres or for producing the typical trance leads.
pub struct BrownNoise {
    _rate: Rate,
}

impl BrownNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BrownNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Noise whose values are either -1 or 1.
/// 
/// This produces the maximum energy for the least peak to peak amplitude. Useful
/// for generating percussive sounds such as snares and hand claps. Also useful
/// for simulating wind or sea effects, for producing breath effects in wind
/// instrument timbres or for producing the typical trance leads.
pub struct ClipNoise {
    _rate: Rate,
}

impl ClipNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ClipNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Chaotic noise generator
/// 
/// A noise generator based on a chaotic function. Useful for generating
/// percussive sounds such as snares and hand claps. Also useful for simulating
/// wind or sea effects, for producing breath effects in wind instrument timbres
/// or for producing the typical trance leads.
pub struct Crackle {
    _rate: Rate,
    chaos_param: UGenInput,
}

impl Crackle {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            chaos_param: UGenInput::Constant(1.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chaos_param: UGenInput::Constant(1.5),
        }
    }

    /// a parameter of the chaotic function with useful values from just below 1.0 to
    /// just above 2.0. Towards 2.0 the sound crackles.
    pub fn chaos_param(mut self, v: impl Into<UGenInput>) -> Self {
        self.chaos_param = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chaos_param);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Crackle", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates random impulses from 0 to +1.
pub struct Dust {
    _rate: Rate,
    density: UGenInput,
}

impl Dust {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            density: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            density: UGenInput::Constant(0.0),
        }
    }

    /// average number of impulses per second
    pub fn density(mut self, v: impl Into<UGenInput>) -> Self {
        self.density = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.density);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dust", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates random impulses from -1 to +1.
pub struct Dust2 {
    _rate: Rate,
    density: UGenInput,
}

impl Dust2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            density: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            density: UGenInput::Constant(0.0),
        }
    }

    /// average number of impulses per second.
    pub fn density(mut self, v: impl Into<UGenInput>) -> Self {
        self.density = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.density);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dust2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Random impulses from -1 to +1 given a density
/// 
/// Creates a sequence of random impulses from -1 to +1. Generates noise which
/// results from flipping random bits in a word. This type of noise has a high RMS
/// level relative to its peak to peak level. The spectrum is emphasized towards
/// lower frequencies. Useful for generating percussive sounds such as snares and
/// hand claps. Also useful for simulating wind or sea effects, for producing
/// breath effects in wind instrument timbres or for producing the typical trance
/// leads.
pub struct GrayNoise {
    _rate: Rate,
}

impl GrayNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"GrayNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Returns a unique output value from zero to one for each input value according
/// to a hash function. The same input value will always produce the same output
/// value. The input need not be from zero to one.
pub struct Hasher {
    _rate: Rate,
    r#in: UGenInput,
}

impl Hasher {
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
        let idx = def.add_ugen(r"Hasher", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Randomly generates the values -1 or +1 at a rate given by the nearest integer
/// division of the sample rate by the freq argument. It is probably pretty hard
/// on your speakers!
pub struct LFClipNoise {
    _rate: Rate,
    freq: UGenInput,
}

impl LFClipNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// approximate rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFClipNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Like lf-clip-noise, it generates the values -1 or +1 at a rate given by the
/// freq argument, with two differences: * no time quantization * fast recovery
/// from low freq values. (lf-clip-noise, as well as lf-noise0,1,2 quantize to the
/// nearest integer division of the samplerate, and they poll the freq argument
/// only when scheduled; thus they often seem to hang when freqs get very low). If
/// you don't need very high or very low freqs, or use fixed freqs lf-noise0 is
/// more efficient.
pub struct LFDClipNoise {
    _rate: Rate,
    freq: UGenInput,
}

impl LFDClipNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFDClipNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Like lf-noise0, it generates random values between -1 and 1 at a rate given by
/// the freq argument, with two differences: p * no time quantization * fast
/// recovery from low freq values. (lf-noise0,1,2 quantize to the nearest integer
/// division of the samplerate and they poll the freq argument only when
/// scheduled, and thus seem to hang when freqs get very low). If you don't need
/// very high or very low freqs, or use fixed freqs lf-noise0 is more efficient.
pub struct LFDNoise0 {
    _rate: Rate,
    freq: UGenInput,
}

impl LFDNoise0 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFDNoise0", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Like lf-noise1, it generates linearly interpolated random values between -1
/// and 1 at a rate given by the freq argument, with two differences: * no time
/// quantization * fast recovery from low freq values. (lf-noise0,1,2 quantize to
/// the nearest integer division of the samplerate and they poll the freq argument
/// only when scheduled, and thus seem to hang when freqs get very low). If you
/// don't need very high or very low freqs, or use fixed freqs lf-noise1 is more
/// efficient.
pub struct LFDNoise1 {
    _rate: Rate,
    freq: UGenInput,
}

impl LFDNoise1 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFDNoise1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Similar to lf-noise2, it generates polynomially interpolated random values
/// between -1 and 1 at a rate given by the freq argument, with 3 differences: *
/// no time quantization * fast recovery from low freq values * cubic instead of
/// quadratic interpolation (lf-noise0,1,2 quantize to the nearest integer
/// division of the samplerate and they poll the freq argument only when
/// scheduled, and thus seem to hang when freqs get very low). If you don't need
/// very high or very low freqs, or use fixed freqs lf-noise2 is more efficient.
pub struct LFDNoise3 {
    _rate: Rate,
    freq: UGenInput,
}

impl LFDNoise3 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFDNoise3", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates random values between -1 and 1 at a rate (the rate is not guaranteed
/// but approximate)
pub struct LFNoise0 {
    _rate: Rate,
    freq: UGenInput,
}

impl LFNoise0 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// approximate rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFNoise0", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates linearly interpolated random values between -1 and 1 at the supplied
/// rate (the rate is not guaranteed but approximate).
pub struct LFNoise1 {
    _rate: Rate,
    freq: UGenInput,
}

impl LFNoise1 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// approximate rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFNoise1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates quadratically interpolated random values between -1 and 1 at the
/// supplied rate (the rate is not guaranteed but approximate). Note: quadratic
/// interpolation means that the noise values can occasionally extend beyond the
/// normal range of +-1, if the freq varies in certain ways. If this is
/// undesirable then you might like to clip2 the values or use a
/// linearly-interpolating unit instead.
pub struct LFNoise2 {
    _rate: Rate,
    freq: UGenInput,
}

impl LFNoise2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(500.0),
        }
    }

    /// approximate rate at which to generate random values.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFNoise2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A noise generator based on the logistic map: y = chaos-param * y * (1.0 - y) y
/// will stay in the range of 0.0 to 1.0 for normal values of the chaos-param.
/// This leads to a DC offset and may cause a pop when you stop the Synth. For
/// output you might want to combine this UGen with a LeakDC or rescale around 0.0
/// via mul and add: see example below.
pub struct Logistic {
    _rate: Rate,
    chaos_param: UGenInput,
    freq: UGenInput,
    init: UGenInput,
}

impl Logistic {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            chaos_param: UGenInput::Constant(3.0),
            freq: UGenInput::Constant(1000.0),
            init: UGenInput::Constant(0.5),
        }
    }

    /// a parameter of the chaotic function with useful values from 0.0 to 4.0. Chaos
    /// occurs from 3.57 up. Don't use values outside this range if you don't want the
    /// UGen to blow up.
    pub fn chaos_param(mut self, v: impl Into<UGenInput>) -> Self {
        self.chaos_param = v.into();
        self
    }

    /// Frequency of calculation; if over the sampling rate, this is clamped to the
    /// sampling rate
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial value of y (see equation below)
    pub fn init(mut self, v: impl Into<UGenInput>) -> Self {
        self.init = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chaos_param);
        inputs.push(self.freq);
        inputs.push(self.init);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Logistic", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Masks off bits in the mantissa of the floating point sample value. This
/// introduces a quantization noise, but is less severe than linearly quantizing
/// the signal.
pub struct MantissaMask {
    _rate: Rate,
    r#in: UGenInput,
    bits: UGenInput,
}

impl MantissaMask {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            bits: UGenInput::Constant(3.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the number of mantissa bits to preserve. a number from 0 to 23.
    pub fn bits(mut self, v: impl Into<UGenInput>) -> Self {
        self.bits = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.bits);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MantissaMask", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Noise whose spectrum falls off in power by 3 dB per octave.
/// 
/// Noise that gives equal power over the span of each octave. Useful for
/// generating percussive sounds such as snares and hand claps. Also useful for
/// simulating wind or sea effects, for producing breath effects in wind
/// instrument timbres or for producing the typical trance leads. This version
/// gives 8 octaves of pink noise.
pub struct PinkNoise {
    _rate: Rate,
}

impl PinkNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PinkNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Noise whose spectrum has equal power at all frequencies.
/// 
/// Noise that contains equal amounts of energy at every frequency - comparable to
/// radio static. Useful for generating percussive sounds such as snares and hand
/// claps. Also useful for simulating wind or sea effects, for producing breath
/// effects in wind instrument timbres or for producing the typical trance leads.
pub struct WhiteNoise {
    _rate: Rate,
}

impl WhiteNoise {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"WhiteNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
