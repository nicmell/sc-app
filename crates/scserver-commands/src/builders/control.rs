// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;
use crate::builders::TailArgs;

/// Fill ranges of bus value(s).
/// OSC address: `/c_fill`
#[derive(Debug, Clone, Default)]
pub struct CFill {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl CFill {
    /// Construct a new /c_fill builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// starting bus index
    /// number of buses to fill (M)
    /// value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/c_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get bus value(s).
/// OSC address: `/c_get`
#[derive(Debug, Clone, Default)]
pub struct CGet {
    /// a bus index
    a_bus_index: Option<i32>,
}

impl CGet {
    /// Construct a new /c_get builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// a bus index
    pub fn a_bus_index(mut self, v: i32) -> Self { self.a_bus_index = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.a_bus_index { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/c_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of bus value(s).
/// OSC address: `/c_getn`
#[derive(Debug, Clone, Default)]
pub struct CGetn {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl CGetn {
    /// Construct a new /c_getn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// starting bus index
    /// number of sequential buses to get (M)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/c_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set bus value(s).
/// OSC address: `/c_set`
#[derive(Debug, Clone, Default)]
pub struct CSet {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl CSet {
    /// Construct a new /c_set builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// a bus index
    /// a control value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/c_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of bus value(s).
/// OSC address: `/c_setn`
#[derive(Debug, Clone, Default)]
pub struct CSetn {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl CSetn {
    /// Construct a new /c_setn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// starting bus index
    /// number of sequential buses to change (M)
    /// tail arg 2
    /// a control value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>, a3: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into(), a3.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/c_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
