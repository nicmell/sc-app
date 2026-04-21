//! Typed encoders and parsers for the SuperCollider server command protocol.
//!
//! See the [Server Command Reference](https://doc.sccode.org/Reference/Server-Command-Reference.html).

pub mod builders;
#[cfg(feature = "component")]
mod component;
mod error;
mod message;
pub mod nrt;
mod registry;
mod reply;

pub use error::CommandError;
pub use message::ServerMessage;
pub use nrt::NrtScore;
pub use registry::{all_commands, lookup, CommandEntry};
pub use reply::{NodeInfo, ServerReply, StatusReply};

pub use rosc::OscType;
