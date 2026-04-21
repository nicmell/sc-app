// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;
use crate::builders::TailArgs;

/// Allocate buffer space.
/// OSC address: `/b_alloc`
#[derive(Debug, Clone, Default)]
pub struct BAlloc {
    /// buffer number
    bufnum: Option<i32>,
    /// number of frames
    num_frames: Option<i32>,
    /// number of channels (optional. default = 1 channel)
    number_of_channels: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
    /// the required sample rate (optional. default (or 0) = the server's
    /// sample rate)
    the_required_sample: Option<f32>,
}

impl BAlloc {
    /// Construct a new /b_alloc builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// number of frames
    pub fn num_frames(mut self, v: i32) -> Self { self.num_frames = Some(v); self }

    /// number of channels (optional. default = 1 channel)
    pub fn number_of_channels(mut self, v: i32) -> Self { self.number_of_channels = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// the required sample rate (optional. default (or 0) = the server's
    /// sample rate)
    pub fn the_required_sample(mut self, v: f32) -> Self { self.the_required_sample = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.num_frames { args.push(OscType::Int(v)); }
        if let Some(v) = self.number_of_channels { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        if let Some(v) = self.the_required_sample { args.push(OscType::Float(v)); }
        ServerMessage::with_args(r"/b_alloc", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Allocate buffer space and read a sound file.
/// OSC address: `/b_allocRead`
#[derive(Debug, Clone, Default)]
pub struct BAllocRead {
    /// buffer number
    bufnum: Option<i32>,
    /// path name of a sound file.
    path: Option<String>,
    /// starting frame in file (optional. default = 0)
    starting_frame_in: Option<i32>,
    /// number of frames to read (optional. default = 0, see below)
    number_of_frames: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl BAllocRead {
    /// Construct a new /b_allocRead builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// path name of a sound file.
    pub fn path(mut self, v: String) -> Self { self.path = Some(v); self }

    /// starting frame in file (optional. default = 0)
    pub fn starting_frame_in(mut self, v: i32) -> Self { self.starting_frame_in = Some(v); self }

    /// number of frames to read (optional. default = 0, see below)
    pub fn number_of_frames(mut self, v: i32) -> Self { self.number_of_frames = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.path { args.push(OscType::String(v)); }
        if let Some(v) = self.starting_frame_in { args.push(OscType::Int(v)); }
        if let Some(v) = self.number_of_frames { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/b_allocRead", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Allocate buffer space and read channels from a sound file.
/// OSC address: `/b_allocReadChannel`
#[derive(Debug, Clone, Default)]
pub struct BAllocReadChannel {
    /// buffer number
    bufnum: Option<i32>,
    /// path name of a sound file
    path: Option<String>,
    /// starting frame in file
    start_frame: Option<i32>,
    /// number of frames to read
    number_of_frames: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl BAllocReadChannel {
    /// Construct a new /b_allocReadChannel builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// path name of a sound file
    pub fn path(mut self, v: String) -> Self { self.path = Some(v); self }

    /// starting frame in file
    pub fn start_frame(mut self, v: i32) -> Self { self.start_frame = Some(v); self }

    /// number of frames to read
    pub fn number_of_frames(mut self, v: i32) -> Self { self.number_of_frames = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// source file channel index
    /// an OSC message to execute upon completion. (optional)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.path { args.push(OscType::String(v)); }
        if let Some(v) = self.start_frame { args.push(OscType::Int(v)); }
        if let Some(v) = self.number_of_frames { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/b_allocReadChannel", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Close soundfile.
/// OSC address: `/b_close`
#[derive(Debug, Clone, Default)]
pub struct BClose {
    /// buffer number
    bufnum: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl BClose {
    /// Construct a new /b_close builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/b_close", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Fill ranges of sample value(s).
/// OSC address: `/b_fill`
#[derive(Debug, Clone, Default)]
pub struct BFill {
    /// buffer number
    bufnum: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl BFill {
    /// Construct a new /b_fill builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// sample starting index
    /// number of samples to fill (M)
    /// value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/b_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Free buffer data.
/// OSC address: `/b_free`
#[derive(Debug, Clone, Default)]
pub struct BFree {
    /// buffer number
    bufnum: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl BFree {
    /// Construct a new /b_free builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/b_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Call a command to fill a buffer.
/// OSC address: `/b_gen`
#[derive(Debug, Clone, Default)]
pub struct BGen {
    /// buffer number
    bufnum: Option<i32>,
    /// command name
    cmd: Option<String>,
    /// command arguments
    command_arguments: Option<OscType>,
}

impl BGen {
    /// Construct a new /b_gen builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// command name
    pub fn cmd(mut self, v: String) -> Self { self.cmd = Some(v); self }

    /// command arguments
    pub fn command_arguments(mut self, v: OscType) -> Self { self.command_arguments = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.cmd { args.push(OscType::String(v)); }
        if let Some(v) = self.command_arguments { args.push(v); }
        ServerMessage::with_args(r"/b_gen", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get sample value(s).
/// OSC address: `/b_get`
#[derive(Debug, Clone, Default)]
pub struct BGet {
    /// buffer number
    bufnum: Option<i32>,
    /// a sample index
    a_sample_index: Option<i32>,
}

impl BGet {
    /// Construct a new /b_get builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// a sample index
    pub fn a_sample_index(mut self, v: i32) -> Self { self.a_sample_index = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.a_sample_index { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/b_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of sample value(s).
/// OSC address: `/b_getn`
#[derive(Debug, Clone, Default)]
pub struct BGetn {
    /// buffer number
    bufnum: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl BGetn {
    /// Construct a new /b_getn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// starting sample index
    /// number of sequential samples to get (M)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/b_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get buffer info.
/// OSC address: `/b_query`
#[derive(Debug, Clone, Default)]
pub struct BQuery {
    /// buffer number(s)
    buffer_number_s: Option<i32>,
}

impl BQuery {
    /// Construct a new /b_query builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number(s)
    pub fn buffer_number_s(mut self, v: i32) -> Self { self.buffer_number_s = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.buffer_number_s { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/b_query", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Read sound file data into an existing buffer.
/// OSC address: `/b_read`
#[derive(Debug, Clone, Default)]
pub struct BRead {
    /// buffer number
    bufnum: Option<i32>,
    /// path name of a sound file.
    path: Option<String>,
    /// starting frame in file (optional. default = 0)
    starting_frame_in: Option<i32>,
    /// number of frames to read (optional. default = -1, see below)
    number_of_frames: Option<i32>,
    /// starting frame in buffer (optional. default = 0)
    starting_frame_in_2: Option<i32>,
    /// leave file open (optional. default = 0)
    leave_file_open: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl BRead {
    /// Construct a new /b_read builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// path name of a sound file.
    pub fn path(mut self, v: String) -> Self { self.path = Some(v); self }

    /// starting frame in file (optional. default = 0)
    pub fn starting_frame_in(mut self, v: i32) -> Self { self.starting_frame_in = Some(v); self }

    /// number of frames to read (optional. default = -1, see below)
    pub fn number_of_frames(mut self, v: i32) -> Self { self.number_of_frames = Some(v); self }

    /// starting frame in buffer (optional. default = 0)
    pub fn starting_frame_in_2(mut self, v: i32) -> Self { self.starting_frame_in_2 = Some(v); self }

    /// leave file open (optional. default = 0)
    pub fn leave_file_open(mut self, v: i32) -> Self { self.leave_file_open = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.path { args.push(OscType::String(v)); }
        if let Some(v) = self.starting_frame_in { args.push(OscType::Int(v)); }
        if let Some(v) = self.number_of_frames { args.push(OscType::Int(v)); }
        if let Some(v) = self.starting_frame_in_2 { args.push(OscType::Int(v)); }
        if let Some(v) = self.leave_file_open { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/b_read", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Read sound file channel data into an existing buffer.
/// OSC address: `/b_readChannel`
#[derive(Debug, Clone, Default)]
pub struct BReadChannel {
    /// buffer number
    bufnum: Option<i32>,
    /// path name of a sound file
    path: Option<String>,
    /// starting frame in file
    start_frame: Option<i32>,
    /// number of frames to read
    number_of_frames: Option<i32>,
    /// starting frame in buffer
    starting_frame: Option<i32>,
    /// leave file open
    leave_file_open: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl BReadChannel {
    /// Construct a new /b_readChannel builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// path name of a sound file
    pub fn path(mut self, v: String) -> Self { self.path = Some(v); self }

    /// starting frame in file
    pub fn start_frame(mut self, v: i32) -> Self { self.start_frame = Some(v); self }

    /// number of frames to read
    pub fn number_of_frames(mut self, v: i32) -> Self { self.number_of_frames = Some(v); self }

    /// starting frame in buffer
    pub fn starting_frame(mut self, v: i32) -> Self { self.starting_frame = Some(v); self }

    /// leave file open
    pub fn leave_file_open(mut self, v: i32) -> Self { self.leave_file_open = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// source file channel index
    /// completion message
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.path { args.push(OscType::String(v)); }
        if let Some(v) = self.start_frame { args.push(OscType::Int(v)); }
        if let Some(v) = self.number_of_frames { args.push(OscType::Int(v)); }
        if let Some(v) = self.starting_frame { args.push(OscType::Int(v)); }
        if let Some(v) = self.leave_file_open { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/b_readChannel", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set sample value(s).
/// OSC address: `/b_set`
#[derive(Debug, Clone, Default)]
pub struct BSet {
    /// buffer number
    bufnum: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl BSet {
    /// Construct a new /b_set builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a sample index
    /// a sample value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/b_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of sample value(s).
/// OSC address: `/b_setn`
#[derive(Debug, Clone, Default)]
pub struct BSetn {
    /// buffer number
    bufnum: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl BSetn {
    /// Construct a new /b_setn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// sample starting index
    /// number of sequential samples to change (M)
    /// a sample value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/b_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set the sampling rate of the buffer.
/// OSC address: `/b_setSampleRate`
#[derive(Debug, Clone, Default)]
pub struct BSetSampleRate {
    /// buffer number
    bufnum: Option<i32>,
    /// the desired sampling rate. 0 or nil will set to the Server's sample
    /// rate.
    the_desired_sampling: Option<f32>,
}

impl BSetSampleRate {
    /// Construct a new /b_setSampleRate builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// the desired sampling rate. 0 or nil will set to the Server's sample
    /// rate.
    pub fn the_desired_sampling(mut self, v: f32) -> Self { self.the_desired_sampling = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.the_desired_sampling { args.push(OscType::Float(v)); }
        ServerMessage::with_args(r"/b_setSampleRate", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Write sound file data.
/// OSC address: `/b_write`
#[derive(Debug, Clone, Default)]
pub struct BWrite {
    /// buffer number
    bufnum: Option<i32>,
    /// path name of a sound file.
    path: Option<String>,
    /// header format.
    header_format: Option<String>,
    /// sample format.
    sample_format: Option<String>,
    /// number of frames to write (optional. default = -1, see below)
    number_of_frames: Option<i32>,
    /// starting frame in buffer (optional. default = 0)
    starting_frame_in: Option<i32>,
    /// leave file open (optional. default = 0)
    leave_file_open: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl BWrite {
    /// Construct a new /b_write builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// path name of a sound file.
    pub fn path(mut self, v: String) -> Self { self.path = Some(v); self }

    /// header format.
    pub fn header_format(mut self, v: String) -> Self { self.header_format = Some(v); self }

    /// sample format.
    pub fn sample_format(mut self, v: String) -> Self { self.sample_format = Some(v); self }

    /// number of frames to write (optional. default = -1, see below)
    pub fn number_of_frames(mut self, v: i32) -> Self { self.number_of_frames = Some(v); self }

    /// starting frame in buffer (optional. default = 0)
    pub fn starting_frame_in(mut self, v: i32) -> Self { self.starting_frame_in = Some(v); self }

    /// leave file open (optional. default = 0)
    pub fn leave_file_open(mut self, v: i32) -> Self { self.leave_file_open = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.path { args.push(OscType::String(v)); }
        if let Some(v) = self.header_format { args.push(OscType::String(v)); }
        if let Some(v) = self.sample_format { args.push(OscType::String(v)); }
        if let Some(v) = self.number_of_frames { args.push(OscType::Int(v)); }
        if let Some(v) = self.starting_frame_in { args.push(OscType::Int(v)); }
        if let Some(v) = self.leave_file_open { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/b_write", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Zero sample data.
/// OSC address: `/b_zero`
#[derive(Debug, Clone, Default)]
pub struct BZero {
    /// buffer number
    bufnum: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl BZero {
    /// Construct a new /b_zero builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer number
    pub fn bufnum(mut self, v: i32) -> Self { self.bufnum = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.bufnum { args.push(OscType::Int(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/b_zero", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
