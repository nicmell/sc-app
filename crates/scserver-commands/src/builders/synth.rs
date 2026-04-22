// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Get control value(s).
/// OSC address: `/s_get`
#[derive(Debug, Clone)]
pub struct SGet {
    /// synth ID
    pub node_id: i32,
    /// a control index or name
    pub control: crate::args::ControlId,
}

impl SGet {
    /// Construct `/s_get` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `SGet { .. SGet::new(...) }`.
    pub fn new(node_id: i32, control: crate::args::ControlId) -> Self {
        Self {
            node_id,
            control,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        args.push(self.control.into());
        ServerMessage::with_args(r"/s_get", args)
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
    pub tail: Vec<(crate::args::ControlId, i32)>,
}

impl SGetn {
    /// Construct `/s_getn` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `SGetn { .. SGetn::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(crate::args::ControlId, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
        }
        ServerMessage::with_args(r"/s_getn", args)
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
    pub tail: Vec<(crate::args::ControlId, crate::args::ControlValue)>,
}

impl SNew {
    /// Construct `/s_new` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `SNew { .. SNew::new(...) }`.
    pub fn new(def_name: String, node_id: i32, add_action: i32, target_id: i32, tail: Vec<(crate::args::ControlId, crate::args::ControlValue)>) -> Self {
        Self {
            def_name,
            node_id,
            add_action,
            target_id,
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::String(self.def_name));
        args.push(OscType::Int(self.node_id));
        args.push(OscType::Int(self.add_action));
        args.push(OscType::Int(self.target_id));
        for (t0, t1) in self.tail {
            args.push(t0.into());
            args.push(t1.into());
        }
        ServerMessage::with_args(r"/s_new", args)
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
    /// synth IDs
    pub synth_ids: i32,
}

impl SNoid {
    /// Construct `/s_noid` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `SNoid { .. SNoid::new(...) }`.
    pub fn new(synth_ids: i32) -> Self {
        Self {
            synth_ids,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.synth_ids));
        ServerMessage::with_args(r"/s_noid", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
