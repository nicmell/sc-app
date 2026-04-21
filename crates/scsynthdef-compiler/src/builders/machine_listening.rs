// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Autocorrelation based beat tracker" , :rates #{:kr} :num-outs 4 :doc "The
/// underlying model assumes 4/4, but it should work on any isochronous beat
/// structure, though there are biases to 100-120 bpm; a fast 7/8 may not be
/// tracked in that sense. There are four k-rate outputs, being ticks at quarter,
/// eighth and sixteenth level from the determined beat, and the current detected
/// tempo. Note that the sixteenth note output won't necessarily make much sense
/// if the music being tracked has swing; it is provided just as a convenience.
/// This beat tracker determines the beat, biased to the midtempo range by
/// weighting functions. It does not determine the measure level, only a tactus.
/// It is also slow reacting, using a 6 second temporal window for its
/// autocorrelation maneouvres. Don't expect human musician level predictive
/// tracking. On the other hand, it is tireless, relatively general (though
/// obviously best at transient 4/4 heavy material without much expressive tempo
/// variation), and can form the basis of computer processing that is decidedly
/// faster than human.
/// 
/// The underlying model assumes 4/4, but it should work on any isochronous beat
/// structure, though there are biases to 100-120 bpm; a fast 7/8 may not be
/// tracked in that sense. There are four k-rate outputs, being ticks at quarter,
/// eighth and sixteenth level from the determined beat, and the current detected
/// tempo. Note that the sixteenth note output won't necessarily make much sense
/// if the music being tracked has swing; it is provided just as a convenience.
/// This beat tracker determines the beat, biased to the midtempo range by
/// weighting functions. It does not determine the measure level, only a tactus.
/// It is also slow reacting, using a 6 second temporal window for its
/// autocorrelation maneouvres. Don't expect human musician level predictive
/// tracking. On the other hand, it is tireless, relatively general (though
/// obviously best at transient 4/4 heavy material without much expressive tempo
/// variation), and can form the basis of computer processing that is decidedly
/// faster than human.
pub struct BeatTrack {
    _rate: Rate,
    chain: UGenInput,
    lock: UGenInput,
}

