// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Clear all scheduled bundles. Removes all bundles from the scheduling
/// queue.
/// OSC address: `/clearSched`
#[derive(Debug, Clone, Default)]
pub struct ClearSched {
}

impl ClearSched {
    /// Construct a new /clearSched builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Build the encoded OSC message.
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
#[derive(Debug, Clone, Default)]
pub struct Cmd {
    /// command name
    cmd: Option<String>,
    /// any arguments
    any_arguments: Option<OscType>,
}

impl Cmd {
    /// Construct a new /cmd builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// command name
    pub fn cmd(mut self, v: String) -> Self { self.cmd = Some(v); self }

    /// any arguments
    pub fn any_arguments(mut self, v: OscType) -> Self { self.any_arguments = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.cmd { args.push(OscType::String(v)); }
        if let Some(v) = self.any_arguments { args.push(v); }
        ServerMessage::with_args(r"/cmd", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Display incoming OSC messages.
/// OSC address: `/dumpOSC`
#[derive(Debug, Clone, Default)]
pub struct DumpOSC {
    /// code
    code: Option<i32>,
}

impl DumpOSC {
    /// Construct a new /dumpOSC builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// code
    pub fn code(mut self, v: i32) -> Self { self.code = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.code { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/dumpOSC", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Enable/disable error message posting.
/// OSC address: `/error`
#[derive(Debug, Clone, Default)]
pub struct Error {
    /// mode
    mode: Option<i32>,
}

impl Error {
    /// Construct a new /error builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// mode
    pub fn mode(mut self, v: i32) -> Self { self.mode = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.mode { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/error", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Register to receive notifications from server
/// OSC address: `/notify`
#[derive(Debug, Clone, Default)]
pub struct Notify {
    /// 1 to receive notifications, 0 to stop receiving them.
    enable: Option<i32>,
    /// client ID (optional)
    client_id: Option<i32>,
}

impl Notify {
    /// Construct a new /notify builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// 1 to receive notifications, 0 to stop receiving them.
    pub fn enable(mut self, v: i32) -> Self { self.enable = Some(v); self }

    /// client ID (optional)
    pub fn client_id(mut self, v: i32) -> Self { self.client_id = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.enable { args.push(OscType::Int(v)); }
        if let Some(v) = self.client_id { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/notify", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Quit program. Exits the synthesis server.
/// OSC address: `/quit`
#[derive(Debug, Clone, Default)]
pub struct Quit {
}

impl Quit {
    /// Construct a new /quit builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Build the encoded OSC message.
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
#[derive(Debug, Clone, Default)]
pub struct RtMemoryStatus {
}

impl RtMemoryStatus {
    /// Construct a new /rtMemoryStatus builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Build the encoded OSC message.
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
#[derive(Debug, Clone, Default)]
pub struct Status {
}

impl Status {
    /// Construct a new /status builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Build the encoded OSC message.
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
#[derive(Debug, Clone, Default)]
pub struct Sync {
    /// a unique number identifying this command.
    a_unique_number: Option<i32>,
}

impl Sync {
    /// Construct a new /sync builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// a unique number identifying this command.
    pub fn a_unique_number(mut self, v: i32) -> Self { self.a_unique_number = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.a_unique_number { args.push(OscType::Int(v)); }
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
#[derive(Debug, Clone, Default)]
pub struct Version {
}

impl Version {
    /// Construct a new /version builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/version", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
