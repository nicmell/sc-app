// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// models the path of a bouncing object that is reflected by a vibrating surface
pub struct Ball {
    _rate: Rate,
    r#in: UGenInput,
    g: UGenInput,
    damp: UGenInput,
    friction: UGenInput,
}

impl Ball {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            g: UGenInput::Constant(1.0),
            damp: UGenInput::Constant(0.0),
            friction: UGenInput::Constant(0.01),
        }
    }

    /// modulated surface level
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// gravity
    pub fn g(mut self, v: impl Into<UGenInput>) -> Self {
        self.g = v.into();
        self
    }

    /// damping on impact
    pub fn damp(mut self, v: impl Into<UGenInput>) -> Self {
        self.damp = v.into();
        self
    }

    /// proximity from which on attraction to surface starts
    pub fn friction(mut self, v: impl Into<UGenInput>) -> Self {
        self.friction = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.g);
        inputs.push(self.damp);
        inputs.push(self.friction);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Ball", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A reverb coded from experiments with faust. Valid parameter range from 0 to 1.
/// Values outside this range are clipped by the UGen.
pub struct FreeVerb {
    _rate: Rate,
    r#in: UGenInput,
    mix: UGenInput,
    room: UGenInput,
    damp: UGenInput,
}

impl FreeVerb {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            mix: UGenInput::Constant(0.33),
            room: UGenInput::Constant(0.5),
            damp: UGenInput::Constant(0.5),
        }
    }

    /// The input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Dry/wet balance. range 0..1
    pub fn mix(mut self, v: impl Into<UGenInput>) -> Self {
        self.mix = v.into();
        self
    }

    /// Room size. rage 0..1
    pub fn room(mut self, v: impl Into<UGenInput>) -> Self {
        self.room = v.into();
        self
    }

    /// Reverb HF damp. range 0..1
    pub fn damp(mut self, v: impl Into<UGenInput>) -> Self {
        self.damp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.mix);
        inputs.push(self.room);
        inputs.push(self.damp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FreeVerb", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A two-channel reverb coded from experiments with faust. Valid parameter range
/// from 0 to 1. Values outside this range are clipped by the UGen.
pub struct FreeVerb2 {
    _rate: Rate,
    r#in: UGenInput,
    in2: UGenInput,
    mix: UGenInput,
    room: UGenInput,
    damp: UGenInput,
}

impl FreeVerb2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            in2: UGenInput::Constant(0.0),
            mix: UGenInput::Constant(0.33),
            room: UGenInput::Constant(0.5),
            damp: UGenInput::Constant(0.5),
        }
    }

    /// Input signal channel 1
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Input signal channel 2
    pub fn in2(mut self, v: impl Into<UGenInput>) -> Self {
        self.in2 = v.into();
        self
    }

    /// Dry/wet balance. range 0..1
    pub fn mix(mut self, v: impl Into<UGenInput>) -> Self {
        self.mix = v.into();
        self
    }

    /// Room size. rage 0..1
    pub fn room(mut self, v: impl Into<UGenInput>) -> Self {
        self.room = v.into();
        self
    }

    /// Reverb HF damp. range 0..1
    pub fn damp(mut self, v: impl Into<UGenInput>) -> Self {
        self.damp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.in2);
        inputs.push(self.mix);
        inputs.push(self.room);
        inputs.push(self.damp);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"FreeVerb2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// FreqShift implements single sideband amplitude modulation, also known as
/// frequency shifting, but not to be confused with pitch shifting. Frequency
/// shifting moves all the components of a signal by a fixed amount but does not
/// preserve the original harmonic relationships.
pub struct FreqShift {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    phase: UGenInput,
}

