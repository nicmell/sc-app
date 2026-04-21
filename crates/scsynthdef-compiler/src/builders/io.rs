// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]

use crate::{Rate, SynthDef, UGenInput};

/// stream audio in from disk file
/// 
/// Continuously play a longer soundfile from disk. This requires a buffer to be
/// preloaded with one buffer size of sound. If loop is set to 1, the soundfile
/// will loop.
pub struct DiskIn {
    _rate: Rate,
    bufnum: UGenInput,
    r#loop: UGenInput,
    num_channels: u32,
}

impl DiskIn {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            r#loop: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// id of buffer
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// Soundfile will loop if 1 otherwise not.
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// Number of channels in the incoming audio.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.r#loop);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"DiskIn", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// stream audio out to disk file
/// 
/// The output of DiskOut is the number of frames written to disk. Note that the
/// number of channels in the buffer and the channelsArray must be the same,
/// otherwise DiskOut will fail silently (and not write anything to your file).
pub struct DiskOut {
    _rate: Rate,
    bufnum: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl DiskOut {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// the number of the buffer to write to (prepared with /b-write)
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// the Array of channels to write to the file.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 1;
        let idx = def.add_ugen(r"DiskOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Read a signal from a bus.
/// 
/// in:kr is functionally similar to in-feedback. That is it reads all data on the
/// bus whether it is from the current cycle or not. This allows for it to receive
/// data from later in the node order. in:ar reads only data from the current
/// cycle, and will zero data from earlier cycles (for use within that synth; the
/// data remains on the bus). Because of this and the fact that the various out
/// ugens mix their output with data from the current cycle but overwrite data
/// from an earlier cycle it may be necessary to use a private control bus when
/// this type of feedback is desired.
pub struct In {
    _rate: Rate,
    bus: UGenInput,
    num_channels: u32,
}

impl In {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bus: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// the index of the bus to read in from
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// the number of channels (i.e. adjacent buses) to read in. The default is 1. You
    /// cannot modulate this number by assigning it to an argument in a SynthDef.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"In", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// read signal from a bus with a current or one cycle old timestamp
/// 
/// When the various output ugens (out, offsetOut, x-out) write data to a bus,
/// they mix it with any data from the current cycle, but overwrite any data from
/// the previous cycle. (replace-out overwrites all data regardless.) Thus
/// depending on node order and what synths are writing to thep bus, the data on a
/// given bus may be from the current cycle or be one cycle old at the time of
/// reading. in:ar checks the timestamp of any data it reads in and zeros any data
/// from the previous cycle (for use within that node; the data remains on the
/// bus). This is fine for audio data, as it avoids feedback, but for control data
/// it is useful to be able to read data from any place in the node order. For
/// this reason in:kr also reads data that is older than the current cycle. In
/// some cases we might also want to read audio from a node later in the current
/// node order. This is the purpose of InFeedback. The delay introduced by this is
/// one block size, which equals about 0.0014 sec at the default block size and
/// sample rate. (See the resonator example below to see the implications of
/// this.) The variably mixing and overwriting behaviour of the output ugens can
/// make order of execution crucial. (No pun intended.) For example with a node
/// order like the following the InFeedback ugen in Synth 2 will only receive data
/// from Synth 1 (-> = write out; <- = read in): Synth 1 -> busA This synth
/// overwrites the output of Synth3 before it reaches Synth 2 Synth 2 (with
/// InFeedback) <- busA Synth 3 -> busA If Synth 1 were moved after Synth 2 then
/// Synth 2's InFeedback would receive a mix of the output from Synth 1 and Synth
/// 3. This would also be true if Synth 2 came after Synth1 and Synth 3. In both
/// cases data from Synth 1 and Synth 3 would have the same time stamp (either
/// current or from the previous cycle), so nothing would be overwritten. Because
/// of this it is often useful to allocate a separate bus for feedback. With the
/// following arrangement Synth 2 will receive data from Synth3 regardless of
/// Synth 1's position in the node order. Synth 1 -> busA Synth 2 (with
/// InFeedback) <- busB Synth 3 -> busB + busA
pub struct InFeedback {
    _rate: Rate,
    bus: UGenInput,
    num_channels: u32,
}

impl InFeedback {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bus: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// the index of the bus to read in from.
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// the number of channels (i.e. adjacent buses) to read in. The default is 1. You
    /// cannot modulate this number by assigning it to an argument in a SynthDef.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"InFeedback", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// generates a trigger any time the bus is set
/// 
/// Any time the bus is 'touched' ie. has its value set (using \"/c_set\" etc.), a
/// single impulse trigger will be generated. Its amplitude is the value that the
/// bus was set to.
pub struct InTrig {
    _rate: Rate,
    bus: UGenInput,
    num_channels: u32,
}

impl InTrig {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// the index of the bus to read in from.
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// the number of channels (i.e. adjacent buses) to read in. The default is 1. You
    /// cannot modulate this number by assigning it to an argument in a SynthDef.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"InTrig", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Read a control signal from a bus with a lag.
/// 
/// Please document me
pub struct LagIn {
    _rate: Rate,
    bus: UGenInput,
    lag: UGenInput,
    num_channels: u32,
}

impl LagIn {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            lag: UGenInput::Constant(0.1),
            num_channels: 1,
        }
    }

    /// the index of the bus to read in from
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// lag factor
    pub fn lag(mut self, v: impl Into<UGenInput>) -> Self {
        self.lag = v.into();
        self
    }

    /// the number of channels (i.e. adjacent buses) to read in. Not modulatable.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        inputs.push(self.lag);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"LagIn", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// defines buses that are local to the enclosing synth. These are like the global
/// buses, but are more convenient if you want to implement a self contained
/// effect that uses a feedback processing loop. There can only be one audio rate
/// and one control rate local-in per SynthDef. The audio can be written to the
/// bus using local-out.
pub struct LocalIn {
    _rate: Rate,
    num_channels: u32,
}

impl LocalIn {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            num_channels: 1,
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            num_channels: 1,
        }
    }

    /// the number of channels (i.e. adjacent buses) to read in. The default is 1. You
    /// cannot modulate this argument.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"LocalIn", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// write to buses local to a synth
/// 
/// local-out writes to buses that are local to the enclosing synth. The buses
/// should have been defined by a local-in ugen. The channelsArray must be the
/// same number of channels as were declared in the LocalIn. These are like the
/// global buses, but are more convenient if you want to implement a self
/// contained effect that uses a feedback processing loop.
pub struct LocalOut {
    _rate: Rate,
    channels_array: Vec<UGenInput>,
}

impl LocalOut {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            channels_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            channels_array: Vec::new(),
        }
    }

    /// an Array of channels or single output to write out. You cannot change the size
    /// of this once a SynthDef has been built.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"LocalOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// write signal to a bus with sample accurate timing
/// 
/// Output signal to a bus, the sample offset within the bus is kept exactly; i.e.
/// if the synth is scheduled to be started part way through a control cycle,
/// offset-out will maintain the correct offset by buffering the output and
/// delaying it until the exact time that the synth was scheduled for. This ugen
/// is used where sample accurate output is needed.
pub struct OffsetOut {
    _rate: Rate,
    bus: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl OffsetOut {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bus: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// the index of the buss to write to. The lowest index numbers are written to the
    /// audio hardware.
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// a list of signals or single output to write out. You cannot change the size of
    /// this once a synth has been defined.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"OffsetOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// write a signal to a bus, adding to previous contents.
/// 
/// write a signal to a bus, adding to any existing contents N.B. Out is subject
/// to control rate jitter. Where sample accurate output is needed, use OffsetOut.
/// When using an array of bus indexes, the channel array will just be copied to
/// each bus index in the array. So (out:ar [bus1 bus2] channels-array) will be
/// the same as (+ (out:ar bus1 channelsArray) (out:ar bus2 channelsArray)).
pub struct Out {
    _rate: Rate,
    bus: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl Out {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bus: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// the index of the buss to write to. The lowest index numbers are written to the
    /// audio hardware.
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// a list of signals or single output to write out. You cannot change the size of
    /// this once a synth has been defined.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"Out", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Send signal to a bus, overwriting previous contents.
/// 
/// Out adds its output to a given bus, making it available to all nodes later in
/// the node tree (See Synth and Order-of-execution for more information).
/// ReplaceOut overwrites those contents. This can make it useful for processing.
pub struct ReplaceOut {
    _rate: Rate,
    bus: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl ReplaceOut {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bus: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// the index of the buss to write to. The lowest index numbers are written to the
    /// audio hardware.
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// a list of signals or single output to write out. You cannot change the size of
    /// this once a synth has been defined.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"ReplaceOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// read from a shared control bus (internal dsp only)
/// 
/// Reads from a control bus shared between the internal server and the SC client.
/// Control rate only. Writing to a shared control bus from the client is
/// synchronous. When not using the internal server use node arguments or the set
/// method of Bus (or /c_set in messaging style).
pub struct SharedIn {
    _rate: Rate,
    bus: UGenInput,
    num_channels: u32,
}

impl SharedIn {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// the index of the shared control bus to read from
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// the number of channels (i.e. adjacent buses) to read in. The default is 1. You
    /// cannot modulate this number by assigning it to an argument in a SynthDef.
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"SharedIn", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// Reads from a control bus shared between the internal server and the SC client.
/// Control rate only. Reading from a shared control bus on the client is
/// synchronous.
pub struct SharedOut {
    _rate: Rate,
    bus: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl SharedOut {
    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// the index of the shared control bus to read from
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// an Array of channels or single output to write out. You cannot change the size
    /// of this once a SynthDef has been built.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"SharedOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// stream in audio from a file (with variable rate)
/// 
/// Continuously play a longer soundfile from disk. This requires a buffer to be
/// preloaded with one buffer size of sound.
pub struct VDiskIn {
    _rate: Rate,
    bufnum: UGenInput,
    rate: UGenInput,
    r#loop: UGenInput,
    send_id: UGenInput,
    num_channels: u32,
}

impl VDiskIn {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bufnum: UGenInput::Constant(0.0),
            rate: UGenInput::Constant(1.0),
            r#loop: UGenInput::Constant(0.0),
            send_id: UGenInput::Constant(0.0),
            num_channels: 1,
        }
    }

    /// id of buffer
    pub fn bufnum(mut self, v: impl Into<UGenInput>) -> Self {
        self.bufnum = v.into();
        self
    }

    /// controls the rate of playback. Values below 4 are probably fine, but the
    /// higher the value, the more disk activity there is, and the more likelihood
    /// there will be a problem.
    pub fn rate(mut self, v: impl Into<UGenInput>) -> Self {
        self.rate = v.into();
        self
    }

    /// Soundfile will loop if 1 otherwise not.
    pub fn r#loop(mut self, v: impl Into<UGenInput>) -> Self {
        self.r#loop = v.into();
        self
    }

    /// send an osc message with this id and the file position each time the buffer is
    /// reloaded: ['/diskin', nodeID, sendID, frame]
    pub fn send_id(mut self, v: impl Into<UGenInput>) -> Self {
        self.send_id = v.into();
        self
    }

    /// Number of channels in the audio
    pub fn num_channels(mut self, n: u32) -> Self {
        self.num_channels = n;
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bufnum);
        inputs.push(self.rate);
        inputs.push(self.r#loop);
        inputs.push(self.send_id);
        let num_outputs: u32 = self.num_channels;
        let idx = def.add_ugen(r"VDiskIn", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}

/// write signal to a bus, crossfading with the existing content
/// 
/// xfade is a level for the crossfade between what is on the bus and what you are
/// sending. The algorithm is equivalent to this: bus_signal = (input_signal *
/// xfade) + (bus_signal * (1 - xfade));
pub struct XOut {
    _rate: Rate,
    bus: UGenInput,
    xfade: UGenInput,
    channels_array: Vec<UGenInput>,
}

impl XOut {
    /// Build at ar rate (Rate::Audio).
    pub fn ar() -> Self {
        Self {
            _rate: Rate::Audio,
            bus: UGenInput::Constant(0.0),
            xfade: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// Build at kr rate (Rate::Control).
    pub fn kr() -> Self {
        Self {
            _rate: Rate::Control,
            bus: UGenInput::Constant(0.0),
            xfade: UGenInput::Constant(0.0),
            channels_array: Vec::new(),
        }
    }

    /// the index, or array of indexes, of buses to write to. The lowest index numbers
    /// are written to the audio hardware.
    pub fn bus(mut self, v: impl Into<UGenInput>) -> Self {
        self.bus = v.into();
        self
    }

    /// crossfade level.
    pub fn xfade(mut self, v: impl Into<UGenInput>) -> Self {
        self.xfade = v.into();
        self
    }

    /// an Array of channels or single output to write out. You cannot change the size
    /// of this once a SynthDef has been built.
    pub fn channels_array<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {
        self.channels_array = iter.into_iter().map(Into::into).collect();
        self
    }

    /// Materialise this UGen into `def`'s node list.
    /// Returns a handle usable as input to other UGens.
    pub fn build(self, def: &mut SynthDef) -> UGenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(self.bus);
        inputs.push(self.xfade);
        inputs.extend(self.channels_array);
        let num_outputs: u32 = 0;
        let idx = def.add_ugen(r"XOut", self._rate, inputs, num_outputs, 0);
        UGenInput::UGen(idx)
    }
}
