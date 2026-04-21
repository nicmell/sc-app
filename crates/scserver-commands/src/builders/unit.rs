// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// Send a command to a unit generator.
/// OSC address: `/u_cmd`
#[derive(Debug, Clone, Default)]
pub struct UCmd {
    /// node ID
    node_id: Option<i32>,
    /// unit generator index
    unit_generator_index: Option<i32>,
    /// command name
    cmd: Option<String>,
    /// any arguments
    any_arguments: Option<OscType>,
}

impl UCmd {
    /// Construct a new /u_cmd builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// node ID
    pub fn node_id(mut self, v: i32) -> Self { self.node_id = Some(v); self }

    /// unit generator index
    pub fn unit_generator_index(mut self, v: i32) -> Self { self.unit_generator_index = Some(v); self }

    /// command name
    pub fn cmd(mut self, v: String) -> Self { self.cmd = Some(v); self }

    /// any arguments
    pub fn any_arguments(mut self, v: OscType) -> Self { self.any_arguments = Some(v); self }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        if let Some(v) = self.node_id { args.push(OscType::Int(v)); }
        if let Some(v) = self.unit_generator_index { args.push(OscType::Int(v)); }
        if let Some(v) = self.cmd { args.push(OscType::String(v)); }
        if let Some(v) = self.any_arguments { args.push(v); }
        ServerMessage::with_args(r"/u_cmd", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
