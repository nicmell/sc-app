//! Typed encoders and parsers for the SuperCollider server command protocol.
//!
//! See the [Server Command Reference](https://doc.sccode.org/Reference/Server-Command-Reference.html).

pub mod args;
pub mod builders;
#[cfg(feature = "component")]
mod component;
mod error;
mod osc;
#[cfg(feature = "component")]
mod registry;
mod reply;

pub use args::{ControlId, ControlValue, NumericValue};
pub use error::CommandError;
pub use osc::{NrtScore, ServerMessage};
pub use reply::{NodeInfo, ServerReply, StatusReply};

pub use rosc::OscType;

// Internal const used by the WIT `core.registry-json` entrypoint — only
// compiled when the `component` feature is on.
#[cfg(feature = "component")]
pub(crate) use registry::REGISTRY_JSON;
