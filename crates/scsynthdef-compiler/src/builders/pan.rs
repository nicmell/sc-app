// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// Equal power panning balances two channels; by panning, you are favouring one
/// or other channel in the mix, and the other loses power. The middle pan
/// position (pos=0.0) corresponds to the original stereo mix; full left (pos of
/// -1) is essentially just left channel playing, full right (pos of 1) just the
/// right. The output of Balance2 remains a stereo signal.
pub struct Balance2 {
    _rate: Rate,
    left: UGenInput,
    right: UGenInput,
    pos: UGenInput,
    level: UGenInput,
}

impl Balance2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            left: UGenInput::Constant(0.0),
            right: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// channel 1 of input stereo signal
    pub fn left(mut self, v: impl Into<UGenInput>) -> Self {
        self.left = v.into();
        self
    }

    /// channel 2 of input stereo signal
    pub fn right(mut self, v: impl Into<UGenInput>) -> Self {
        self.right = v.into();
        self
    }

    /// pan position, -1 is left, +1 is right
    pub fn pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.pos = v.into();
        self
    }

    /// a control rate level input.
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.left);
        inputs.push(self.right);
        inputs.push(self.pos);
        inputs.push(self.level);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"Balance2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Encode a two channel signal to two dimensional ambisonic B-format. This puts
/// two channels at opposite poles of a 2D ambisonic field. This is one way to map
/// a stereo sound onto a soundfield. It is equivalent to: PanB2(inA, azimuth,
/// gain) + PanB2(inB, azimuth + 1, gain)
pub struct BiPanB2 {
    _rate: Rate,
    in_a: UGenInput,
    in_b: UGenInput,
    azimuth: UGenInput,
    gain: UGenInput,
}

impl BiPanB2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            in_a: UGenInput::Constant(0.0),
            in_b: UGenInput::Constant(0.0),
            azimuth: UGenInput::Constant(0.0),
            gain: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            in_a: UGenInput::Constant(0.0),
            in_b: UGenInput::Constant(0.0),
            azimuth: UGenInput::Constant(0.0),
            gain: UGenInput::Constant(1.0),
        }
    }

    /// input signal A
    pub fn in_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.in_a = v.into();
        self
    }

    /// input signal B
    pub fn in_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.in_b = v.into();
        self
    }

    /// position around the circle from -1 to +1. -1 is behind, -0.5 is left, 0 is
    /// forward, +0.5 is right, +1 is behind.
    pub fn azimuth(mut self, v: impl Into<UGenInput>) -> Self {
        self.azimuth = v.into();
        self
    }

    /// amplitude control
    pub fn gain(mut self, v: impl Into<UGenInput>) -> Self {
        self.gain = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.in_a);
        inputs.push(self.in_b);
        inputs.push(self.azimuth);
        inputs.push(self.gain);
        let num_outputs: u32 = 3;
        let idx = def.add_ugen(r"BiPanB2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// 2D Ambisonic B-format decoder. Decode a two dimensional ambisonic B-format
/// signal to a set of speakers in a regular polygon. The outputs will be in
/// clockwise order. The position of the first speaker is either center or left of
/// center.
pub struct DecodeB2 {
    _rate: Rate,
    w: UGenInput,
    x: UGenInput,
    y: UGenInput,
    orientation: UGenInput,
    num_channels: u32,
}

impl DecodeB2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            w: UGenInput::Constant(0.0),
            x: UGenInput::Constant(0.0),
            y: UGenInput::Constant(0.0),
            orientation: UGenInput::Constant(0.5),
            num_channels: 1,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            w: UGenInput::Constant(0.0),
            x: UGenInput::Constant(0.0),
            y: UGenInput::Constant(0.0),
            orientation: UGenInput::Constant(0.5),
            num_channels: 1,
        }
    }

    /// B-format signal
    pub fn w(mut self, v: impl Into<UGenInput>) -> Self {
        self.w = v.into();
        self
    }

    /// B-format signal
    pub fn x(mut self, v: impl Into<UGenInput>) -> Self {
        self.x = v.into();
        self
    }

    /// B-format signal
    pub fn y(mut self, v: impl Into<UGenInput>) -> Self {
        self.y = v.into();
        self
    }

    /// Should be zero if the front is a vertex of the polygon. The first speaker will
    /// be directly in front. Should be 0.5 if the front bisects a side of the
    /// polygon. Then the first speaker will be the one left of center. Default is
    /// 0.5.
    pub fn orientation(mut self, v: impl Into<UGenInput>) -> Self {
        self.orientation = v.into();
        self
    }

    /// number of output speakers. Typically 4 to 8.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.w);
        inputs.push(self.x);
        inputs.push(self.y);
        inputs.push(self.orientation);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"DecodeB2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Two channel (stereo) linear panner. This one sounds more like the Rhodes
