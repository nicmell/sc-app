// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// This ugen has been internalised for scserver compatibility. Please use the
/// dbrown cgen instead.
pub struct Dbrown {
    _rate: Rate,
    length: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
    step: UGenInput,
}

impl Dbrown {
    /// Default: positive infinity
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    pub fn step(mut self, v: impl Into<UGenInput>) -> Self {
        self.step = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.step);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dbrown", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Read values from a buffer on demand, using phase (index) value that is also
/// pulled on demand. All inputs can be either demand ugen or any other ugen.
pub struct Dbufrd {
    _rate: Rate,
    bufnum: UGenInput,
    phase: UGenInput,
    r#loop: UGenInput,
}

impl Dbufrd {
    /// buffer number to read from
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// index into the buffer
    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    /// when phase exceeds number of frames in buffer, loops when set to 1
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.phase);
        inputs.push(self.r#loop);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dbufrd", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// dbufwr cgen instead.
pub struct Dbufwr {
    _rate: Rate,
    bufnum: UGenInput,
    phase: UGenInput,
    input: UGenInput,
    r#loop: UGenInput,
}

impl Dbufwr {
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    pub fn phase(mut self, v: impl Into<UGenInput>) -> Self {
        self.phase = v.into();
        self
    }

    pub fn input(mut self, v: impl Into<UGenInput>) -> Self {
        self.input = v.into();
        self
    }

    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.phase);
        inputs.push(self.input);
        inputs.push(self.r#loop);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dbufwr", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// On every trigger it demands the next value from each of the demand ugens
/// passed as args. Used to pull values from the other demand rate ugens. By
/// design, a reset trigger only resets the demand ugens; it does not reset the
/// value at Demand's output. Demand continues to hold its value until the next
/// value is demanded, at which point its output value will be the first expected
/// item in the list.
pub struct Demand {
    _rate: Rate,
    trig: UGenInput,
    reset: UGenInput,
    demand_ugens: UGenInput,
}

impl Demand {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
            demand_ugens: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            trig: UGenInput::Constant(0.0),
            reset: UGenInput::Constant(0.0),
            demand_ugens: UGenInput::Constant(0.0),
        }
    }

    /// Can be any signal. A trigger happens when the signal changes from non-positive
    /// to positive.
    pub fn trig(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig = v.into();
        self
    }

    /// Resets the list of ugens when triggered.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// list of demand rate ugens
    pub fn demand_ugens(mut self, v: impl Into<UGenInput>) -> Self {
        self.demand_ugens = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.trig);
        inputs.push(self.reset);
        inputs.push(self.demand_ugens);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Demand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Plays back break point envelope contours (levels, times, shapes) given by
/// demand ugens. The next values are called when the next node is reached.
pub struct DemandEnvGen {
    _rate: Rate,
    level: UGenInput,
    dur: UGenInput,
    shape: UGenInput,
    curve: UGenInput,
    gate: UGenInput,
    reset: UGenInput,
    level_scale: UGenInput,
    level_bias: UGenInput,
    time_scale: UGenInput,
    action: UGenInput,
}

impl DemandEnvGen {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            level: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.0),
            shape: UGenInput::Constant(1.0),
            curve: UGenInput::Constant(0.0),
            gate: UGenInput::Constant(1.0),
            reset: UGenInput::Constant(1.0),
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
            level: UGenInput::Constant(0.0),
            dur: UGenInput::Constant(0.0),
            shape: UGenInput::Constant(1.0),
            curve: UGenInput::Constant(0.0),
            gate: UGenInput::Constant(1.0),
            reset: UGenInput::Constant(1.0),
            level_scale: UGenInput::Constant(1.0),
            level_bias: UGenInput::Constant(0.0),
            time_scale: UGenInput::Constant(1.0),
            action: UGenInput::Constant(0.0),
        }
    }

    /// demand ugen (or other ugen) returning level values
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// demand ugen (or other ugen) returning time values
    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    /// demand ugen (or other ugen) returning shape number - the number given is the
    /// shape number
    pub fn shape(mut self, v: impl Into<UGenInput>) -> Self {
        self.shape = v.into();
        self
    }

    /// demand ugen (or other ugen) returning curve values - if shape is 5, this is
    /// the curve factor. The possible values are: 0 - flat segments, 1 - linear
    /// segments, the default, 2 - natural exponential growth and decay. In this case,
    /// the levels must all be nonzero and the have the same sign, 3 - sinusoidal S
    /// shaped segments, 4 - sinusoidal segments shaped like the sides of a Welch
    /// window, a Float - a curvature value for all segments, an Array of Floats -
    /// curvature values for each segments.
    pub fn curve(mut self, v: impl Into<UGenInput>) -> Self {
        self.curve = v.into();
        self
    }

    /// control rate gate if gate is x >= 1, the ugen runs, if gate is 0 > x > 1, the
    /// ugen is released at the next level (doneAction), if gate is x <= 0, the ugen
    /// is sampled end held
    pub fn gate(mut self, v: impl Into<UGenInput>) -> Self {
        self.gate = v.into();
        self
    }

    /// if reset crosses from nonpositive to positive, the ugen is reset at the next
    /// level. If it is > 1, it is reset immediately.
    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// demand ugen returning level scaling values
    pub fn level_scale(mut self, v: impl Into<UGenInput>) -> Self {
        self.level_scale = v.into();
        self
    }

    /// demand ugen returning level offset values
    pub fn level_bias(mut self, v: impl Into<UGenInput>) -> Self {
        self.level_bias = v.into();
        self
    }

    /// demand ugen returning time scaling values
    pub fn time_scale(mut self, v: impl Into<UGenInput>) -> Self {
        self.time_scale = v.into();
        self
    }

    /// Default: NO-ACTION
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.level);
        inputs.push(self.dur);
        inputs.push(self.shape);
        inputs.push(self.curve);
        inputs.push(self.gate);
        inputs.push(self.reset);
        inputs.push(self.level_scale);
        inputs.push(self.level_bias);
        inputs.push(self.time_scale);
        inputs.push(self.action);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DemandEnvGen", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// dgeom cgen instead.
