// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Fill ranges of bus value(s).
/// OSC address: `/c_fill`
#[derive(Debug, Clone)]
pub struct CFill {
    /// Repeated tuples (starting_bus_index: starting bus index; number_of_buses: number of buses to fill (M); value: value).
    pub tail: Vec<(i32, i32, crate::args::NumericValue)>,
}

impl CFill {
    /// Construct `/c_fill` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `CFill { .. CFill::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, crate::args::NumericValue)>) -> Self {
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
            args.push(t2.into());
        }
        ServerMessage::with_args(r"/c_fill", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get bus value(s).
/// OSC address: `/c_get`
#[derive(Debug, Clone)]
pub struct CGet {
    /// a bus index
    pub a_bus_index: i32,
}

impl CGet {
    /// Construct `/c_get` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `CGet { .. CGet::new(...) }`.
    pub fn new(a_bus_index: i32) -> Self {
        Self {
            a_bus_index,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.a_bus_index));
        ServerMessage::with_args(r"/c_get", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Get ranges of bus value(s).
/// OSC address: `/c_getn`
#[derive(Debug, Clone)]
pub struct CGetn {
    /// Repeated tuples (starting_bus_index: starting bus index; number_of_sequential: number of sequential buses to get (M)).
    pub tail: Vec<(i32, i32)>,
}

impl CGetn {
    /// Construct `/c_getn` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `CGetn { .. CGetn::new(...) }`.
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
        ServerMessage::with_args(r"/c_getn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set bus value(s).
/// OSC address: `/c_set`
#[derive(Debug, Clone)]
pub struct CSet {
    /// Repeated tuples (a_bus_index: a bus index; value: a control value).
    pub tail: Vec<(i32, crate::args::NumericValue)>,
}

impl CSet {
    /// Construct `/c_set` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `CSet { .. CSet::new(...) }`.
    pub fn new(tail: Vec<(i32, crate::args::NumericValue)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1) in self.tail {
            args.push(OscType::Int(t0));
            args.push(t1.into());
        }
        ServerMessage::with_args(r"/c_set", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}

/// Set ranges of bus value(s).
/// OSC address: `/c_setn`
#[derive(Debug, Clone)]
pub struct CSetn {
    /// Repeated tuples (starting_bus_index: starting bus index; number_of_sequential: number of sequential buses to change (M); arg2: ; value: a control value).
    pub tail: Vec<(i32, i32, rosc::OscType, crate::args::NumericValue)>,
}

impl CSetn {
    /// Construct `/c_setn` with all required args. Optional
    /// fields default to `None` — set them via struct update syntax:
    /// `CSetn { .. CSetn::new(...) }`.
    pub fn new(tail: Vec<(i32, i32, rosc::OscType, crate::args::NumericValue)>) -> Self {
        Self {
            tail,
        }
    }

    /// Encode the typed fields into an `OscType` message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        for (t0, t1, t2, t3) in self.tail {
            args.push(OscType::Int(t0));
            args.push(OscType::Int(t1));
            args.push(t2);
            args.push(t3.into());
        }
        ServerMessage::with_args(r"/c_setn", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
