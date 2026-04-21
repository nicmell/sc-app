// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Strict convolution of two continuously changing inputs. Also see convolution2
/// for a cheaper CPU cost alternative for the case of a fixed kernel which can be
/// changed with a trigger message. See Steven W Smith, The Scientist and
/// Engineer's Guide to Digital Signal Processing: chapter 18: http://
/// www.dspguide.com/ch18.htm
pub struct Convolution {
    _rate: Rate,
    r#in: UGenInput,
    kernel: UGenInput,
    framesize: UGenInput,
}

impl Convolution {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            kernel: UGenInput::Constant(0.0),
            framesize: UGenInput::Constant(512.0),
        }
    }

    /// processing target
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// processing kernel.
    pub fn kernel(mut self, v: impl Into<UGenInput>) -> Self {
        self.kernel = v.into();
        self
    }

    /// size of FFT frame, must be a power of two
    pub fn framesize(mut self, v: impl Into<UGenInput>) -> Self {
        self.framesize = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.kernel);
        inputs.push(self.framesize);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Convolution", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Strict convolution with fixed kernel which can be updated using a trigger
/// signal. See Steven W Smith, The Scientist and Engineer's Guide to Digital
/// Signal Processing: chapter 18: http:// www.dspguide.com/ch18.htm
pub struct Convolution2 {
    _rate: Rate,
    r#in: UGenInput,
    kernel: UGenInput,
    trigger: UGenInput,
    framesize: UGenInput,
}

impl Convolution2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            kernel: UGenInput::Constant(0.0),
            trigger: UGenInput::Constant(0.0),
            framesize: UGenInput::Constant(512.0),
        }
    }

    /// processing target
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// buffer index for the fixed kernel, may be modulated in combination with the
    /// trigger
    pub fn kernel(mut self, v: impl Into<UGenInput>) -> Self {
        self.kernel = v.into();
        self
    }

    /// update the kernel on a change from <= 0 to > 0
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of FFT frame, must be a power of two. Convolution uses twice this number
    /// internally, maximum value you can give this argument is 2^16 = 65536. Note
    /// that it gets progressively more expensive to run for higher powers! 512, 1024,
    /// 2048, 4096 standard.
    pub fn framesize(mut self, v: impl Into<UGenInput>) -> Self {
        self.framesize = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.kernel);
        inputs.push(self.trigger);
        inputs.push(self.framesize);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Convolution2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Strict convolution with fixed kernel which can be updated using a trigger
/// signal. There is a linear crossfade between the buffers upon change. See
/// Steven W Smith, The Scientist and Engineer's Guide to Digital Signal
/// Processing: chapter 18: http://www.dspguide.com/ch18.htm
pub struct Convolution2L {
    _rate: Rate,
    r#in: UGenInput,
    kernel: UGenInput,
    trigger: UGenInput,
    framesize: UGenInput,
    crossfade: UGenInput,
}

impl Convolution2L {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            kernel: UGenInput::Constant(0.0),
            trigger: UGenInput::Constant(0.0),
            framesize: UGenInput::Constant(512.0),
            crossfade: UGenInput::Constant(1.0),
        }
    }

    /// processing target
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// buffer index for the fixed kernel, may be modulated in combination with the
    /// trigger
    pub fn kernel(mut self, v: impl Into<UGenInput>) -> Self {
        self.kernel = v.into();
        self
    }

    /// update the kernel on a change from <= 0 to > 0
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of FFT frame, must be a power of two. Convolution uses twice this number
    /// internally, maximum value you can give this argument is 2^16=65536. Note that
    /// it gets progressively more expensive to run for higher powers! 512, 1024,
    /// 2048, 4096 standard.
    pub fn framesize(mut self, v: impl Into<UGenInput>) -> Self {
        self.framesize = v.into();
        self
    }

    /// The number of periods over which a crossfade is made. The default is 1. This
    /// must be an integer.
    pub fn crossfade(mut self, v: impl Into<UGenInput>) -> Self {
        self.crossfade = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.kernel);
        inputs.push(self.trigger);
        inputs.push(self.framesize);
        inputs.push(self.crossfade);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Convolution2L", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Strict convolution with fixed kernel which can be updated using a trigger
/// signal. The convolution is performed in the time domain, which is highly
/// inefficient, and probably only useful for either very short kernel sizes, or
/// for control rate signals.
pub struct Convolution3 {
    _rate: Rate,
    r#in: UGenInput,
    kernel: UGenInput,
    trigger: UGenInput,
    framesize: UGenInput,
}

