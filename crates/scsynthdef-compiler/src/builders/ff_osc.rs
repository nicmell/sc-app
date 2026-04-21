// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Band Limited Impulse generator. All harmonics have equal amplitude. This is
/// the equivalent of buzz in MusicN languages. WARNING: This waveform in its raw
/// form could be damaging to your ears at high amplitudes or for long periods. It
/// is improved from other implementations in that it will crossfade in a control
/// period when the number of harmonics changes, so that there are no audible
/// pops. It also eliminates the divide in the formula by using a 1/sin table
/// (with special precautions taken for 1/0). The lookup tables are linearly
/// interpolated for better quality. Synth-O-Matic (1990) had an impulse generator
/// called blip, hence that name here rather than 'buzz'.
pub struct Blip {
    _rate: Rate,
    freq: UGenInput,
    numharm: UGenInput,
}

impl Blip {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            numharm: UGenInput::Constant(200.0),
        }
    }

    /// Frequency in Hertz (control rate)
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Number of harmonics. This may be lowered internally if it would cause
    /// aliasing.
    pub fn numharm(mut self, v: impl Into<UGenInput>) -> Self {
        self.numharm = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.numharm);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Blip", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Very fast sine wave generator (2 PowerPC instructions per output sample!)
/// implemented using a ringing filter. This generates a much cleaner sine wave
/// than a table lookup oscillator and is a lot faster. However, the amplitude of
/// the wave will vary with frequency. Generally the amplitude will go down as you
/// raise the frequency and go up as you lower the frequency. WARNING: In the
/// current implementation, the amplitude can blow up if the frequency is
/// modulated by certain alternating signals.
pub struct FSinOsc {
    _rate: Rate,
    freq: UGenInput,
    iphase: UGenInput,
}

impl FSinOsc {
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

    /// frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// phase offset or modulator in radians
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
        let idx = def.add_ugen(r"FSinOsc", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Klang is a bank of fixed frequency sine oscillators. Klang is more efficient
/// than creating individual oscillators but offers less flexibility. The specs
/// can't be changed after it has been started. For a modulatable but less
/// efficient version, see dyn-klang.
pub struct Klang {
    _rate: Rate,
    specs: UGenInput,
    freqscale: UGenInput,
    freqoffset: UGenInput,
}

impl Klang {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            specs: UGenInput::Constant(0.0),
            freqscale: UGenInput::Constant(1.0),
            freqoffset: UGenInput::Constant(0.0),
        }
    }

    /// An array of three arrays frequencies, amplitudes and phases: 1) an array of
    /// filter frequencies, 2) an Array of filter amplitudes, or nil. If nil, then
    /// amplitudes default to 1.0, 3) an Array of initial phases, or nil. If nil, then
    /// phases default to 0.0.
    pub fn specs(mut self, v: impl Into<UGenInput>) -> Self {
        self.specs = v.into();
        self
    }

    /// a scale factor multiplied by all frequencies at initialization time.
    pub fn freqscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.freqscale = v.into();
        self
    }

    /// an offset added to all frequencies at initialization time.
    pub fn freqoffset(mut self, v: impl Into<UGenInput>) -> Self {
        self.freqoffset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.specs);
        inputs.push(self.freqscale);
        inputs.push(self.freqoffset);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Klang", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Klank is a bank of fixed frequency resonators which can be used to simulate
/// the resonant modes of an object. Each mode is given a ring time, which is the
/// time for the mode to decay by 60 dB. The specs can't be changed after it has
/// been started. For a modulatable but less efficient version, see dyn-klank.
pub struct Klank {
    _rate: Rate,
    specs: UGenInput,
    input: UGenInput,
    freqscale: UGenInput,
    freqoffset: UGenInput,
    decayscale: UGenInput,
}

impl Klank {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            specs: UGenInput::Constant(0.0),
            input: UGenInput::Constant(0.0),
            freqscale: UGenInput::Constant(1.0),
            freqoffset: UGenInput::Constant(0.0),
            decayscale: UGenInput::Constant(1.0),
        }
    }

    /// An array of three arrays: frequencies, amplitudes and ring times: *all arrays
    /// should have the same length* 1) an Array of filter frequencies. 2) an Array of
    /// filter amplitudes, or nil. If nil, then amplitudes default to 1.0 3) an Array
    /// of 60 dB decay times for the filters.
    pub fn specs(mut self, v: impl Into<UGenInput>) -> Self {
        self.specs = v.into();
        self
    }

    /// the excitation input to the resonant filter bank.
    pub fn input(mut self, v: impl Into<UGenInput>) -> Self {
        self.input = v.into();
        self
    }

    /// a scale factor multiplied by all frequencies at initialization time.
    pub fn freqscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.freqscale = v.into();
        self
    }

    /// an offset added to all frequencies at initialization time.
    pub fn freqoffset(mut self, v: impl Into<UGenInput>) -> Self {
        self.freqoffset = v.into();
        self
    }

    /// a scale factor multiplied by all ring times at initialization time.
    pub fn decayscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.decayscale = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.specs);
        inputs.push(self.input);
        inputs.push(self.freqscale);
        inputs.push(self.freqoffset);
        inputs.push(self.decayscale);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Klank", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Fixed frequency sine oscillator this ugen uses a very fast algorithm for
/// generating a sine wave at a fixed frequency
pub struct PSinGrain {
    _rate: Rate,
    freq: UGenInput,
    dur: UGenInput,
    amp: UGenInput,
}

impl PSinGrain {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            dur: UGenInput::Constant(0.2),
            amp: UGenInput::Constant(1.0),
        }
    }

    /// frequency in cycles per second. Must be a scalar
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// grain duration
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// amplitude of grain
    pub fn amp(mut self, v: impl Into<UGenInput>) -> Self {
        self.amp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.dur);
        inputs.push(self.amp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PSinGrain", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// band limited pulse wave generator with pulse width modulation.
/// 
/// Pulse waves are a general form of square wave that allow for the width of the
/// pulses to be varied. A square wave is therefore a pulse with a width of 0.5
/// i.e. the width of the high and low states is identical. Adjusting the ratio of
/// the pulse width will vary the harmonic content of the sound. For example,
/// reductions in the width allow you to produce thin reed-like timbres along with
/// the wide, hollow sounds created by a square wave.
pub struct Pulse {
    _rate: Rate,
    freq: UGenInput,
    width: UGenInput,
}

impl Pulse {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
            width: UGenInput::Constant(0.5),
        }
    }

    /// Frequency in Hertz (control rate)
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Pulse width ratio from zero to one. 0.5 makes a square wave (control rate)
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.freq);
        inputs.push(self.width);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Pulse", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// band limited sawtooth wave generator
/// 
/// The sawtooth wave produces even and odd harmonics in series and therefore
/// produces a bright sound that is an excellent starting point for brassy, raspy
/// sounds. It's also suitable for creating the gritty, bright sounds needed for
/// leads and raspy basses. Due to its harmonic richness it's extremely suitable
/// for use with sounds that will be filter swept.
pub struct Saw {
    _rate: Rate,
    freq: UGenInput,
}

impl Saw {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            freq: UGenInput::Constant(440.0),
        }
    }

    /// Frequency in Hertz (control rate).
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
        let idx = def.add_ugen(r"Saw", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
