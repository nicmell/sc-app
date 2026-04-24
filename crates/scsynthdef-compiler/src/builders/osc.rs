// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Chorusing wavetable lookup oscillator. Produces sum of two signals at (freq
/// +/- (beats / 2)). Due to summing, the peak amplitude is twice that of the
/// wavetable.
pub struct COsc {
    _rate: Rate,
    bufnum: UGenInput,
    freq: UGenInput,
    beats: UGenInput,
}

impl COsc {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            beats: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            beats: UGenInput::Constant(0.5),
        }
    }

    /// The number of a buffer filled in wavetable format
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Beat frequency in Hertz
    pub fn beats(mut self, v: impl Into<UGenInput>) -> Self {
        self.beats = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.freq);
        inputs.push(self.beats);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"COsc", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// the input signal value is truncated to an integer value and used as an index
/// into an octave repeating table of note values (indices wrap around the table)
pub struct DegreeToKey {
    _rate: Rate,
    bufnum: UGenInput,
    r#in: UGenInput,
    octave: UGenInput,
}

impl DegreeToKey {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            octave: UGenInput::Constant(12.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
            octave: UGenInput::Constant(12.0),
        }
    }

    /// Index of the buffer which contains the steps for each scale degree.
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// The input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// The number of steps per octave in the scale. The default is 12.
    pub fn octave(mut self, v: impl Into<UGenInput>) -> Self {
        self.octave = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#in);
        inputs.push(self.octave);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DegreeToKey", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// search a buffer for a value
pub struct DetectIndex {
    _rate: Rate,
    bufnum: UGenInput,
    r#in: UGenInput,
}

impl DetectIndex {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DetectIndex", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Generates a set of harmonics around a formant frequency at a given fundamental
/// frequency. The frequency inputs are read at control rate only, so if you use
/// an audio rate UGen as an input, it will only be sampled at the start of each
/// audio synthesis block.
pub struct Formant {
    _rate: Rate,
    fundfreq: UGenInput,
    formfreq: UGenInput,
    bwfreq: UGenInput,
}

impl Formant {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            fundfreq: UGenInput::Constant(440.0),
            formfreq: UGenInput::Constant(1760.0),
            bwfreq: UGenInput::Constant(880.0),
        }
    }

    /// Fundamental frequency in Hertz (control rate)
    pub fn fundfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.fundfreq = v.into();
        self
    }

    /// Formant frequency in Hertz (control rate)
    pub fn formfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.formfreq = v.into();
        self
    }

    /// Pulse width frequency in Hertz. Controls the bandwidth of the formant (control
    /// rate)
    pub fn bwfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.bwfreq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.fundfreq);
        inputs.push(self.formfreq);
        inputs.push(self.bwfreq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Formant", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// non band limited impulse oscillator. Outputs a single 1 every freq cycles per
/// second and 0 the rest of the time.
pub struct Impulse {
    _rate: Rate,
    freq: UGenInput,
    phase: UGenInput,
}

impl Impulse {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Phase offset in cycles ( 0..1 )
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.phase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Impulse", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// the input signal value is truncated to an integer and used as an index into
/// the table
pub struct Index {
    _rate: Rate,
    bufnum: UGenInput,
    r#in: UGenInput,
}

impl Index {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Index", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// finds the (lowest) point in the buffer at which the input signal lies
/// in-between the two values, and returns the index
pub struct IndexInBetween {
    _rate: Rate,
    bufnum: UGenInput,
    r#in: UGenInput,
}

impl IndexInBetween {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"IndexInBetween", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// an oscillator outputting a sine like shape made of two cubic pieces
pub struct LFCub {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
}

impl LFCub {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial phase offset. For efficiency reasons this is a value ranging from 0 to
    /// 2.
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.iphase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFCub", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A non-band-limited gaussian function oscillator. Output ranges from minval to
/// 1. LFGauss implements the formula: f(x) = exp(squared(x - iphase) / (-2.0 *
/// squared(width))) where x is to vary in the range -1 to 1 over the period dur.
/// minval is the initial value at -1
pub struct LFGauss {
    _rate: Rate,
    duration: UGenInput,
    width: UGenInput,
    iphase: UGenInput,
    r#loop: UGenInput,
    action: UGenInput,
}

impl LFGauss {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            duration: UGenInput::Constant(1.0),
            width: UGenInput::Constant(0.1),
            iphase: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            duration: UGenInput::Constant(1.0),
            width: UGenInput::Constant(0.1),
            iphase: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Duration of one full cycle ( for freq input: dur = 1 / freq )
    pub fn duration(mut self, v: impl Into<UGenInput>) -> Self {
        self.duration = v.into();
        self
    }

    /// Relative width of the bell. Best to keep below 0.25 when used as envelope.
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Initial offset
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// If loop is > 0, UGen oscillates. Otherwise it calls the done action after one
    /// cycle
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// Action to be evaluated after cycle completes. Default: NO-ACTION.
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.duration);
        inputs.push(self.width);
        inputs.push(self.iphase);
        inputs.push(self.r#loop);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFGauss", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non band-limited parabolic oscillator outputing a high of 1 and a low of
/// zero.
pub struct LFPar {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
}

impl LFPar {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial phase offset. For efficiency reasons this is a value ranging from 0 to
    /// 2.
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.iphase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFPar", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A non-band-limited pulse oscillator. Outputs a high value of one and a low
/// value of zero.
pub struct LFPulse {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
    width: UGenInput,
}

impl LFPulse {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial phase offset in cycles ( 0..1 )
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Pulse width duty cycle from zero to one
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.iphase);
        inputs.push(self.width);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFPulse", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// low freq (i.e. not band limited) sawtooth oscillator
pub struct LFSaw {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
}

impl LFSaw {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial phase offset. For efficiency reasons this is a value ranging from 0 to
    /// 2.
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.iphase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFSaw", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a non-band-limited triangle oscillator
/// 
/// The triangle wave shape features two linear slopes and is not as harmonically
/// rich as a sawtooth wave since it only contains odd harmonics (partials).
/// Ideally, this type of wave form is mixed with a sine, square or pulse wave to
/// add a sparkling or bright effect to a sound and is often employed on pads to
/// give them a glittery feel.
pub struct LFTri {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
}

impl LFTri {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial phase offset. For efficiency reasons this is a value ranging from 0 to
    /// 2.
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.iphase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LFTri", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Linear interpolating wavetable lookup oscillator with frequency and phase
/// modulation inputs. This oscillator requires a buffer to be filled with a
/// wavetable format signal. This preprocesses the Signal into a form which can be
/// used efficiently by the Oscillator. The buffer size must be a power of 2. This
/// can be achieved by creating a Buffer object and sending it one of the b_gen
/// messages (sine1, sine2, sine3) with the wavetable flag set to true. This can
/// also be achieved by creating a Signal object and sending it the 'asWavetable'
/// message, saving it to disk, and having the server load it from there.
pub struct Osc {
    _rate: Rate,
    buffer: UGenInput,
    freq: UGenInput,
    phase: UGenInput,
}

impl Osc {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buffer: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Lookup buffer
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Phase offset or modulator in radians
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.freq);
        inputs.push(self.phase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Osc", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// select the output signal from an array of inputs
pub struct Select {
    _rate: Rate,
    which: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl Select {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            which: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            which: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Index of array to select
    pub fn which(mut self, v: impl Into<UGenInput>) -> Self {
        self.which = v.into();
        self
    }

    /// List of ugens to choose from
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.which);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Select", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// performs waveshaping on the input signal by indexing into a table
pub struct Shaper {
    _rate: Rate,
    bufnum: UGenInput,
    r#in: UGenInput,
}

impl Shaper {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Shaper", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Sine table lookup oscillator
/// 
/// Outputs a sine wave with values oscillating between -1 and 1 similar to osc
/// except that the table has already been fixed as a sine table of 8192 entries.
/// Sine waves are often used for creating sub-basses or are mixed with other
/// waveforms to add extra body or bottom end to a sound. They contain no
/// harmonics and consist entirely of the fundamental frequency. This means that
/// they're not suitable for subtractive synthesis i.e. passing through filters
/// such as a hpf or lpf. However, they are useful for additive synthesis i.e.
/// adding multiple sine waves together at different frequencies, amplitudes and
/// phase to create new timbres.
pub struct SinOsc {
    _rate: Rate,
    freq: UGenInput,
    phase: UGenInput,
}

impl SinOsc {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Phase offset or modulator in radians
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.phase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SinOsc", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Sine oscillator with phase modulation feedback
/// 
/// Different feedback values results in a modulation between a sine wave and a
/// sawtooth like wave. Overmodulation causes chaotic oscillation.
pub struct SinOscFB {
    _rate: Rate,
    freq: UGenInput,
    feedback: UGenInput,
}

impl SinOscFB {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            feedback: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            feedback: UGenInput::Constant(0.0),
        }
    }

    /// Frequency of oscillator
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// amplitude of phase feedback in radians
    pub fn feedback(mut self, v: impl Into<UGenInput>) -> Self {
        self.feedback = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.feedback);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SinOscFB", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// hard sync sawtooth wave oscillator
/// 
/// A sawtooth wave that is hard synched to a fundamental pitch. This produces an
/// effect similar to moving formants or pulse width modulation. The sawtooth
/// oscillator has its phase reset when the sync oscillator completes a cycle.
/// This is not a band limited waveform, so it may alias.
pub struct SyncSaw {
    _rate: Rate,
    sync_freq: UGenInput,
    saw_freq: UGenInput,
}

impl SyncSaw {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            sync_freq: UGenInput::Constant(440.0),
            saw_freq: UGenInput::Constant(440.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            sync_freq: UGenInput::Constant(440.0),
            saw_freq: UGenInput::Constant(440.0),
        }
    }

    /// Frequency of the fundamental.
    pub fn sync_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.sync_freq = v.into();
        self
    }

    /// Frequency of the slave synched sawtooth wave. saw-freq should always be
    /// greater than sync-freq.
    pub fn saw_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.saw_freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.sync_freq);
        inputs.push(self.saw_freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SyncSaw", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a variable duty cycle saw wave oscillator
pub struct VarSaw {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
    width: UGenInput,
}

impl VarSaw {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            iphase: UGenInput::Constant(0.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Initial phase offset in cycles ( 0..1 )
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Duty cycle from zero to one. (0 = downward sawtooth, 0.5 = triangle, 1 =
    /// upward sawtooth)
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.iphase);
        inputs.push(self.width);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"VarSaw", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Models a slow frequency modulation.
/// 
/// Vibrato is a slow frequency modulation. Consider the systematic deviation in
/// pitch of a singer around a fundamental frequency, or a violinist whose finger
/// wobbles in position on the fingerboard, slightly tightening and loosening the
/// string to add shimmer to the pitch. There is often also a delay before vibrato
/// is established on a note. This UGen models these processes; by setting more
/// extreme settings, you can get back to the timbres of FM synthesis. You can
/// also add in some noise to the vibrato rate and vibrato size (modulation depth)
/// to make for a more realistic motor pattern. The vibrato output is a waveform
/// based on a squared envelope shape with four stages marking out 0.0 to 1.0, 1.0
/// to 0.0, 0.0 to -1.0, and -1.0 back to 0.0. Vibrato rate determines how quickly
/// you move through these stages.
pub struct Vibrato {
    _rate: Rate,
    freq: UGenInput,
    rate: UGenInput,
    depth: UGenInput,
    delay: UGenInput,
    onset: UGenInput,
    rate_variation: UGenInput,
    depth_variation: UGenInput,
    iphase: UGenInput,
}

impl Vibrato {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            rate: UGenInput::Constant(6.0),
            depth: UGenInput::Constant(0.02),
            delay: UGenInput::Constant(0.0),
            onset: UGenInput::Constant(0.0),
            rate_variation: UGenInput::Constant(0.04),
            depth_variation: UGenInput::Constant(0.1),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            freq: UGenInput::Constant(440.0),
            rate: UGenInput::Constant(6.0),
            depth: UGenInput::Constant(0.02),
            delay: UGenInput::Constant(0.0),
            onset: UGenInput::Constant(0.0),
            rate_variation: UGenInput::Constant(0.04),
            depth_variation: UGenInput::Constant(0.1),
            iphase: UGenInput::Constant(0.0),
        }
    }

    /// Fundamental frequency in Hertz. If the Vibrato UGen is running at audio rate,
    /// this must not be a constant, but an actual audio rate UGen
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Vibrato rate, speed of wobble in Hertz. Note that if this is set to a low
    /// value (and definitely with 0.0), you may never get vibrato back, since the
    /// rate input is only checked at the end of a cycle.
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// Size of vibrato frequency deviation around the fundamental, as a proportion of
    /// the fundamental. 0.02 = 2% of the fundamental.
    pub fn depth(mut self, v: impl Into<UGenInput>) -> Self {
        self.depth = v.into();
        self
    }

    /// Delay before vibrato is established in seconds (a singer tends to attack a
    /// note and then stabilise with vibrato, for instance).
    pub fn delay(mut self, v: impl Into<UGenInput>) -> Self {
        self.delay = v.into();
        self
    }

    /// Transition time in seconds from no vibrato to full vibrato after the initial
    /// delay time.
    pub fn onset(mut self, v: impl Into<UGenInput>) -> Self {
        self.onset = v.into();
        self
    }

    /// Noise on the rate, expressed as a proportion of the rate; can change once per
    /// cycle of vibrato.
    pub fn rate_variation(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate_variation = v.into();
        self
    }

    /// Noise on the depth of modulation, expressed as a proportion of the depth; can
    /// change once per cycle of vibrato. The noise affects independently the up and
    /// the down part of vibrato shape within a cycle.
    pub fn depth_variation(mut self, v: impl Into<UGenInput>) -> Self {
        self.depth_variation = v.into();
        self
    }

    /// Initial phase of vibrato modulation, allowing starting above or below the
    /// fundamental rather than on it.
    pub fn iphase(mut self, v: impl Into<UGenInput>) -> Self {
        self.iphase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.rate);
        inputs.push(self.depth);
        inputs.push(self.delay);
        inputs.push(self.onset);
        inputs.push(self.rate_variation);
        inputs.push(self.depth_variation);
        inputs.push(self.iphase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Vibrato", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A wavetable lookup oscillator which can be swept smoothly across wavetables.
/// All the wavetables must be allocated to the same size. Fractional values of
/// table will interpolate between two adjacent tables. This oscillator requires
/// at least two buffers to be filled with a wavetable format signal. This
/// preprocesses the Signal into a form which can be used efficiently by the
/// Oscillator. The buffer size must be a power of 2.
pub struct VOsc {
    _rate: Rate,
    bufpos: UGenInput,
    freq: UGenInput,
    phase: UGenInput,
}

impl VOsc {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufpos: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufpos: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// Buffer index. Can be swept continuously among adjacent wavetable buffers of
    /// the same size.
    pub fn bufpos(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufpos = v.into();
        self
    }

    /// Frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Phase offset of modulator in radians
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufpos);
        inputs.push(self.freq);
        inputs.push(self.phase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"VOsc", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Three variable wavetable oscillators. A wavetable lookup oscillator which can
/// be swept smoothly across wavetables. All the wavetables must be allocated to
/// the same size. Fractional values of table will interpolate between two
/// adjacent tables. This unit generator contains three oscillators at different
/// frequencies, mixed together. This oscillator requires at least two buffers to
/// be filled with a wavetable format signal. This preprocesses the Signal into a
/// form which can be used efficiently by the Oscillator. The buffer size must be
/// a power of 2.
pub struct VOsc3 {
    _rate: Rate,
    bufpos: UGenInput,
    freq1: UGenInput,
    freq2: UGenInput,
    freq3: UGenInput,
}

impl VOsc3 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufpos: UGenInput::Constant(0.0),
            freq1: UGenInput::Constant(110.0),
            freq2: UGenInput::Constant(220.0),
            freq3: UGenInput::Constant(440.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufpos: UGenInput::Constant(0.0),
            freq1: UGenInput::Constant(110.0),
            freq2: UGenInput::Constant(220.0),
            freq3: UGenInput::Constant(440.0),
        }
    }

    /// Buffer index. Can be swept continuously among adjacent wavetable buffers of
    /// the same size.
    pub fn bufpos(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufpos = v.into();
        self
    }

    /// Frequency in Hertz of first oscillator
    pub fn freq1(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq1 = v.into();
        self
    }

    /// Frequency in Hertz of second oscillator
    pub fn freq2(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq2 = v.into();
        self
    }

    /// Frequency in Hertz of third oscillator
    pub fn freq3(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq3 = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufpos);
        inputs.push(self.freq1);
        inputs.push(self.freq2);
        inputs.push(self.freq3);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"VOsc3", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// the input signal value is truncated to an integer value and used as an index
/// into the table (out of range index values are wrapped)
pub struct WrapIndex {
    _rate: Rate,
    bufnum: UGenInput,
    r#in: UGenInput,
}

impl WrapIndex {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at ir rate (Rate::Scalar).
    pub fn ir() -> Self {
        Self {
            _rate: Rate::Scalar,
            bufnum: UGenInput::Constant(0.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"WrapIndex", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
