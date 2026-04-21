// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

pub struct APF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    radius: UGenInput,
}

impl APF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            radius: UGenInput::Constant(0.8),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            radius: UGenInput::Constant(0.8),
        }
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    pub fn radius(mut self, v: impl Into<UGenInput>) -> Self {
        self.radius = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.radius);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"APF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// second order Butterworth bandpass filter
/// 
/// A band pass filter permits the frequencies around a specified centre frequency
/// to pass unaltered through the filter while the frequencies either side are
/// attenuated. The frequencies that pass through are known as the bandwidth or
/// the band pass of the filter. Used to create timbres consisting of fizzy
/// harmonics, lo-fi qualities or very thin sounds that may form the basis of
/// sound effects.
pub struct BPF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl BPF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// centre frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq
    pub fn rq(mut self, v: impl Into<UGenInput>) -> Self {
        self.rq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.rq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BPF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// two zero fixed midpass which cuts out 0 Hz and the Nyquist frequency.
/// Implements the formula: out(i) = 0.5 * (in(i) - in(i-2))
pub struct BPZ2 {
    _rate: Rate,
    r#in: UGenInput,
}

impl BPZ2 {
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
        let idx = def.add_ugen(r"BPZ2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// second order Butterworth band reject filter
/// 
/// Band reject filters, also known as notch filters, attenuate a selected range
/// of frequencies effectively creating a notch in the sound. This type of filter
/// is handy for scooping out frequencies, thinning out a sound while leaving the
/// fundamental intact, making them useful for creating timbres that contain a
/// discernable pitch but do not have a high level of harmonic content.
pub struct BRF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl BRF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// centre frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq
    pub fn rq(mut self, v: impl Into<UGenInput>) -> Self {
        self.rq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.rq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BRF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// two zero fixed midcut which cuts out frequencies around 1/2 of the Nyquist
/// frequency. Implements the formula: out(i) = 0.5 * (in(i) + in(i-2))
pub struct BRZ2 {
    _rate: Rate,
    r#in: UGenInput,
}

impl BRZ2 {
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
        let idx = def.add_ugen(r"BRZ2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// triggered exponential decay.
/// 
/// This is essentially the same as integrator except that instead of supplying
/// the coefficient directly, it is calculated from a 60 dB decay time. This is
/// the time required for the integrator to lose 99.9 % of its value or -60dB.
/// This is useful for exponential decaying envelopes triggered by impulses.
pub struct Decay {
    _rate: Rate,
    r#in: UGenInput,
    decay_time: UGenInput,
}

impl Decay {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB decay time in seconds
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Decay", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// triggered exponential attack and exponential decay. Decay has a very sharp
/// attack and can produce clicks. Decay2 rounds off the attack by subtracting one
/// Decay from another. (decay in attack-time decay-time) equivalent to: (- (decay
/// in attack-time decay-time) (decay in attack-time decay-time))
pub struct Decay2 {
    _rate: Rate,
    r#in: UGenInput,
    attack_time: UGenInput,
    decay_time: UGenInput,
}

impl Decay2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            attack_time: UGenInput::Constant(0.01),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            attack_time: UGenInput::Constant(0.01),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB attack time in seconds.
    pub fn attack_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.attack_time = v.into();
        self
    }

    /// 60 dB decay time in seconds.
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.attack_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Decay2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// If the signal input starts with silence at the beginning of the synth's
/// duration, then DetectSilence will wait indefinitely until the first sound
/// before starting to monitor for silence. This UGen outputs 1 if silence is
/// detected, otherwise 0.
pub struct DetectSilence {
    _rate: Rate,
    r#in: UGenInput,
    amp: UGenInput,
    time: UGenInput,
    action: UGenInput,
}

impl DetectSilence {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            amp: UGenInput::Constant(0.0001),
            time: UGenInput::Constant(0.1),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            amp: UGenInput::Constant(0.0001),
            time: UGenInput::Constant(0.1),
            action: UGenInput::Constant(0.0),
        }
    }

    /// any source
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// when input falls below this, evaluate done action
    pub fn amp(mut self, v: impl Into<UGenInput>) -> Self {
        self.amp = v.into();
        self
    }

    /// the minimum duration of the input signal which input must fall below thresh
    /// before this triggers. The default is 0.1 seconds
    pub fn time(mut self, v: impl Into<UGenInput>) -> Self {
        self.time = v.into();
        self
    }

    /// the action to perform when silence is detected. Default: NO-ACTION
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.amp);
        inputs.push(self.time);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DetectSilence", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a resonant filter whose impulse response is like that of a sine wave with a
/// Decay2 envelope over it. The great advantage to this filter over FOF is that
/// there is no limit to the number of overlapping grains since the grain is just
/// the impulse response of the filter. Note that if attacktime == decaytime then
/// the signal cancels out and if attacktime > decaytime then the impulse response
/// is inverted.
pub struct Formlet {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    attack_time: UGenInput,
    decay_time: UGenInput,
}

impl Formlet {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            attack_time: UGenInput::Constant(1.0),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            attack_time: UGenInput::Constant(1.0),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// resonant frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// 60 dB attack time in seconds
    pub fn attack_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.attack_time = v.into();
        self
    }

    /// 60 dB decay time in seconds
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.attack_time);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Formlet", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// first order filter section. Formula is equivalent to: out(i) = (a0 * in(i)) +
/// (a1 * in(i-1)) + (b1 * out(i-1))
pub struct FOS {
    _rate: Rate,
    r#in: UGenInput,
    a0: UGenInput,
    a1: UGenInput,
    b1: UGenInput,
}

impl FOS {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            a0: UGenInput::Constant(0.0),
            a1: UGenInput::Constant(0.0),
            b1: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            a0: UGenInput::Constant(0.0),
            a1: UGenInput::Constant(0.0),
            b1: UGenInput::Constant(0.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// first coefficient
    pub fn a0(mut self, v: impl Into<UGenInput>) -> Self {
        self.a0 = v.into();
        self
    }

    /// second coefficient
    pub fn a1(mut self, v: impl Into<UGenInput>) -> Self {
        self.a1 = v.into();
        self
    }

    /// third coefficient
    pub fn b1(mut self, v: impl Into<UGenInput>) -> Self {
        self.b1 = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.a0);
        inputs.push(self.a1);
        inputs.push(self.b1);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FOS", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// second order high pass filter
/// 
/// A high pass filter lets through the frequencies above the cutoff point and
/// successfully dampens the frequencies below the cutoff point. This effectively
/// removes the fundamental frequency of the sound, leaving only the fizz harmonic
/// overtones. High pass filters are rarely used in the creation of instruments
/// and are predominantly used to create effervexcent sound effects of bright
/// timbres that can be laid over the top of another low pass sound to increase
/// the harmonic content.
pub struct HPF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
}

impl HPF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// cutoff frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"HPF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// two point difference filter. Implements the formula: out(i) = 0.5 * (in(i) -
/// in(i-1))
pub struct HPZ1 {
    _rate: Rate,
    r#in: UGenInput,
}

impl HPZ1 {
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
        let idx = def.add_ugen(r"HPZ1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// two zero fixed highpass. Implements the formula: out(i) = 0.25 * (in(i) -
/// (2*in(i-1)) + in(i-2))
pub struct HPZ2 {
    _rate: Rate,
    r#in: UGenInput,
}

impl HPZ2 {
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
        let idx = def.add_ugen(r"HPZ2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// leaky integrator. Integrates an input signal with a leak. The formula
/// implemented is: out(0) = in(0) + (coef * out(-1))
pub struct Integrator {
    _rate: Rate,
    r#in: UGenInput,
    coef: UGenInput,
}

impl Integrator {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// leak coefficient
    pub fn coef(mut self, v: impl Into<UGenInput>) -> Self {
        self.coef = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.coef);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Integrator", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// exponential lag, useful for smoothing out control signals. This is essentially
/// the same as OnePole except that instead of supplying the coefficient directly,
/// it is calculated from a 60 dB lag time. This is the time required for the
/// filter to converge to within 0.01 % of a value.
pub struct Lag {
    _rate: Rate,
    r#in: UGenInput,
    lag_time: UGenInput,
}

impl Lag {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds
    pub fn lag_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Lag", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// equivalent to (lag (lag in time) time), resulting in a smoother transition.
/// This saves on CPU as you only have to calculate the decay factor once instead
/// of twice. See lag for more details.
pub struct Lag2 {
    _rate: Rate,
    r#in: UGenInput,
    lag_time: UGenInput,
}

impl Lag2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds
    pub fn lag_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Lag2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// equivalent to (lag-ud (lag-ud in up-t down-t) up-t down-t) thus resulting in a
/// smoother transition. This saves on CPU as you only have to calculate the decay
/// factor once instead of twice. See Lag for more details.
pub struct Lag2UD {
    _rate: Rate,
    r#in: UGenInput,
    lag_time_up: UGenInput,
    lag_time_down: UGenInput,
}

impl Lag2UD {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time_up: UGenInput::Constant(0.1),
            lag_time_down: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time_up: UGenInput::Constant(0.1),
            lag_time_down: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds for the upgoing signal
    pub fn lag_time_up(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time_up = v.into();
        self
    }

    /// 60 dB lag time in seconds for the downgoing signal
    pub fn lag_time_down(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time_down = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time_up);
        inputs.push(self.lag_time_down);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Lag2UD", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// lag3 is equivalent to (lag (lag (lag in time) time) time), thus resulting in a
/// smoother transition. This saves on CPU as you only have to calculate the decay
/// factor once instead of three times. See Lag for more details.
pub struct Lag3 {
    _rate: Rate,
    r#in: UGenInput,
    lag_time: UGenInput,
}

impl Lag3 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds
    pub fn lag_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Lag3", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// equivalent to (lag-ud (lag-ud (lag-ud (in up-t down-t) up-t down-t) up-t,
/// down-t) thus resulting in a smoother transition. This saves on CPU as you only
/// have to calculate the decay factor once instead of three times.
pub struct Lag3UD {
    _rate: Rate,
    r#in: UGenInput,
    lag_time_up: UGenInput,
    lag_time_down: UGenInput,
}

impl Lag3UD {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time_up: UGenInput::Constant(0.1),
            lag_time_down: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time_up: UGenInput::Constant(0.1),
            lag_time_down: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds for the upgoing signal
    pub fn lag_time_up(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time_up = v.into();
        self
    }

    /// 60 dB lag time in seconds for the downgoing signal
    pub fn lag_time_down(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time_down = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time_up);
        inputs.push(self.lag_time_down);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Lag3UD", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// the same as Lag except that you can supply a different 60 dB time for when the
/// signal goes up, from when the signal goes down
pub struct LagUD {
    _rate: Rate,
    r#in: UGenInput,
    lag_time_up: UGenInput,
    lag_time_down: UGenInput,
}

impl LagUD {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time_up: UGenInput::Constant(0.1),
            lag_time_down: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time_up: UGenInput::Constant(0.1),
            lag_time_down: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds for the upgoing signal
    pub fn lag_time_up(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time_up = v.into();
        self
    }

    /// 60 dB lag time in seconds for the downgoing signal
    pub fn lag_time_down(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time_down = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time_up);
        inputs.push(self.lag_time_down);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LagUD", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// removes a DC offset from signal. For example, a square wave contains prolonged
/// sections of the cycle which are at +1 and -1 (the top and bottom of the square
/// sections). If you were to pass this wave through leak-dc, then these top parts
/// would taper back towards 0 with a greater slope as you move coef from 1 to 0..
/// Good starting point coef values are to 0.995 for audio rate and 0.9 for
/// control rate
pub struct LeakDC {
    _rate: Rate,
    r#in: UGenInput,
    coef: UGenInput,
}

impl LeakDC {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(0.995),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(0.995),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// leak coefficient. A value of 1 indicates no leakage and 0 indicates high
    /// leakage - essentially the rate at which the offset will return back to 0
    pub fn coef(mut self, v: impl Into<UGenInput>) -> Self {
        self.coef = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.coef);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LeakDC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// second order Butterworth low pass filter
/// 
/// A low pass filter is a standard subtractive synthesis tool which removes
/// frequencies above a defined cut-off point. This typically has the effect of
/// making bright sounds duller. Using a low pass filter allows you to have
/// fine-grained control of the level of brightness/dullness to tune your timbre
/// in addition to allowing you to modulate the effect in real time thus creating
/// movement in the sound.
pub struct LPF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
}

impl LPF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// cutoff frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LPF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// two point average filter. Implements the formula: out(i) = 0.5 * (in(i) +
/// in(i-1))
pub struct LPZ1 {
    _rate: Rate,
    r#in: UGenInput,
}

impl LPZ1 {
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
        let idx = def.add_ugen(r"LPZ1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// two zero fixed lowpass. Implements the formula: out(i) = 0.25 * (in(i) +
/// (2*in(i-1)) + in(i-2))
pub struct LPZ2 {
    _rate: Rate,
    r#in: UGenInput,
}

impl LPZ2 {
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
        let idx = def.add_ugen(r"LPZ2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// returns the median of the last length input points. This non linear filter is
/// good at reducing impulse noise from a signal.
pub struct Median {
    _rate: Rate,
    length: UGenInput,
    r#in: UGenInput,
}

impl Median {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            length: UGenInput::Constant(3.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            length: UGenInput::Constant(3.0),
            r#in: UGenInput::Constant(0.0),
        }
    }

    /// number of input points in which to find the median. Must be an odd number from
    /// 1 to 31. If length is 1 then Median has no effect.
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    /// Input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Median", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// attenuates or boosts a frequency band
pub struct MidEQ {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
    db: UGenInput,
}

impl MidEQ {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
            db: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
            db: UGenInput::Constant(0.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency of the band in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq
    pub fn rq(mut self, v: impl Into<UGenInput>) -> Self {
        self.rq = v.into();
        self
    }

    /// amount of boost (db > 0) or attenuation (db < 0) of the frequency band
    pub fn db(mut self, v: impl Into<UGenInput>) -> Self {
        self.db = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.rq);
        inputs.push(self.db);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MidEQ", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A one pole filter. Implements the formula: out(i) = ((1 - abs(coef)) * in(i))
/// + (coef * out(i-1))
pub struct OnePole {
    _rate: Rate,
    r#in: UGenInput,
    coef: UGenInput,
}

impl OnePole {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(0.5),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// feedback coefficient. Should be between -1 and +1
    pub fn coef(mut self, v: impl Into<UGenInput>) -> Self {
        self.coef = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.coef);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"OnePole", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A one zero filter. Implements the formula : out(i) = ((1 - abs(coef)) * in(i))
/// + (coef * in(i-1))
pub struct OneZero {
    _rate: Rate,
    r#in: UGenInput,
    coef: UGenInput,
}

impl OneZero {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(0.5),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            coef: UGenInput::Constant(0.5),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// feed forward coefficient. +0.5 makes a two point averaging filter (see also
    /// lpz1), -0.5 makes a differentiator (see also hpz1), +1 makes a single sample
    /// delay (see also delay1), -1 makes an inverted single sample delay.
    pub fn coef(mut self, v: impl Into<UGenInput>) -> Self {
        self.coef = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.coef);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"OneZero", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// similar to lag but with a linear rather than exponential lag, useful for
/// smoothing out control signals
pub struct Ramp {
    _rate: Rate,
    r#in: UGenInput,
    lag_time: UGenInput,
}

impl Ramp {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lag_time: UGenInput::Constant(0.1),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60 dB lag time in seconds
    pub fn lag_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lag_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Ramp", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A Note on Constant-Gain Digital Resonators,\" Computer Music Journal, vol 18,
/// no. 4, pp. 8-10, Winter 1994.\" Computer Music Journal, vol 18, no. 4, pp.
/// 8-10, Winter 1994.
pub struct Resonz {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    bwr: UGenInput,
}

impl Resonz {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            bwr: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            bwr: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// resonant frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// bandwidth ratio (reciprocal of Q). rq = bandwidth / centerFreq
    pub fn bwr(mut self, v: impl Into<UGenInput>) -> Self {
        self.bwr = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.bwr);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Resonz", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// resonant high pass filter
/// 
/// A resonant high pass filter lets through the frequencies above the cutoff
/// point and successfully dampens the frequencies below the cutoff point. This
/// effectively removes the fundamental frequency of the sound, leaving only the
/// fizz harmonic overtones. However, in addition to this behaviour, the resonant
/// high pass filter also emphasises/resonates the frequencies around the cutoff
/// point. The amount of emphasis is controlled by the rq param with a lower rq
/// resulting in greater resonance. High amounts of resonance (rq ~0) can create a
/// whistling sound around the cutoff frequency. High pass filters are rarely used
/// in the creation of instruments and are predominantly used to create
/// effervescent sound effects of bright timbres that can be laid over the top of
/// another low pass sound to increase the harmonic content.
pub struct RHPF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl RHPF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// cutoff frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq. A lower rq results in more
    /// resonance
    pub fn rq(mut self, v: impl Into<UGenInput>) -> Self {
        self.rq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.rq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RHPF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Ringz is the same as Resonz, except that instead of a resonance parameter, the
/// bandwidth is specified in a 60dB ring decay time. One Ringz is equivalent to
/// one component of the klank ugen
pub struct Ringz {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    decay_time: UGenInput,
}

impl Ringz {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            decay_time: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// resonant frequency in Hertz
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the 60 dB decay time of the filter
    pub fn decay_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.decay_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Ringz", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// resonant low pass filter
/// 
/// A resonant low pass filter is a standard subtractive synthesis tool which
/// removes frequencies above a defined cut-off point. This typically has the
/// effect of making bright sounds duller. However, in addition to this behaviour,
/// the resonant low pass filter also emphasises/resonates the frequencies around
/// the cutoff point. The amount of emphasis is controlled by the rq param with a
/// lower rq resulting in greater resonance. High amounts of resonance (rq ~0) can
/// create a whistling sound around the cutoff frequency. Using a low pass filter
/// allows you to have fine-grained control of the level of brightness/dullness to
/// tune your timbre in addition to allowing you to modulate the effect in real
/// time thus creating movement in the sound.
pub struct RLPF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl RLPF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// cutoff frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq. A lower rq results in more
    /// resonance.
    pub fn rq(mut self, v: impl Into<UGenInput>) -> Self {
        self.rq = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.rq);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RLPF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Smooth the curve by limiting the slope of the input signal to up and dn
pub struct Slew {
    _rate: Rate,
    r#in: UGenInput,
    up: UGenInput,
    dn: UGenInput,
}

impl Slew {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            up: UGenInput::Constant(1.0),
            dn: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            up: UGenInput::Constant(1.0),
            dn: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// maximum upward slope
    pub fn up(mut self, v: impl Into<UGenInput>) -> Self {
        self.up = v.into();
        self
    }

    /// maximum downward slope
    pub fn dn(mut self, v: impl Into<UGenInput>) -> Self {
        self.dn = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.up);
        inputs.push(self.dn);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Slew", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Measures the rate of change per second of a signal. Formula implemented is:
/// out[i] = (in[i] - in[i-1]) * sampling_rate
pub struct Slope {
    _rate: Rate,
    r#in: UGenInput,
}

impl Slope {
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

    /// input signal to measure
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
        let idx = def.add_ugen(r"Slope", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// second order filter section (biquad). Formula is equivalent to: out(i) = (a0 *
/// in(i)) + (a1 * in(i-1)) + (a2 * in(i-2)) + (b1 * out(i-1)) + (b2 * out(i-2))
pub struct SOS {
    _rate: Rate,
    r#in: UGenInput,
    a0: UGenInput,
    a1: UGenInput,
    a2: UGenInput,
    b1: UGenInput,
    b2: UGenInput,
}

impl SOS {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            a0: UGenInput::Constant(0.0),
            a1: UGenInput::Constant(0.0),
            a2: UGenInput::Constant(0.0),
            b1: UGenInput::Constant(0.0),
            b2: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            a0: UGenInput::Constant(0.0),
            a1: UGenInput::Constant(0.0),
            a2: UGenInput::Constant(0.0),
            b1: UGenInput::Constant(0.0),
            b2: UGenInput::Constant(0.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 1st coefficient
    pub fn a0(mut self, v: impl Into<UGenInput>) -> Self {
        self.a0 = v.into();
        self
    }

    /// 2nd coefficient
    pub fn a1(mut self, v: impl Into<UGenInput>) -> Self {
        self.a1 = v.into();
        self
    }

    /// 3rd coefficient
    pub fn a2(mut self, v: impl Into<UGenInput>) -> Self {
        self.a2 = v.into();
        self
    }

    /// 4th coefficient
    pub fn b1(mut self, v: impl Into<UGenInput>) -> Self {
        self.b1 = v.into();
        self
    }

    /// 5th coefficient
    pub fn b2(mut self, v: impl Into<UGenInput>) -> Self {
        self.b2 = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.a0);
        inputs.push(self.a1);
        inputs.push(self.a2);
        inputs.push(self.b1);
        inputs.push(self.b2);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SOS", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a two pole filter. This provides lower level access to setting of pole
/// location. For general purposes Resonz is better.
pub struct TwoPole {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    radius: UGenInput,
}

impl TwoPole {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            radius: UGenInput::Constant(0.8),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            radius: UGenInput::Constant(0.8),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// frequency of pole angle
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// radius of pole. Should be between 0 and +1
    pub fn radius(mut self, v: impl Into<UGenInput>) -> Self {
        self.radius = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.radius);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TwoPole", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// a two zero filter
pub struct TwoZero {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    radius: UGenInput,
}

impl TwoZero {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            radius: UGenInput::Constant(0.8),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(440.0),
            radius: UGenInput::Constant(0.8),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// frequency of zero angle
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// radius of zero
    pub fn radius(mut self, v: impl Into<UGenInput>) -> Self {
        self.radius = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.radius);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TwoZero", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
