// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// current number of channels of soundfile in buffer
pub struct BufChannels {
    _rate: Rate,
    buf: UGenInput,
}

impl BufChannels {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// a buffer
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufChannels", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the current duration of a buffer in seconds.
pub struct BufDur {
    _rate: Rate,
    buf: UGenInput,
}

impl BufDur {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// a buffer
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufDur", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the current number of allocated frames i.e. the size of the buffer.
/// This is the equivalent of Clojure's count on a seq.
pub struct BufFrames {
    _rate: Rate,
    buf: UGenInput,
}

impl BufFrames {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// a buffer
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufFrames", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns a ratio by which the playback of a buffer is to be scaled
pub struct BufRateScale {
    _rate: Rate,
    buf: UGenInput,
}

impl BufRateScale {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// a buffer
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufRateScale", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the buffers current sample rate
pub struct BufSampleRate {
    _rate: Rate,
    buf: UGenInput,
}

impl BufSampleRate {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// a buffer
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufSampleRate", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// current number of samples allocated in the buffer
pub struct BufSamples {
    _rate: Rate,
    buf: UGenInput,
}

impl BufSamples {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    /// a buffer
    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufSamples", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// test for infinity, not-a-number, and denormals. If one of these is found, it
/// posts a warning. Its output is as follows: 0 = a normal float, 1 = NaN, 2 =
/// infinity, and 3 = a denormal.
pub struct CheckBadValues {
    _rate: Rate,
    r#in: UGenInput,
    id: UGenInput,
    post: UGenInput,
}

impl CheckBadValues {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            id: UGenInput::Constant(0.0),
            post: UGenInput::Constant(2.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            r#in: UGenInput::Constant(0.0),
            id: UGenInput::Constant(0.0),
            post: UGenInput::Constant(2.0),
        }
    }

    /// the UGen whose output is to be tested
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// an id number to identify this UGen.
    pub fn id(mut self, v: impl Into<UGenInput>) -> Self {
        self.id = v.into();
        self
    }

    /// One of three post modes: 0 = no posting; 1 = post a line for every bad value;
    /// 2 = post a line only when the floating-point classification changes (e.g.,
    /// normal -> NaN and vice versa)
    pub fn post(mut self, v: impl Into<UGenInput>) -> Self {
        self.post = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.id);
        inputs.push(self.post);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"CheckBadValues", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the current control rate block duration of the server in seconds
pub struct ControlDur {
    _rate: Rate,
}

impl ControlDur {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ControlDur", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the current control rate of the server
pub struct ControlRate {
    _rate: Rate,
}

impl ControlRate {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ControlRate", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the number of audio buses allocated on the server.
pub struct NumAudioBuses {
    _rate: Rate,
}

impl NumAudioBuses {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"NumAudioBuses", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the number of buffers allocated on the server
pub struct NumBuffers {
    _rate: Rate,
}

impl NumBuffers {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"NumBuffers", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the number of control buses allocated on the server
pub struct NumControlBuses {
    _rate: Rate,
}

impl NumControlBuses {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"NumControlBuses", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the number of input buses allocated on the server. This is the number
/// of hardware inputs provided by the host machine such as a mic.
pub struct NumInputBuses {
    _rate: Rate,
}

impl NumInputBuses {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"NumInputBuses", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the number of output buses allocated on the server. This is the number
/// of hardware outputs provided by the host machine such as left and right
/// speakers.
pub struct NumOutputBuses {
    _rate: Rate,
}

impl NumOutputBuses {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"NumOutputBuses", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the number of currently running synths
pub struct NumRunningSynths {
    _rate: Rate,
}

impl NumRunningSynths {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
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
        let idx = def.add_ugen(r"NumRunningSynths", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// poll cgen instead.
pub struct Poll {
    _rate: Rate,
    trig: UGenInput,
    r#in: UGenInput,
    label: UGenInput,
    trig_id: UGenInput,
}

impl Poll {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            label: UGenInput::Constant(0.0),
            trig_id: UGenInput::Constant(-1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            label: UGenInput::Constant(0.0),
            trig_id: UGenInput::Constant(-1.0),
        }
    }

    /// a non-positive to positive transition telling Poll to return a value
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// the signal you want to poll
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// a string or symbol to be printed with the polled value
    pub fn label(mut self, v: impl Into<UGenInput>) -> Self {
        self.label = v.into();
        self
    }

    /// if greater than 0, a '/tr' message is sent back to the client (similar to
    /// send-trig)
    pub fn trig_id(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig_id = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.r#in);
        inputs.push(self.label);
        inputs.push(self.trig_id);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Poll", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct RadiansPerSample {
    _rate: Rate,
}

impl RadiansPerSample {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RadiansPerSample", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the current sample duration of the server in seconds
pub struct SampleDur {
    _rate: Rate,
}

impl SampleDur {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SampleDur", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the current sample rate
pub struct SampleRate {
    _rate: Rate,
}

impl SampleRate {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SampleRate", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// offset from synth start within one sample
pub struct SubsampleOffset {
    _rate: Rate,
}

impl SubsampleOffset {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
        }
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SubsampleOffset", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
