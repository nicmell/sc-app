// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;
use crate::builders::TailArgs;

/// Get control value(s).
/// OSC address: `/s_get`
#[derive(Debug, Clone, Default)]
pub struct SGet {
    /// synth ID
    node_id: Option<i32>,
    /// a control index or name
    control: Option<OscType>,
}

impl SGet {
    /// Construct a new /s_get builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// synth ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// a control index or name
    pub fn control(mut self, v: impl Into<OscType>) -> Self { self.control = Some(v.into()); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        if let Some(v) = self.control { args.push(v); }
        ServerMessage::with_args(r"/s_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of control value(s).
/// OSC address: `/s_getn`
#[derive(Debug, Clone, Default)]
pub struct SGetn {
    /// synth ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl SGetn {
    /// Construct a new /s_getn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// synth ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// number of sequential controls to get (M)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/s_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Create a new synth.
/// OSC address: `/s_new`
#[derive(Debug, Clone, Default)]
pub struct SNew {
    /// synth definition name
    def_name: Option<String>,
    /// synth ID
    node_id: Option<i32>,
    /// add action (0,1,2, 3 or 4 see below)
    add_action: Option<i32>,
    /// add target ID
    target_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl SNew {
    /// Construct a new /s_new builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// synth definition name
    pub fn def_name(mut self, v: String) -> Self { self.def_name = Some(v); self }

    /// synth ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// add action (0,1,2, 3 or 4 see below)
    pub fn add_action(mut self, v: i32) -> Self { self.add_action = Some(v); self }

    /// add target ID
    pub fn target_id(mut self, v: i32) -> Self { self.target_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// floating point and integer arguments are interpreted as control value.
    /// a symbol argument consisting of the letter 'c' or 'a' (for control or
    /// audio) followed by the bus's index.
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.def_name { args.push(OscType::String(v)); }
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        if let Some(v) = self.add_action { args.push(OscType::Int(v)); }
        if let Some(v) = self.target_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/s_new", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Auto-reassign synth's ID to a reserved value.
/// OSC address: `/s_noid`
#[derive(Debug, Clone, Default)]
pub struct SNoid {
    /// synth IDs
    synth_ids: Option<i32>,
}

impl SNoid {
    /// Construct a new /s_noid builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// synth IDs
    pub fn synth_ids(mut self, v: i32) -> Self { self.synth_ids = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.synth_ids { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/s_noid", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
