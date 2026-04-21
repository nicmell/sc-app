// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;
use crate::builders::TailArgs;

/// Free all synths in this group and all its sub-groups.
/// OSC address: `/g_deepFree`
#[derive(Debug, Clone, Default)]
pub struct GDeepFree {
    /// group ID(s)
    group_id_s: Option<i32>,
}

impl GDeepFree {
    /// Construct a new /g_deepFree builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// group ID(s)
    pub fn group_id_s(mut self, v: i32) -> Self { self.group_id_s = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.group_id_s { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/g_deepFree", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Post a representation of this group's node subtree.
/// OSC address: `/g_dumpTree`
#[derive(Debug, Clone, Default)]
pub struct GDumpTree {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl GDumpTree {
    /// Construct a new /g_dumpTree builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// group ID
    /// flag; if not 0 the current control (arg) values for synths will be
    /// posted
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/g_dumpTree", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Delete all nodes in a group.
/// OSC address: `/g_freeAll`
#[derive(Debug, Clone, Default)]
pub struct GFreeAll {
    /// group ID(s)
    group_id_s: Option<i32>,
}

impl GFreeAll {
    /// Construct a new /g_freeAll builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// group ID(s)
    pub fn group_id_s(mut self, v: i32) -> Self { self.group_id_s = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.group_id_s { args.push(OscType::Int(v)); }
        ServerMessage::with_args(r"/g_freeAll", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Add node to head of group.
/// OSC address: `/g_head`
#[derive(Debug, Clone, Default)]
pub struct GHead {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl GHead {
    /// Construct a new /g_head builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// group ID
    /// node ID
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/g_head", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Create a new group.
/// OSC address: `/g_new`
#[derive(Debug, Clone, Default)]
pub struct GNew {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl GNew {
    /// Construct a new /g_new builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// new group ID
    /// add action (0,1,2, 3 or 4 see below)
    /// add target ID
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/g_new", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get a representation of this group's node subtree.
/// OSC address: `/g_queryTree`
#[derive(Debug, Clone, Default)]
pub struct GQueryTree {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl GQueryTree {
    /// Construct a new /g_queryTree builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// group ID
    /// flag: if not 0 the current control (arg) values for synths will be
    /// included
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/g_queryTree", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Add node to tail of group.
/// OSC address: `/g_tail`
#[derive(Debug, Clone, Default)]
pub struct GTail {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl GTail {
    /// Construct a new /g_tail builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// group ID
    /// node ID
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/g_tail", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Create a new parallel group.
/// OSC address: `/p_new`
#[derive(Debug, Clone, Default)]
pub struct PNew {
    /// Repeated tail group — one tuple per trailing entry.
    tail: Vec<TailArgs>,
}

impl PNew {
    /// Construct a new /p_new builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Append one tuple to the repeated tail.
    /// new group ID
    /// add action (0,1,2, 3 or 4 see below)
    /// add target ID
    pub fn tail(mut self, a0: impl Into<OscType>, a1: impl Into<OscType>, a2: impl Into<OscType>) -> Self { self.tail.push(TailArgs(vec![a0.into(), a1.into(), a2.into()])); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for TailArgs(mut t) in self.tail { args.append(&mut t); }
        ServerMessage::with_args(r"/p_new", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