impl FreqShift {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(0.0),
            phase: UGenInput::Constant(0.0),
        }
    }

    /// The signal to process
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Amount of shift in cycles per second
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Phase of the frequency shift (0 - 2pi)
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.phase);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FreqShift", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// An implementation of the dynamic stochastic synthesis generator conceived by
/// Iannis Xenakis and described in Formalized Music (1992, Stuyvesant, NY:
/// Pendragon Press) chapter 9 (pp 246-254) and chapters 13 and 14 (pp 289-322).
/// The BASIC program in the book was written by Marie-Helene Serra so I think it
/// helpful to credit her too. The program code has been adapted to avoid
/// infinities in the probability distribution functions. The distributions are
/// hard-coded in C but there is an option to have new amplitude or time
/// breakpoints sampled from a continuous controller input.
pub struct Gendy1 {
    _rate: Rate,
    ampdist: UGenInput,
    durdist: UGenInput,
    adparam: UGenInput,
    ddparam: UGenInput,
    minfreq: UGenInput,
    maxfreq: UGenInput,
    ampscale: UGenInput,
    durscale: UGenInput,
    init_cps: UGenInput,
    knum: UGenInput,
}

impl Gendy1 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            ampdist: UGenInput::Constant(1.0),
            durdist: UGenInput::Constant(1.0),
            adparam: UGenInput::Constant(1.0),
            ddparam: UGenInput::Constant(1.0),
            minfreq: UGenInput::Constant(440.0),
            maxfreq: UGenInput::Constant(660.0),
            ampscale: UGenInput::Constant(0.5),
            durscale: UGenInput::Constant(0.5),
            init_cps: UGenInput::Constant(12.0),
            knum: UGenInput::Constant(12.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            ampdist: UGenInput::Constant(1.0),
            durdist: UGenInput::Constant(1.0),
            adparam: UGenInput::Constant(1.0),
            ddparam: UGenInput::Constant(1.0),
            minfreq: UGenInput::Constant(440.0),
            maxfreq: UGenInput::Constant(660.0),
            ampscale: UGenInput::Constant(0.5),
            durscale: UGenInput::Constant(0.5),
            init_cps: UGenInput::Constant(12.0),
            knum: UGenInput::Constant(12.0),
        }
    }

    /// Choice of probability distribution for the next perturbation of the amplitude
    /// of a control point. The distributions are (adapted from the GENDYN program in
    /// Formalized Music): 0- LINEAR,1- CAUCHY, 2- LOGIST, 3- HYPERBCOS, 4- ARCSINE,
    /// 5- EXPON, 6- SINUS, Where the sinus (Xenakis' name) is in this implementation
    /// taken as sampling from a third party oscillator. See example below.
    pub fn ampdist(mut self, v: impl Into<UGenInput>) -> Self {
        self.ampdist = v.into();
        self
    }

    /// Choice of distribution for the perturbation of the current inter control point
    /// duration.
    pub fn durdist(mut self, v: impl Into<UGenInput>) -> Self {
        self.durdist = v.into();
        self
    }

    /// A parameter for the shape of the amplitude probability distribution, requires
    /// values in the range 0.0001 to 1 (there are safety checks in the code so don't
    /// worry too much if you want to modulate!)
    pub fn adparam(mut self, v: impl Into<UGenInput>) -> Self {
        self.adparam = v.into();
        self
    }

    /// A parameter for the shape of the duration probability distribution, requires
    /// values in the range 0.0001 to 1
    pub fn ddparam(mut self, v: impl Into<UGenInput>) -> Self {
        self.ddparam = v.into();
        self
    }

    /// Minimum allowed frequency of oscillation for the Gendy1 oscillator, so gives
    /// the largest period the duration is allowed to take on.
    pub fn minfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.minfreq = v.into();
        self
    }

    /// Maximum allowed frequency of oscillation for the Gendy1 oscillator, so gives
    /// the smallest period the duration is allowed to take on.
    pub fn maxfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.maxfreq = v.into();
        self
    }

    /// Normally 0.0 to 1.0, multiplier for the distribution's delta value for
    /// amplitude. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
    /// amplitude.
    pub fn ampscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.ampscale = v.into();
        self
    }

    /// Normally 0.0 to 1.0, multiplier for the distribution's delta value for
    /// duration. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
    /// duration.
    pub fn durscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.durscale = v.into();
        self
    }

    /// Initialise the number of control points in the memory. Xenakis specifies 12.
    /// There would be this number of control points per cycle of the oscillator,
    /// though the oscillator's period will constantly change due to the duration
    /// distribution.
    pub fn init_cps(mut self, v: impl Into<UGenInput>) -> Self {
        self.init_cps = v.into();
        self
    }

    /// Current number of utilised control points, allows modulation.
    pub fn knum(mut self, v: impl Into<UGenInput>) -> Self {
        self.knum = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.ampdist);
        inputs.push(self.durdist);
        inputs.push(self.adparam);
        inputs.push(self.ddparam);
        inputs.push(self.minfreq);
        inputs.push(self.maxfreq);
        inputs.push(self.ampscale);
        inputs.push(self.durscale);
        inputs.push(self.init_cps);
        inputs.push(self.knum);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Gendy1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// See gendy1 help file for background. This variant of GENDYN is closer to that