impl BeatTrack {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            lock: UGenInput::Constant(0.0),
        }
    }

    /// Audio input to track, already passed through an FFT UGen; the expected size of
    /// FFT is 1024 for 44100 and 48000 sampling rate, and 2048 for double those. No
    /// other sampling rates are supported.
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// If this argument is greater than 0.5, the tracker will lock at its current
    /// periodicity and continue from the current phase. Whilst it updates the model's
    /// phase and period, this is not reflected in the output until lock goes back
    /// below 0.5.
    pub fn lock(mut self, v: impl Into<UGenInput>) -> Self {
        self.lock = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.lock);
        let num_outputs: u32 = 4;
        let idx = def.add_ugen(r"BeatTrack", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Template matching beat tracker. This beat tracker is based on exhaustively
/// testing particular template patterns against feature streams; the testing
/// takes place every 0.5 seconds. The two basic templates are a straight
/// (groove=0) and a swung triplet (groove=1) pattern of 16th notes; this pattern
/// is tried out at scalings corresponding to the tempi from 60 to 180 bpm. This
/// is the cross-corellation method of beat tracking. A majority vote is taken on
/// the best tempo detected, but this must be confirmed by a consistency check
/// after a phase estimate. Such a consistency check helps to avoid wild
/// fluctuating estimates, but is at the expense of an additional half second
/// delay. The latency of the beat tracker with default settings is thus at least
/// 2.5 seconds; because of block-based amortisation of calculation, it is
/// actually around 2.8 seconds latency for a 2.0 second temporal window. This
/// beat tracker is designed to be flexible for user needs; you can try out
/// different window sizes, tempo weights and combinations of features. However,
/// there are no guarantees on stability and effectiveness, and you will need to
/// explore such parameters for a particular situation.
pub struct BeatTrack2 {
    _rate: Rate,
    busindex: UGenInput,
    numfeatures: UGenInput,
    windowsize: UGenInput,
    phaseaccuracy: UGenInput,
    lock: UGenInput,
    weightingscheme: UGenInput,
}

impl BeatTrack2 {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            busindex: UGenInput::Constant(0.0),
            numfeatures: UGenInput::Constant(0.0),
            windowsize: UGenInput::Constant(2.0),
            phaseaccuracy: UGenInput::Constant(0.02),
            lock: UGenInput::Constant(0.0),
            weightingscheme: UGenInput::Constant(-2.1),
        }
    }

    /// Audio input to track, already analysed into N features, passed in via a
    /// control bus number from which to retrieve consecutive streams.
    pub fn busindex(mut self, v: impl Into<UGenInput>) -> Self {
        self.busindex = v.into();
        self
    }

    /// How many features (ie how many control buses) are provided
    pub fn numfeatures(mut self, v: impl Into<UGenInput>) -> Self {
        self.numfeatures = v.into();
        self
    }

    /// Size of the temporal window desired (2.0 to 3.0 seconds models the human
    /// temporal window). You might use longer values for stability of estimate at the
    /// expense of reactiveness.
    pub fn windowsize(mut self, v: impl Into<UGenInput>) -> Self {
        self.windowsize = v.into();
        self
    }

    /// Relates to how many different phases to test. At the default, 50 different
    /// phases spaced by phaseaccuracy seconds would be tried out for 60bpm; 16 would
    /// be trialed for 180 bpm. Larger phaseaccuracy means more tests and more CPU
    /// cost.
    pub fn phaseaccuracy(mut self, v: impl Into<UGenInput>) -> Self {
        self.phaseaccuracy = v.into();
        self
    }

    /// If this argument is greater than 0.5, the tracker will lock at its current
    /// periodicity and continue from the current phase. Whilst it updates the model's
    /// phase and period, this is not reflected in the output until lock goes back
    /// below 0.5.
    pub fn lock(mut self, v: impl Into<UGenInput>) -> Self {
        self.lock = v.into();
        self
    }

    /// Use (-2.5) for flat weighting of tempi, (-1.5) for compensation weighting
    /// based on the number of events tested (because different periods allow
    /// different numbers of events within the temporal window) or otherwise a bufnum
    /// from 0 upwards for passing an array of 120 individual tempo weights; tempi go
    /// from 60 to 179 bpm in steps of one bpm, so you must have a buffer of 120
    /// values.
    pub fn weightingscheme(mut self, v: impl Into<UGenInput>) -> Self {
        self.weightingscheme = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.busindex);
        inputs.push(self.numfeatures);
        inputs.push(self.windowsize);
        inputs.push(self.phaseaccuracy);
        inputs.push(self.lock);
        inputs.push(self.weightingscheme);
        let num_outputs: u32 = 6;
        let idx = def.add_ugen(r"BeatTrack2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A (12TET major/minor) key tracker based on a pitch class profile of energy
/// across FFT bins and matching this to templates for major and minor scales in
/// all transpositions. It assumes a 440 Hz concert A reference. Output is 0-11 C
/// major to B major, 12-23 C minor to B minor
pub struct KeyTrack {
    _rate: Rate,
    chain: UGenInput,
    keydecay: UGenInput,
    chromaleak: UGenInput,
}

impl KeyTrack {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            keydecay: UGenInput::Constant(2.0),
            chromaleak: UGenInput::Constant(0.5),
        }
    }

    /// Audio input to track. This must have been pre-analysed by a 4096 size FFT.
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// Number of seconds for the influence of a window on the final key decision to
    /// decay by 40dB (to 0.01 its original value)
    pub fn keydecay(mut self, v: impl Into<UGenInput>) -> Self {
        self.keydecay = v.into();
        self
    }

    /// Each frame, the chroma values are set to the previous value multiplied by the
    /// chromadecay. 0.0 will start each frame afresh with no memory.
    pub fn chromaleak(mut self, v: impl Into<UGenInput>) -> Self {
        self.chromaleak = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.keydecay);
        inputs.push(self.chromaleak);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"KeyTrack", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A perceptual loudness function which outputs loudness in sones; this is a
