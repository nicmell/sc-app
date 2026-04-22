// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Clear all scheduled bundles. Removes all bundles from the scheduling
/// queue.
/// OSC address: `/clearSched`
#[derive(Debug, Clone)]
pub struct ClearSched {
}

impl ClearSched {
    /// Construct `/clearSched` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `ClearSched { .. ClearSched::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Cmd { .. Cmd::new(...) }`.
    pub fn new(cmd: String, any_arguments: rosc::OscType) -> Self {
        Self {
            cmd,
            any_arguments,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `DumpOSC { .. DumpOSC::new(...) }`.
    pub fn new(code: i32) -> Self {
        Self {
            code,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Error { .. Error::new(...) }`.
    pub fn new(mode: i32) -> Self {
        Self {
            mode,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Notify { .. Notify::new(...) }`.
    pub fn new(enable: i32) -> Self {
        Self {
            enable,
            client_id: None,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Quit { .. Quit::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `RtMemoryStatus { .. RtMemoryStatus::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Status { .. Status::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Sync { .. Sync::new(...) }`.
    pub fn new(a_unique_number: i32) -> Self {
        Self {
            a_unique_number,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `Version { .. Version::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/version", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
