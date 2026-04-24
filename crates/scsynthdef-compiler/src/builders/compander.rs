// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Amplitude follower
/// 
/// Tracks the peak amplitude of a signal.
pub struct Amplitude {
    _rate: Rate,
    r#in: UGenInput,
    attack_time: UGenInput,
    release_time: UGenInput,
}

impl Amplitude {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            attack_time: UGenInput::Constant(0.01),
            release_time: UGenInput::Constant(0.01),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            attack_time: UGenInput::Constant(0.01),
            release_time: UGenInput::Constant(0.01),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// 60dB convergence time for following attacks
    pub fn attack_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.attack_time = v.into();
        self
    }

    /// 60dB convergence time for following decays
    pub fn release_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.release_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.attack_time);
        inputs.push(self.release_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Amplitude", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// General purpose hard-knee dynamic range processor.
/// 
/// The compander will modify the amplitude of the in signal based on an analysis
/// of the control signal. Typically the in and control signals are the same. The
/// amplitude of the control signal is calcuated using RMS (Root Mean Square) and
/// the final amplitude of the in signal is calculated as a function of the
/// amplitude threshold, and slopes either side (below and above) with some
/// temporal modifications in terms of attack and release phases. It is a
/// hard-knee processor which means that the response curve is a sharp angle
/// rather than a rounded edge. If the control amplitude is less than the
/// threshold, the slope below is used to calculate the amplitude modification. If
/// this is steep (greater than 1) this will reduce the amplitude of quiet signals
/// (the quieter the control amplitude the greater the reduction affect). Values <
/// 1.0 are possible, but it means that a very low-level control signal will cause
/// the input signal to be amplified, which would raise the noise floor. If the
/// control amplitude is greater than the threshold, the slope above is used to
/// calculate the amplitude modification. If this is steep (greater than 1) this
/// will create expansion - loud signals will be made louder). Less than 1 will
/// achieve compressions (louder signals are attenuated). The clamp and relax
/// times modify when the amplitude modification takes place and ends. May be used
/// to define: compressers, expanders, limiters, gates and duckers. For more
/// information see: http://en.wikipedia.org/wiki/Audio_level_compression
pub struct Compander {
    _rate: Rate,
    r#in: UGenInput,
    control: UGenInput,
    thresh: UGenInput,
    slope_below: UGenInput,
    slope_above: UGenInput,
    clamp_time: UGenInput,
    relax_time: UGenInput,
}

impl Compander {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            control: UGenInput::Constant(0.0),
            thresh: UGenInput::Constant(0.5),
            slope_below: UGenInput::Constant(1.0),
            slope_above: UGenInput::Constant(1.0),
            clamp_time: UGenInput::Constant(0.01),
            relax_time: UGenInput::Constant(0.1),
        }
    }

    /// The signal to be compressed / expanded / gated
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// The signal whose amplitude determines the gain applied to the input signal.
    /// Often the same as in (for standard gating or compression) but should be
    /// different for ducking.
    pub fn control(mut self, v: impl Into<UGenInput>) -> Self {
        self.control = v.into();
        self
    }

    /// Control signal amplitude threshold, which determines the break point between
    /// slope-below and slope-above. Typically a value between 0 and 1.
    pub fn thresh(mut self, v: impl Into<UGenInput>) -> Self {
        self.thresh = v.into();
        self
    }

    /// Slope of the amplitude curve below the threshold. A value of 1 means the
    /// output amplitude will match the control signal amplitude.
    pub fn slope_below(mut self, v: impl Into<UGenInput>) -> Self {
        self.slope_below = v.into();
        self
    }

    /// Slope of the amplitude curve above the threshold. A value of 1 means the
    /// output amplitude will match the control signal amplitude.
    pub fn slope_above(mut self, v: impl Into<UGenInput>) -> Self {
        self.slope_above = v.into();
        self
    }

    /// Time taken for the amplitude adjustment to kick in fully (in seconds). This is
    /// usually pretty small, not much more than 10 milliseconds (the default value).
    /// Also known as the time of the attack phase.
    pub fn clamp_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.clamp_time = v.into();
        self
    }

    /// The amount of time for the amplitude adjustment to be released. Usually a bit
    /// longer than clamp-time; if both times are too short, you can get some
    /// (possibly unwanted) artifacts. Also known as the time of the release phase.
    pub fn relax_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.relax_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.control);
        inputs.push(self.thresh);
        inputs.push(self.slope_below);
        inputs.push(self.slope_above);
        inputs.push(self.clamp_time);
        inputs.push(self.relax_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Compander", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Limits the input amplitude to the given level. Limiter will not overshoot like
/// Compander will, but it needs to look ahead in the audio. Thus there is a delay
/// equal to twice the lookAheadTime. Limiter, unlike Compander, is completely
/// transparent for an in range signal.
pub struct Limiter {
    _rate: Rate,
    r#in: UGenInput,
    level: UGenInput,
    dur: UGenInput,
}

impl Limiter {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
            dur: UGenInput::Constant(0.01),
        }
    }

    /// The input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// The peak output amplitude level to which to normalize the input
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// The buffer delay time. Shorter times will produce smaller delays and quicker
    /// transient response times, but may introduce amplitude modulation artifacts.
    /// (AKA lookAheadTime)
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.level);
        inputs.push(self.dur);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Limiter", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// flattens dynamics. Normalizes the input amplitude to the given level.
/// Normalize will not overshoot like Compander will, but it needs to look ahead
/// in the audio. Thus there is a delay equal to twice the lookAheadTime.
pub struct Normalizer {
    _rate: Rate,
    r#in: UGenInput,
    level: UGenInput,
    dur: UGenInput,
}

impl Normalizer {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
            dur: UGenInput::Constant(0.01),
        }
    }

    /// The input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// The peak output amplitude level to which to normalize the input
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// The buffer delay time. Shorter times will produce smaller delays and quicker
    /// transient response times, but may introduce amplitude modulation artifacts.
    /// (AKA lookAheadTime)
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.level);
        inputs.push(self.dur);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Normalizer", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
