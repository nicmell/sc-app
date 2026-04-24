// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Granular synthesis with sound stored in a buffer
pub struct GrainBuf {
    _rate: Rate,
    trigger: UGenInput,
    dur: UGenInput,
    sndbuf: UGenInput,
    rate: UGenInput,
    pos: UGenInput,
    interp: UGenInput,
    pan: UGenInput,
    envbufnum: UGenInput,
    max_grains: UGenInput,
    num_channels: u32,
}

impl GrainBuf {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trigger: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(1.0),
            sndbuf: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            pos: UGenInput::Constant(1.0),
            interp: UGenInput::Constant(2.0),
            pan: UGenInput::Constant(0.0),
            envbufnum: UGenInput::Constant(-1.0),
            max_grains: UGenInput::Constant(512.0),
            num_channels: 1,
        }
    }

    /// a kr or ar trigger to start a new grain. If ar, grains after the start of the
    /// synth are sample accurate.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of the grain (in seconds).
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// the buffer holding a mono audio signal. If using multi-channel files, use
    /// Buffer.readChannel.
    pub fn sndbuf(mut self, v: impl Into<UGenInput>) -> Self {
        self.sndbuf = v.into();
        self
    }

    /// the playback rate of the sampled sound
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// the playback position for the grain to start with (0 is beginning, 1 is end of
    /// file)
    pub fn pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.pos = v.into();
        self
    }

    /// the interpolation method used for pitchshifting grains: 1 = no interpolation 2
    /// = linear 4 = cubic interpolation (more computationally intensive)
    pub fn interp(mut self, v: impl Into<UGenInput>) -> Self {
        self.interp = v.into();
        self
    }

    /// Determines where to pan the output. If num-channels = 1, no panning is done;
    /// if num-channels = 2, panning is similar to Pan2; if num-channels > 2, pannins
    /// is the same as PanAz.
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// the buffer number containing a singal to use for the grain envelope. -1 uses a
    /// built-in Hanning envelope.
    pub fn envbufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.envbufnum = v.into();
        self
    }

    /// the maximum number of overlapping grains that can be used at a given time.
    /// This value is set at the UGens init time and can't be modified. This can be
    /// set lower for more efficient use of memory.
    pub fn max_grains(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_grains = v.into();
        self
    }

    /// the number of channels to output. If 1, mono is returned and pan is ignored.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trigger);
        inputs.push(self.dur);
        inputs.push(self.sndbuf);
        inputs.push(self.rate);
        inputs.push(self.pos);
        inputs.push(self.interp);
        inputs.push(self.pan);
        inputs.push(self.envbufnum);
        inputs.push(self.max_grains);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"GrainBuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Granular synthesis with frequency modulated sine tones
pub struct GrainFM {
    _rate: Rate,
    trigger: UGenInput,
    dur: UGenInput,
    car_freq: UGenInput,
    mod_freq: UGenInput,
    index: UGenInput,
    pan: UGenInput,
    envbufnum: UGenInput,
    max_grains: UGenInput,
    num_channels: u32,
}

impl GrainFM {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trigger: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(1.0),
            car_freq: UGenInput::Constant(440.0),
            mod_freq: UGenInput::Constant(440.0),
            index: UGenInput::Constant(1.0),
            pan: UGenInput::Constant(0.0),
            envbufnum: UGenInput::Constant(-1.0),
            max_grains: UGenInput::Constant(512.0),
            num_channels: 1,
        }
    }

    /// a kr or ar trigger to start a new grain. If ar, grains after the start of the
    /// synth are sample accurate.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of the grain.
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// the frequency of the FM grain's carrier oscillator
    pub fn car_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.car_freq = v.into();
        self
    }

    /// the frequency of the FM grain's modulating oscillator
    pub fn mod_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.mod_freq = v.into();
        self
    }

    /// the FM index
    pub fn index(mut self, v: impl Into<UGenInput>) -> Self {
        self.index = v.into();
        self
    }

    /// Determines where to pan the output. If num-channels = 1, no panning is done;
    /// if num-channels = 2, panning is similar to Pan2; if numChannels > 2, pannins
    /// is the same as PanAz.
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// the buffer number containing a singal to use for the grain envelope. -1 uses a
    /// built-in Hanning envelope.
    pub fn envbufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.envbufnum = v.into();
        self
    }

    /// the maximum number of overlapping grains that can be used at a given time.
    /// This value is set at the UGens init time and can't be modified. This can be
    /// set lower for more efficient use of memory.
    pub fn max_grains(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_grains = v.into();
        self
    }

    /// the number of channels to output. If 1, mono is returned and pan is ignored.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trigger);
        inputs.push(self.dur);
        inputs.push(self.car_freq);
        inputs.push(self.mod_freq);
        inputs.push(self.index);
        inputs.push(self.pan);
        inputs.push(self.envbufnum);
        inputs.push(self.max_grains);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"GrainFM", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Granulate an input signal
pub struct GrainIn {
    _rate: Rate,
    trigger: UGenInput,
    dur: UGenInput,
    r#in: UGenInput,
    pan: UGenInput,
    envbufnum: UGenInput,
    max_grains: UGenInput,
    num_channels: u32,
}

