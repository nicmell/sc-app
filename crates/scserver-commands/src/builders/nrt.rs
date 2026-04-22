// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate.mjs` (from the crate root).

#![allow(non_snake_case, unused_mut, clippy::all)]

use rosc::OscType;
use crate::ServerMessage;

/// End real time mode, close file. Not yet implemented. This message should be
/// sent in a bundle in non real time mode. The bundle timestamp will establish
/// the ending time of the file. This command will end non real time mode and
/// close the sound file. Replies to sender with /done when complete.
/// OSC address: `/nrt_end`
#[derive(Debug, Clone)]
pub struct NrtEnd {
}

impl NrtEnd {
    /// Construct `/nrt_end` with all required args. Optional
    /// fields default to `None` — override via struct update syntax:
    /// `NrtEnd { .. NrtEnd::new(...) }`.
    pub fn new() -> Self {
        Self {
        }
    }

    /// Encode the typed fields into an OSC `ServerMessage`.
    pub fn to_message(self) -> ServerMessage {
        let mut args: Vec<OscType> = Vec::new();
        ServerMessage::with_args(r"/nrt_end", args)
    }

    /// Shortcut: build + encode to OSC wire bytes.
    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {
        self.to_message().encode()
    }
}
