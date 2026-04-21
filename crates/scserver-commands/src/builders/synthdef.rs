// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Delete synth definition.
/// OSC address: `/d_free`
#[derive(Debug, Clone, Default)]
pub struct DFree {
    /// synth def name
    synth_def_name: Option<String>,
}

impl DFree {
    /// Construct a new /d_free builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// synth def name
    pub fn synth_def_name(mut self, v: String) -> Self { self.synth_def_name = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.synth_def_name { args.push(OscType::String(v)); }
        ServerMessage::with_args(r"/d_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Load synth definition.
/// OSC address: `/d_load`
#[derive(Debug, Clone, Default)]
pub struct DLoad {
    /// pathname of file. Can be a pattern like "synthdefs/perc-*"
    pathname_of_file: Option<String>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl DLoad {
    /// Construct a new /d_load builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// pathname of file. Can be a pattern like "synthdefs/perc-*"
    pub fn pathname_of_file(mut self, v: String) -> Self { self.pathname_of_file = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.pathname_of_file { args.push(OscType::String(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/d_load", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Load a directory of synth definitions.
/// OSC address: `/d_loadDir`
#[derive(Debug, Clone, Default)]
pub struct DLoadDir {
    /// pathname of directory.
    pathname_of_directory: Option<String>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl DLoadDir {
    /// Construct a new /d_loadDir builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// pathname of directory.
    pub fn pathname_of_directory(mut self, v: String) -> Self { self.pathname_of_directory = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.pathname_of_directory { args.push(OscType::String(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/d_loadDir", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Receive a synth definition file.
/// OSC address: `/d_recv`
#[derive(Debug, Clone, Default)]
pub struct DRecv {
    /// buffer of data.
    buffer_of_data: Option<Vec<u8>>,
    /// an OSC message to execute upon completion. (optional)
    an_osc_message: Option<Vec<u8>>,
}

impl DRecv {
    /// Construct a new /d_recv builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// buffer of data.
    pub fn buffer_of_data(mut self, v: Vec<u8>) -> Self { self.buffer_of_data = Some(v); self }

    /// an OSC message to execute upon completion. (optional)
    pub fn an_osc_message(mut self, v: Vec<u8>) -> Self { self.an_osc_message = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.buffer_of_data { args.push(OscType::Blob(v)); }
        if let Some(v) = self.an_osc_message { args.push(OscType::Blob(v)); }
        ServerMessage::with_args(r"/d_recv", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
