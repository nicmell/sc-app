//! Typed encoders and parsers for the SuperCollider server command protocol.
//!
//! See the [Server Command Reference](https://doc.sccode.org/Reference/Server-Command-Reference.html).

pub mod builders;
mod error;
mod message;
mod registry;
mod reply;

pub use error::CommandError;
pub use message::ServerMessage;
pub use registry::{all_commands, lookup, CommandEntry};
pub use reply::{NodeInfo, ServerReply, StatusReply};

pub use rosc::OscType;