pub struct Dgeom {
    _rate: Rate,
    length: UGenInput,
    start: UGenInput,
    grow: UGenInput,
}

impl Dgeom {
    /// Default: positive infinity
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    pub fn start(mut self, v: impl Into<UGenInput>) -> Self {
        self.start = v.into();
        self
    }

    pub fn grow(mut self, v: impl Into<UGenInput>) -> Self {
        self.grow = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.start);
        inputs.push(self.grow);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dgeom", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// dibrown cgen instead.
pub struct Dibrown {
    _rate: Rate,
    length: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
    step: UGenInput,
}

impl Dibrown {
    /// Default: positive infinity
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    pub fn step(mut self, v: impl Into<UGenInput>) -> Self {
        self.step = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.lo);
        inputs.push(self.hi);
        inputs.push(self.step);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dibrown", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// diwhite cgen instead.
pub struct Diwhite {
    _rate: Rate,
    length: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl Diwhite {
    /// Default: positive infinity
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Diwhite", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

pub struct Donce {
    _rate: Rate,
    r#in: UGenInput,
}

impl Donce {
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
        let idx = def.add_ugen(r"Donce", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Print the value of an input demand ugen. The print-out is in the form: label:
/// value block offset: offset. WARNING: Printing values from the Server is
/// intensive for the CPU. Poll should be used for debugging purposes.
pub struct Dpoll {
    _rate: Rate,
    r#in: UGenInput,
    trig_id: UGenInput,
    label: UGenInput,
    run: UGenInput,
}

impl Dpoll {
    /// demand ugen to poll values from
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// if greater than 0, a '/tr' message is sent back to the client (similar to
    /// send-trig)
    pub fn trig_id(mut self, v: impl Into<UGenInput>) -> Self {
        self.trig_id = v.into();
        self
    }

    /// a label string
    pub fn label(mut self, v: impl Into<UGenInput>) -> Self {
        self.label = v.into();
        self
    }

    /// activation switch 0 or 1 (can be a demand ugen)
    pub fn run(mut self, v: impl Into<UGenInput>) -> Self {
        self.run = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.trig_id);
        inputs.push(self.label);
        inputs.push(self.run);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dpoll", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Demand rate random sequence generator. Generate a random ordering of an input
/// sequence.
pub struct Drand {
    _rate: Rate,
    list: UGenInput,
    num_repeats: UGenInput,
}

impl Drand {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// number of repeats
    pub fn num_repeats(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_repeats = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.num_repeats);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Drand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Demand rate sequence generator. Outputs a sequence of values, possibly
/// repeating multiple times. Use INF as a repeat val to create an endless loop.
pub struct Dseq {
    _rate: Rate,
    list: UGenInput,
    num_repeats: UGenInput,
}

impl Dseq {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// number of repeats
    pub fn num_repeats(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_repeats = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.num_repeats);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dseq", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Demand rate sequence generator. Generates a sequence of values like dseq,
/// except outputs only count total values, rather than repeating.
pub struct Dser {
    _rate: Rate,
    list: UGenInput,
    count: UGenInput,
}

impl Dser {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// number of values to return
    pub fn count(mut self, v: impl Into<UGenInput>) -> Self {
        self.count = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.count);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dser", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// dseries cgen instead.
pub struct Dseries {
    _rate: Rate,
    length: UGenInput,
    start: UGenInput,
    step: UGenInput,
}

impl Dseries {
    /// Default: positive infinity.
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    pub fn start(mut self, v: impl Into<UGenInput>) -> Self {
        self.start = v.into();
        self
    }

    pub fn step(mut self, v: impl Into<UGenInput>) -> Self {
        self.step = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.start);
        inputs.push(self.step);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dseries", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Demand rate random sequence generator. Shuffle a sequence once and then output
/// it one or more times.
pub struct Dshuf {
    _rate: Rate,
    list: UGenInput,
    num_repeats: UGenInput,
}

impl Dshuf {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// number of repeats
    pub fn num_repeats(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_repeats = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.num_repeats);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dshuf", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Replicates input values n times on demand. Both inputs can be demand rate
/// ugens.
pub struct Dstutter {
    _rate: Rate,
    num_repeats: UGenInput,
    r#in: UGenInput,
}

impl Dstutter {
    /// number of repeats (can be a demand ugen)
    pub fn num_repeats(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_repeats = v.into();
        self
    }

    /// input ugen
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.num_repeats);
        inputs.push(self.r#in);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dstutter", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A demand rate switch. In difference to Dswitch1, Dswitch embeds all items of
/// an input demand ugen first before looking up the next index.
pub struct Dswitch {
    _rate: Rate,
    list: UGenInput,
    index: UGenInput,
}

impl Dswitch {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// which of the inputs to return
    pub fn index(mut self, v: impl Into<UGenInput>) -> Self {
        self.index = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.index);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dswitch", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// A demand rate switch that can be used to select one of multiple demand rate
/// inputs.
pub struct Dswitch1 {
    _rate: Rate,
    list: UGenInput,
    index: UGenInput,
}

impl Dswitch1 {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// which of the inputs to return
    pub fn index(mut self, v: impl Into<UGenInput>) -> Self {
        self.index = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.index);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dswitch1", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// duty cgen instead.
pub struct Duty {
    _rate: Rate,
    dur: UGenInput,
    reset: UGenInput,
    action: UGenInput,
    level: UGenInput,
}

impl Duty {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            dur: UGenInput::Constant(1.0),
            reset: UGenInput::Constant(0.0),
            action: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            dur: UGenInput::Constant(1.0),
            reset: UGenInput::Constant(0.0),
            action: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// Default: NO-ACTION
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.dur);
        inputs.push(self.reset);
        inputs.push(self.action);
        inputs.push(self.level);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Duty", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// dwhite cgen instead.
pub struct Dwhite {
    _rate: Rate,
    length: UGenInput,
    lo: UGenInput,
    hi: UGenInput,
}

impl Dwhite {
    /// Default: positive infinity
    pub fn length(mut self, v: impl Into<UGenInput>) -> Self {
        self.length = v.into();
        self
    }

    pub fn lo(mut self, v: impl Into<UGenInput>) -> Self {
        self.lo = v.into();
        self
    }

    pub fn hi(mut self, v: impl Into<UGenInput>) -> Self {
        self.hi = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.length);
        inputs.push(self.lo);
        inputs.push(self.hi);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dwhite", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Demand rate random sequence generator. Generate a random ordering of the given
/// sequence without repeating any element until all elements have been returned.
pub struct Dxrand {
    _rate: Rate,
    list: UGenInput,
    num_repeats: UGenInput,
}

impl Dxrand {
    /// array of values or other ugens
    pub fn list(mut self, v: impl Into<UGenInput>) -> Self {
        self.list = v.into();
        self
    }

    /// number of repeats
    pub fn num_repeats(mut self, v: impl Into<UGenInput>) -> Self {
        self.num_repeats = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.list);
        inputs.push(self.num_repeats);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"Dxrand", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// This ugen has been internalised for scserver compatibility. Please use the
/// tduty cgen instead.
pub struct TDuty {
    _rate: Rate,
    dur: UGenInput,
    reset: UGenInput,
    action: UGenInput,
    level: UGenInput,
    gap_first: UGenInput,
}

impl TDuty {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            dur: UGenInput::Constant(1.0),
            reset: UGenInput::Constant(0.0),
            action: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
            gap_first: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            dur: UGenInput::Constant(1.0),
            reset: UGenInput::Constant(0.0),
            action: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
            gap_first: UGenInput::Constant(0.0),
        }
    }

    pub fn dur(mut self, v: impl Into<UGenInput>) -> Self {
        self.dur = v.into();
        self
    }

    pub fn reset(mut self, v: impl Into<UGenInput>) -> Self {
        self.reset = v.into();
        self
    }

    /// Default: NO-ACTION
    pub fn action(mut self, v: impl Into<UGenInput>) -> Self {
        self.action = v.into();
        self
    }

    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    pub fn gap_first(mut self, v: impl Into<UGenInput>) -> Self {
        self.gap_first = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.dur);
        inputs.push(self.reset);
        inputs.push(self.action);
        inputs.push(self.level);
        inputs.push(self.gap_first);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"TDuty", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
