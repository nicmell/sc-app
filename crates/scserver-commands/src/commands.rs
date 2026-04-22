//! Typed encoders for every SuperCollider server command, plus the
//! polymorphic arg enums some commands use.
//!
//! Hand-maintained. When you add / remove / tweak a command here, also
//! update `wit/commands.wit` so the component bindings stay in sync.

#![allow(non_snake_case, unused_mut)]

use rosc::OscType;
use crate::ServerMessage;

// ── Polymorphic arg types ───────────────────────────────────────────────

/// Identifier used to address a synth control: either its index in the
/// control list, or its declared name.
#[derive(Debug, Clone, PartialEq)]
pub enum ControlId {
    Index(i32),
    Name(String),
}

impl From<i32> for ControlId {
    fn from(v: i32) -> Self {
        ControlId::Index(v)
    }
}

impl From<&str> for ControlId {
    fn from(v: &str) -> Self {
        ControlId::Name(v.to_string())
    }
}

impl From<String> for ControlId {
    fn from(v: String) -> Self {
        ControlId::Name(v)
    }
}

impl From<ControlId> for OscType {
    fn from(v: ControlId) -> Self {
        match v {
            ControlId::Index(i) => OscType::Int(i),
            ControlId::Name(s) => OscType::String(s),
        }
    }
}

/// A numeric value that the server accepts as either `int` or `float`.
/// Used by `/c_set`, `/c_setn`, `/c_fill`, `/n_set`, `/n_setn`, `/n_fill`,
/// `/b_set`, `/b_setn`, `/b_fill`, etc.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NumericValue {
    Float(f32),
    Int(i32),
}

impl From<f32> for NumericValue {
    fn from(v: f32) -> Self {
        NumericValue::Float(v)
    }
}

impl From<i32> for NumericValue {
    fn from(v: i32) -> Self {
        NumericValue::Int(v)
    }
}

impl From<NumericValue> for OscType {
    fn from(v: NumericValue) -> Self {
        match v {
            NumericValue::Float(f) => OscType::Float(f),
            NumericValue::Int(i) => OscType::Int(i),
        }
    }
}

/// The `/s_new` control-value alternative: a float, an int, or a bus
/// reference string (e.g. `"c10"` for control bus 10, `"a0"` for audio
/// bus 0).
#[derive(Debug, Clone, PartialEq)]
pub enum ControlValue {
    Float(f32),
    Int(i32),
    /// Bus reference — a symbol like `"c10"` or `"a0"` that instructs the
    /// server to map the control to that bus at synth creation.
    Bus(String),
}

impl From<f32> for ControlValue {
    fn from(v: f32) -> Self {
        ControlValue::Float(v)
    }
}

impl From<i32> for ControlValue {
    fn from(v: i32) -> Self {
        ControlValue::Int(v)
    }
}

impl From<&str> for ControlValue {
    fn from(v: &str) -> Self {
        ControlValue::Bus(v.to_string())
    }
}

impl From<String> for ControlValue {
    fn from(v: String) -> Self {
        ControlValue::Bus(v)
    }
}

impl From<ControlValue> for OscType {
    fn from(v: ControlValue) -> Self {
        match v {
            ControlValue::Float(f) => OscType::Float(f),
            ControlValue::Int(i) => OscType::Int(i),
            ControlValue::Bus(s) => OscType::String(s),
        }
    }
}

// ── buffer commands ─────────────────────────────────────────────────

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

// ── control commands ─────────────────────────────────────────────────

/// Fill ranges of bus value(s).
/// OSC address: `/c_fill`
#[derive(Debug, Clone)]
pub struct CFill {
    /// Repeated tuples (starting_bus_index: starting bus index; number_of_buses: number of buses to fill (M); value: value).
    pub tail: Vec<(i32, i32, NumericValue)>,
}