/// tremolo than Pan2.
pub struct LinPan2 {
    _rate: Rate,
    r#in: UGenInput,
    pos: UGenInput,
    level: UGenInput,
}

impl LinPan2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// pan position, -1 is left, +1 is right
    pub fn pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.pos = v.into();
        self
    }

    /// a control rate level input
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.pos);
        inputs.push(self.level);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"LinPan2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Two channel linear crossfader.
pub struct LinXFade2 {
    _rate: Rate,
    in_a: UGenInput,
    in_b: UGenInput,
    pan: UGenInput,
    level: UGenInput,
}

impl LinXFade2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            in_a: UGenInput::Constant(0.0),
            in_b: UGenInput::Constant(0.0),
            pan: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            in_a: UGenInput::Constant(0.0),
            in_b: UGenInput::Constant(0.0),
            pan: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// input signal A
    pub fn in_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.in_a = v.into();
        self
    }

    /// input signal B
    pub fn in_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.in_b = v.into();
        self
    }

    /// cross fade position from -1 to +1
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// a control rate level input
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.in_a);
        inputs.push(self.in_b);
        inputs.push(self.pan);
        inputs.push(self.level);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"LinXFade2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Two channel (stereo) equal power panner.
pub struct Pan2 {
    _rate: Rate,
    r#in: UGenInput,
    pos: UGenInput,
    level: UGenInput,
}

impl Pan2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// pan position, -1 is left, +1 is right
    pub fn pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.pos = v.into();
        self
    }

    /// a control rate level input
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.pos);
        inputs.push(self.level);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"Pan2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Four channel equal power panner. Outputs are in order LeftFront, RightFront,
/// LeftBack, RightBack.
pub struct Pan4 {
    _rate: Rate,
    r#in: UGenInput,
    xpos: UGenInput,
    ypos: UGenInput,
    level: UGenInput,
}

impl Pan4 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            xpos: UGenInput::Constant(0.0),
            ypos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            xpos: UGenInput::Constant(0.0),
            ypos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// x pan position from -1 to +1 (left to right)
    pub fn xpos(mut self, v: impl Into<UGenInput>) -> Self {
        self.xpos = v.into();
        self
    }

    /// y pan position from -1 to +1 (back to front)
    pub fn ypos(mut self, v: impl Into<UGenInput>) -> Self {
        self.ypos = v.into();
        self
    }

    /// a control rate level input.
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.xpos);
        inputs.push(self.ypos);
        inputs.push(self.level);
        let num_outputs: u32 = 4;
        let idx = def.add_ugen(r"Pan4", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Multichannel equal power panner.
pub struct PanAz {
    _rate: Rate,
    r#in: UGenInput,
    pos: UGenInput,
    level: UGenInput,
    width: UGenInput,
    orientation: UGenInput,
    num_channels: u32,
}

impl PanAz {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
            width: UGenInput::Constant(2.0),
            orientation: UGenInput::Constant(0.5),
            num_channels: 1,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
            width: UGenInput::Constant(2.0),
            orientation: UGenInput::Constant(0.5),
            num_channels: 1,
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// pan position. Channels are evenly spaced over a cyclic period of 2.0 with 0.0
    /// equal to the position directly in front, 2.0/numChans a clockwise shift
    /// 1/numChans of the way around the ring, 4.0/numChans equal to a shift of
    /// 2/numChans, etc. Thus all channels will be cyclically panned through if a
    /// sawtooth wave from -1 to +1 is used to modulate the pos. N.B. Front may or may
    /// not correspond to a speaker depending on the setting of the orientation arg,
    /// see below.
    pub fn pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.pos = v.into();
        self
    }

    /// a control rate level input.
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// The width of the panning envelope. Nominally this is 2.0 which pans between
    /// pairs of adjacent speakers. Width values greater than two will spread the pan
    /// over greater numbers of speakers. Width values less than one will leave silent
    /// gaps between speakers.
    pub fn width(mut self, v: impl Into<UGenInput>) -> Self {
        self.width = v.into();
        self
    }

    /// Should be zero if the front is a vertex of the polygon. The first speaker will
    /// be directly in front. Should be 0.5 if the front bisects a side of the
    /// polygon. Then the first speaker will be the one left of center. Default is
    /// 0.5.
    pub fn orientation(mut self, v: impl Into<UGenInput>) -> Self {
        self.orientation = v.into();
        self
    }

    /// number of output channels
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.pos);
        inputs.push(self.level);
        inputs.push(self.width);
        inputs.push(self.orientation);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"PanAz", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Ambisonic B format panner. Output channels are in order W,X,Y,Z.
pub struct PanB {
    _rate: Rate,
    r#in: UGenInput,
    azimuth: UGenInput,
    elevation: UGenInput,
    gain: UGenInput,
}

