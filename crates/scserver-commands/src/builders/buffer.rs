// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate.mjs` (from the crate root).

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Allocate buffer space.
/// OSC address: `/b_alloc`
#[derive(Debug, Clone)]
pub struct BAlloc {
    /// buffer number
    pub bufnum: i32,
    /// number of frames
    pub num_frames: i32,
    /// number of channels (optional. default = 1 channel)
    pub num_channels: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
    /// the required sample rate (optional. default (or 0) = the server's sample
    /// rate)
    pub sample_rate: Option<f32>,
}

impl BAlloc {
    /// Construct `/b_alloc` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BAlloc { .. BAlloc::new(...) }`.
    pub fn new(bufnum: i32, num_frames: i32) -> Self {
        Self {
            bufnum,
            num_frames,
            num_channels: None,
            completion_msg: None,
            sample_rate: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::Int(self.num_frames));
        if let Some(v) = self.num_channels {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        if let Some(v) = self.sample_rate {
            args.push(OscType::Float(v));
        }
        ServerMessage::with_args(r"/b_alloc", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Allocate buffer space and read a sound file.
/// OSC address: `/b_allocRead`
#[derive(Debug, Clone)]
pub struct BAllocRead {
    /// buffer number
    pub bufnum: i32,
    /// path name of a sound file.
    pub path: String,
    /// starting frame in file (optional. default = 0)
    pub start_frame: Option<i32>,
    /// number of frames to read (optional. default = 0, see below)
    pub number_of_frames: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BAllocRead {
    /// Construct `/b_allocRead` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BAllocRead { .. BAllocRead::new(...) }`.
    pub fn new(bufnum: i32, path: String) -> Self {
        Self {
            bufnum,
            path,
            start_frame: None,
            number_of_frames: None,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        if let Some(v) = self.start_frame {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.number_of_frames {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/b_allocRead", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Allocate buffer space and read channels from a sound file.
/// OSC address: `/b_allocReadChannel`
#[derive(Debug, Clone)]
pub struct BAllocReadChannel {
    /// buffer number
    pub bufnum: i32,
    /// path name of a sound file
    pub path: String,
    /// starting frame in file
    pub start_frame: i32,
    /// number of frames to read
    pub number_of_frames: i32,
    /// Repeated tuples (source_file_channel: source file channel index; completion_msg: an OSC message to execute upon completion. (optional)).
    pub tail: Vec<(i32, Vec<u8>)>,
}

impl BAllocReadChannel {
    /// Construct `/b_allocReadChannel` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BAllocReadChannel { .. BAllocReadChannel::new(...) }`.
    pub fn new(bufnum: i32, path: String, start_frame: i32, number_of_frames: i32, tail: Vec<(i32, Vec<u8>)>) -> Self {
        Self {
            bufnum,
            path,
            start_frame,
            number_of_frames,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        args.push(OscType::Int(self.start_frame));
        args.push(OscType::Int(self.number_of_frames));
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Blob(t1));
        }
        ServerMessage::with_args(r"/b_allocReadChannel", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Close soundfile.
/// OSC address: `/b_close`
#[derive(Debug, Clone)]
pub struct BClose {
    /// buffer number
    pub bufnum: i32,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BClose {
    /// Construct `/b_close` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BClose { .. BClose::new(...) }`.
    pub fn new(bufnum: i32) -> Self {
        Self {
            bufnum,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/b_close", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Fill ranges of sample value(s).
/// OSC address: `/b_fill`
#[derive(Debug, Clone)]
pub struct BFill {
    /// buffer number
    pub bufnum: i32,
    /// Repeated tuples (sample_starting_index: sample starting index; number_of_samples: number of samples to fill (M); value: value).
    pub tail: Vec<(i32, i32, f32)>,
}

impl BFill {
    /// Construct `/b_fill` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BFill { .. BFill::new(...) }`.
    pub fn new(bufnum: i32, tail: Vec<(i32, i32, f32)>) -> Self {
        Self {
            bufnum,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Float(t2));
        }
        ServerMessage::with_args(r"/b_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Free buffer data.
/// OSC address: `/b_free`
#[derive(Debug, Clone)]
pub struct BFree {
    /// buffer number
    pub bufnum: i32,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BFree {
    /// Construct `/b_free` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BFree { .. BFree::new(...) }`.
    pub fn new(bufnum: i32) -> Self {
        Self {
            bufnum,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/b_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Call a command to fill a buffer.
/// OSC address: `/b_gen`
#[derive(Debug, Clone)]
pub struct BGen {
    /// buffer number
    pub bufnum: i32,
    /// command name
    pub cmd: String,
    /// command arguments
    pub command_arguments: rosc::OscType,
}

impl BGen {
    /// Construct `/b_gen` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BGen { .. BGen::new(...) }`.
    pub fn new(bufnum: i32, cmd: String, command_arguments: rosc::OscType) -> Self {
        Self {
            bufnum,
            cmd,
            command_arguments,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.cmd));
        args.push(self.command_arguments);
        ServerMessage::with_args(r"/b_gen", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get sample value(s).
/// OSC address: `/b_get`
#[derive(Debug, Clone)]
pub struct BGet {
    /// buffer number
    pub bufnum: i32,
    /// a sample index
    pub a_sample_index: i32,
}

impl BGet {
    /// Construct `/b_get` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BGet { .. BGet::new(...) }`.
    pub fn new(bufnum: i32, a_sample_index: i32) -> Self {
        Self {
            bufnum,
            a_sample_index,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::Int(self.a_sample_index));
        ServerMessage::with_args(r"/b_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of sample value(s).
/// OSC address: `/b_getn`
#[derive(Debug, Clone)]
pub struct BGetn {
    /// buffer number
    pub bufnum: i32,
    /// Repeated tuples (start_index: starting sample index; number_of_sequential: number of sequential samples to get (M)).
    pub tail: Vec<(i32, i32)>,
}

impl BGetn {
    /// Construct `/b_getn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BGetn { .. BGetn::new(...) }`.
    pub fn new(bufnum: i32, tail: Vec<(i32, i32)>) -> Self {
        Self {
            bufnum,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/b_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get buffer info.
/// OSC address: `/b_query`
#[derive(Debug, Clone)]
pub struct BQuery {
    /// buffer number(s)
    pub bufnum: i32,
}

impl BQuery {
    /// Construct `/b_query` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BQuery { .. BQuery::new(...) }`.
    pub fn new(bufnum: i32) -> Self {
        Self {
            bufnum,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        ServerMessage::with_args(r"/b_query", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Read sound file data into an existing buffer.
/// OSC address: `/b_read`
#[derive(Debug, Clone)]
pub struct BRead {
    /// buffer number
    pub bufnum: i32,
    /// path name of a sound file.
    pub path: String,
    /// starting frame in file (optional. default = 0)
    pub start_frame: Option<i32>,
    /// number of frames to read (optional. default = -1, see below)
    pub number_of_frames: Option<i32>,
    /// starting frame in buffer (optional. default = 0)
    pub starting_frame: Option<i32>,
    /// leave file open (optional. default = 0)
    pub leave_file_open: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BRead {
    /// Construct `/b_read` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BRead { .. BRead::new(...) }`.
    pub fn new(bufnum: i32, path: String) -> Self {
        Self {
            bufnum,
            path,
            start_frame: None,
            number_of_frames: None,
            starting_frame: None,
            leave_file_open: None,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        if let Some(v) = self.start_frame {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.number_of_frames {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.starting_frame {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.leave_file_open {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/b_read", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Read sound file channel data into an existing buffer.
/// OSC address: `/b_readChannel`
#[derive(Debug, Clone)]
pub struct BReadChannel {
    /// buffer number
    pub bufnum: i32,
    /// path name of a sound file
    pub path: String,
    /// starting frame in file
    pub start_frame: i32,
    /// number of frames to read
    pub number_of_frames: i32,
    /// starting frame in buffer
    pub starting_frame: i32,
    /// leave file open
    pub leave_file_open: i32,
    /// Repeated tuples (source_file_channel: source file channel index; completion_message: completion message).
    pub tail: Vec<(i32, Vec<u8>)>,
}

impl BReadChannel {
    /// Construct `/b_readChannel` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BReadChannel { .. BReadChannel::new(...) }`.
    pub fn new(bufnum: i32, path: String, start_frame: i32, number_of_frames: i32, starting_frame: i32, leave_file_open: i32, tail: Vec<(i32, Vec<u8>)>) -> Self {
        Self {
            bufnum,
            path,
            start_frame,
            number_of_frames,
            starting_frame,
            leave_file_open,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        args.push(OscType::Int(self.start_frame));
        args.push(OscType::Int(self.number_of_frames));
        args.push(OscType::Int(self.starting_frame));
        args.push(OscType::Int(self.leave_file_open));
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Blob(t1));
        }
        ServerMessage::with_args(r"/b_readChannel", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set sample value(s).
/// OSC address: `/b_set`
#[derive(Debug, Clone)]
pub struct BSet {
    /// buffer number
    pub bufnum: i32,
    /// Repeated tuples (a_sample_index: a sample index; a_sample_value: a sample value).
    pub tail: Vec<(i32, f32)>,
}

impl BSet {
    /// Construct `/b_set` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BSet { .. BSet::new(...) }`.
    pub fn new(bufnum: i32, tail: Vec<(i32, f32)>) -> Self {
        Self {
            bufnum,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Float(t1));
        }
        ServerMessage::with_args(r"/b_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of sample value(s).
/// OSC address: `/b_setn`
#[derive(Debug, Clone)]
pub struct BSetn {
    /// buffer number
    pub bufnum: i32,
    /// Repeated tuples (sample_starting_index: sample starting index; number_of_sequential: number of sequential samples to change (M); a_sample_value: a sample value).
    pub tail: Vec<(i32, i32, f32)>,
}

impl BSetn {
    /// Construct `/b_setn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BSetn { .. BSetn::new(...) }`.
    pub fn new(bufnum: i32, tail: Vec<(i32, i32, f32)>) -> Self {
        Self {
            bufnum,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Float(t2));
        }
        ServerMessage::with_args(r"/b_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set the sampling rate of the buffer.
/// OSC address: `/b_setSampleRate`
#[derive(Debug, Clone)]
pub struct BSetSampleRate {
    /// buffer number
    pub bufnum: i32,
    /// the desired sampling rate. 0 or nil will set to the Server's sample
    /// rate.
    pub the_desired_sampling: f32,
}

impl BSetSampleRate {
    /// Construct `/b_setSampleRate` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BSetSampleRate { .. BSetSampleRate::new(...) }`.
    pub fn new(bufnum: i32, the_desired_sampling: f32) -> Self {
        Self {
            bufnum,
            the_desired_sampling,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::Float(self.the_desired_sampling));
        ServerMessage::with_args(r"/b_setSampleRate", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Write sound file data.
/// OSC address: `/b_write`
#[derive(Debug, Clone)]
pub struct BWrite {
    /// buffer number
    pub bufnum: i32,
    /// path name of a sound file.
    pub path: String,
    /// header format.
    pub header_format: String,
    /// sample format.
    pub sample_format: String,
    /// number of frames to write (optional. default = -1, see below)
    pub number_of_frames: Option<i32>,
    /// starting frame in buffer (optional. default = 0)
    pub starting_frame: Option<i32>,
    /// leave file open (optional. default = 0)
    pub leave_file_open: Option<i32>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BWrite {
    /// Construct `/b_write` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BWrite { .. BWrite::new(...) }`.
    pub fn new(bufnum: i32, path: String, header_format: String, sample_format: String) -> Self {
        Self {
            bufnum,
            path,
            header_format,
            sample_format,
            number_of_frames: None,
            starting_frame: None,
            leave_file_open: None,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        args.push(OscType::String(self.header_format));
        args.push(OscType::String(self.sample_format));
        if let Some(v) = self.number_of_frames {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.starting_frame {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.leave_file_open {
            args.push(OscType::Int(v));
        }
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/b_write", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Zero sample data.
/// OSC address: `/b_zero`
#[derive(Debug, Clone)]
pub struct BZero {
    /// buffer number
    pub bufnum: i32,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BZero {
    /// Construct `/b_zero` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `BZero { .. BZero::new(...) }`.
    pub fn new(bufnum: i32) -> Self {
        Self {
            bufnum,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/b_zero", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
