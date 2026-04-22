// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate.mjs` (from the crate root).

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

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
