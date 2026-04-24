// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Clip a signal outside given thresholds.
/// 
/// Clip a signal outside given thresholds. This differs from the ugen clip2 in
/// that it allows one to set both low and high thresholds.
pub struct Clip {
    _rate: Rate,
    r#in: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl Clip {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// The signal to be clipped
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Low threshold of clipping. Must be less then hi
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// High threshold of clipping. Must be greater then lo
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Clip", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Fold a signal outside given thresholds.
/// 
/// Folds input wave to within the lo and hi thresholds. This differs from the
/// ugen fold2 in that it allows one to set both low and high thresholds.
pub struct Fold {
    _rate: Rate,
    r#in: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl Fold {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// low threshold
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// high threshold
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Fold", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Gate or hold
/// 
/// Lets signal flow when trig is positive, otherwise holds last input value
pub struct Gate {
    _rate: Rate,
    r#in: UGenInput,
    trig: UGenInput,
}

impl Gate {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Gate", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Tests if a signal is within a given range
/// 
/// If in is >= lo and <= hi output 1.0, otherwise output 0.0. Output is initially
/// zero.
pub struct InRange {
    _rate: Rate,
    r#in: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl InRange {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// low threshold
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// high threshold
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"InRange", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Test if a point is within a given rectangle.
/// 
/// Outputs one if the 2d coordinate of x,y input values falls inside a rectangle,
/// else zero
pub struct InRect {
    _rate: Rate,
    x: UGenInput,
    y: UGenInput,
    left: UGenInput,
    top: UGenInput,
    right: UGenInput,
    bottom: UGenInput,
}

impl InRect {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            x: UGenInput::Constant(0.0),
            y: UGenInput::Constant(0.0),
            left: UGenInput::Constant(0.0),
            top: UGenInput::Constant(0.0),
            right: UGenInput::Constant(0.0),
            bottom: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            x: UGenInput::Constant(0.0),
            y: UGenInput::Constant(0.0),
            left: UGenInput::Constant(0.0),
            top: UGenInput::Constant(0.0),
            right: UGenInput::Constant(0.0),
            bottom: UGenInput::Constant(0.0),
        }
    }

    /// X component signal
    pub fn x(mut self, v: impl Into<UGenInput>) -> Self {
        self.x = v.into();
        self
    }

    /// Y component signal
    pub fn y(mut self, v: impl Into<UGenInput>) -> Self {
        self.y = v.into();
        self
    }

    pub fn left(mut self, v: impl Into<UGenInput>) -> Self {
        self.left = v.into();
        self
    }

    pub fn top(mut self, v: impl Into<UGenInput>) -> Self {
        self.top = v.into();
        self
    }

    pub fn right(mut self, v: impl Into<UGenInput>) -> Self {
        self.right = v.into();
        self
    }

    pub fn bottom(mut self, v: impl Into<UGenInput>) -> Self {
        self.bottom = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.x);
        inputs.push(self.y);
        inputs.push(self.left);
        inputs.push(self.top);
        inputs.push(self.right);
        inputs.push(self.bottom);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"InRect", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Output the last value before the input changed
/// 
/// Output the last value before the input changed by a threshold of diff
pub struct LastValue {
    _rate: Rate,
    r#in: UGenInput,
    diff: UGenInput,
}

impl LastValue {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            diff: UGenInput::Constant(0.01),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            diff: UGenInput::Constant(0.01),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// difference threshold
    pub fn diff(mut self, v: impl Into<UGenInput>) -> Self {
        self.diff = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.diff);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LastValue", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Sample and hold
/// 
/// Holds input signal value when triggered.
pub struct Latch {
    _rate: Rate,
    r#in: UGenInput,
    trig: UGenInput,
}

impl Latch {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Latch", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Output least changed
/// 
/// output whichever signal changed the least
pub struct LeastChange {
    _rate: Rate,
    a: UGenInput,
    b: UGenInput,
}

impl LeastChange {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            a: UGenInput::Constant(0.0),
            b: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            a: UGenInput::Constant(0.0),
            b: UGenInput::Constant(0.0),
        }
    }

    /// first input
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// second input
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.a);
        inputs.push(self.b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LeastChange", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Output most changed
/// 
/// output whichever signal changed the most
pub struct MostChange {
    _rate: Rate,
    a: UGenInput,
    b: UGenInput,
}

impl MostChange {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            a: UGenInput::Constant(0.0),
            b: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            a: UGenInput::Constant(0.0),
            b: UGenInput::Constant(0.0),
        }
    }