/// variant of an MP3 perceptual model, summing excitation in ERB bands. It models
/// simple spectral and temporal masking, with equal loudness contour correction
/// in ERB bands to obtain phons (relative dB), then a phon to sone transform. The
/// final output is typically in the range of 0 to 64 sones, though higher values
/// can occur with specific synthesised stimuli.
pub struct Loudness {
    _rate: Rate,
    chain: UGenInput,
    smask: UGenInput,
    tmask: UGenInput,
}

impl Loudness {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            smask: UGenInput::Constant(0.25),
            tmask: UGenInput::Constant(1.0),
        }
    }

    /// Audio input to track, which has been pre-analysed by the FFT UGen
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// Spectral masking param: lower bins mask higher bin power within ERB bands,
    /// with a power falloff (leaky integration multiplier) of smask per bin
    pub fn smask(mut self, v: impl Into<UGenInput>) -> Self {
        self.smask = v.into();
        self
    }

    /// Temporal masking param: the phon level let through in an ERB band is the
    /// maximum of the new measurement, and the previous minus tmask phons
    pub fn tmask(mut self, v: impl Into<UGenInput>) -> Self {
        self.tmask = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.smask);
        inputs.push(self.tmask);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Loudness", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct MFCC {
    _rate: Rate,
    chain: UGenInput,
    numcoeff: UGenInput,
}

impl MFCC {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            numcoeff: UGenInput::Constant(13.0),
        }
    }

    /// Audio input to track, which has been pre-analysed by the FFT UGen
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// Number of coefficients, defaults to 13, maximum of 42
    pub fn numcoeff(mut self, v: impl Into<UGenInput>) -> Self {
        self.numcoeff = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.numcoeff);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MFCC", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// An onset detector for musical audio signals - detects the beginning of
/// notes/drumbeats/etc. Outputs a control-rate trigger signal which is 1 when an
/// onset is detected, and 0 otherwise. For the FFT chain, you should typically
/// use a frame size of 512 or 1024 (at 44.1 kHz sampling rate) and 50% hop size
/// (which is the default setting in SC). For different sampling rates choose an
/// FFT size to cover a similar time-span (around 10 to 20 ms). The onset
/// detection should work well for a general range of monophonic and polyphonic
/// audio signals. The onset detection is purely based on signal analysis and does
/// not make use of any top-down inferences such as tempo.
pub struct Onsets {
    _rate: Rate,
    chain: UGenInput,
    threshold: UGenInput,
    odftype: UGenInput,
    relaxtime: UGenInput,
    floor: UGenInput,
    mingap: UGenInput,
    medianspan: UGenInput,
    whtype: UGenInput,
    rawodf: UGenInput,
}

impl Onsets {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            threshold: UGenInput::Constant(0.5),
            odftype: UGenInput::Constant(3.0),
            relaxtime: UGenInput::Constant(1.0),
            floor: UGenInput::Constant(0.1),
            mingap: UGenInput::Constant(10.0),
            medianspan: UGenInput::Constant(11.0),
            whtype: UGenInput::Constant(1.0),
            rawodf: UGenInput::Constant(0.0),
        }
    }

    /// an FFT chain
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// the detection threshold, typically between 0 and 1, although in rare cases you
    /// may find values outside this range useful
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// the function used to analyse the signal. Options: nPOWER, MAGSUM, COMPLEX,
    /// RCOMPLEX (default), PHASE, WPHASE and MKL. Default is RCOMPLEX.
    pub fn odftype(mut self, v: impl Into<UGenInput>) -> Self {
        self.odftype = v.into();
        self
    }

    /// specifies the time (in seconds) for the normalisation to forget about a recent
    /// onset. If you find too much re-triggering (e.g. as a note dies away unevenly)
    /// then you might wish to increase this value.
    pub fn relaxtime(mut self, v: impl Into<UGenInput>) -> Self {
        self.relaxtime = v.into();
        self
    }

    /// is a lower limit, connected to the idea of how quiet the sound is expected to
    /// get without becoming indistinguishable from noise. For some cleanly-recorded
    /// classical music with wide dynamic variations, I found it helpful to go down as
    /// far as 0.000001.
    pub fn floor(mut self, v: impl Into<UGenInput>) -> Self {
        self.floor = v.into();
        self
    }

    /// specifies a minimum gap (in FFT frames) between onset detections, a
    /// brute-force way to prevent too many doubled detections.
    pub fn mingap(mut self, v: impl Into<UGenInput>) -> Self {
        self.mingap = v.into();
        self
    }

    /// specifies the size (in FFT frames) of the median window used for smoothing the
    /// detection function before triggering.
    pub fn medianspan(mut self, v: impl Into<UGenInput>) -> Self {
        self.medianspan = v.into();
        self
    }

    pub fn whtype(mut self, v: impl Into<UGenInput>) -> Self {
        self.whtype = v.into();
        self
    }

    pub fn rawodf(mut self, v: impl Into<UGenInput>) -> Self {
        self.rawodf = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.threshold);
        inputs.push(self.odftype);
        inputs.push(self.relaxtime);
        inputs.push(self.floor);
        inputs.push(self.mingap);
        inputs.push(self.medianspan);
        inputs.push(self.whtype);
        inputs.push(self.rawodf);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Onsets", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Given an FFT chain, this measures the spectral centroid, which is the weighted