impl Convolution3 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            kernel: UGenInput::Constant(0.0),
            trigger: UGenInput::Constant(0.0),
            framesize: UGenInput::Constant(512.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            kernel: UGenInput::Constant(0.0),
            trigger: UGenInput::Constant(0.0),
            framesize: UGenInput::Constant(512.0),
        }
    }

    /// processing target
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// buffer index for the fixed kernel, may be modulated in combination with the
    /// trigger
    pub fn kernel(mut self, v: impl Into<UGenInput>) -> Self {
        self.kernel = v.into();
        self
    }

    /// update the kernel on a change from <= 0 to > 0
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of FFT frame, does not have to be a power of two.
    pub fn framesize(mut self, v: impl Into<UGenInput>) -> Self {
        self.framesize = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.kernel);
        inputs.push(self.trigger);
        inputs.push(self.framesize);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Convolution3", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Applies the conformal mapping z -> (z-a)/(1-za*) to the phase vocoder bins z
/// with a given by the real and imag inputs to the UGen. i.e., makes a
/// transformation of the complex plane so the output is full of phase vocoder
/// artifacts but may be musically fun. Usually keep |a|<1 but you can of course
/// try bigger values to make it really noisy. a=0 should give back the input
/// mostly unperturbed. See http://mathworld.wolfram.com/ConformalMapping.html
pub struct PV_ConformalMap {
    _rate: Rate,
    buffer: UGenInput,
    areal: UGenInput,
    aimag: UGenInput,
}

impl PV_ConformalMap {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            buffer: UGenInput::Constant(0.0),
            areal: UGenInput::Constant(0.0),
            aimag: UGenInput::Constant(0.0),
        }
    }

    /// buffer number of buffer to act on, passed in through a chain (see examples
    /// below).
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// real part of a.
    pub fn areal(mut self, v: impl Into<UGenInput>) -> Self {
        self.areal = v.into();
        self
    }

    /// imaginary part of a.
    pub fn aimag(mut self, v: impl Into<UGenInput>) -> Self {
        self.aimag = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.areal);
        inputs.push(self.aimag);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_ConformalMap", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// FFT onset detector based on work described in: Hainsworth, S. (2003)
/// Techniques for the Automated Analysis of Musical Audio. PhD, University of
/// Cambridge engineering dept. See especially p128. The Hainsworth metric is a
/// modification of the Kullback Liebler distance. The onset detector has general
/// ability to spot spectral change, so may have some ability to track chord
/// changes aside from obvious transient jolts, but there's no guarantee it won't
/// be confused by frequency modulation artifacts. Hainsworth metric on it's own
/// gives good results but Foote might be useful in some situations: experimental.
pub struct PV_HainsworthFoote {
    _rate: Rate,
    buffer: UGenInput,
    proph: UGenInput,
    propf: UGenInput,
    threshold: UGenInput,
    wait_time: UGenInput,
}

impl PV_HainsworthFoote {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buffer: UGenInput::Constant(0.0),
            proph: UGenInput::Constant(0.0),
            propf: UGenInput::Constant(0.0),
            threshold: UGenInput::Constant(1.0),
            wait_time: UGenInput::Constant(0.04),
        }
    }

    /// FFT buffer to read from
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// What strength of detection signal from Hainsworth metric to use.
    pub fn proph(mut self, v: impl Into<UGenInput>) -> Self {
        self.proph = v.into();
        self
    }

    /// What strength of detection signal from Foote metric to use. The Foote metric
    /// is normalised to [0.0,1.0]
    pub fn propf(mut self, v: impl Into<UGenInput>) -> Self {
        self.propf = v.into();
        self
    }

    /// Threshold hold level for allowing a detection
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// If triggered, minimum wait until a further frame can cause another spot
    /// (useful to stop multiple detects on heavy signals)
    pub fn wait_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.wait_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.proph);
        inputs.push(self.propf);
        inputs.push(self.threshold);
        inputs.push(self.wait_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_HainsworthFoote", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// FFT feature detector for onset detection based on work described in: Jensen,K.
/// & Andersen, T. H. (2003). Real-time Beat Estimation Using Feature Extraction.
/// In Proceedings of the Computer Music Modeling and Retrieval Symposium, Lecture
/// Notes in Computer Science. Springer Verlag. First order derivatives of the
/// features are taken. Threshold may need to be set low to pick up on changes.
pub struct PV_JensenAndersen {
    _rate: Rate,
    buffer: UGenInput,
    propsc: UGenInput,
    prophfe: UGenInput,
    prophfc: UGenInput,
    propsf: UGenInput,
    threshold: UGenInput,
    wait_time: UGenInput,
}

impl PV_JensenAndersen {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            buffer: UGenInput::Constant(0.0),
            propsc: UGenInput::Constant(0.25),
            prophfe: UGenInput::Constant(0.25),
            prophfc: UGenInput::Constant(0.25),
            propsf: UGenInput::Constant(0.25),
            threshold: UGenInput::Constant(1.0),
            wait_time: UGenInput::Constant(0.04),
        }
    }

    /// FFT buffer to read from.
    pub fn buffer(mut self, v: impl Into<UGenInput>) -> Self {
        self.buffer = v.into();
        self
    }

    /// Proportion of spectral centroid feature.
    pub fn propsc(mut self, v: impl Into<UGenInput>) -> Self {
        self.propsc = v.into();
        self
    }

    /// Proportion of high frequency energy feature.
    pub fn prophfe(mut self, v: impl Into<UGenInput>) -> Self {
        self.prophfe = v.into();
        self
    }

    /// Proportion of high frequency content feature.
    pub fn prophfc(mut self, v: impl Into<UGenInput>) -> Self {
        self.prophfc = v.into();
        self
    }

    /// Proportion of spectral flux feature.
    pub fn propsf(mut self, v: impl Into<UGenInput>) -> Self {
        self.propsf = v.into();
        self
    }

    /// Threshold level for allowing a detection
    pub fn threshold(mut self, v: impl Into<UGenInput>) -> Self {
        self.threshold = v.into();
        self
    }

    /// If triggered, minimum wait until a further frame can cause another spot
    /// (useful to stop multiple detects on heavy signals)
    pub fn wait_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.wait_time = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.buffer);
        inputs.push(self.propsc);
        inputs.push(self.prophfe);
        inputs.push(self.prophfc);
        inputs.push(self.propsf);
        inputs.push(self.threshold);
        inputs.push(self.wait_time);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PV_JensenAndersen", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A running sum over a user specified number of samples, useful for running RMS