    /// first input
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// second input
    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.a);
        inputs.push(self.b);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MostChange", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Track peak signal amplitude
/// 
/// Outputs the peak amplitude of the signal so far, a trigger resets to current
/// value
pub struct Peak {
    _rate: Rate,
    trig: UGenInput,
    reset: UGenInput,
}

impl Peak {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Resets the counter to zero when triggered.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.reset);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Peak", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Track peak signal amplitude
/// 
/// Outputs the peak signal amplitude, falling with decay over time until reaching
/// signal level
pub struct PeakFollower {
    _rate: Rate,
    r#in: UGenInput,
    decay: UGenInput,
}

impl PeakFollower {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            decay: UGenInput::Constant(0.999),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            decay: UGenInput::Constant(0.999),
        }
    }

    /// input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// decay factor.
    pub fn decay(mut self, v: impl Into<UGenInput>) -> Self {
        self.decay = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.decay);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PeakFollower", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Resettable linear ramp between two levels
/// 
/// Phasor is a linear ramp between start and end values. When its trigger input
/// crosses from non-positive to positive, Phasor's output will jump to its reset
/// position. Upon reaching the end of its ramp Phasor will wrap back to its
/// start. N.B. Since end is defined as the wrap point, its value is never
/// actually output.
pub struct Phasor {
    _rate: Rate,
    trig: UGenInput,
    rate: UGenInput,
    start: UGenInput,
    end: UGenInput,
    reset_pos: UGenInput,
}

impl Phasor {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            start: UGenInput::Constant(0.0),
            end: UGenInput::Constant(1.0),
            reset_pos: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            start: UGenInput::Constant(0.0),
            end: UGenInput::Constant(1.0),
            reset_pos: UGenInput::Constant(0.0),
        }
    }

    /// When triggered, reset value to reset-pos (default: 0, phasor outputs start
    /// initially)
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// The amount of change per sample i.e at a rate of 1 the value of each sample
    /// will be 1 greater than the preceding sample
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// Starting point of the ramp
    pub fn start(mut self, v: impl Into<UGenInput>) -> Self {
        self.start = v.into();
        self
    }

    /// End point of the ramp
    pub fn end(mut self, v: impl Into<UGenInput>) -> Self {
        self.end = v.into();
        self
    }

    /// The value to jump to upon receiving a trigger
    pub fn reset_pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset_pos = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.rate);
        inputs.push(self.start);
        inputs.push(self.end);
        inputs.push(self.reset_pos);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Phasor", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Autocorrelation pitch follower
/// 
/// This is a better pitch follower than zero-crossing, but more costly of CPU.
/// For most purposes the default settings can be used and only in needs to be
/// supplied. Pitch returns two values (via an Array of OutputProxys, a freq which
/// is the pitch estimate and has-freq, which tells whether a pitch was found.
/// Some vowels are still problematic, for instance a wide open mouth sound
/// somewhere between a low pitched short 'a' sound as in 'sat', and long 'i'
/// sound as in 'fire', contains enough overtone energy to confuse the algorithm.
/// None of these settings are time variable.
pub struct Pitch {
    _rate: Rate,
    r#in: UGenInput,
    init_freq: UGenInput,
    min_freq: UGenInput,
    max_freq: UGenInput,
    exec_freq: UGenInput,
    max_bins_per_octave: UGenInput,
    median: UGenInput,
    amp_threshold: UGenInput,
    peak_threshold: UGenInput,
    down_sample: UGenInput,
    clar: UGenInput,
}