/// mean frequency, or the centre of mass of the spectrum. (DC is ignored.) This
/// can be a useful indicator of the perceptual brightness of a signal.
pub struct SpecCentroid {
    _rate: Rate,
    chain: UGenInput,
}

impl SpecCentroid {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
        }
    }

    /// An FFT chain
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SpecCentroid", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Given an FFT chain this calculates the Spectral Flatness measure, defined as a
/// power spectrum's geometric mean divided by its arithmetic mean. This gives a
/// measure which ranges from approx 0 for a pure sinusoid, to approx 1 for white
/// noise. The measure is calculated linearly. For some applications you may wish
/// to convert the value to a decibel scale - an example of such conversion is
/// shown below.
pub struct SpecFlatness {
    _rate: Rate,
    chain: UGenInput,
}

impl SpecFlatness {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
        }
    }

    /// An FFT chain
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SpecFlatness", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Find a percentile of FFT magnitude spectrum" , :rates #{:kr} :doc "Given an
/// FFT chain this calculates the cumulative distribution of the frequency
/// spectrum, and outputs the frequency value which corresponds to the desired
/// percentile. For example, to find the frequency at which 90% of the spectral
/// energy lies below that frequency, you want the 90-percentile, which means the
/// value of fraction should be 0.9. The 90-percentile or 95-percentile is often
/// used as a measure of spectral roll-off. The optional third argument
/// interpolate specifies whether interpolation should be used to try and make the
/// percentile frequency estimate more accurate, at the cost of a little higher
/// CPU usage. Set it to 1 to enable this.
/// 
/// Given an FFT chain this calculates the cumulative distribution of the
/// frequency spectrum, and outputs the frequency value which corresponds to the
/// desired percentile. For example, to find the frequency at which 90% of the
/// spectral energy lies below that frequency, you want the 90-percentile, which
/// means the value of fraction should be 0.9. The 90-percentile or 95-percentile
/// is often used as a measure of spectral roll-off. The optional third argument
/// interpolate specifies whether interpolation should be used to try and make the
/// percentile frequency estimate more accurate, at the cost of a little higher
/// CPU usage. Set it to 1 to enable this.
pub struct SpecPcile {
    _rate: Rate,
    chain: UGenInput,
    fraction: UGenInput,
    interpolate: UGenInput,
}

impl SpecPcile {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            chain: UGenInput::Constant(0.0),
            fraction: UGenInput::Constant(0.5),
            interpolate: UGenInput::Constant(0.0),
        }
    }

    /// An FFT chain
    pub fn chain(mut self, v: impl Into<UGenInput>) -> Self {
        self.chain = v.into();
        self
    }

    /// percentage of the spectral energy you which to find the frequency for
    pub fn fraction(mut self, v: impl Into<UGenInput>) -> Self {
        self.fraction = v.into();
        self
    }

    /// Interpolation toggle - 0 off 1 on.
    pub fn interpolate(mut self, v: impl Into<UGenInput>) -> Self {
        self.interpolate = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.chain);
        inputs.push(self.fraction);
        inputs.push(self.interpolate);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"SpecPcile", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