/// power windowing.
pub struct RunningSum {
    _rate: Rate,
    r#in: UGenInput,
    numsamp: UGenInput,
}

impl RunningSum {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            numsamp: UGenInput::Constant(40.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            numsamp: UGenInput::Constant(40.0),
        }
    }

    /// Input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// How many samples to take the running sum over (initialisation time only, not
    /// modulatable.
    pub fn numsamp(mut self, v: impl Into<UGenInput>) -> Self {
        self.numsamp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.numsamp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"RunningSum", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Strict convolution with fixed kernel which can be updated using a trigger
/// signal. There is a linear crossfade between the buffers upon change. Like
/// convolution2L, but convolves with two buffers and outputs a stereo signal.
/// This saves one FFT transformation per period, as compared to using two copies
/// of convolution2L. Useful applications could include stereo reverberation or
/// HRTF convolution. See Steven W Smith, The Scientist and Engineer's Guide to
/// Digital Signal Processing: chapter 18: http://www.dspguide.com/ch18.htm
pub struct StereoConvolution2L {
    _rate: Rate,
    r#in: UGenInput,
    kernel_l: UGenInput,
    kernel_r: UGenInput,
    trigger: UGenInput,
    framesize: UGenInput,
    crossfade: UGenInput,
}

impl StereoConvolution2L {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            kernel_l: UGenInput::Constant(0.0),
            kernel_r: UGenInput::Constant(0.0),
            trigger: UGenInput::Constant(0.0),
            framesize: UGenInput::Constant(512.0),
            crossfade: UGenInput::Constant(1.0),
        }
    }

    /// processing target
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// buffer index for the fixed kernel of the left channel, may be modulated in
    /// combination with the trigger
    pub fn kernel_l(mut self, v: impl Into<UGenInput>) -> Self {
        self.kernel_l = v.into();
        self
    }

    /// buffer index for the fixed kernel of the right channel, may be modulated in
    /// combination with the trigger
    pub fn kernel_r(mut self, v: impl Into<UGenInput>) -> Self {
        self.kernel_r = v.into();
        self
    }

    /// update the kernel on a change from <= 0 to > 0
    pub fn trigger(mut self, v: impl Into<UGenInput>) -> Self {
        self.trigger = v.into();
        self
    }

    /// size of FFT frame, must be a power of two. Convolution uses twice this number
    /// internally, maximum value you can give this argument is 2^16=65536. Note that
    /// it gets progressively more expensive to run for higher powers! 512, 1024,
    /// 2048, 4096 standard.
    pub fn framesize(mut self, v: impl Into<UGenInput>) -> Self {
        self.framesize = v.into();
        self
    }

    /// The number of periods over which a crossfade is made. This must be an integer.
    pub fn crossfade(mut self, v: impl Into<UGenInput>) -> Self {
        self.crossfade = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.kernel_l);
        inputs.push(self.kernel_r);
        inputs.push(self.trigger);
        inputs.push(self.framesize);
        inputs.push(self.crossfade);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"StereoConvolution2L", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
