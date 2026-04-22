//! Typed encoders for every SuperCollider server command, plus the
//! polymorphic arg enums some commands use.
//!
//! Hand-maintained. When you add / remove / tweak a command here, also
//! update `wit/commands.wit` so the component bindings stay in sync.

#![allow(non_snake_case, unused_mut)]

use rosc::OscType;
use crate::OscMessage;

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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
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
        OscMessage::with_args(r"/b_alloc", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
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
        OscMessage::with_args(r"/b_allocRead", args)
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
    /// source file channel indices (one or more) to read
    pub channels: Vec<i32>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BAllocReadChannel {
    /// Construct `/b_allocReadChannel` with all required args.
    /// `completion_msg` defaults to `None` — override via struct update:
    /// `BAllocReadChannel { completion_msg: Some(bytes), ..BAllocReadChannel::new(...) }`.
    pub fn new(
        bufnum: i32,
        path: String,
        start_frame: i32,
        number_of_frames: i32,
        channels: Vec<i32>,
    ) -> Self {
        Self {
            bufnum,
            path,
            start_frame,
            number_of_frames,
            channels,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        args.push(OscType::Int(self.start_frame));
        args.push(OscType::Int(self.number_of_frames));
        for ch in self.channels {
            args.push(OscType::Int(ch));
        }
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/b_allocReadChannel", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/b_close", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Float(t2));
        }
        OscMessage::with_args(r"/b_fill", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/b_free", args)
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
    /// command arguments — variadic trailing OSC args (types depend on the
    /// specific `/b_gen` command being invoked, e.g. `sine1`, `cheby`).
    pub command_arguments: Vec<OscType>,
}

impl BGen {
    pub fn new(bufnum: i32, cmd: String, command_arguments: Vec<OscType>) -> Self {
        Self {
            bufnum,
            cmd,
            command_arguments,
        }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.cmd));
        args.extend(self.command_arguments);
        OscMessage::with_args(r"/b_gen", args)
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
    /// sample indices (one or more) — the server replies with the value
    /// at each index.
    pub sample_indices: Vec<i32>,
}

impl BGet {
    pub fn new(bufnum: i32, sample_indices: Vec<i32>) -> Self {
        Self {
            bufnum,
            sample_indices,
        }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for idx in self.sample_indices {
            args.push(OscType::Int(idx));
        }
        OscMessage::with_args(r"/b_get", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/b_getn", args)
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
    /// buffer numbers to query
    pub bufnums: Vec<i32>,
}

impl BQuery {
    pub fn new(bufnums: Vec<i32>) -> Self {
        Self { bufnums }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for b in self.bufnums {
            args.push(OscType::Int(b));
        }
        OscMessage::with_args(r"/b_query", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
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
        OscMessage::with_args(r"/b_read", args)
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
    /// source file channel indices (one or more) to read
    pub channels: Vec<i32>,
    /// an OSC message to execute upon completion. (optional)
    pub completion_msg: Option<Vec<u8>>,
}

impl BReadChannel {
    /// Construct `/b_readChannel` with all required args. `completion_msg`
    /// defaults to `None` — override via struct update syntax.
    pub fn new(
        bufnum: i32,
        path: String,
        start_frame: i32,
        number_of_frames: i32,
        starting_frame: i32,
        leave_file_open: i32,
        channels: Vec<i32>,
    ) -> Self {
        Self {
            bufnum,
            path,
            start_frame,
            number_of_frames,
            starting_frame,
            leave_file_open,
            channels,
            completion_msg: None,
        }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::String(self.path));
        args.push(OscType::Int(self.start_frame));
        args.push(OscType::Int(self.number_of_frames));
        args.push(OscType::Int(self.starting_frame));
        args.push(OscType::Int(self.leave_file_open));
        for ch in self.channels {
            args.push(OscType::Int(ch));
        }
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/b_readChannel", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Float(t1));
        }
        OscMessage::with_args(r"/b_set", args)
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
    /// Repeated ranges — each `(start_index, samples[])` range writes
    /// `samples.len()` consecutive samples starting at `start_index`.
    /// The count is computed from the vector length, not passed separately.
    pub tail: Vec<(i32, Vec<f32>)>,
}

impl BSetn {
    pub fn new(bufnum: i32, tail: Vec<(i32, Vec<f32>)>) -> Self {
        Self { bufnum, tail }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        for (start, samples) in self.tail {
            args.push(OscType::Int(start));
            args.push(OscType::Int(samples.len() as i32));
            for v in samples {
                args.push(OscType::Float(v));
            }
        }
        OscMessage::with_args(r"/b_setn", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        args.push(OscType::Float(self.the_desired_sampling));
        OscMessage::with_args(r"/b_setSampleRate", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
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
        OscMessage::with_args(r"/b_write", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.bufnum));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/b_zero", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        OscMessage::with_args(r"/c_fill", args)
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
    /// bus indices (one or more)
    pub bus_indices: Vec<i32>,
}

impl CGet {
    pub fn new(bus_indices: Vec<i32>) -> Self {
        Self { bus_indices }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for idx in self.bus_indices {
            args.push(OscType::Int(idx));
        }
        OscMessage::with_args(r"/c_get", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/c_getn", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(t1.into());
        }
        OscMessage::with_args(r"/c_set", args)
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
    /// Repeated ranges — each `(start_bus, values[])` writes `values.len()`
    /// consecutive buses starting at `start_bus`. The count is encoded from
    /// the vector length.
    pub tail: Vec<(i32, Vec<NumericValue>)>,
}

impl CSetn {
    pub fn new(tail: Vec<(i32, Vec<NumericValue>)>) -> Self {
        Self { tail }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (start, values) in self.tail {
            args.push(OscType::Int(start));
            args.push(OscType::Int(values.len() as i32));
            for v in values {
                args.push(v.into());
            }
        }
        OscMessage::with_args(r"/c_setn", args)
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
    /// group IDs (one or more)
    pub group_ids: Vec<i32>,
}

impl GDeepFree {
    pub fn new(group_ids: Vec<i32>) -> Self {
        Self { group_ids }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for id in self.group_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/g_deepFree", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/g_dumpTree", args)
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
    /// group IDs (one or more)
    pub group_ids: Vec<i32>,
}

impl GFreeAll {
    pub fn new(group_ids: Vec<i32>) -> Self {
        Self { group_ids }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for id in self.group_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/g_freeAll", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/g_head", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        OscMessage::with_args(r"/g_new", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/g_queryTree", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/g_tail", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        OscMessage::with_args(r"/p_new", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        OscMessage::with_args(r"/clearSched", args)
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
    /// variadic trailing OSC args — types depend on the specific
    /// plug-in-defined command being invoked.
    pub any_arguments: Vec<OscType>,
}

impl Cmd {
    pub fn new(cmd: String, any_arguments: Vec<OscType>) -> Self {
        Self { cmd, any_arguments }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.cmd));
        args.extend(self.any_arguments);
        OscMessage::with_args(r"/cmd", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.code));
        OscMessage::with_args(r"/dumpOSC", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.mode));
        OscMessage::with_args(r"/error", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.enable));
        if let Some(v) = self.client_id {
            args.push(OscType::Int(v));
        }
        OscMessage::with_args(r"/notify", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        OscMessage::with_args(r"/quit", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        OscMessage::with_args(r"/rtMemoryStatus", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        OscMessage::with_args(r"/status", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.a_unique_number));
        OscMessage::with_args(r"/sync", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        OscMessage::with_args(r"/version", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/n_after", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/n_before", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        OscMessage::with_args(r"/n_fill", args)
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
    /// node IDs (one or more)
    pub node_ids: Vec<i32>,
}

impl NFree {
    pub fn new(node_ids: Vec<i32>) -> Self {
        Self { node_ids }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for id in self.node_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/n_free", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/n_map", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/n_mapa", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        OscMessage::with_args(r"/n_mapan", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        OscMessage::with_args(r"/n_mapn", args)
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
    /// node IDs (one or more) to reorder relative to the target
    pub node_ids: Vec<i32>,
}

impl NOrder {
    pub fn new(add_action: i32, target_id: i32, node_ids: Vec<i32>) -> Self {
        Self {
            add_action,
            target_id,
            node_ids,
        }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.add_action));
        args.push(OscType::Int(self.target_id));
        for id in self.node_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/n_order", args)
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
    /// node IDs (one or more) to query
    pub node_ids: Vec<i32>,
}

impl NQuery {
    pub fn new(node_ids: Vec<i32>) -> Self {
        Self { node_ids }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for id in self.node_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/n_query", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/n_run", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(t1.into());
        }
        OscMessage::with_args(r"/n_set", args)
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
    /// Repeated ranges — each `(control, values[])` writes `values.len()`
    /// consecutive controls starting at `control`. The count is encoded
    /// from the vector length.
    pub tail: Vec<(ControlId, Vec<NumericValue>)>,
}

impl NSetn {
    pub fn new(node_id: i32, tail: Vec<(ControlId, Vec<NumericValue>)>) -> Self {
        Self { node_id, tail }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (ctrl, values) in self.tail {
            args.push(ctrl.into());
            args.push(OscType::Int(values.len() as i32));
            for v in values {
                args.push(v.into());
            }
        }
        OscMessage::with_args(r"/n_setn", args)
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
    /// node IDs (one or more) to trace
    pub node_ids: Vec<i32>,
}

impl NTrace {
    pub fn new(node_ids: Vec<i32>) -> Self {
        Self { node_ids }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for id in self.node_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/n_trace", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        OscMessage::with_args(r"/nrt_end", args)
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
    /// controls (one or more) — each by index or name
    pub controls: Vec<ControlId>,
}

impl SGet {
    pub fn new(node_id: i32, controls: Vec<ControlId>) -> Self {
        Self { node_id, controls }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for c in self.controls {
            args.push(c.into());
        }
        OscMessage::with_args(r"/s_get", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        OscMessage::with_args(r"/s_getn", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.def_name));
        args.push(OscType::Int(self.node_id));
        args.push(OscType::Int(self.add_action));
        args.push(OscType::Int(self.target_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(t1.into());
        }
        OscMessage::with_args(r"/s_new", args)
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
    /// synth IDs (one or more) to reassign
    pub synth_ids: Vec<i32>,
}

impl SNoid {
    pub fn new(synth_ids: Vec<i32>) -> Self {
        Self { synth_ids }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for id in self.synth_ids {
            args.push(OscType::Int(id));
        }
        OscMessage::with_args(r"/s_noid", args)
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
    /// synthdef names (one or more) to delete
    pub synth_def_names: Vec<String>,
}

impl DFree {
    pub fn new(synth_def_names: Vec<String>) -> Self {
        Self { synth_def_names }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        for name in self.synth_def_names {
            args.push(OscType::String(name));
        }
        OscMessage::with_args(r"/d_free", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.pathname_of_file));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/d_load", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.pathname_of_directory));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/d_loadDir", args)
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

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Blob(self.buffer_of_data));
        if let Some(v) = self.completion_msg {
            args.push(OscType::Blob(v));
        }
        OscMessage::with_args(r"/d_recv", args)
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
    /// variadic trailing OSC args — types depend on the UGen command
    /// being invoked.
    pub any_arguments: Vec<OscType>,
}

impl UCmd {
    pub fn new(
        node_id: i32,
        unit_generator_index: i32,
        cmd: String,
        any_arguments: Vec<OscType>,
    ) -> Self {
        Self {
            node_id,
            unit_generator_index,
            cmd,
            any_arguments,
        }
    }

    /// Encode the typed fields into an OSC `OscMessage`.
    pub fn to_message(self) -> OscMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        args.push(OscType::Int(self.unit_generator_index));
        args.push(OscType::String(self.cmd));
        args.extend(self.any_arguments);
        OscMessage::with_args(r"/u_cmd", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

// ── ServerMessage: typed dispatch over every command ────────────────────

/// Typed dispatch over every documented SC server command. One variant
/// per address — 57 carry their per-command arg struct, 6 argless
/// commands are pure unit cases, and `Other` is an escape hatch for
/// addresses outside the catalogue (extensions / plug-in commands).
///
/// Construct via `From<…>` (`let msg: ServerMessage = BAlloc::new(0, 8192).into();`)
/// or directly (`ServerMessage::ClearSched`), then call [`encode`] to
/// produce OSC wire bytes.
#[derive(Debug, Clone)]
pub enum ServerMessage {
    BAlloc(BAlloc),
    BAllocRead(BAllocRead),
    BAllocReadChannel(BAllocReadChannel),
    BClose(BClose),
    BFill(BFill),
    BFree(BFree),
    BGen(BGen),
    BGet(BGet),
    BGetn(BGetn),
    BQuery(BQuery),
    BRead(BRead),
    BReadChannel(BReadChannel),
    BSet(BSet),
    BSetSampleRate(BSetSampleRate),
    BSetn(BSetn),
    BWrite(BWrite),
    BZero(BZero),
    CFill(CFill),
    CGet(CGet),
    CGetn(CGetn),
    CSet(CSet),
    CSetn(CSetn),
    ClearSched,
    Cmd(Cmd),
    DFree(DFree),
    DLoad(DLoad),
    DLoadDir(DLoadDir),
    DRecv(DRecv),
    DumpOSC(DumpOSC),
    Error(Error),
    GDeepFree(GDeepFree),
    GDumpTree(GDumpTree),
    GFreeAll(GFreeAll),
    GHead(GHead),
    GNew(GNew),
    GQueryTree(GQueryTree),
    GTail(GTail),
    NAfter(NAfter),
    NBefore(NBefore),
    NFill(NFill),
    NFree(NFree),
    NMap(NMap),
    NMapa(NMapa),
    NMapan(NMapan),
    NMapn(NMapn),
    NOrder(NOrder),
    NQuery(NQuery),
    NRun(NRun),
    NSet(NSet),
    NSetn(NSetn),
    NTrace(NTrace),
    Notify(Notify),
    NrtEnd,
    PNew(PNew),
    Quit,
    RtMemoryStatus,
    SGet(SGet),
    SGetn(SGetn),
    SNew(SNew),
    SNoid(SNoid),
    Status,
    Sync(Sync),
    UCmd(UCmd),
    Version,
    /// Escape hatch for addresses outside the catalogue. The `ServerMessage`
    /// enum covers every documented command; use this for SC extensions or
    /// plug-in commands the catalogue doesn't know about.
    Other {
        address: String,
        args: Vec<OscType>,
    },
}

impl ServerMessage {
    /// Lower to the underlying `OscMessage` (raw address + arg list).
    pub fn to_osc_message(self) -> OscMessage {
        match self {
            Self::BAlloc(c) => c.to_message(),
            Self::BAllocRead(c) => c.to_message(),
            Self::BAllocReadChannel(c) => c.to_message(),
            Self::BClose(c) => c.to_message(),
            Self::BFill(c) => c.to_message(),
            Self::BFree(c) => c.to_message(),
            Self::BGen(c) => c.to_message(),
            Self::BGet(c) => c.to_message(),
            Self::BGetn(c) => c.to_message(),
            Self::BQuery(c) => c.to_message(),
            Self::BRead(c) => c.to_message(),
            Self::BReadChannel(c) => c.to_message(),
            Self::BSet(c) => c.to_message(),
            Self::BSetSampleRate(c) => c.to_message(),
            Self::BSetn(c) => c.to_message(),
            Self::BWrite(c) => c.to_message(),
            Self::BZero(c) => c.to_message(),
            Self::CFill(c) => c.to_message(),
            Self::CGet(c) => c.to_message(),
            Self::CGetn(c) => c.to_message(),
            Self::CSet(c) => c.to_message(),
            Self::CSetn(c) => c.to_message(),
            Self::ClearSched => ClearSched::new().to_message(),
            Self::Cmd(c) => c.to_message(),
            Self::DFree(c) => c.to_message(),
            Self::DLoad(c) => c.to_message(),
            Self::DLoadDir(c) => c.to_message(),
            Self::DRecv(c) => c.to_message(),
            Self::DumpOSC(c) => c.to_message(),
            Self::Error(c) => c.to_message(),
            Self::GDeepFree(c) => c.to_message(),
            Self::GDumpTree(c) => c.to_message(),
            Self::GFreeAll(c) => c.to_message(),
            Self::GHead(c) => c.to_message(),
            Self::GNew(c) => c.to_message(),
            Self::GQueryTree(c) => c.to_message(),
            Self::GTail(c) => c.to_message(),
            Self::NAfter(c) => c.to_message(),
            Self::NBefore(c) => c.to_message(),
            Self::NFill(c) => c.to_message(),
            Self::NFree(c) => c.to_message(),
            Self::NMap(c) => c.to_message(),
            Self::NMapa(c) => c.to_message(),
            Self::NMapan(c) => c.to_message(),
            Self::NMapn(c) => c.to_message(),
            Self::NOrder(c) => c.to_message(),
            Self::NQuery(c) => c.to_message(),
            Self::NRun(c) => c.to_message(),
            Self::NSet(c) => c.to_message(),
            Self::NSetn(c) => c.to_message(),
            Self::NTrace(c) => c.to_message(),
            Self::Notify(c) => c.to_message(),
            Self::NrtEnd => NrtEnd::new().to_message(),
            Self::PNew(c) => c.to_message(),
            Self::Quit => Quit::new().to_message(),
            Self::RtMemoryStatus => RtMemoryStatus::new().to_message(),
            Self::SGet(c) => c.to_message(),
            Self::SGetn(c) => c.to_message(),
            Self::SNew(c) => c.to_message(),
            Self::SNoid(c) => c.to_message(),
            Self::Status => Status::new().to_message(),
            Self::Sync(c) => c.to_message(),
            Self::UCmd(c) => c.to_message(),
            Self::Version => Version::new().to_message(),
            Self::Other { address, args } => OscMessage::with_args(address, args),
        }
    }

    /// Serialise the command to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_osc_message().encode()
    }
}

macro_rules! impl_from_cmd {
    ($($ty:ident),* $(,)?) => {
        $(
            impl From<$ty> for ServerMessage {
                fn from(c: $ty) -> Self { ServerMessage::$ty(c) }
            }
        )*
    };
}

impl_from_cmd! {
    BAlloc, BAllocRead, BAllocReadChannel, BClose, BFill, BFree, BGen,
    BGet, BGetn, BQuery, BRead, BReadChannel, BSet, BSetSampleRate, BSetn,
    BWrite, BZero, CFill, CGet, CGetn, CSet, CSetn, Cmd, DFree, DLoad,
    DLoadDir, DRecv, DumpOSC, Error, GDeepFree, GDumpTree, GFreeAll,
    GHead, GNew, GQueryTree, GTail, NAfter, NBefore, NFill, NFree, NMap,
    NMapa, NMapan, NMapn, NOrder, NQuery, NRun, NSet, NSetn, NTrace,
    Notify, PNew, SGet, SGetn, SNew, SNoid, Sync, UCmd,
}