impl PanB {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            azimuth: UGenInput::Constant(0.0),
            elevation: UGenInput::Constant(0.0),
            gain: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            azimuth: UGenInput::Constant(0.0),
            elevation: UGenInput::Constant(0.0),
            gain: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// in radians, -pi to +pi
    pub fn azimuth(mut self, v: impl Into<UGenInput>) -> Self {
        self.azimuth = v.into();
        self
    }

    /// in radians, -0.5pi to +0.5pi
    pub fn elevation(mut self, v: impl Into<UGenInput>) -> Self {
        self.elevation = v.into();
        self
    }

    /// a control rate level input
    pub fn gain(mut self, v: impl Into<UGenInput>) -> Self {
        self.gain = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.azimuth);
        inputs.push(self.elevation);
        inputs.push(self.gain);
        let num_outputs: u32 = 4;
        let idx = def.add_ugen(r"PanB", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Encode a mono signal to two dimensional ambisonic B-format.
pub struct PanB2 {
    _rate: Rate,
    r#in: UGenInput,
    azimuth: UGenInput,
    gain: UGenInput,
}

impl PanB2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            r#in: UGenInput::Constant(0.0),
            azimuth: UGenInput::Constant(0.0),
            gain: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            r#in: UGenInput::Constant(0.0),
            azimuth: UGenInput::Constant(0.0),
            gain: UGenInput::Constant(1.0),
        }
    }

    /// input signal
    pub fn r#in(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#in = v.into();
        self
    }

    /// position around the circle from -1 to +1. -1 is behind, -0.5 is left, 0 is
    /// forward, +0.5 is right, +1 is behind.
    pub fn azimuth(mut self, v: impl Into<UGenInput>) -> Self {
        self.azimuth = v.into();
        self
    }

    /// amplitude control
    pub fn gain(mut self, v: impl Into<UGenInput>) -> Self {
        self.gain = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.r#in);
        inputs.push(self.azimuth);
        inputs.push(self.gain);
        let num_outputs: u32 = 3;
        let idx = def.add_ugen(r"PanB2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Rotate2 can be used for rotating an ambisonic B-format sound field around an
/// axis. Rotate2 does an equal power rotation so it also works well on stereo
/// sounds. It takes two audio inputs (x, y) and an angle control (pos). It
/// outputs two channels (x, y). It computes this: xout = cos(angle) * xin +
/// sin(angle) * yin; yout = cos(angle) * yin - sin(angle) * xin; where angle =
/// pos * pi, so that -1 becomes -pi and +1 becomes +pi. This allows you to use an
/// LFSaw to do continuous rotation around a circle.
pub struct Rotate2 {
    _rate: Rate,
    x: UGenInput,
    y: UGenInput,
    pos: UGenInput,
}

impl Rotate2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            x: UGenInput::Constant(0.0),
            y: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            x: UGenInput::Constant(0.0),
            y: UGenInput::Constant(0.0),
            pos: UGenInput::Constant(0.0),
        }
    }

    /// input signal
    pub fn x(mut self, v: impl Into<UGenInput>) -> Self {
        self.x = v.into();
        self
    }

    /// input signal
    pub fn y(mut self, v: impl Into<UGenInput>) -> Self {
        self.y = v.into();
        self
    }

    /// angle to rotate around the circle from -1 to +1. -1 is 180 degrees, -0.5 is
    /// left, 0 is forward, +0.5 is right, +1 is behind.
    pub fn pos(mut self, v: impl Into<UGenInput>) -> Self {
        self.pos = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.x);
        inputs.push(self.y);
        inputs.push(self.pos);
        let num_outputs: u32 = 2;
        let idx = def.add_ugen(r"Rotate2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Equal power two channel cross fade
pub struct XFade2 {
    _rate: Rate,
    in_a: UGenInput,
    in_b: UGenInput,
    pan: UGenInput,
    level: UGenInput,
}

impl XFade2 {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            in_a: UGenInput::Constant(0.0),
            in_b: UGenInput::Constant(0.0),
            pan: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            in_a: UGenInput::Constant(0.0),
            in_b: UGenInput::Constant(0.0),
            pan: UGenInput::Constant(0.0),
            level: UGenInput::Constant(1.0),
        }
    }

    /// input signal A
    pub fn in_a(mut self, v: impl Into<UGenInput>) -> Self {
        self.in_a = v.into();
        self
    }

    /// input signal B
    pub fn in_b(mut self, v: impl Into<UGenInput>) -> Self {
        self.in_b = v.into();
        self
    }

    /// Pan between the two input signals with -1 being inA only and 1 being inB only
    /// with values between being a mix of the two.
    pub fn pan(mut self, v: impl Into<UGenInput>) -> Self {
        self.pan = v.into();
        self
    }

    /// Output level - 0 being silent and 1 being original volume
    pub fn level(mut self, v: impl Into<UGenInput>) -> Self {
        self.level = v.into();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.in_a);
        inputs.push(self.in_b);
        inputs.push(self.pan);
        inputs.push(self.level);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"XFade2", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
