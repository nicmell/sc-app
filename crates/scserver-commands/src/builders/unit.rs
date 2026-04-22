// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate.mjs` (from the crate root).

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Send a command to a unit generator.
/// OSC address: `/u_cmd`
#[derive(Debug, Clone)]
pub struct UCmd {
    /// node ID
    pub node_id: i32,
    /// unit generator index
    pub unit_generator_index: i32,
    /// command name
    pub cmd: String,
    /// any arguments
    pub any_arguments: rosc::OscType,
}

impl UCmd {
    /// Construct `/u_cmd` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `UCmd { .. UCmd::new(...) }`.
    pub fn new(node_id: i32, unit_generator_index: i32, cmd: String, any_arguments: rosc::OscType) -> Self {
        Self {
            node_id,
            unit_generator_index,
            cmd,
            any_arguments,
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        args.push(OscType::Int(self.node_id));
        args.push(OscType::Int(self.unit_generator_index));
        args.push(OscType::String(self.cmd));
        args.push(self.any_arguments);
        ServerMessage::with_args(r"/u_cmd", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
