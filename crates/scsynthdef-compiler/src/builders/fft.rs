// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// fast fourier transform, converts input data from the time to the frequency
/// domain and stores the result in a buffer (audio waveform -> graph equalizer
/// bands) Output is -1 except when an FFT frame is ready, when the output is the
/// buffer index. This creates a special kind of slower pseudo-rate (built on top
/// of control rate) which all the pv-ugens understand.
pub struct FFT {
    _rate: Rate,
    buffer: UGenInput,
    r#in: UGenInput,
    hop: UGenInput,
    wintype: UGenInput,
    active: UGenInput,
    winsize: UGenInput,
}

impl FFT {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            hop: UGenInput::Constant(0.5),
            wintype: UGenInput::Constant(0.0),
            active: UGenInput::Constant(1.0),
            winsize: UGenInput::Constant(0.0),
        }
    }

    /// The buffer where a frame will be held. Its size must be a power of two.
    /// local-buf is useful here, because processes should not share data between
    /// synths. (Note: most PV UGens operate on this data in place. Use buffer-2n if
    /// you wish to create an external buffer.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// the signal to be analyzed. The signal's rate determines the rate at which the
    /// input is read.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// the amount of offset from one FFT analysis frame to the next, measured in
    /// multiples of the analysis frame size. This can range between zero and one, and
    /// the default is 0.5 (meaning each frame has a 50% overlap with the
    /// preceding/following frames).
    pub fn hop(mut self, v: impl Into<UGenInput>) -> Self {
        self.hop = v.into();
        self
    }

    /// defines how the data is windowed: RECT is for rectangular windowing, simple
    /// but typically not recommended; SINE (the default) is for Sine windowing,
    /// typically recommended for phase-vocoder work; HANN is for Hann windowing,
    /// typically recommended for analysis work.
    pub fn wintype(mut self, v: impl Into<UGenInput>) -> Self {
        self.wintype = v.into();
        self
    }

    /// is a simple control allowing FFT analysis to be active (>0) or inactive (<=0).
    /// This is mainly useful for signal analysis processes which are only intended to
    /// analyse at specific times rather than continuously
    pub fn active(mut self, v: impl Into<UGenInput>) -> Self {
        self.active = v.into();
        self
    }

    /// the windowed audio frames are usually the same size as the buffer. If you wish
    /// the FFT to be zero-padded then you can specify a window size smaller than the
    /// actual buffer size (e.g. window size 1024 with buffer size 2048). Both values
    /// must still be a power of two. Leave this at its default of zero for no
    /// zero-padding.
    pub fn winsize(mut self, v: impl Into<UGenInput>) -> Self {
        self.winsize = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.r#in);
        inputs.push(self.hop);
        inputs.push(self.wintype);
        inputs.push(self.active);
        inputs.push(self.winsize);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FFT", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Outputs the necessary signal for FFT chains, without doing an FFT on a signal
pub struct FFTTrigger {
    _rate: Rate,
    buffer: UGenInput,
    hop: UGenInput,
    polar: UGenInput,
}

impl FFTTrigger {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            hop: UGenInput::Constant(0.5),
            polar: UGenInput::Constant(0.0),
        }
    }

    /// a buffer to condition for FFT use
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// the hop size for timing triggers
    pub fn hop(mut self, v: impl Into<UGenInput>) -> Self {
        self.hop = v.into();
        self
    }

    /// a flag. If 0.0, the buffer will be prepared for complex data, if > 0.0, polar
    /// data is set up.
    pub fn polar(mut self, v: impl Into<UGenInput>) -> Self {
        self.polar = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.hop);
        inputs.push(self.polar);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FFTTrigger", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// inverse fast fourier transform, converts buffer data from frequency domain to
/// time domain The IFFT UGen converts the FFT data in-place (in the original FFT
/// buffer) and overlap-adds the result to produce a continuous signal at its
/// output.
pub struct IFFT {
    _rate: Rate,
    chain: UGenInput,
    wintype: UGenInput,
    winsize: UGenInput,
}

