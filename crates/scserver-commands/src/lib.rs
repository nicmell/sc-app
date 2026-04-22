//! Typed encoders and parsers for the SuperCollider server command protocol.
//!
//! See the [Server Command Reference](https://doc.sccode.org/Reference/Server-Command-Reference.html).

pub mod args;
pub mod builders;
#[cfg(feature = "component")]
mod component;
mod error;
mod osc;
mod reply;

pub use args::{ControlId, ControlValue, NumericValue};
pub use error::CommandError;
pub use osc::{NrtScore, ServerMessage};
pub use reply::{NodeInfo, ServerReply, StatusReply};

pub use rosc::OscType;