impl Pitch {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            init_freq: UGenInput::Constant(440.0),
            min_freq: UGenInput::Constant(60.0),
            max_freq: UGenInput::Constant(4000.0),
            exec_freq: UGenInput::Constant(100.0),
            max_bins_per_octave: UGenInput::Constant(16.0),
            median: UGenInput::Constant(1.0),
            amp_threshold: UGenInput::Constant(0.01),
            peak_threshold: UGenInput::Constant(0.5),
            down_sample: UGenInput::Constant(1.0),
            clar: UGenInput::Constant(0.0),
        }
    }

    /// Input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Value of output pitch until first pitch detected.
    pub fn init_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.init_freq = v.into();
        self
    }

    /// Minimum frequency of execution.
    pub fn min_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.min_freq = v.into();
        self
    }

    /// Maximum frequency of execution.
    pub fn max_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_freq = v.into();
        self
    }

    /// The target rate to periodically execute in cps. Clipped between min-freq and
    /// max-freq.
    pub fn exec_freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.exec_freq = v.into();
        self
    }

    /// Number of lags for course search. A larger value will cause the coarse search
    /// to take longer, a smaller value will cause the subsequent fine search to take
    /// longer.
    pub fn max_bins_per_octave(mut self, v: impl Into<UGenInput>) -> Self {
        self.max_bins_per_octave = v.into();
        self
    }

    /// Median filter value of length median on the output estimation. Helps eliminate
    /// outliers and jitter. Value of 1 means no filter.
    pub fn median(mut self, v: impl Into<UGenInput>) -> Self {
        self.median = v.into();
        self
    }

    /// Minum peak to peak amplitude of input signal before pitch estimation is
    /// performed.
    pub fn amp_threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.amp_threshold = v.into();
        self
    }

    /// Finds the next peak that is above peak-threshold times the amplitude of the
    /// peak at lag zero. A value of 0.5 does a pretty good job of eliminating
    /// overtones.
    pub fn peak_threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.peak_threshold = v.into();
        self
    }

    /// Down sample the input signal by an integer factor. Helps reduce CPU overthead.
    /// Also reduces pitch resolution.
    pub fn down_sample(mut self, v: impl Into<UGenInput>) -> Self {
        self.down_sample = v.into();
        self
    }

    /// Clarity measurement (purity of the pitched signal) if greater than 0.
    pub fn clar(mut self, v: impl Into<UGenInput>) -> Self {
        self.clar = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.init_freq);
        inputs.push(self.min_freq);
        inputs.push(self.max_freq);
        inputs.push(self.exec_freq);
        inputs.push(self.max_bins_per_octave);
        inputs.push(self.median);
        inputs.push(self.amp_threshold);
        inputs.push(self.peak_threshold);
        inputs.push(self.down_sample);
        inputs.push(self.clar);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"Pitch", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Pulse counter
/// 
/// Each input trigger increments a counter value that is output.
pub struct PulseCount {
    _rate: Rate,
    trig: UGenInput,
    reset: UGenInput,
}

impl PulseCount {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Resets the counter to zero when triggered.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.reset);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PulseCount", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Pulse divider
/// 
/// Outputs a trigger every div input triggers
pub struct PulseDivider {
    _rate: Rate,
    trig: UGenInput,
    div: UGenInput,
    start_val: UGenInput,
}

impl PulseDivider {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            div: UGenInput::Constant(2.0),
            start_val: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            div: UGenInput::Constant(2.0),
            start_val: UGenInput::Constant(0.0),
        }
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Number of pulses to divide by.
    pub fn div(mut self, v: impl Into<UGenInput>) -> Self {
        self.div = v.into();
        self
    }

    /// Starting value for the trigger count. This lets you start somewhere in the
    /// middle of a count, or if startCount is negative it adds that many counts to
    /// the first time the output is triggers.
    pub fn start_val(mut self, v: impl Into<UGenInput>) -> Self {
        self.start_val = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.div);
        inputs.push(self.start_val);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PulseDivider", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Track maximum level
/// 
/// Outputs the maximum value received at the input. When triggered, the maximum
/// output value is reset to the current value.
pub struct RunningMax {
    _rate: Rate,
    r#in: UGenInput,
    trig: UGenInput,
}

impl RunningMax {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RunningMax", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Track minimum level
/// 
/// Outputs the minimum value received at the input. When triggered, the minimum
/// output value is reset to the current value.
pub struct RunningMin {
    _rate: Rate,
    r#in: UGenInput,
    trig: UGenInput,
}

impl RunningMin {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RunningMin", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Schmidt trigger
/// 
/// Outout one when signal greater than high, and zero when lower than low.
pub struct Schmidt {
    _rate: Rate,
    r#in: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl Schmidt {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// low threshold
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// high threshold
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Schmidt", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Send information via OSC to Overtone
/// 
/// Send an array of values from the server via an message. The OSC message is
/// formed with cmd-name as the path, followed by two compulsary args: node-id
/// (the id of the node that sent the message) and reply-id (the value specified
/// in the params). These args are then followed by the list of values specified
/// in the params. For example, if the ugen is used as follows: (send-reply tr
/// \"/foobar\" [1 2 3] 42) When the trig tr triggers, Overtone will receive an
/// event that looks like the following (where 32 represents the node-id of the
/// synth that sent the message): {:path \"/foobar\
pub struct SendReply {
    _rate: Rate,
    trig: UGenInput,
    cmd_name: UGenInput,
    values: UGenInput,
    reply_id: UGenInput,
}

impl SendReply {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            cmd_name: UGenInput::Constant(0.0),
            values: UGenInput::Constant(0.0),
            reply_id: UGenInput::Constant(-1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            cmd_name: UGenInput::Constant(0.0),
            values: UGenInput::Constant(0.0),
            reply_id: UGenInput::Constant(-1.0),
        }
    }

