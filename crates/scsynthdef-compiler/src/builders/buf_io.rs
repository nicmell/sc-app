// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Read the contents of a buffer at a specified index
/// 
/// reads the contents of a buffer at a given index.
pub struct BufRd {
    _rate: Rate,
    bufnum: UGenInput,
    phase: UGenInput,
    r#loop: UGenInput,
    interpolation: UGenInput,
    num_channels: u32,
}

impl BufRd {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(1.0),
            interpolation: UGenInput::Constant(2.0),
            num_channels: 1,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(1.0),
            interpolation: UGenInput::Constant(2.0),
            num_channels: 1,
        }
    }

    /// The index of the buffer to use
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// Audio rate modulatable index into the buffer. Warning: The phase argument only
    /// offers precision for addressing 2**24 samples (about 6.3 minutes at 44100Hz)
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// 1 means true, 0 means false. This is modulatable.
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// 1 means no interpolation, 2 is linear, 4 is cubic interpolation
    pub fn interpolation(mut self, v: impl Into<UGenInput>) -> Self {
        self.interpolation = v.into();
        self
    }

    /// The number of channels of the supplied buffer. This must be a fixed integer
    /// and not a signal or a control proxy. The architecture of the synth design
    /// cannot change after it is compiled. (Warning: if you supply a bufnum of a
    /// buffer that has a different number of channels than you have specified to
    /// buf-rd , it will fail silently).
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.phase);
        inputs.push(self.r#loop);
        inputs.push(self.interpolation);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"BufRd", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// writes to a buffer at a given index. Note, buf-wr (in difference to buf-rd)
/// does not do multichannel expansion, because input is an array.
pub struct BufWr {
    _rate: Rate,
    bufnum: UGenInput,
    phase: UGenInput,
    r#loop: UGenInput,
    input_array: Vec<UGenInput>,
}

impl BufWr {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(1.0),
            input_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(1.0),
            input_array: Vec::new(),
        }
    }

    /// the index of the buffer to use
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// modulatable index into the buffer (has to be audio rate).
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// 1 means true, 0 means false. This is modulatable
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// input ugens (channelArray)
    pub fn input_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.input_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.phase);
        inputs.push(self.r#loop);
        inputs.extend(self.input_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BufWr", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct ClearBuf {
    _rate: Rate,
    buf: UGenInput,
}

impl ClearBuf {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            buf: UGenInput::Constant(0.0),
        }
    }

    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"ClearBuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct LocalBuf {
    _rate: Rate,
    num_frames: UGenInput,
    num_channels: u32,
}

impl LocalBuf {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            num_frames: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    pub fn num_frames(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_frames = v.into();
        self
    }

    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.num_frames);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"LocalBuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct MaxLocalBufs {
    _rate: Rate,
    num_local_bufs: UGenInput,
}

impl MaxLocalBufs {
    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            num_local_bufs: UGenInput::Constant(0.0),
        }
    }

    pub fn num_local_bufs(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_local_bufs = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.num_local_bufs);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MaxLocalBufs", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Plays back a sample resident in a buffer
pub struct PlayBuf {
    _rate: Rate,
    bufnum: UGenInput,
    rate: UGenInput,
    trigger: UGenInput,
    start_pos: UGenInput,
    r#loop: UGenInput,
    action: UGenInput,
    num_channels: u32,
}

