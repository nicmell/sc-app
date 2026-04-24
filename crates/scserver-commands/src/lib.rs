//! Typed encoders and parsers for the SuperCollider server command protocol.
//!
//! See the [Server Command Reference](https://doc.sccode.org/Reference/Server-Command-Reference.html).

pub mod commands;
#[cfg(feature = "component")]
mod component;
mod error;
mod nrt;
mod osc;
mod replies;

pub use commands::{ControlId, ControlValue, NumericValue, ServerMessage};
pub use error::CommandError;
pub use nrt::NrtScore;
pub use osc::OscMessage;
pub use replies::{BSetnReply, NodeInfo, ServerReply, StatusReply};

pub use rosc::OscType;