impl IFFT {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            chain: UGenInput::Constant(0.0),
            wintype: UGenInput::Constant(0.0),
            winsize: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            wintype: UGenInput::Constant(0.0),
            winsize: UGenInput::Constant(0.0),
        }
    }

    /// The FFT chain signal coming originally from an FFT UGen, perhaps via other PV
    /// UGens.
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// defines how the data is windowed: RECT is for rectangular windowing, simple
    /// but typically not recommended; SINE (the default) is for Sine windowing,
    /// typically recommended for phase-vocoder work; HANN is for Hann windowing,
    /// typically recommended for analysis work.
    pub fn wintype(mut self, v: impl Into<UGenInput>) -> Self {
        self.wintype = v.into();
        self
    }

    /// can be used to account for zero-padding, in the same way as the FFT UGen.
    pub fn winsize(mut self, v: impl Into<UGenInput>) -> Self {
        self.winsize = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.wintype);
        inputs.push(self.winsize);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"IFFT", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// complex addition: RealA + RealB, ImagA + ImagB
pub struct PV_Add {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_Add {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Add", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// randomizes the order of the bins. The trigger will select a new random
/// ordering.
pub struct PV_BinScramble {
    _rate: Rate,
    buffer: UGenInput,
    wipe: UGenInput,
    width: UGenInput,
    trig: UGenInput,
}

impl PV_BinScramble {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            wipe: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.2),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// scrambles more bins as wipe moves from zero to one.
    pub fn wipe(mut self, v: impl Into<UGenInput>) -> Self {
        self.wipe = v.into();
        self
    }

    /// a value from zero to one, indicating the maximum randomized distance of a bin
    /// from its original location in the spectrum.
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// a trigger selects a new random ordering.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.wipe);
        inputs.push(self.width);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_BinScramble", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// shift and scale the positions of the bins. Can be used as a very crude
/// frequency shifter/scaler.
pub struct PV_BinShift {
    _rate: Rate,
    buffer: UGenInput,
    stretch: UGenInput,
    shift: UGenInput,
}

impl PV_BinShift {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            stretch: UGenInput::Constant(1.0),
            shift: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// scale bin location by factor.
    pub fn stretch(mut self, v: impl Into<UGenInput>) -> Self {
        self.stretch = v.into();
        self
    }

