// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Place a node after another.
/// OSC address: `/n_after`
#[derive(Debug, Clone)]
pub struct NAfter {
    /// Repeated tuples (the_id_of: the ID of the node to place (A); the_id_of: the ID of the node after which the above is placed (B)).
    pub tail: Vec<(i32, i32)>,
}

impl NAfter {
    /// Construct `/n_after` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NAfter { .. NAfter::new(...) }`.
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
        ServerMessage::with_args(r"/n_after", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Place a node before another.
/// OSC address: `/n_before`
#[derive(Debug, Clone)]
pub struct NBefore {
    /// Repeated tuples (the_id_of: the ID of the node to place (A); the_id_of: the ID of the node before which the above is placed (B)).
    pub tail: Vec<(i32, i32)>,
}

impl NBefore {
    /// Construct `/n_before` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NBefore { .. NBefore::new(...) }`.
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
        ServerMessage::with_args(r"/n_before", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Fill ranges of a node's control value(s).
/// OSC address: `/n_fill`
#[derive(Debug, Clone)]
pub struct NFill {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; number_of_values: number of values to fill (M); value: value).
    pub tail: Vec<(crate::args::ControlId, i32, crate::args::NumericValue)>,
}

impl NFill {
    /// Construct `/n_fill` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NFill { .. NFill::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(crate::args::ControlId, i32, crate::args::NumericValue)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        ServerMessage::with_args(r"/n_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Delete a node.
/// OSC address: `/n_free`
#[derive(Debug, Clone)]
pub struct NFree {
    /// node ID
    pub node_id: i32,
}

impl NFree {
    /// Construct `/n_free` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NFree { .. NFree::new(...) }`.
    pub fn new(node_id: i32) -> Self {
        Self {
            node_id,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        ServerMessage::with_args(r"/n_free", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from a bus.
/// OSC address: `/n_map`
#[derive(Debug, Clone)]
pub struct NMap {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; control_bus_index: control bus index).
    pub tail: Vec<(crate::args::ControlId, i32)>,
}

impl NMap {
    /// Construct `/n_map` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NMap { .. NMap::new(...) }`.
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
        ServerMessage::with_args(r"/n_map", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from an audio bus.
/// OSC address: `/n_mapa`
#[derive(Debug, Clone)]
pub struct NMapa {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; audio_bus_index: audio bus index).
    pub tail: Vec<(crate::args::ControlId, i32)>,
}

impl NMapa {
    /// Construct `/n_mapa` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NMapa { .. NMapa::new(...) }`.
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
        ServerMessage::with_args(r"/n_mapa", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from audio buses.
/// OSC address: `/n_mapan`
#[derive(Debug, Clone)]
pub struct NMapan {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; audio_bus_index: audio bus index; number_of_controls: number of controls to map).
    pub tail: Vec<(crate::args::ControlId, i32, i32)>,
}

impl NMapan {
    /// Construct `/n_mapan` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NMapan { .. NMapan::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(crate::args::ControlId, i32, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        ServerMessage::with_args(r"/n_mapan", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Map a node's controls to read from buses.
/// OSC address: `/n_mapn`
#[derive(Debug, Clone)]
pub struct NMapn {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; control_bus_index: control bus index; number_of_controls: number of controls to map).
    pub tail: Vec<(crate::args::ControlId, i32, i32)>,
}

impl NMapn {
    /// Construct `/n_mapn` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NMapn { .. NMapn::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(crate::args::ControlId, i32, i32)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(OscType::Int(t2));
        }
        ServerMessage::with_args(r"/n_mapn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Move and order a list of nodes.
/// OSC address: `/n_order`
#[derive(Debug, Clone)]
pub struct NOrder {
    /// add action (0,1,2 or 3 see below)
    pub add_action: i32,
    /// add target ID
    pub target_id: i32,
    /// node IDs
    pub node_ids: i32,
}

impl NOrder {
    /// Construct `/n_order` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NOrder { .. NOrder::new(...) }`.
    pub fn new(add_action: i32, target_id: i32, node_ids: i32) -> Self {
        Self {
            add_action,
            target_id,
            node_ids,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.add_action));
        args.push(OscType::Int(self.target_id));
        args.push(OscType::Int(self.node_ids));
        ServerMessage::with_args(r"/n_order", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get info about a node.
/// OSC address: `/n_query`
#[derive(Debug, Clone)]
pub struct NQuery {
    /// node ID
    pub node_id: i32,
}

impl NQuery {
    /// Construct `/n_query` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NQuery { .. NQuery::new(...) }`.
    pub fn new(node_id: i32) -> Self {
        Self {
            node_id,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        ServerMessage::with_args(r"/n_query", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Turn node on or off.
/// OSC address: `/n_run`
#[derive(Debug, Clone)]
pub struct NRun {
    /// Repeated tuples (node_id: node ID; run_flag: run flag).
    pub tail: Vec<(i32, i32)>,
}

impl NRun {
    /// Construct `/n_run` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NRun { .. NRun::new(...) }`.
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
        ServerMessage::with_args(r"/n_run", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set a node's control value(s).
/// OSC address: `/n_set`
#[derive(Debug, Clone)]
pub struct NSet {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; value: a control value).
    pub tail: Vec<(crate::args::ControlId, crate::args::NumericValue)>,
}

impl NSet {
    /// Construct `/n_set` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NSet { .. NSet::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(crate::args::ControlId, crate::args::NumericValue)>) -> Self {
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
            args.push(t1.into());
        }
        ServerMessage::with_args(r"/n_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of a node's control value(s).
/// OSC address: `/n_setn`
#[derive(Debug, Clone)]
pub struct NSetn {
    /// node ID
    pub node_id: i32,
    /// Repeated tuples (control: a control index or name; number_of_sequential: number of sequential controls to change (M); control_value: control value(s)).
    pub tail: Vec<(crate::args::ControlId, i32, crate::args::NumericValue)>,
}

impl NSetn {
    /// Construct `/n_setn` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NSetn { .. NSetn::new(...) }`.
    pub fn new(node_id: i32, tail: Vec<(crate::args::ControlId, i32, crate::args::NumericValue)>) -> Self {
        Self {
            node_id,
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        for (t0, t1, t2) in self.tail {
            args.push(t0.into());
            args.push(OscType::Int(t1));
            args.push(t2.into());
        }
        ServerMessage::with_args(r"/n_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Trace a node.
/// OSC address: `/n_trace`
#[derive(Debug, Clone)]
pub struct NTrace {
    /// node IDs
    pub node_ids: i32,
}

impl NTrace {
    /// Construct `/n_trace` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `NTrace { .. NTrace::new(...) }`.
    pub fn new(node_ids: i32) -> Self {
        Self {
            node_ids,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_ids));
        ServerMessage::with_args(r"/n_trace", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