/// presented in Hoffmann, Peter. (2000) The New GENDYN Program. Computer Music
/// Journal 24:2, pp 31-38.
pub struct Gendy2 {
    _rate: Rate,
    ampdist: UGenInput,
    durdist: UGenInput,
    adparam: UGenInput,
    ddparam: UGenInput,
    minfreq: UGenInput,
    maxfreq: UGenInput,
    ampscale: UGenInput,
    durscale: UGenInput,
    init_cps: UGenInput,
    knum: UGenInput,
    a: UGenInput,
    c: UGenInput,
}

impl Gendy2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            ampdist: UGenInput::Constant(1.0),
            durdist: UGenInput::Constant(1.0),
            adparam: UGenInput::Constant(1.0),
            ddparam: UGenInput::Constant(1.0),
            minfreq: UGenInput::Constant(440.0),
            maxfreq: UGenInput::Constant(660.0),
            ampscale: UGenInput::Constant(0.5),
            durscale: UGenInput::Constant(0.5),
            init_cps: UGenInput::Constant(12.0),
            knum: UGenInput::Constant(12.0),
            a: UGenInput::Constant(1.17),
            c: UGenInput::Constant(0.31),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            ampdist: UGenInput::Constant(1.0),
            durdist: UGenInput::Constant(1.0),
            adparam: UGenInput::Constant(1.0),
            ddparam: UGenInput::Constant(1.0),
            minfreq: UGenInput::Constant(440.0),
            maxfreq: UGenInput::Constant(660.0),
            ampscale: UGenInput::Constant(0.5),
            durscale: UGenInput::Constant(0.5),
            init_cps: UGenInput::Constant(12.0),
            knum: UGenInput::Constant(12.0),
            a: UGenInput::Constant(1.17),
            c: UGenInput::Constant(0.31),
        }
    }

    /// Choice of probability distribution for the next perturbation of the amplitude
    /// of a control point. The distributions are (adapted from the GENDYN program in
    /// Formalized Music): 0- LINEAR, 1- CAUCHY, 2- LOGIST, 3- HYPERBCOS, 4- ARCSINE,
    /// 5- EXPON, 6- SINUS, Where the sinus (Xenakis' name) is in this implementation
    /// taken as sampling from a third party oscillator.
    pub fn ampdist(mut self, v: impl Into<UGenInput>) -> Self {
        self.ampdist = v.into();
        self
    }

    /// Choice of distribution for the perturbation of the current inter control point
    /// duration.
    pub fn durdist(mut self, v: impl Into<UGenInput>) -> Self {
        self.durdist = v.into();
        self
    }

    /// A parameter for the shape of the amplitude probability distribution, requires
    /// values in the range 0.0001 to 1 (there are safety checks in the code so don't
    /// worry too much if you want to modulate!)
    pub fn adparam(mut self, v: impl Into<UGenInput>) -> Self {
        self.adparam = v.into();
        self
    }

    /// A parameter for the shape of the duration probability distribution, requires
    /// values in the range 0.0001 to 1
    pub fn ddparam(mut self, v: impl Into<UGenInput>) -> Self {
        self.ddparam = v.into();
        self
    }

    /// Minimum allowed frequency of oscillation for the Gendy1 oscillator, so gives
    /// the largest period the duration is allowed to take on.
    pub fn minfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.minfreq = v.into();
        self
    }

    /// Maximum allowed frequency of oscillation for the Gendy1 oscillator, so gives
    /// the smallest period the duration is allowed to take on.
    pub fn maxfreq(mut self, v: impl Into<UGenInput>) -> Self {
        self.maxfreq = v.into();
        self
    }

    /// Normally 0.0 to 1.0, multiplier for the distribution's delta value for
    /// amplitude. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
    /// amplitude.
    pub fn ampscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.ampscale = v.into();
        self
    }

    /// Normally 0.0 to 1.0, multiplier for the distribution's delta value for
    /// duration. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
    /// duration.
    pub fn durscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.durscale = v.into();
        self
    }

    /// Initialise the number of control points in the memory. Xenakis specifies 12.
    /// There would be this number of control points per cycle of the oscillator,
    /// though the oscillator's period will constantly change due to the duration
    /// distribution.
    pub fn init_cps(mut self, v: impl Into<UGenInput>) -> Self {
        self.init_cps = v.into();
        self
    }

    /// Current number of utilised control points, allows modulation.
    pub fn knum(mut self, v: impl Into<UGenInput>) -> Self {
        self.knum = v.into();
        self
    }

    /// parameter for Lehmer random number generator perturbed by Xenakis as in
    /// ((old*a)+c)%1.0
    pub fn a(mut self, v: impl Into<UGenInput>) -> Self {
        self.a = v.into();
        self
    }

    /// parameter for Lehmer random number generator perturbed by Xenakis
    pub fn c(mut self, v: impl Into<UGenInput>) -> Self {
        self.c = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.ampdist);
        inputs.push(self.durdist);
        inputs.push(self.adparam);
        inputs.push(self.ddparam);
        inputs.push(self.minfreq);
        inputs.push(self.maxfreq);
        inputs.push(self.ampscale);
        inputs.push(self.durscale);
        inputs.push(self.init_cps);
        inputs.push(self.knum);
        inputs.push(self.a);
        inputs.push(self.c);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Gendy2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// See Gendy1 help file for background. This variant of GENDYN normalises the
