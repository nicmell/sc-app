// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;
use crate::builders::TailArgs;

/// Place a node after another.
/// OSC address: `/n_after`
#[derive(Debug, Clone, Default)]
pub struct NAfter {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NAfter {
    /// Construct a new /n_after builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// the ID of the node to place (A)
    /// the ID of the node after which the above is placed (B)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_after", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Place a node before another.
/// OSC address: `/n_before`
#[derive(Debug, Clone, Default)]
pub struct NBefore {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NBefore {
    /// Construct a new /n_before builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// the ID of the node to place (A)
    /// the ID of the node before which the above is placed (B)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_before", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Fill ranges of a node's control value(s).
/// OSC address: `/n_fill`
#[derive(Debug, Clone, Default)]
pub struct NFill {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NFill {
    /// Construct a new /n_fill builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// number of values to fill (M)
    /// value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Delete a node.
/// OSC address: `/n_free`
#[derive(Debug, Clone, Default)]
pub struct NFree {
    /// node ID
    node_id: Option<i32>,
}

impl NFree {
    /// Construct a new /n_free builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/n_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from a bus.
/// OSC address: `/n_map`
#[derive(Debug, Clone, Default)]
pub struct NMap {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NMap {
    /// Construct a new /n_map builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// control bus index
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_map", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from an audio bus.
/// OSC address: `/n_mapa`
#[derive(Debug, Clone, Default)]
pub struct NMapa {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NMapa {
    /// Construct a new /n_mapa builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// audio bus index
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_mapa", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from audio buses.
/// OSC address: `/n_mapan`
#[derive(Debug, Clone, Default)]
pub struct NMapan {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NMapan {
    /// Construct a new /n_mapan builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// audio bus index
    /// number of controls to map
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_mapan", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from buses.
/// OSC address: `/n_mapn`
#[derive(Debug, Clone, Default)]
pub struct NMapn {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NMapn {
    /// Construct a new /n_mapn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// control bus index
    /// number of controls to map
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_mapn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Move and order a list of nodes.
/// OSC address: `/n_order`
#[derive(Debug, Clone, Default)]
pub struct NOrder {
    /// add action (0,1,2 or 3 see below)
    add_action: Option<i32>,
    /// add target ID
    target_id: Option<i32>,
    /// node IDs
    node_ids: Option<i32>,
}

impl NOrder {
    /// Construct a new /n_order builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// add action (0,1,2 or 3 see below)
    pub fn add_action(mut self, v: i32) -> Self { self.add_action = Some(v); self }

    /// add target ID
    pub fn target_id(mut self, v: i32) -> Self { self.target_id = Some(v); self }

    /// node IDs
    pub fn node_ids(mut self, v: i32) -> Self { self.node_ids = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.add_action { args.push(OscType::Int(v)); }
        if let Some(v) = self.target_id { args.push(OscType::Int(v)); }
        if let Some(v) = self.node_ids { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/n_order", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get info about a node.
/// OSC address: `/n_query`
#[derive(Debug, Clone, Default)]
pub struct NQuery {
    /// node ID
    node_id: Option<i32>,
}

impl NQuery {
    /// Construct a new /n_query builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/n_query", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Turn node on or off.
/// OSC address: `/n_run`
#[derive(Debug, Clone, Default)]
pub struct NRun {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NRun {
    /// Construct a new /n_run builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// node ID
    /// run flag
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_run", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set a node's control value(s).
/// OSC address: `/n_set`
#[derive(Debug, Clone, Default)]
pub struct NSet {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NSet {
    /// Construct a new /n_set builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// a control value
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of a node's control value(s).
/// OSC address: `/n_setn`
#[derive(Debug, Clone, Default)]
pub struct NSetn {
    /// node ID
    node_id: Option<i32>,
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl NSetn {
    /// Construct a new /n_setn builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// Append one tuple to the repeated tail.
    /// a control index or name
    /// number of sequential controls to change (M)
    /// control value(s)
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/n_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Trace a node.
/// OSC address: `/n_trace`
#[derive(Debug, Clone, Default)]
pub struct NTrace {
    /// node IDs
    node_ids: Option<i32>,
}

impl NTrace {
    /// Construct a new /n_trace builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node IDs
    pub fn node_ids(mut self, v: i32) -> Self { self.node_ids = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_ids { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/n_trace", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
