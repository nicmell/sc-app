// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_rust.mjs`.

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// End real time mode, close file. Not yet implemented. This message should
/// be sent in a bundle in non real time mode. The bundle timestamp will
/// establish the ending time of the file. This command will end non real time
/// mode and close the sound file. Replies to sender with /done when complete.
/// OSC address: `/nrt_end`
#[derive(Debug, Clone, Default)]
pub struct NrtEnd {
}

impl NrtEnd {
    /// Construct a new /nrt_end builder with no args set.
    pub fn new() -> Self { Self::default() }

    /// Build the encoded OSC message.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/nrt_end", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