impl CFill {
    /// Construct `/c_fill` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `CFill { .. CFill::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, NumericValue)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        ServerMessage::with_args(r"/c_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get bus value(s).
/// OSC address: `/c_get`
#[derive(Debug, Clone)]
pub struct CGet {
    /// a bus index
    pub a_bus_index: i32,
}

impl CGet {
    /// Construct `/c_get` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `CGet { .. CGet::new(...) }`.
    pub fn new(a_bus_index: i32) -> Self {
        Self {
            a_bus_index,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.a_bus_index));
        ServerMessage::with_args(r"/c_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of bus value(s).
/// OSC address: `/c_getn`
#[derive(Debug, Clone)]
pub struct CGetn {
    /// Repeated tuples (starting_bus_index: starting bus index; number_of_sequential: number of sequential buses to get (M)).
    pub tail: Vec<(i32, i32)>,
}

impl CGetn {
    /// Construct `/c_getn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `CGetn { .. CGetn::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/c_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set bus value(s).
/// OSC address: `/c_set`
#[derive(Debug, Clone)]
pub struct CSet {
    /// Repeated tuples (a_bus_index: a bus index; value: a control value).
    pub tail: Vec<(i32, NumericValue)>,
}

impl CSet {
    /// Construct `/c_set` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `CSet { .. CSet::new(...) }`.
    pub fn new(tail: Vec<(i32, NumericValue)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(t1.into());
        }
        ServerMessage::with_args(r"/c_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of bus value(s).
/// OSC address: `/c_setn`
#[derive(Debug, Clone)]
pub struct CSetn {
    /// Repeated tuples (starting_bus_index: starting bus index; number_of_sequential: number of sequential buses to change (M); arg2: ; value: a control value).
    pub tail: Vec<(i32, i32, rosc::OscType, NumericValue)>,
}

impl CSetn {
    /// Construct `/c_setn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `CSetn { .. CSetn::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, rosc::OscType, NumericValue)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2, t3) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(t2);
            args.push(t3.into());
        }
        ServerMessage::with_args(r"/c_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── group commands ─────────────────────────────────────────────────

/// Free all synths in this group and all its sub-groups.
/// OSC address: `/g_deepFree`
#[derive(Debug, Clone)]
pub struct GDeepFree {
    /// group ID(s)
    pub group_id: i32,
}

impl GDeepFree {
    /// Construct `/g_deepFree` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GDeepFree { .. GDeepFree::new(...) }`.
    pub fn new(group_id: i32) -> Self {
        Self {
            group_id,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.group_id));
        ServerMessage::with_args(r"/g_deepFree", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Post a representation of this group's node subtree.
/// OSC address: `/g_dumpTree`
#[derive(Debug, Clone)]
pub struct GDumpTree {
    /// Repeated tuples (group_id: group ID; flag_if_not: flag; if not 0 the current control (arg) values for synths will be posted).
    pub tail: Vec<(i32, i32)>,
}

impl GDumpTree {
    /// Construct `/g_dumpTree` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GDumpTree { .. GDumpTree::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/g_dumpTree", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Delete all nodes in a group.
/// OSC address: `/g_freeAll`
#[derive(Debug, Clone)]
pub struct GFreeAll {
    /// group ID(s)
    pub group_id: i32,
}

impl GFreeAll {
    /// Construct `/g_freeAll` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GFreeAll { .. GFreeAll::new(...) }`.
    pub fn new(group_id: i32) -> Self {
        Self {
            group_id,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.group_id));
        ServerMessage::with_args(r"/g_freeAll", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Add node to head of group.
/// OSC address: `/g_head`
#[derive(Debug, Clone)]
pub struct GHead {
    /// Repeated tuples (group_id: group ID; node_id: node ID).
    pub tail: Vec<(i32, i32)>,
}

impl GHead {
    /// Construct `/g_head` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GHead { .. GHead::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/g_head", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Create a new group.
/// OSC address: `/g_new`
#[derive(Debug, Clone)]
pub struct GNew {
    /// Repeated tuples (new_group_id: new group ID; add_action: add action (0,1,2, 3 or 4 see below); target_id: add target ID).
    pub tail: Vec<(i32, i32, i32)>,
}

impl GNew {
    /// Construct `/g_new` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GNew { .. GNew::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        ServerMessage::with_args(r"/g_new", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get a representation of this group's node subtree.
/// OSC address: `/g_queryTree`
#[derive(Debug, Clone)]
pub struct GQueryTree {
    /// Repeated tuples (group_id: group ID; flag_if_not: flag: if not 0 the current control (arg) values for synths will be included).
    pub tail: Vec<(i32, i32)>,
}

impl GQueryTree {
    /// Construct `/g_queryTree` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GQueryTree { .. GQueryTree::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/g_queryTree", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Add node to tail of group.
/// OSC address: `/g_tail`
#[derive(Debug, Clone)]
pub struct GTail {
    /// Repeated tuples (group_id: group ID; node_id: node ID).
    pub tail: Vec<(i32, i32)>,
}

impl GTail {
    /// Construct `/g_tail` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `GTail { .. GTail::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/g_tail", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Create a new parallel group.
/// OSC address: `/p_new`
#[derive(Debug, Clone)]
pub struct PNew {
    /// Repeated tuples (new_group_id: new group ID; add_action: add action (0,1,2, 3 or 4 see below); target_id: add target ID).
    pub tail: Vec<(i32, i32, i32)>,
}

impl PNew {
    /// Construct `/p_new` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `PNew { .. PNew::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        ServerMessage::with_args(r"/p_new", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── master commands ─────────────────────────────────────────────────

/// Clear all scheduled bundles. Removes all bundles from the scheduling queue.
/// OSC address: `/clearSched`
#[derive(Debug, Clone)]
pub struct ClearSched {
}

impl ClearSched {
    /// Construct `/clearSched` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `ClearSched { .. ClearSched::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/clearSched", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Plug-in defined command.
/// OSC address: `/cmd`
#[derive(Debug, Clone)]
pub struct Cmd {
    /// command name
    pub cmd: String,
    /// any arguments
    pub any_arguments: rosc::OscType,
}

impl Cmd {
    /// Construct `/cmd` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Cmd { .. Cmd::new(...) }`.
    pub fn new(cmd: String, any_arguments: rosc::OscType) -> Self {
        Self {
            cmd,
            any_arguments,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.cmd));
        args.push(self.any_arguments);
        ServerMessage::with_args(r"/cmd", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Display incoming OSC messages.
/// OSC address: `/dumpOSC`
#[derive(Debug, Clone)]
pub struct DumpOSC {
    /// code
    pub code: i32,
}

impl DumpOSC {
    /// Construct `/dumpOSC` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `DumpOSC { .. DumpOSC::new(...) }`.
    pub fn new(code: i32) -> Self {
        Self {
            code,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.code));
        ServerMessage::with_args(r"/dumpOSC", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Enable/disable error message posting.
/// OSC address: `/error`
#[derive(Debug, Clone)]
pub struct Error {
    /// mode
    pub mode: i32,
}

impl Error {
    /// Construct `/error` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Error { .. Error::new(...) }`.
    pub fn new(mode: i32) -> Self {
        Self {
            mode,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.mode));
        ServerMessage::with_args(r"/error", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Register to receive notifications from server
/// OSC address: `/notify`
#[derive(Debug, Clone)]
pub struct Notify {
    /// 1 to receive notifications, 0 to stop receiving them.
    pub enable: i32,
    /// client ID (optional)
    pub client_id: Option<i32>,
}

impl Notify {
    /// Construct `/notify` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Notify { .. Notify::new(...) }`.
    pub fn new(enable: i32) -> Self {
        Self {
            enable,
            client_id: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.enable));
        if let Some(v) = self.client_id {
            args.push(OscType::Int(v));
        }
        ServerMessage::with_args(r"/notify", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Quit program. Exits the synthesis server.
/// OSC address: `/quit`
#[derive(Debug, Clone)]
pub struct Quit {
}

impl Quit {
    /// Construct `/quit` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Quit { .. Quit::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/quit", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Queries the amount of currently free real-time memory (in bytes).
/// OSC address: `/rtMemoryStatus`
#[derive(Debug, Clone)]
pub struct RtMemoryStatus {
}

impl RtMemoryStatus {
    /// Construct `/rtMemoryStatus` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `RtMemoryStatus { .. RtMemoryStatus::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/rtMemoryStatus", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Query the status. Replies to sender with the following message:
/// OSC address: `/status`
#[derive(Debug, Clone)]
pub struct Status {
}

impl Status {
    /// Construct `/status` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Status { .. Status::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/status", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Notify when async commands have completed.
/// OSC address: `/sync`
#[derive(Debug, Clone)]
pub struct Sync {
    /// a unique number identifying this command.
    pub a_unique_number: i32,
}

impl Sync {
    /// Construct `/sync` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Sync { .. Sync::new(...) }`.
    pub fn new(a_unique_number: i32) -> Self {
        Self {
            a_unique_number,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.a_unique_number));
        ServerMessage::with_args(r"/sync", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Query the SuperCollider version. Replies to sender with the following
/// message:
/// OSC address: `/version`
#[derive(Debug, Clone)]
pub struct Version {
}

impl Version {
    /// Construct `/version` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `Version { .. Version::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/version", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── node commands ─────────────────────────────────────────────────

/// Place a node after another.
/// OSC address: `/n_after`
#[derive(Debug, Clone)]
pub struct NAfter {
    /// Repeated tuples (the_id_of: the ID of the node to place (A); the_id_of: the ID of the node after which the above is placed (B)).
    pub tail: Vec<(i32, i32)>,
}

impl NAfter {
    /// Construct `/n_after` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NAfter { .. NAfter::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/n_after", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Place a node before another.
/// OSC address: `/n_before`
#[derive(Debug, Clone)]
pub struct NBefore {
    /// Repeated tuples (the_id_of: the ID of the node to place (A); the_id_of: the ID of the node before which the above is placed (B)).
    pub tail: Vec<(i32, i32)>,
}

impl NBefore {
    /// Construct `/n_before` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NBefore { .. NBefore::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/n_before", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Fill ranges of a node's control value(s).
/// OSC address: `/n_fill`
#[derive(Debug, Clone)]
pub struct NFill {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; number_of_values: number of values to fill (M); value: value).
    pub tail: Vec<(ControlId, i32, NumericValue)>,
}

impl NFill {
    /// Construct `/n_fill` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NFill { .. NFill::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32, NumericValue)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        ServerMessage::with_args(r"/n_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Delete a node.
/// OSC address: `/n_free`
#[derive(Debug, Clone)]
pub struct NFree {
    /// node ID
    pub node_id: i32,
}

impl NFree {
    /// Construct `/n_free` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NFree { .. NFree::new(...) }`.
    pub fn new(node_id: i32) -> Self {
        Self {
            node_id,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        ServerMessage::with_args(r"/n_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from a bus.
/// OSC address: `/n_map`
#[derive(Debug, Clone)]
pub struct NMap {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; control_bus_index: control bus index).
    pub tail: Vec<(ControlId, i32)>,
}

impl NMap {
    /// Construct `/n_map` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NMap { .. NMap::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/n_map", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from an audio bus.
/// OSC address: `/n_mapa`
#[derive(Debug, Clone)]
pub struct NMapa {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; audio_bus_index: audio bus index).
    pub tail: Vec<(ControlId, i32)>,
}

impl NMapa {
    /// Construct `/n_mapa` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NMapa { .. NMapa::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/n_mapa", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from audio buses.
/// OSC address: `/n_mapan`
#[derive(Debug, Clone)]
pub struct NMapan {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; audio_bus_index: audio bus index; number_of_controls: number of controls to map).
    pub tail: Vec<(ControlId, i32, i32)>,
}

impl NMapan {
    /// Construct `/n_mapan` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NMapan { .. NMapan::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        ServerMessage::with_args(r"/n_mapan", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from buses.
/// OSC address: `/n_mapn`
#[derive(Debug, Clone)]
pub struct NMapn {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; control_bus_index: control bus index; number_of_controls: number of controls to map).
    pub tail: Vec<(ControlId, i32, i32)>,
}

impl NMapn {
    /// Construct `/n_mapn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NMapn { .. NMapn::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        ServerMessage::with_args(r"/n_mapn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Move and order a list of nodes.
/// OSC address: `/n_order`
#[derive(Debug, Clone)]
pub struct NOrder {
    /// add action (0,1,2 or 3 see below)
    pub add_action: i32,
    /// add target ID
    pub target_id: i32,
    /// node IDs
    pub node_ids: i32,
}

impl NOrder {
    /// Construct `/n_order` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NOrder { .. NOrder::new(...) }`.
    pub fn new(add_action: i32, target_id: i32, node_ids: i32) -> Self {
        Self {
            add_action,
            target_id,
            node_ids,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.add_action));
        args.push(OscType::Int(self.target_id));
        args.push(OscType::Int(self.node_ids));
        ServerMessage::with_args(r"/n_order", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get info about a node.
/// OSC address: `/n_query`
#[derive(Debug, Clone)]
pub struct NQuery {
    /// node ID
    pub node_id: i32,
}

impl NQuery {
    /// Construct `/n_query` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NQuery { .. NQuery::new(...) }`.
    pub fn new(node_id: i32) -> Self {
        Self {
            node_id,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        ServerMessage::with_args(r"/n_query", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Turn node on or off.
/// OSC address: `/n_run`
#[derive(Debug, Clone)]
pub struct NRun {
    /// Repeated tuples (node_id: node ID; run_flag: run flag).
    pub tail: Vec<(i32, i32)>,
}

impl NRun {
    /// Construct `/n_run` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NRun { .. NRun::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/n_run", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set a node's control value(s).
/// OSC address: `/n_set`
#[derive(Debug, Clone)]
pub struct NSet {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; value: a control value).
    pub tail: Vec<(ControlId, NumericValue)>,
}

impl NSet {
    /// Construct `/n_set` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NSet { .. NSet::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, NumericValue)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(t1.into());
        }
        ServerMessage::with_args(r"/n_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of a node's control value(s).
/// OSC address: `/n_setn`
#[derive(Debug, Clone)]
pub struct NSetn {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; number_of_sequential: number of sequential controls to change (M); control_value: control value(s)).
    pub tail: Vec<(ControlId, i32, NumericValue)>,
}

impl NSetn {
    /// Construct `/n_setn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NSetn { .. NSetn::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32, NumericValue)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        ServerMessage::with_args(r"/n_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Trace a node.
/// OSC address: `/n_trace`
#[derive(Debug, Clone)]
pub struct NTrace {
    /// node IDs
    pub node_ids: i32,
}

impl NTrace {
    /// Construct `/n_trace` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NTrace { .. NTrace::new(...) }`.
    pub fn new(node_ids: i32) -> Self {
        Self {
            node_ids,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_ids));
        ServerMessage::with_args(r"/n_trace", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── nrt commands ─────────────────────────────────────────────────

/// End real time mode, close file. Not yet implemented. This message should be
/// sent in a bundle in non real time mode. The bundle timestamp will establish
/// the ending time of the file. This command will end non real time mode and
/// close the sound file. Replies to sender with /done when complete.
/// OSC address: `/nrt_end`
#[derive(Debug, Clone)]
pub struct NrtEnd {
}

impl NrtEnd {
    /// Construct `/nrt_end` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NrtEnd { .. NrtEnd::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/nrt_end", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── synth commands ─────────────────────────────────────────────────

/// Get control value(s).
/// OSC address: `/s_get`
#[derive(Debug, Clone)]
pub struct SGet {
    /// synth ID
    pub node_id: i32,
    /// a control index or name
    pub control: ControlId,
}

impl SGet {
    /// Construct `/s_get` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `SGet { .. SGet::new(...) }`.
    pub fn new(node_id: i32, control: ControlId) -> Self {
        Self {
            node_id,
            control,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        args.push(self.control.into());
        ServerMessage::with_args(r"/s_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of control value(s).
/// OSC address: `/s_getn`
#[derive(Debug, Clone)]
pub struct SGetn {
    /// synth ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; number_of_sequential: number of sequential controls to get (M)).
    pub tail: Vec<(ControlId, i32)>,
}

impl SGetn {
    /// Construct `/s_getn` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `SGetn { .. SGetn::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(ControlId, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/s_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Create a new synth.
/// OSC address: `/s_new`
#[derive(Debug, Clone)]
pub struct SNew {
    /// synth definition name
    pub def_name: String,
    /// synth ID
    pub node_id: i32,
    /// add action (0,1,2, 3 or 4 see below)
    pub add_action: i32,
    /// add target ID
    pub target_id: i32,
    /// Repeated tuples (control: a control index or name; floating_point_and: floating point and integer arguments are interpreted as control value. a symbol argument consisting of the letter 'c' or 'a' (for control or audio) followed by the bus's index.).
    pub tail: Vec<(ControlId, ControlValue)>,
}

impl SNew {
    /// Construct `/s_new` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `SNew { .. SNew::new(...) }`.
    pub fn new(def_name: String, node_id: i32, add_action: i32, target_id: i32, tail: Vec<(ControlId, ControlValue)>) -> Self {
        Self {
            def_name,
            node_id,
            add_action,
            target_id,
            tail,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.def_name));
        args.push(OscType::Int(self.node_id));
        args.push(OscType::Int(self.add_action));
        args.push(OscType::Int(self.target_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(t1.into());
        }
        ServerMessage::with_args(r"/s_new", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Auto-reassign synth's ID to a reserved value.
/// OSC address: `/s_noid`
#[derive(Debug, Clone)]
pub struct SNoid {
    /// synth IDs
    pub synth_ids: i32,
}

impl SNoid {
    /// Construct `/s_noid` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `SNoid { .. SNoid::new(...) }`.
    pub fn new(synth_ids: i32) -> Self {
        Self {
            synth_ids,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.synth_ids));
        ServerMessage::with_args(r"/s_noid", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── synthdef commands ─────────────────────────────────────────────────

/// Delete synth definition.
/// OSC address: `/d_free`
#[derive(Debug, Clone)]
pub struct DFree {
    /// synth def name
    pub synth_def_name: String,
}

impl DFree {
    /// Construct `/d_free` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `DFree { .. DFree::new(...) }`.
    pub fn new(synth_def_name: String) -> Self {
        Self {
            synth_def_name,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.synth_def_name));
        ServerMessage::with_args(r"/d_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Load synth definition.
/// OSC address: `/d_load`
#[derive(Debug, Clone)]
pub struct DLoad {
    /// pathname of file. Can be a pattern like "synthdefs/perc-*"
    pub pathname_of_file: String,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl DLoad {
    /// Construct `/d_load` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `DLoad { .. DLoad::new(...) }`.
    pub fn new(pathname_of_file: String) -> Self {
        Self {
            pathname_of_file,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.pathname_of_file));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/d_load", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Load a directory of synth definitions.
/// OSC address: `/d_loadDir`
#[derive(Debug, Clone)]
pub struct DLoadDir {
    /// pathname of directory.
    pub pathname_of_directory: String,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl DLoadDir {
    /// Construct `/d_loadDir` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `DLoadDir { .. DLoadDir::new(...) }`.
    pub fn new(pathname_of_directory: String) -> Self {
        Self {
            pathname_of_directory,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.pathname_of_directory));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/d_loadDir", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Receive a synth definition file.
/// OSC address: `/d_recv`
#[derive(Debug, Clone)]
pub struct DRecv {
    /// buffer of data.
    pub buffer_of_data: Vec<u8>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl DRecv {
    /// Construct `/d_recv` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `DRecv { .. DRecv::new(...) }`.
    pub fn new(buffer_of_data: Vec<u8>) -> Self {
        Self {
            buffer_of_data,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Blob(self.buffer_of_data));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        ServerMessage::with_args(r"/d_recv", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── unit commands ─────────────────────────────────────────────────

/// Send a command to a unit generator.
/// OSC address: `/u_cmd`
#[derive(Debug, Clone)]
pub struct UCmd {
    /// node ID
    pub node_id: i32,
    /// unit generator index
    pub unit_generator_index: i32,
    /// command name
    pub cmd: String,
    /// any arguments
    pub any_arguments: rosc::OscType,
}

impl UCmd {
    /// Construct `/u_cmd` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `UCmd { .. UCmd::new(...) }`.
    pub fn new(node_id: i32, unit_generator_index: i32, cmd: String, any_arguments: rosc::OscType) -> Self {
        Self {
            node_id,
            unit_generator_index,
            cmd,
            any_arguments,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        args.push(OscType::Int(self.unit_generator_index));
        args.push(OscType::String(self.cmd));
        args.push(self.any_arguments);
        ServerMessage::with_args(r"/u_cmd", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── WIT Guest impl (component feature) ──────────────────────────────────

#[cfg(feature = "component")]
mod component_bridge {
    use super::*;
    use crate::component::bindings::exports::scserver::commands::commands as wit_cmd;
    use crate::component::{Component, ServerMessageResource};
    use crate::component::bindings::exports::scserver::commands::core::ServerMessage as WitServerMessageResource;

    impl wit_cmd::Guest for Component {
        fn b_alloc(
            args: wit_cmd::BAllocArgs,
        ) -> WitServerMessageResource {
            let msg = BAlloc {
                num_channels: args.num_channels,
                completion_msg: args.completion_msg,
                sample_rate: args.sample_rate,
                ..BAlloc::new(args.bufnum, args.num_frames)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_alloc_read(
            args: wit_cmd::BAllocReadArgs,
        ) -> WitServerMessageResource {
            let msg = BAllocRead {
                start_frame: args.start_frame,
                number_of_frames: args.number_of_frames,
                completion_msg: args.completion_msg,
                ..BAllocRead::new(args.bufnum, args.path)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_alloc_read_channel(
            args: wit_cmd::BAllocReadChannelArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = BAllocReadChannel::new(args.bufnum, args.path, args.start_frame, args.number_of_frames, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_close(
            args: wit_cmd::BCloseArgs,
        ) -> WitServerMessageResource {
            let msg = BClose {
                completion_msg: args.completion_msg,
                ..BClose::new(args.bufnum)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_fill(
            args: wit_cmd::BFillArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            let msg = BFill::new(args.bufnum, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_free(
            args: wit_cmd::BFreeArgs,
        ) -> WitServerMessageResource {
            let msg = BFree {
                completion_msg: args.completion_msg,
                ..BFree::new(args.bufnum)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_gen(
            args: wit_cmd::BGenArgs,
        ) -> WitServerMessageResource {
            let command_arguments = rosc::OscType::Blob(args.command_arguments);
            let msg = BGen::new(args.bufnum, args.cmd, command_arguments).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_get(
            args: wit_cmd::BGetArgs,
        ) -> WitServerMessageResource {
            let msg = BGet::new(args.bufnum, args.a_sample_index).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_getn(
            args: wit_cmd::BGetnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = BGetn::new(args.bufnum, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_query(
            args: wit_cmd::BQueryArgs,
        ) -> WitServerMessageResource {
            let msg = BQuery::new(args.bufnum).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_read(
            args: wit_cmd::BReadArgs,
        ) -> WitServerMessageResource {
            let msg = BRead {
                start_frame: args.start_frame,
                number_of_frames: args.number_of_frames,
                starting_frame: args.starting_frame,
                leave_file_open: args.leave_file_open,
                completion_msg: args.completion_msg,
                ..BRead::new(args.bufnum, args.path)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_read_channel(
            args: wit_cmd::BReadChannelArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = BReadChannel::new(args.bufnum, args.path, args.start_frame, args.number_of_frames, args.starting_frame, args.leave_file_open, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_set(
            args: wit_cmd::BSetArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = BSet::new(args.bufnum, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_set_sample_rate(
            args: wit_cmd::BSetSampleRateArgs,
        ) -> WitServerMessageResource {
            let msg = BSetSampleRate::new(args.bufnum, args.the_desired_sampling).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_setn(
            args: wit_cmd::BSetnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            let msg = BSetn::new(args.bufnum, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_write(
            args: wit_cmd::BWriteArgs,
        ) -> WitServerMessageResource {
            let msg = BWrite {
                number_of_frames: args.number_of_frames,
                starting_frame: args.starting_frame,
                leave_file_open: args.leave_file_open,
                completion_msg: args.completion_msg,
                ..BWrite::new(args.bufnum, args.path, args.header_format, args.sample_format)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn b_zero(
            args: wit_cmd::BZeroArgs,
        ) -> WitServerMessageResource {
            let msg = BZero {
                completion_msg: args.completion_msg,
                ..BZero::new(args.bufnum)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn c_fill(
            args: wit_cmd::CFillArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, match t.2 {
                    wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                    wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
                })).collect();
            let msg = CFill::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn c_get(
            args: wit_cmd::CGetArgs,
        ) -> WitServerMessageResource {
            let msg = CGet::new(args.a_bus_index).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn c_getn(
            args: wit_cmd::CGetnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = CGetn::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn c_set(
            args: wit_cmd::CSetArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, match t.1 {
                    wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                    wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
                })).collect();
            let msg = CSet::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn c_setn(
            args: wit_cmd::CSetnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, rosc::OscType::Blob(t.2), match t.3 {
                    wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                    wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
                })).collect();
            let msg = CSetn::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn clear_sched(
        ) -> WitServerMessageResource {
            let msg = ClearSched::new().to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn cmd(
            args: wit_cmd::CmdArgs,
        ) -> WitServerMessageResource {
            let any_arguments = rosc::OscType::Blob(args.any_arguments);
            let msg = Cmd::new(args.cmd, any_arguments).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn d_free(
            args: wit_cmd::DFreeArgs,
        ) -> WitServerMessageResource {
            let msg = DFree::new(args.synth_def_name).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn d_load(
            args: wit_cmd::DLoadArgs,
        ) -> WitServerMessageResource {
            let msg = DLoad {
                completion_msg: args.completion_msg,
                ..DLoad::new(args.pathname_of_file)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn d_load_dir(
            args: wit_cmd::DLoadDirArgs,
        ) -> WitServerMessageResource {
            let msg = DLoadDir {
                completion_msg: args.completion_msg,
                ..DLoadDir::new(args.pathname_of_directory)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn d_recv(
            args: wit_cmd::DRecvArgs,
        ) -> WitServerMessageResource {
            let msg = DRecv {
                completion_msg: args.completion_msg,
                ..DRecv::new(args.buffer_of_data)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn dump_osc(
            args: wit_cmd::DumpOscArgs,
        ) -> WitServerMessageResource {
            let msg = DumpOSC::new(args.code).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn error(
            args: wit_cmd::ErrorArgs,
        ) -> WitServerMessageResource {
            let msg = Error::new(args.mode).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_deep_free(
            args: wit_cmd::GDeepFreeArgs,
        ) -> WitServerMessageResource {
            let msg = GDeepFree::new(args.group_id).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_dump_tree(
            args: wit_cmd::GDumpTreeArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = GDumpTree::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_free_all(
            args: wit_cmd::GFreeAllArgs,
        ) -> WitServerMessageResource {
            let msg = GFreeAll::new(args.group_id).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_head(
            args: wit_cmd::GHeadArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = GHead::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_new(
            args: wit_cmd::GNewArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            let msg = GNew::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_query_tree(
            args: wit_cmd::GQueryTreeArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = GQueryTree::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn g_tail(
            args: wit_cmd::GTailArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = GTail::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_after(
            args: wit_cmd::NAfterArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = NAfter::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_before(
            args: wit_cmd::NBeforeArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = NBefore::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_fill(
            args: wit_cmd::NFillArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1, match t.2 {
                    wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                    wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
                })).collect();
            let msg = NFill::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_free(
            args: wit_cmd::NFreeArgs,
        ) -> WitServerMessageResource {
            let msg = NFree::new(args.node_id).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_map(
            args: wit_cmd::NMapArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1)).collect();
            let msg = NMap::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_mapa(
            args: wit_cmd::NMapaArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1)).collect();
            let msg = NMapa::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_mapan(
            args: wit_cmd::NMapanArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1, t.2)).collect();
            let msg = NMapan::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_mapn(
            args: wit_cmd::NMapnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1, t.2)).collect();
            let msg = NMapn::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_order(
            args: wit_cmd::NOrderArgs,
        ) -> WitServerMessageResource {
            let msg = NOrder::new(args.add_action, args.target_id, args.node_ids).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_query(
            args: wit_cmd::NQueryArgs,
        ) -> WitServerMessageResource {
            let msg = NQuery::new(args.node_id).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_run(
            args: wit_cmd::NRunArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
            let msg = NRun::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_set(
            args: wit_cmd::NSetArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, match t.1 {
                    wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                    wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
                })).collect();
            let msg = NSet::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_setn(
            args: wit_cmd::NSetnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1, match t.2 {
                    wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                    wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
                })).collect();
            let msg = NSetn::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn n_trace(
            args: wit_cmd::NTraceArgs,
        ) -> WitServerMessageResource {
            let msg = NTrace::new(args.node_ids).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn notify(
            args: wit_cmd::NotifyArgs,
        ) -> WitServerMessageResource {
            let msg = Notify {
                client_id: args.client_id,
                ..Notify::new(args.enable)
            }.to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn nrt_end(
        ) -> WitServerMessageResource {
            let msg = NrtEnd::new().to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn p_new(
            args: wit_cmd::PNewArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            let msg = PNew::new(tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn quit(
        ) -> WitServerMessageResource {
            let msg = Quit::new().to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn rt_memory_status(
        ) -> WitServerMessageResource {
            let msg = RtMemoryStatus::new().to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn s_get(
            args: wit_cmd::SGetArgs,
        ) -> WitServerMessageResource {
            let control = match args.control {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                };
            let msg = SGet::new(args.node_id, control).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn s_getn(
            args: wit_cmd::SGetnArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, t.1)).collect();
            let msg = SGetn::new(args.node_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn s_new(
            args: wit_cmd::SNewArgs,
        ) -> WitServerMessageResource {
            let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                    wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                    wit_cmd::ControlId::Name(s) => ControlId::Name(s),
                }, match t.1 {
                    wit_cmd::ControlValue::Float(f) => ControlValue::Float(f),
                    wit_cmd::ControlValue::Int(i) => ControlValue::Int(i),
                    wit_cmd::ControlValue::Bus(s) => ControlValue::Bus(s),
                })).collect();
            let msg = SNew::new(args.def_name, args.node_id, args.add_action, args.target_id, tail).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn s_noid(
            args: wit_cmd::SNoidArgs,
        ) -> WitServerMessageResource {
            let msg = SNoid::new(args.synth_ids).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn status(
        ) -> WitServerMessageResource {
            let msg = Status::new().to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn sync(
            args: wit_cmd::SyncArgs,
        ) -> WitServerMessageResource {
            let msg = Sync::new(args.a_unique_number).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn u_cmd(
            args: wit_cmd::UCmdArgs,
        ) -> WitServerMessageResource {
            let any_arguments = rosc::OscType::Blob(args.any_arguments);
            let msg = UCmd::new(args.node_id, args.unit_generator_index, args.cmd, any_arguments).to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
        fn version(
        ) -> WitServerMessageResource {
            let msg = Version::new().to_message();
            WitServerMessageResource::new(ServerMessageResource::new(msg))
        }
    }
}
