// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// All pass filter based on the Second Order Section (SOS) biquad UGen
pub struct BAllPass {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl BAllPass {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
            rq: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed.
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency.
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq.
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
        let idx = def.add_ugen(r"BAllPass", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Band pass filter based on the Second Order Section (SOS) biquad UGen
pub struct BBandPass {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    bw: UGenInput,
}

impl BBandPass {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
            bw: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the bandwidth in octaves between -3 dB frequencies
    pub fn bw(mut self, v: impl Into<UGenInput>) -> Self {
        self.bw = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.bw);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BBandPass", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Band reject filter based on the Second Order Section (SOS) biquad UGen
pub struct BBandStop {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    bw: UGenInput,
}

impl BBandStop {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
            bw: UGenInput::Constant(1.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the bandwidth in octaves between -3 dB frequencies
    pub fn bw(mut self, v: impl Into<UGenInput>) -> Self {
        self.bw = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.freq);
        inputs.push(self.bw);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BBandStop", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// 12db/oct rolloff - 2nd order resonant Hi Pass Filter based on the Second Order
/// Section (SOS) biquad UGen.
pub struct BHiPass {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl BHiPass {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
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
        let idx = def.add_ugen(r"BHiPass", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Hi shelfbased on the Second Order Section (SOS) biquad UGen
pub struct BHiShelf {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rs: UGenInput,
    db: UGenInput,
}

impl BHiShelf {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
            rs: UGenInput::Constant(1.0),
            db: UGenInput::Constant(0.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of S. Shell boost/cut slope. When S = 1, the shelf slope is as
    /// steep as it can be and remain monotonically increasing or decreasing gain with
    /// frequency. The shelf slope, in dB/octave, remains proportional to S for all
    /// other values for a fixed freq/SampleRate.ir and db.
    pub fn rs(mut self, v: impl Into<UGenInput>) -> Self {
        self.rs = v.into();
        self
    }

    /// gain. boost/cut the center frequency in dBs
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
        inputs.push(self.rs);
        inputs.push(self.db);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BHiShelf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// 12db/oct rolloff - 2nd order resonant Low Pass Filter based on the Second
/// Order Section (SOS) biquad UGen
pub struct BLowPass {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
}

impl BLowPass {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
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
        let idx = def.add_ugen(r"BLowPass", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Low shelf based on the Second Order Section (SOS) biquad UGen
pub struct BLowShelf {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rs: UGenInput,
    db: UGenInput,
}

impl BLowShelf {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
            rs: UGenInput::Constant(1.0),
            db: UGenInput::Constant(0.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of S. Shell boost/cut slope. When S = 1, the shelf slope is as
    /// steep as it can be and remain monotonically increasing or decreasing gain with
    /// frequency. The shelf slope, in dB/octave, remains proportional to S for all
    /// other values for a fixed freq/SampleRate.ir and db.
    pub fn rs(mut self, v: impl Into<UGenInput>) -> Self {
        self.rs = v.into();
        self
    }

    /// gain. boost/cut the center frequency in dBs
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
        inputs.push(self.rs);
        inputs.push(self.db);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"BLowShelf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Parametric equalizer based on the Second Order Section (SOS) biquad UGen
pub struct BPeakEQ {
    _rate: Rate,
    r#in: UGenInput,
    freq: UGenInput,
    rq: UGenInput,
    db: UGenInput,
}

impl BPeakEQ {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            freq: UGenInput::Constant(1200.0),
            rq: UGenInput::Constant(1.0),
            db: UGenInput::Constant(0.0),
        }
    }

    /// input signal to be processed
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// center frequency
    pub fn freq(mut self, v: impl Into<UGenInput>) -> Self {
        self.freq = v.into();
        self
    }

    /// the reciprocal of Q. bandwidth / cutoffFreq
    pub fn rq(mut self, v: impl Into<UGenInput>) -> Self {
        self.rq = v.into();
        self
    }

    /// boost/cut the center frequency (in dBs)
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
        let idx = def.add_ugen(r"BPeakEQ", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