/// durations in each period to force oscillation at the desired pitch. The
/// breakpoints still get perturbed as in Gendy1. There is some glitching in the
/// oscillator caused by the stochastic effects: control points as they vary cause
/// big local jumps of amplitude. Put ampscale and durscale low to minimise this.
/// All parameters can be modulated at control rate except for initCPs which is
/// used only at initialisation.
pub struct Gendy3 {
    _rate: Rate,
    ampdist: UGenInput,
    durdist: UGenInput,
    adparam: UGenInput,
    ddparam: UGenInput,
    freq: UGenInput,
    ampscale: UGenInput,
    durscale: UGenInput,
    init_cps: UGenInput,
    knum: UGenInput,
}

impl Gendy3 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            ampdist: UGenInput::Constant(1.0),
            durdist: UGenInput::Constant(1.0),
            adparam: UGenInput::Constant(1.0),
            ddparam: UGenInput::Constant(1.0),
            freq: UGenInput::Constant(440.0),
            ampscale: UGenInput::Constant(0.5),
            durscale: UGenInput::Constant(0.5),
            init_cps: UGenInput::Constant(12.0),
            knum: UGenInput::Constant(12.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            ampdist: UGenInput::Constant(1.0),
            durdist: UGenInput::Constant(1.0),
            adparam: UGenInput::Constant(1.0),
            ddparam: UGenInput::Constant(1.0),
            freq: UGenInput::Constant(440.0),
            ampscale: UGenInput::Constant(0.5),
            durscale: UGenInput::Constant(0.5),
            init_cps: UGenInput::Constant(12.0),
            knum: UGenInput::Constant(12.0),
        }
    }

    /// Choice of probability distribution for the next perturbation of the amplitude
    /// of a control point. The distributions are (adapted from the GENDYN program in
    /// Formalized Music): 0- LINEAR,1- CAUCHY, 2- LOGIST, 3- HYPERBCOS, 4- ARCSINE,
    /// 5- EXPON, 6- SINUS, Where the sinus (Xenakis' name) is in this implementation
    /// taken as sampling from a third party oscillator.
    pub fn ampdist(mut self, v: impl Into<UGenInput>) -> Self {
        self.ampdist = v.into();
        self
    }

    /// Choice of distribution for the perturbation of the current inter control point
    /// duration.
    pub fn durdist(mut self, v: impl Into<UGenInput>) -> Self {
        self.durdist = v.into();
        self
    }

    /// A parameter for the shape of the amplitude probability distribution, requires
    /// values in the range 0.0001 to 1 (there are safety checks in the code so don't
    /// worry too much if you want to modulate!)
    pub fn adparam(mut self, v: impl Into<UGenInput>) -> Self {
        self.adparam = v.into();
        self
    }

    /// A parameter for the shape of the duration probability distribution, requires
    /// values in the range 0.0001 to 1
    pub fn ddparam(mut self, v: impl Into<UGenInput>) -> Self {
        self.ddparam = v.into();
        self
    }

    /// Oscillation frquency.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// Normally 0.0 to 1.0, multiplier for the distribution's delta value for
    /// amplitude. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
    /// amplitude.
    pub fn ampscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.ampscale = v.into();
        self
    }

    /// Normally 0.0 to 1.0, multiplier for the distribution's delta value for
    /// duration. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
    /// duration.
    pub fn durscale(mut self, v: impl Into<UGenInput>) -> Self {
        self.durscale = v.into();
        self
    }

    /// Initialise the number of control points in the memory. Xenakis specifies 12.
    /// There would be this number of control points per cycle of the oscillator,
    /// though the oscillator's period will constantly change due to the duration
    /// distribution.
    pub fn init_cps(mut self, v: impl Into<UGenInput>) -> Self {
        self.init_cps = v.into();
        self
    }

    /// Current number of utilised control points, allows modulation.
    pub fn knum(mut self, v: impl Into<UGenInput>) -> Self {
        self.knum = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.ampdist);
        inputs.push(self.durdist);
        inputs.push(self.adparam);
        inputs.push(self.ddparam);
        inputs.push(self.freq);
        inputs.push(self.ampscale);
        inputs.push(self.durscale);
        inputs.push(self.init_cps);
        inputs.push(self.knum);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Gendy3", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A two-channel reverb UGen, based on the \"GVerb\" LADSPA effect by Juhana