impl PlayBuf {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            trigger: UGenInput::Constant(1.0),
            start_pos: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(0.0),
            action: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            trigger: UGenInput::Constant(1.0),
            start_pos: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(0.0),
            action: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// The index of the buffer to use.
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// 1.0 is the server's sample rate, 2.0 is one octave up, 0.5 is one octave down
    /// -1.0 is backwards normal rate ... etc. Interpolation is cubic. Note: if the
    /// buffer's sample rate is different from the server's, you will need to multiply
    /// the desired playback rate by (file's rate / server's rate). The UGen
    /// (buf-rate-scale bufnum) returns this factor.
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// A trigger causes a jump to the startPos. A trigger occurs when a signal
    /// changes from <= 0 to > 0.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// Sample frame to start playback.
    pub fn start_pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.start_pos = v.into();
        self
    }

    /// 1 means true, 0 means false. This is modulateable.
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// an integer representing an action to be executed when the buffer is finished
    /// playing. This can be used to free the enclosing synth. Action is only
    /// evaluated if loop is 0
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// The number of channels that the buffer will be. This must be a fixed integer.
    /// The architechture of the SynthDef cannot change after it is compiled. Warning:
    /// if you supply a bufnum of a buffer that has a different numChannels then you
    /// have specified to the play-buf, it will fail silently.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.rate);
        inputs.push(self.trigger);
        inputs.push(self.start_pos);
        inputs.push(self.r#loop);
        inputs.push(self.action);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"PlayBuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// record a stream of values into a buffer. If recLevel is 1.0 and preLevel is
/// 0.0 then the new input overwrites the old data. If they are both 1.0 then the
/// new data is added to the existing data. (Any other settings are also valid.)
/// Note that the number of channels must be fixed for the defsynth, it cannot
/// vary depending on which buffer you use.
pub struct RecordBuf {
    _rate: Rate,
    bufnum: UGenInput,
    offset: UGenInput,
    rec_level: UGenInput,
    pre_level: UGenInput,
    run: UGenInput,
    r#loop: UGenInput,
    trigger: UGenInput,
    action: UGenInput,
    input_array: Vec<UGenInput>,
}

impl RecordBuf {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            offset: UGenInput::Constant(0.0),
            rec_level: UGenInput::Constant(1.0),
            pre_level: UGenInput::Constant(0.0),
            run: UGenInput::Constant(1.0),
            r#loop: UGenInput::Constant(1.0),
            trigger: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
            input_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            offset: UGenInput::Constant(0.0),
            rec_level: UGenInput::Constant(1.0),
            pre_level: UGenInput::Constant(0.0),
            run: UGenInput::Constant(1.0),
            r#loop: UGenInput::Constant(1.0),
            trigger: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
            input_array: Vec::new(),
        }
    }

    /// the index of the buffer to use
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// an offset into the buffer in frames,
    pub fn offset(mut self, v: impl Into<UGenInput>) -> Self {
        self.offset = v.into();
        self
    }

    /// value to multiply by input before mixing with existing data.
    pub fn rec_level(mut self, v: impl Into<UGenInput>) -> Self {
        self.rec_level = v.into();
        self
    }

    /// value to multiply to existing data in buffer before mixing with input
    pub fn pre_level(mut self, v: impl Into<UGenInput>) -> Self {
        self.pre_level = v.into();
        self
    }

    /// If zero, then recording stops, otherwise recording proceeds.
    pub fn run(mut self, v: impl Into<UGenInput>) -> Self {
        self.run = v.into();
        self
    }

    /// If zero then don't loop, otherwise do. This is modulate-able.
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// a trigger causes a jump to the offset position in the Buffer. A trigger occurs
    /// when a signal changes from <= 0 to > 0.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// an integer representing an action to be executed when the buffer is finished
    /// playing. This can be used to free the enclosing synth. Action is only
    /// evaluated if loop is 0
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// an Array of input channels
    pub fn input_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.input_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.offset);
        inputs.push(self.rec_level);
        inputs.push(self.pre_level);
        inputs.push(self.run);
        inputs.push(self.r#loop);
        inputs.push(self.trigger);
        inputs.push(self.action);
        inputs.extend(self.input_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RecordBuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct ScopeOut {
    _rate: Rate,
    bufnum: UGenInput,
    input_array: Vec<UGenInput>,
}

impl ScopeOut {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            input_array: Vec::new(),
        }
    }

    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn input_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.input_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.extend(self.input_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ScopeOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct ScopeOut2 {
    _rate: Rate,
    scope_num: UGenInput,
    max_frames: UGenInput,
    scope_frames: UGenInput,
    input_array: Vec<UGenInput>,
}

impl ScopeOut2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            scope_num: UGenInput::Constant(0.0),
            max_frames: UGenInput::Constant(4096.0),
            scope_frames: UGenInput::Constant(4096.0),
            input_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            scope_num: UGenInput::Constant(0.0),
            max_frames: UGenInput::Constant(4096.0),
            scope_frames: UGenInput::Constant(4096.0),
            input_array: Vec::new(),
        }
    }

    pub fn scope_num(mut self, v: impl Into<UGenInput>) -> Self {
        self.scope_num = v.into();
        self
    }

    pub fn max_frames(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_frames = v.into();
        self
    }

    pub fn scope_frames(mut self, v: impl Into<UGenInput>) -> Self {
        self.scope_frames = v.into();
        self
    }

    pub fn input_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.input_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.scope_num);
        inputs.push(self.max_frames);
        inputs.push(self.scope_frames);
        inputs.extend(self.input_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ScopeOut2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct SetBuf {
    _rate: Rate,
    buf: UGenInput,
    values: UGenInput,
    offset: UGenInput,
}

impl SetBuf {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buf: UGenInput::Constant(0.0),
            values: UGenInput::Constant(0.0),
            offset: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buf: UGenInput::Constant(0.0),
            values: UGenInput::Constant(0.0),
            offset: UGenInput::Constant(0.0),
        }
    }

    pub fn buf(mut self, v: impl Into<UGenInput>) -> Self {
        self.buf = v.into();
        self
    }

    pub fn values(mut self, v: impl Into<UGenInput>) -> Self {
        self.values = v.into();
        self
    }

    pub fn offset(mut self, v: impl Into<UGenInput>) -> Self {
        self.offset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buf);
        inputs.push(self.values);
        inputs.push(self.offset);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"SetBuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// sample playback from a buffer with fine control for doing granular synthesis.