    /// Input trigger signal
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// A string or symbol, as a message name.
    pub fn cmd_name(mut self, v: impl Into<UGenInput>) -> Self {
        self.cmd_name = v.into();
        self
    }

    /// Array of ugens, or valid ugen inputs
    pub fn values(mut self, v: impl Into<UGenInput>) -> Self {
        self.values = v.into();
        self
    }

    /// Integer id (similar to that used by send-trig)
    pub fn reply_id(mut self, v: impl Into<UGenInput>) -> Self {
        self.reply_id = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.cmd_name);
        inputs.push(self.values);
        inputs.push(self.reply_id);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"SendReply", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Send a /tr OSC message to Overtone
/// 
/// On receiving a trigger sends a :trigger event with id and value. This command
/// is the mechanism that synths can use to trigger events in clients. The trigger
/// message sent back to the client is this: int - node ID int - trigger ID float
/// - trigger value This is then presented as an event on the event-stream which
/// is a map containing the key :path with the string \"/tr\" and the key :args
/// containing a sequence of the values in the above order. i.e. {:path /tr, :args
/// (34 3 123.0)} See on-trigger, on-latest-trigger and on-sync-trigger for
/// registering handlers for trigger events.
pub struct SendTrig {
    _rate: Rate,
    r#in: UGenInput,
    id: UGenInput,
    value: UGenInput,
}

impl SendTrig {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            id: UGenInput::Constant(0.0),
            value: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            id: UGenInput::Constant(0.0),
            value: UGenInput::Constant(0.0),
        }
    }

    /// input trigger signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// an integer that will be passed with the trigger message. This is useful if you
    /// have more than one send-trig in a synth design. Consider using trig-id to
    /// genearate a unique id.
    pub fn id(mut self, v: impl Into<UGenInput>) -> Self {
        self.id = v.into();
        self
    }

    /// A ugen or float that will be polled at the time of trigger, and its value
    /// passed with the trigger message
    pub fn value(mut self, v: impl Into<UGenInput>) -> Self {
        self.value = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.id);
        inputs.push(self.value);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"SendTrig", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Set-reset flip flop
/// 
/// When a trigger is received the output is set to 1.0 Subsequent triggers have
/// no effect When a trigger is received in the reset input, the output is set
/// back to 0.0 One use of this is to have some precipitating event cause
/// something to happen until you reset it.
pub struct SetResetFF {
    _rate: Rate,
    trig: UGenInput,
    reset: UGenInput,
}

impl SetResetFF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Resets the counter to zero when triggered.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.reset);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SetResetFF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Pulse counter
/// 
/// Triggers increment a counter which is output as a signal. The counter loops
/// around from max to min by step increments
pub struct Stepper {
    _rate: Rate,
    trig: UGenInput,
    reset: UGenInput,
    min: UGenInput,
    max: UGenInput,
    step: UGenInput,
    resetval: UGenInput,
}

impl Stepper {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
            min: UGenInput::Constant(0.0),
            max: UGenInput::Constant(7.0),
            step: UGenInput::Constant(1.0),
            resetval: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
            min: UGenInput::Constant(0.0),
            max: UGenInput::Constant(7.0),
            step: UGenInput::Constant(1.0),
            resetval: UGenInput::Constant(1.0),
        }
    }

    /// Trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Resets the counter to resetval when triggered.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// minimum value of the counter.
    pub fn min(mut self, v: impl Into<UGenInput>) -> Self {
        self.min = v.into();
        self
    }

    /// maximum value of the counter.
    pub fn max(mut self, v: impl Into<UGenInput>) -> Self {
        self.max = v.into();
        self
    }

    /// step value each trigger. May be negative.
    pub fn step(mut self, v: impl Into<UGenInput>) -> Self {
        self.step = v.into();
        self
    }

    /// value to which the counter is reset when it receives a reset trigger.
    pub fn resetval(mut self, v: impl Into<UGenInput>) -> Self {
        self.resetval = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.reset);
        inputs.push(self.min);
        inputs.push(self.max);
        inputs.push(self.step);
        inputs.push(self.resetval);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Stepper", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Triggered linear ramp
