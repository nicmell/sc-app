// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Outputs a one when the src ugen (typically an envelope) has finished
pub struct Done {
    _rate: Rate,
    src: UGenInput,
}

impl Done {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            src: UGenInput::Constant(0.0),
        }
    }

    /// ugen to monitor
    pub fn src(mut self, v: impl Into<UGenInput>) -> Self {
        self.src = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.src);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Done", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// envelope generator, interpolates across a path of control points over time,
/// see the overtone.sc.envelope functions to generate the control points array
/// Note: The actual minimum duration of a segment is not zero, but one sample
/// step for audio rate and one block for control rate. This may result in
/// asynchronicity when in two envelopes of different number of levels, the
/// envelope times add up to the same total duration. Similarly, when modulating
/// times, the new time is only updated at the end of the current segment - this
/// may lead to asynchronicity of two envelopes with modulated times.
pub struct EnvGen {
    _rate: Rate,
    envelope: UGenInput,
    gate: UGenInput,
    level_scale: UGenInput,
    level_bias: UGenInput,
    time_scale: UGenInput,
    action: UGenInput,
}

impl EnvGen {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            envelope: UGenInput::Constant(0.0),
            gate: UGenInput::Constant(1.0),
            level_scale: UGenInput::Constant(1.0),
            level_bias: UGenInput::Constant(0.0),
            time_scale: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            envelope: UGenInput::Constant(0.0),
            gate: UGenInput::Constant(1.0),
            level_scale: UGenInput::Constant(1.0),
            level_bias: UGenInput::Constant(0.0),
            time_scale: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// an Array of Controls.
    pub fn envelope(mut self, v: impl Into<UGenInput>) -> Self {
        self.envelope = v.into();
        self
    }

    /// this triggers the envelope and holds it open while > 0. If the envelope is
    /// fixed-length (e.g. perc), the gate argument is used as a simple trigger. If it
    /// is an sustaining envelope (e.g. adsr, asr), the envelope is held open until
    /// the gate becomes 0, at which point is released. If the gate of an env-gen is
    /// set to -1 or below, then the envelope will cutoff immediately. The time for it
    /// to cutoff is the amount less than -1, with -1 being as fast as possible, -1.5
    /// being a cutoff in 0.5 seconds, etc. The cutoff shape is linear.
    pub fn gate(mut self, v: impl Into<UGenInput>) -> Self {
        self.gate = v.into();
        self
    }

    /// scales the levels of the breakpoints.
    pub fn level_scale(mut self, v: impl Into<UGenInput>) -> Self {
        self.level_scale = v.into();
        self
    }

    /// offsets the levels of the breakpoints.
    pub fn level_bias(mut self, v: impl Into<UGenInput>) -> Self {
        self.level_bias = v.into();
        self
    }

    /// scales the durations of the segments.
    pub fn time_scale(mut self, v: impl Into<UGenInput>) -> Self {
        self.time_scale = v.into();
        self
    }

    /// an integer representing an action to be executed when the env is finished
    /// playing. This can be used to free the enclosing synth, etc.
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.envelope);
        inputs.push(self.gate);
        inputs.push(self.level_scale);
        inputs.push(self.level_bias);
        inputs.push(self.time_scale);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"EnvGen", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Free the specified node when triggered
pub struct Free {
    _rate: Rate,
    trig: UGenInput,
    id: UGenInput,
}

impl Free {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            id: UGenInput::Constant(0.0),
        }
    }

    /// when triggered, frees node
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// node to be freed
    pub fn id(mut self, v: impl Into<UGenInput>) -> Self {
        self.id = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.id);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Free", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Free the enclosing synth when triggered
pub struct FreeSelf {
    _rate: Rate,
    r#in: UGenInput,
}

impl FreeSelf {
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
        let idx = def.add_ugen(r"FreeSelf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Free the enclosing synth when the src ugen finishes (e.g. env-gen, play-buf,
/// linen...)
pub struct FreeSelfWhenDone {
    _rate: Rate,
    src: UGenInput,
}

impl FreeSelfWhenDone {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            src: UGenInput::Constant(0.0),
        }
    }

    /// the ugen to check for done
    pub fn src(mut self, v: impl Into<UGenInput>) -> Self {
        self.src = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.src);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"FreeSelfWhenDone", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct IEnvGen {
    _rate: Rate,
    ienvelope: UGenInput,
    index: UGenInput,
}

impl IEnvGen {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            ienvelope: UGenInput::Constant(0.0),
            index: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            ienvelope: UGenInput::Constant(0.0),
            index: UGenInput::Constant(0.0),
        }
    }

    /// an InterplEnv (this is static for the life of the UGen)
    pub fn ienvelope(mut self, v: impl Into<UGenInput>) -> Self {
        self.ienvelope = v.into();
        self
    }

    /// a point to access within the InterplEnv
    pub fn index(mut self, v: impl Into<UGenInput>) -> Self {
        self.index = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.ienvelope);
        inputs.push(self.index);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"IEnvGen", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A linear envelope generator, rises to sus-level over attack-time seconds and
/// after the gate goes non-positive falls over release-time to finally perform
/// the (optional) action
pub struct Linen {
    _rate: Rate,
    gate: UGenInput,
    attack_time: UGenInput,
    sus_level: UGenInput,
    release_time: UGenInput,
    action: UGenInput,
}

impl Linen {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            gate: UGenInput::Constant(1.0),
            attack_time: UGenInput::Constant(0.01),
            sus_level: UGenInput::Constant(1.0),
            release_time: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// Input trigger
    pub fn gate(mut self, v: impl Into<UGenInput>) -> Self {
        self.gate = v.into();
        self
    }

    /// Time taken to rise to susLevel in seconds
    pub fn attack_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.attack_time = v.into();
        self
    }

    /// Level to hold the envelope at until gate is triggered
    pub fn sus_level(mut self, v: impl Into<UGenInput>) -> Self {
        self.sus_level = v.into();
        self
    }

    /// Time to fall from susLevel back to 0 after the gate has been triggered
    pub fn release_time(mut self, v: impl Into<UGenInput>) -> Self {
        self.release_time = v.into();
        self
    }

    /// done action
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.gate);
        inputs.push(self.attack_time);
        inputs.push(self.sus_level);
        inputs.push(self.release_time);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Linen", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Pause a specified node when triggered
pub struct Pause {
    _rate: Rate,
    gate: UGenInput,
    id: UGenInput,
}

impl Pause {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            gate: UGenInput::Constant(0.0),
            id: UGenInput::Constant(0.0),
        }
    }

    /// when gate is 0, node is paused, when 1 it runs
    pub fn gate(mut self, v: impl Into<UGenInput>) -> Self {
        self.gate = v.into();
        self
    }

    /// node to be paused
    pub fn id(mut self, v: impl Into<UGenInput>) -> Self {
        self.id = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.gate);
        inputs.push(self.id);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Pause", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Pause the enclosing synth when triggered
pub struct PauseSelf {
    _rate: Rate,
    r#in: UGenInput,
}

impl PauseSelf {
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
        let idx = def.add_ugen(r"PauseSelf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Pause the enclosing synth when the src ugen finishes (e.g. env-gen, play-buf,
/// linen...)
pub struct PauseSelfWhenDone {
    _rate: Rate,
    src: UGenInput,
}

impl PauseSelfWhenDone {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            src: UGenInput::Constant(0.0),
        }
    }

    /// the ugen to check for done
    pub fn src(mut self, v: impl Into<UGenInput>) -> Self {
        self.src = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.src);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"PauseSelfWhenDone", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
