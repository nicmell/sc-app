// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Free all synths in this group and all its sub-groups.
/// OSC address: `/g_deepFree`
#[derive(Debug, Clone)]
pub struct GDeepFree {
    /// group ID(s)
    pub group_id: i32,
}

impl GDeepFree {
    /// Construct `/g_deepFree` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `GDeepFree { .. GDeepFree::new(...) }`.
    pub fn new(group_id: i32) -> Self {
        Self {
            group_id,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `GDumpTree { .. GDumpTree::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `GFreeAll { .. GFreeAll::new(...) }`.
    pub fn new(group_id: i32) -> Self {
        Self {
            group_id,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `GHead { .. GHead::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `GNew { .. GNew::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `GQueryTree { .. GQueryTree::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `GTail { .. GTail::new(...) }`.
    pub fn new(tail: Vec<(i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
    /// fields default to `None` — set them via struct update syntax:
    /// `PNew { .. PNew::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, i32)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
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