/// 
/// outputs a linear increasing signal by rate/second when trig input crosses from
/// non-positive to positive
pub struct Sweep {
    _rate: Rate,
    trig: UGenInput,
    rate: UGenInput,
}

impl Sweep {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
        }
    }

    /// trigger input
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// rate in seconds
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.rate);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Sweep", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Trigger delay
/// 
/// Delays an input trigger by dur, ignoring other triggers in the meantime
pub struct TDelay {
    _rate: Rate,
    trig: UGenInput,
    dur: UGenInput,
}

impl TDelay {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
        }
    }

    /// input trigger signal.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// delay time in seconds.
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.dur);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TDelay", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Trigger timer
/// 
/// Outputs time since last trigger
pub struct Timer {
    _rate: Rate,
    trig: UGenInput,
}

impl Timer {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
        }
    }

    /// trigger input
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Timer", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Toggle flip flop
/// 
/// Flip-flops between zero and one each trigger
pub struct ToggleFF {
    _rate: Rate,
    trig: UGenInput,
}

impl ToggleFF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
        }
    }

    /// trigger input
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"ToggleFF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct Trapezoid {
    _rate: Rate,
    r#in: UGenInput,
    a: UGenInput,
    b: UGenInput,
    c: UGenInput,
    d: UGenInput,
}

impl Trapezoid {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            a: UGenInput::Constant(0.2),
            b: UGenInput::Constant(0.4),
            c: UGenInput::Constant(0.6),
            d: UGenInput::Constant(0.8),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            a: UGenInput::Constant(0.2),
            b: UGenInput::Constant(0.4),
            c: UGenInput::Constant(0.6),
            d: UGenInput::Constant(0.8),
        }
    }

    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    pub fn b(mut self, v: impl Into<UGenInput>) -> Self {
        self.b = v.into();
        self
    }

    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    pub fn d(mut self, v: impl Into<UGenInput>) -> Self {
        self.d = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.a);
        inputs.push(self.b);
        inputs.push(self.c);
        inputs.push(self.d);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Trapezoid", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Timed trigger
/// 
/// When a nonpositive to positive transition occurs at the input, Trig outputs
/// the level of the triggering input for the specified duration, otherwise it
/// outputs zero.
pub struct Trig {
    _rate: Rate,
    trig: UGenInput,
    dur: UGenInput,
}

impl Trig {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
        }
    }

    /// trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// duration of the trigger output in seconds.
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.dur);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Trig", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Timed trigger
/// 
/// Outputs one for dur seconds whenever the input goes from negative to positive,
/// otherwise outputs 0.
pub struct Trig1 {
    _rate: Rate,
    trig: UGenInput,
    dur: UGenInput,
}

impl Trig1 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.1),
        }
    }

    /// trigger. Trigger can be any signal. A trigger happens when the signal changes
    /// from non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// duration of the trigger output in seconds.
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.dur);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Trig1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Triggered window
/// 
/// When triggered, returns a random index value based on array as a list of
/// probabilities. By default the list of probabilities should sum to 1.0, when
/// the normalize flag is set to 1, the values get normalized by the ugen (less
/// efficient).
pub struct TWindex {
    _rate: Rate,
    trig: UGenInput,
    normalize: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl TWindex {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            normalize: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            normalize: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Trigger - can be any signal. A trigger happens when the signal changes from
    /// non-positive to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// normalise flag - 0 off, 1 on
    pub fn normalize(mut self, v: impl Into<UGenInput>) -> Self {
        self.normalize = v.into();
        self
    }

    /// list of probabilities
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.normalize);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TWindex", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Wrap a signal outside given thresholds.
/// 
/// Wraps input wave to the low and high thresholds. This differs from the ugen
/// wrap2 in that it allows one to set both low and high thresholds.
pub struct Wrap {
    _rate: Rate,
    r#in: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl Wrap {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            lo: UGenInput::Constant(0.0),
            hi: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// low threshold
    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    /// high threshold
    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Wrap", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Zero crossing frequency follower
/// 
/// Outputs a frequency based upon the distance between interceptions of the X
/// axis. The X intercepts are determined via linear interpolation so this gives
/// better than just integer wavelength resolution. This is a very crude pitch
/// follower, but can be useful in some situations.
pub struct ZeroCrossing {
    _rate: Rate,
    r#in: UGenInput,
}

impl ZeroCrossing {
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
        let idx = def.add_ugen(r"ZeroCrossing", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