/// Triggers generate grains from a single channel (mono) buffer. Each grain has a
/// Hann envelope (sin^2(x) for x from 0 to pi) and is panned between two channels
/// of multiple outputs.
pub struct TGrains {
    _rate: Rate,
    trigger: UGenInput,
    bufnum: UGenInput,
    rate: UGenInput,
    center_pos: UGenInput,
    dur: UGenInput,
    pan: UGenInput,
    amp: UGenInput,
    interp: UGenInput,
    num_channels: u32,
}

impl TGrains {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trigger: UGenInput::Constant(0.0),
            bufnum: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            center_pos: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
            pan: UGenInput::Constant(0.0),
            amp: UGenInput::Constant(0.1),
            interp: UGenInput::Constant(4.0),
            num_channels: 2,
        }
    }

    /// at each trigger, the following arguments are sampled and used as the arguments
    /// of a new grain. A trigger occurs when a signal changes from <= 0 to > 0. If
    /// the trigger is audio rate then the grains will start with sample accuracy.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// the index of the buffer to use. It must be a one channel (mono) buffer.
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// 1.0 is normal, 2.0 is one octave up, 0.5 is one octave down -1.0 is backwards
    /// normal rate. Unlike PlayBuf, the rate is multiplied by BufRate, so you needn't
    /// do that yourself.
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// the position in the buffer in seconds at which the grain envelope will reach
    /// maximum amplitude.
    pub fn center_pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.center_pos = v.into();
        self
    }

    /// duration of the grain in seconds
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// a value from -1 to 1. Determines where to pan the output in the same manner as
    /// PanAz.
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// amplitude of the grain.
    pub fn amp(mut self, v: impl Into<UGenInput>) -> Self {
        self.amp = v.into();
        self
    }

    /// 1,2,or 4. Determines whether the grain uses (1) no interpolation, (2) linear
    /// interpolation, or (4) cubic interpolation.
    pub fn interp(mut self, v: impl Into<UGenInput>) -> Self {
        self.interp = v.into();
        self
    }

    /// number of output channels
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trigger);
        inputs.push(self.bufnum);
        inputs.push(self.rate);
        inputs.push(self.center_pos);
        inputs.push(self.dur);
        inputs.push(self.pan);
        inputs.push(self.amp);
        inputs.push(self.interp);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"TGrains", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