/// Sadeharju (kouhia at nic.funet.fi). WARNING - in the current version of the
/// server, there are severe noise issues when you attempt to modify the roomsize
/// or set it to a value greater than 40.
pub struct GVerb {
    _rate: Rate,
    r#in: UGenInput,
    roomsize: UGenInput,
    revtime: UGenInput,
    damping: UGenInput,
    inputbw: UGenInput,
    spread: UGenInput,
    drylevel: UGenInput,
    earlyreflevel: UGenInput,
    taillevel: UGenInput,
    maxroomsize: UGenInput,
}

impl GVerb {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            roomsize: UGenInput::Constant(10.0),
            revtime: UGenInput::Constant(3.0),
            damping: UGenInput::Constant(0.5),
            inputbw: UGenInput::Constant(0.5),
            spread: UGenInput::Constant(15.0),
            drylevel: UGenInput::Constant(1.0),
            earlyreflevel: UGenInput::Constant(0.7),
            taillevel: UGenInput::Constant(0.5),
            maxroomsize: UGenInput::Constant(300.0),
        }
    }

    /// mono input
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// in squared meters.
    pub fn roomsize(mut self, v: impl Into<UGenInput>) -> Self {
        self.roomsize = v.into();
        self
    }

    /// in seconds
    pub fn revtime(mut self, v: impl Into<UGenInput>) -> Self {
        self.revtime = v.into();
        self
    }

    /// 0 to 1, high frequency rolloff, 0 damps the reverb signal completely, 1 not at
    /// all
    pub fn damping(mut self, v: impl Into<UGenInput>) -> Self {
        self.damping = v.into();
        self
    }

    /// 0 to 1, same as damping control, but on the input signal
    pub fn inputbw(mut self, v: impl Into<UGenInput>) -> Self {
        self.inputbw = v.into();
        self
    }

    /// a control on the stereo spread and diffusion of the reverb signal
    pub fn spread(mut self, v: impl Into<UGenInput>) -> Self {
        self.spread = v.into();
        self
    }

    /// amount of dry signal
    pub fn drylevel(mut self, v: impl Into<UGenInput>) -> Self {
        self.drylevel = v.into();
        self
    }

    /// amount of early reflection level
    pub fn earlyreflevel(mut self, v: impl Into<UGenInput>) -> Self {
        self.earlyreflevel = v.into();
        self
    }

    /// amount of tail level
    pub fn taillevel(mut self, v: impl Into<UGenInput>) -> Self {
        self.taillevel = v.into();
        self
    }

    /// to set the size of the delay lines.
    pub fn maxroomsize(mut self, v: impl Into<UGenInput>) -> Self {
        self.maxroomsize = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.roomsize);
        inputs.push(self.revtime);
        inputs.push(self.damping);
        inputs.push(self.inputbw);
        inputs.push(self.spread);
        inputs.push(self.drylevel);
        inputs.push(self.earlyreflevel);
        inputs.push(self.taillevel);
        inputs.push(self.maxroomsize);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"GVerb", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct Hilbert {
    _rate: Rate,
    r#in: UGenInput,
}