    /// add an offset to bin position.
    pub fn shift(mut self, v: impl Into<UGenInput>) -> Self {
        self.shift = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.stretch);
        inputs.push(self.shift);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_BinShift", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// copies low bins from one input and the high bins of the other
pub struct PV_BinWipe {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
    wipe: UGenInput,
}

impl PV_BinWipe {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
            wipe: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// can range between -1 and +1; if wipe == 0 then the output is the same as inA;
    /// if wipe > 0 then it begins replacing with bins from inB from the bottom up;if
    /// wipe < 0 then it begins replacing with bins from inB from the top down.
    pub fn wipe(mut self, v: impl Into<UGenInput>) -> Self {
        self.wipe = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        inputs.push(self.wipe);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_BinWipe", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// clears bins above or below a cutoff point
pub struct PV_BrickWall {
    _rate: Rate,
    buffer: UGenInput,
    wipe: UGenInput,
}

impl PV_BrickWall {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            wipe: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// can range between -1 and +1. if wipe == 0 then there is no effect; if wipe > 0
    /// then it acts like a high pass filter, clearing bins from the bottom up; if
    /// wipe < 0 then it acts like a low pass filter, clearing bins from the top down.
    pub fn wipe(mut self, v: impl Into<UGenInput>) -> Self {
        self.wipe = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.wipe);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_BrickWall", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// converts the FFT frames to their complex conjugate (i.e. reverses the sign of
/// their imaginary part). This is not usually a useful audio effect in itself,
/// but may be a component of other analysis or transformation processes...
pub struct PV_Conj {
    _rate: Rate,
    buffer: UGenInput,
}

impl PV_Conj {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Conj", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// copies the spectral frame in bufferA to bufferB at that point in the chain of
/// PV UGens. This allows for parallel processing of spectral data without the
/// need for multiple FFT UGens, and to copy out data at that point in the chain
/// for other purposes. bufferA and bufferB must be the same size.
pub struct PV_Copy {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_Copy {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// source buffer
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// destination buffer
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Copy", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// combines magnitudes of first input and phases of the second input
pub struct PV_CopyPhase {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_CopyPhase {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_CopyPhase", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// adds a different constant random phase shift to each bin. The trigger will
/// select a new set of random phases.
pub struct PV_Diffuser {
    _rate: Rate,
    buffer: UGenInput,
    trig: UGenInput,
}

impl PV_Diffuser {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// a trigger selects a new set of random values.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Diffuser", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// complex division
pub struct PV_Div {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_Div {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Div", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// passes only bins whose magnitude is above a threshold and above their nearest
/// neighbors
pub struct PV_LocalMax {
    _rate: Rate,
    buffer: UGenInput,
    threshold: UGenInput,
}

impl PV_LocalMax {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            threshold: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// magnitude threshold.
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.threshold);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_LocalMax", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// passes only bins whose magnitude is above a threshold
pub struct PV_MagAbove {
    _rate: Rate,
    buffer: UGenInput,
    threshold: UGenInput,
}

impl PV_MagAbove {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            threshold: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// magnitude threshold.
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.threshold);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagAbove", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// passes only bins whose magnitude is below a threshold
pub struct PV_MagBelow {
    _rate: Rate,
    buffer: UGenInput,
    threshold: UGenInput,
}

impl PV_MagBelow {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            threshold: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// magnitude threshold.
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.threshold);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagBelow", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// clips bin magnitudes to a maximum threshold
pub struct PV_MagClip {
    _rate: Rate,
    buffer: UGenInput,
    threshold: UGenInput,
}

impl PV_MagClip {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            threshold: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// magnitude threshold.
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.threshold);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagClip", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// divides magnitudes of two inputs and keeps the phases of the first input
pub struct PV_MagDiv {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
    zeroed: UGenInput,
}

impl PV_MagDiv {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
            zeroed: UGenInput::Constant(0.0001),
        }
    }

    /// fft buffer A.
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B.
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// number to use when bins are zeroed out, i.e. causing division by zero
    pub fn zeroed(mut self, v: impl Into<UGenInput>) -> Self {
        self.zeroed = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        inputs.push(self.zeroed);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagDiv", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// freezes magnitudes at current levels when freeze > 0
pub struct PV_MagFreeze {
    _rate: Rate,
    buffer: UGenInput,
    freeze: UGenInput,
}

impl PV_MagFreeze {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            freeze: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// if freeze > 0 then magnitudes are frozen at current levels.
    pub fn freeze(mut self, v: impl Into<UGenInput>) -> Self {
        self.freeze = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.freeze);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagFreeze", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// multiplies magnitudes of two inputs and keeps the phases of the first input
pub struct PV_MagMul {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_MagMul {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagMul", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// magnitudes are multiplied with noise
pub struct PV_MagNoise {
    _rate: Rate,
    buffer: UGenInput,
}

impl PV_MagNoise {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagNoise", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// shift and stretch the positions of only the magnitude of the bins. Can be used
/// as a very crude frequency shifter/scaler.
pub struct PV_MagShift {
    _rate: Rate,
    buffer: UGenInput,
    stretch: UGenInput,
    shift: UGenInput,
}

impl PV_MagShift {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            stretch: UGenInput::Constant(1.0),
            shift: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// scale bin location by factor.
    pub fn stretch(mut self, v: impl Into<UGenInput>) -> Self {
        self.stretch = v.into();
        self
    }

    /// add an offset to bin position.
    pub fn shift(mut self, v: impl Into<UGenInput>) -> Self {
        self.shift = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.stretch);
        inputs.push(self.shift);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagShift", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// average a bin's magnitude with its neighbors
pub struct PV_MagSmear {
    _rate: Rate,
    buffer: UGenInput,
    bins: UGenInput,
}

impl PV_MagSmear {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            bins: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// number of bins to average on each side of bin. As this number rises, so will
    /// CPU usage.
    pub fn bins(mut self, v: impl Into<UGenInput>) -> Self {
        self.bins = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.bins);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagSmear", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// squares the magnitudes and renormalizes to previous peak. This makes weak bins
/// weaker.
pub struct PV_MagSquared {
    _rate: Rate,
    buffer: UGenInput,
}

impl PV_MagSquared {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_MagSquared", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// output copies bins with the maximum magnitude of the two inputs
pub struct PV_Max {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_Max {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Max", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// output copies bins with the minimum magnitude of the two inputs
pub struct PV_Min {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_Min {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Min", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// complex multiplication: (RealA * RealB) - (ImagA * ImagB) (ImagA * RealB) +
/// (RealA * ImagB)
pub struct PV_Mul {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
}

impl PV_Mul {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_Mul", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// shift phase of all bins
pub struct PV_PhaseShift {
    _rate: Rate,
    buffer: UGenInput,
    shift: UGenInput,
}

impl PV_PhaseShift {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            shift: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// phase shift in radians
    pub fn shift(mut self, v: impl Into<UGenInput>) -> Self {
        self.shift = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.shift);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_PhaseShift", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// shift phase of all bins by 270 degrees
pub struct PV_PhaseShift270 {
    _rate: Rate,
    buffer: UGenInput,
}

impl PV_PhaseShift270 {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_PhaseShift270", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// shift phase of all bins by 90 degrees
pub struct PV_PhaseShift90 {
    _rate: Rate,
    buffer: UGenInput,
}

impl PV_PhaseShift90 {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_PhaseShift90", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// randomly clear bins
pub struct PV_RandComb {
    _rate: Rate,
    buffer: UGenInput,
    wipe: UGenInput,
    trig: UGenInput,
}

impl PV_RandComb {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            wipe: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// clears bins from input in a random order as wipe goes from 0 to 1.
    pub fn wipe(mut self, v: impl Into<UGenInput>) -> Self {
        self.wipe = v.into();
        self
    }

    /// a trigger selects a new random ordering.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.wipe);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_RandComb", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// cross fades between two sounds by copying bins in a random order
pub struct PV_RandWipe {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
    wipe: UGenInput,
    trig: UGenInput,
}

impl PV_RandWipe {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
            wipe: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// fft buffer A.
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B.
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// copies bins from bufferB in a random order as wipe goes from 0 to 1.
    pub fn wipe(mut self, v: impl Into<UGenInput>) -> Self {
        self.wipe = v.into();
        self
    }

    /// a trigger selects a new random ordering.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        inputs.push(self.wipe);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_RandWipe", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// makes a series of gaps in a spectrum
pub struct PV_RectComb {
    _rate: Rate,
    buffer: UGenInput,
    num_teeth: UGenInput,
    phase: UGenInput,
    width: UGenInput,
}

impl PV_RectComb {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            num_teeth: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// fft buffer.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// number of teeth in the comb.
    pub fn num_teeth(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_teeth = v.into();
        self
    }

    /// starting phase of comb pulse.
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// pulse width of comb.
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.num_teeth);
        inputs.push(self.phase);
        inputs.push(self.width);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_RectComb", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// alternates blocks of bins between the two inputs
pub struct PV_RectComb2 {
    _rate: Rate,
    buffer_a: UGenInput,
    buffer_b: UGenInput,
    num_teeth: UGenInput,
    phase: UGenInput,
    width: UGenInput,
}

impl PV_RectComb2 {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer_a: UGenInput::Constant(0.0),
            buffer_b: UGenInput::Constant(0.0),
            num_teeth: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// fft buffer A.
    pub fn buffer_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_a = v.into();
        self
    }

    /// fft buffer B.
    pub fn buffer_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer_b = v.into();
        self
    }

    /// number of teeth in the comb.
    pub fn num_teeth(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_teeth = v.into();
        self
    }

    /// starting phase of comb pulse.
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// pulse width of comb.
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer_a);
        inputs.push(self.buffer_b);
        inputs.push(self.num_teeth);
        inputs.push(self.phase);
        inputs.push(self.width);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_RectComb2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