impl GrainIn {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trigger: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(1.0),
            r#in: UGenInput::Constant(0.0),
            pan: UGenInput::Constant(0.0),
            envbufnum: UGenInput::Constant(-1.0),
            max_grains: UGenInput::Constant(512.0),
            num_channels: 1,
        }
    }

    /// a kr or ar trigger to start a new grain. If ar, grains after the start of the
    /// synth are sample accurate.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of the grain.
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// the input to granulate
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Determines where to pan the output. If num-channels = 1, no panning is done;
    /// if num-channels = 2, panning is similar to Pan2; if num-channels > 2, pannins
    /// is the same as PanAz.
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// the buffer number containing a singal to use for the grain envelope. -1 uses a
    /// built-in Hanning envelope.
    pub fn envbufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.envbufnum = v.into();
        self
    }

    /// the maximum number of overlapping grains that can be used at a given time.
    /// This value is set at the UGens init time and can't be modified. This can be
    /// set lower for more efficient use of memory.
    pub fn max_grains(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_grains = v.into();
        self
    }

    /// the number of channels to output. If 1, mono is returned and pan is ignored.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trigger);
        inputs.push(self.dur);
        inputs.push(self.r#in);
        inputs.push(self.pan);
        inputs.push(self.envbufnum);
        inputs.push(self.max_grains);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"GrainIn", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Granular synthesis with sine tones
pub struct GrainSin {
    _rate: Rate,
    trigger: UGenInput,
    dur: UGenInput,
    freq: UGenInput,
    pan: UGenInput,
    envbufnum: UGenInput,
    max_grains: UGenInput,
    num_channels: u32,
}

impl GrainSin {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trigger: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(1.0),
            freq: UGenInput::Constant(440.0),
            pan: UGenInput::Constant(0.0),
            envbufnum: UGenInput::Constant(-1.0),
            max_grains: UGenInput::Constant(512.0),
            num_channels: 1,
        }
    }

    /// a kr or ar trigger to start a new grain. If ar, grains after the start of the
    /// synth are sample accurate.
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of the grain.
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// the frequency of the grain's oscillator
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Determines where to pan the output. If num-channels = 1, no panning is done;
    /// if num-channels = 2, panning is similar to Pan2; if numChannels > 2, pannins
    /// is the same as PanAz.
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// the buffer number containing a singal to use for the grain envelope. -1 uses a
    /// built-in Hanning envelope.
    pub fn envbufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.envbufnum = v.into();
        self
    }

    /// the maximum number of overlapping grains that can be used at a given time.
    /// This value is set at the UGens init time and can't be modified. This can be
    /// set lower for more efficient use of memory.
    pub fn max_grains(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_grains = v.into();
        self
    }

    /// the number of channels to output. If 1, mono is returned and pan is ignored.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trigger);
        inputs.push(self.dur);
        inputs.push(self.freq);
        inputs.push(self.pan);
        inputs.push(self.envbufnum);
        inputs.push(self.max_grains);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"GrainSin", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A granular time stretcher and pitchshifter. Inspired by Chad Kirby's
/// SuperCollider2 Warp1 class, which was inspired by Richard Karpen's sndwarp for
/// CSound.
pub struct Warp1 {
    _rate: Rate,
    bufnum: UGenInput,
    pointer: UGenInput,
    freq_scale: UGenInput,
    window_size: UGenInput,
    envbufnum: UGenInput,
    overlaps: UGenInput,
    window_rand_ratio: UGenInput,
    interp: UGenInput,
    num_channels: u32,
}

impl Warp1 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            pointer: UGenInput::Constant(0.0),
            freq_scale: UGenInput::Constant(1.0),
            window_size: UGenInput::Constant(0.1),
            envbufnum: UGenInput::Constant(-1.0),
            overlaps: UGenInput::Constant(8.0),
            window_rand_ratio: UGenInput::Constant(0.0),
            interp: UGenInput::Constant(1.0),
            num_channels: 1,
        }
    }

    /// the buffer number of a mono soundfile.
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// the position in the buffer. The value should be between 0 and 1, with 0 being
    /// the begining of the buffer, and 1 the end.
    pub fn pointer(mut self, v: impl Into<UGenInput>) -> Self {
        self.pointer = v.into();
        self
    }

    /// the amount of frequency shift. 1.0 is normal, 0.5 is one octave down, 2.0 is
    /// one octave up. Negative values play the soundfile backwards.
    pub fn freq_scale(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq_scale = v.into();
        self
    }

    /// the size of each grain window.
    pub fn window_size(mut self, v: impl Into<UGenInput>) -> Self {
        self.window_size = v.into();
        self
    }

    /// the buffer number containing a singal to use for the grain envelope. -1 uses a
    /// built-in Hanning envelope.
    pub fn envbufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.envbufnum = v.into();
        self
    }

    /// the number of overlaping windows.
    pub fn overlaps(mut self, v: impl Into<UGenInput>) -> Self {
        self.overlaps = v.into();
        self
    }

    /// the amount of randomness to the windowing function. Must be between 0 (no
    /// randomness) to 1.0 (probably to random actually)
    pub fn window_rand_ratio(mut self, v: impl Into<UGenInput>) -> Self {
        self.window_rand_ratio = v.into();
        self
    }

    /// the interpolation method used for pitchshifting grains. 1 = no interpolation.
    /// 2 = linear. 4 = cubic interpolation (more computationally intensive).
    pub fn interp(mut self, v: impl Into<UGenInput>) -> Self {
        self.interp = v.into();
        self
    }

    /// the number of channels in the soundfile used in bufnum.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.pointer);
        inputs.push(self.freq_scale);
        inputs.push(self.window_size);
        inputs.push(self.envbufnum);
        inputs.push(self.overlaps);
        inputs.push(self.window_rand_ratio);
        inputs.push(self.interp);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"Warp1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