impl Hilbert {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
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
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"Hilbert", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A digital implementation of the Moog VCF (filter).
pub struct MoogFF {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    gain: UGenInput,
    reset: UGenInput,
}

impl MoogFF {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(100.0),
            gain: UGenInput::Constant(2.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(100.0),
            gain: UGenInput::Constant(2.0),
            reset: UGenInput::Constant(0.0),
        }
    }

    /// The input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// The cutoff frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// The filter resonance gain, between zero and 4
    pub fn gain(mut self, v: impl Into<UGenInput>) -> Self {
        self.gain = v.into();
        self
    }

    /// When greater than zero, this will reset the state of the digital filters at
    /// the beginning of a computational block.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.gain);
        inputs.push(self.reset);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"MoogFF", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Partitioned convolution. Various additional buffers must be supplied. Mono
/// impulse response only! If inputting multiple channels, you'll need independent
/// PartConvs, one for each channel. But the charm is: impulse response can be as
/// large as you like (CPU load increases with IR size. Various tradeoffs based on
/// fftsize choice, due to rarer but larger FFTs. This plug-in uses amortisation
/// to spread processing and avoid spikes). Normalisation factors difficult to
/// anticipate; convolution piles up multiple copies of the input on top of
/// itself, so can easily overload.
pub struct PartConv {
    _rate: Rate,
    r#in: UGenInput,
    fftsize: UGenInput,
    irbufnum: UGenInput,
}

impl PartConv {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            fftsize: UGenInput::Constant(0.0),
            irbufnum: UGenInput::Constant(0.0),
        }
    }

    /// Processing target.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Spectral convolution partition size (twice partition size). You must ensure
    /// that the blocksize divides the partition size and there are at least two
    /// blocks per partition (to allow for amortisation)
    pub fn fftsize(mut self, v: impl Into<UGenInput>) -> Self {
        self.fftsize = v.into();
        self
    }

    /// Prepared buffer of spectra for each partition of the inpulse response
    pub fn irbufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.irbufnum = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.fftsize);
        inputs.push(self.irbufnum);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PartConv", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A time domain granular pitch shifter. Grains have a triangular amplitude
/// envelope and an overlap of 4:1.
pub struct PitchShift {
    _rate: Rate,
    r#in: UGenInput,
    window_size: UGenInput,
    pitch_ratio: UGenInput,
    pitch_dispersion: UGenInput,
    time_dispersion: UGenInput,
}

impl PitchShift {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            window_size: UGenInput::Constant(0.2),
            pitch_ratio: UGenInput::Constant(1.0),
            pitch_dispersion: UGenInput::Constant(0.0),
            time_dispersion: UGenInput::Constant(0.0),
        }
    }

    /// The input signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// The size of the grain window in seconds. This value cannot be modulated.
    pub fn window_size(mut self, v: impl Into<UGenInput>) -> Self {
        self.window_size = v.into();
        self
    }

    /// The ratio of the pitch shift. Must be from 0.0 to 4.0
    pub fn pitch_ratio(mut self, v: impl Into<UGenInput>) -> Self {
        self.pitch_ratio = v.into();
        self
    }

    /// The maximum random deviation of the pitch from the pitchRatio.
    pub fn pitch_dispersion(mut self, v: impl Into<UGenInput>) -> Self {
        self.pitch_dispersion = v.into();
        self
    }

    /// A random offset of from zero to timeDispersion seconds is added to the delay
    /// of each grain. Use of some dispersion can alleviate a hard comb filter effect
    /// due to uniform grain placement. It can also be an effect in itself.
    /// timeDispersion can be no larger than windowSize.
    pub fn time_dispersion(mut self, v: impl Into<UGenInput>) -> Self {
        self.time_dispersion = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.window_size);
        inputs.push(self.pitch_ratio);
        inputs.push(self.pitch_dispersion);
        inputs.push(self.time_dispersion);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PitchShift", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Implements the Karplus-Strong style of synthesis, where a delay line (normally
/// starting with noise) is filtered and fed back on itself so that over time it
/// becomes periodic.
pub struct Pluck {
    _rate: Rate,
    r#in: UGenInput,
    trig: UGenInput,
    maxdelaytime: UGenInput,
    delaytime: UGenInput,
    decaytime: UGenInput,
    coef: UGenInput,
}

impl Pluck {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            trig: UGenInput::Constant(1.0),
            maxdelaytime: UGenInput::Constant(0.2),
            delaytime: UGenInput::Constant(0.2),
            decaytime: UGenInput::Constant(1.0),
            coef: UGenInput::Constant(0.5),
        }
    }

    /// An excitation signal.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Upon a negative to positive transition, the excitation signal will be fed into
    /// the delay line.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// The max delay time in seconds (initializes the internal delay buffer).
    pub fn maxdelaytime(mut self, v: impl Into<UGenInput>) -> Self {
        self.maxdelaytime = v.into();
        self
    }

    /// Delay time in seconds.
    pub fn delaytime(mut self, v: impl Into<UGenInput>) -> Self {
        self.delaytime = v.into();
        self
    }

    /// Time for the echoes to decay by 60 decibels. Negative times emphasize odd
    /// partials.
    pub fn decaytime(mut self, v: impl Into<UGenInput>) -> Self {
        self.decaytime = v.into();
        self
    }

    /// The coef of the internal OnePole filter. Values should be between -1 and +1
    /// (larger values will be unstable... so be careful!).
    pub fn coef(mut self, v: impl Into<UGenInput>) -> Self {
        self.coef = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.trig);
        inputs.push(self.maxdelaytime);
        inputs.push(self.delaytime);
        inputs.push(self.decaytime);
        inputs.push(self.coef);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Pluck", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Physical model of resonating spring
pub struct Spring {
    _rate: Rate,
    r#in: UGenInput,
    spring: UGenInput,
    damp: UGenInput,
}

impl Spring {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            spring: UGenInput::Constant(0.0),
            damp: UGenInput::Constant(0.0),
        }
    }

    /// Modulated input force
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Spring constant (incl. mass)
    pub fn spring(mut self, v: impl Into<UGenInput>) -> Self {
        self.spring = v.into();
        self
    }

    /// Damping
    pub fn damp(mut self, v: impl Into<UGenInput>) -> Self {
        self.damp = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.spring);
        inputs.push(self.damp);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Spring", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// models the impacts of a bouncing object that is reflected by a vibrating
/// surface
pub struct TBall {
    _rate: Rate,
    r#in: UGenInput,
    g: UGenInput,
    damp: UGenInput,
    friction: UGenInput,
}

impl TBall {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            g: UGenInput::Constant(10.0),
            damp: UGenInput::Constant(0.0),
            friction: UGenInput::Constant(0.01),
        }
    }

    /// modulated surface level
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// gravity
    pub fn g(mut self, v: impl Into<UGenInput>) -> Self {
        self.g = v.into();
        self
    }

    /// damping on impact
    pub fn damp(mut self, v: impl Into<UGenInput>) -> Self {
        self.damp = v.into();
        self
    }

    /// proximity from which on attraction to surface starts
    pub fn friction(mut self, v: impl Into<UGenInput>) -> Self {
        self.friction = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.g);
        inputs.push(self.damp);
        inputs.push(self.friction);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TBall", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
