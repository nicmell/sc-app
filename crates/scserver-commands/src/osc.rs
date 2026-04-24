//! OSC wire layer: `OscMessage` (one address + arg list).
//!
//! Thin wrappers over [`rosc`]. Each server command is one OSC message
//! (address + typed arg list); OSC bundles are used only by the NRT
//! score format, which lives in [`crate::nrt`].

use rosc::{OscMessage as RoscMessage, OscPacket, OscType};

use crate::CommandError;

/// A single OSC wire message — address plus ordered typed args. Used as
/// the low-level representation commands encode to and replies decode
/// from.
#[derive(Debug, Clone, PartialEq)]
pub struct OscMessage {
    pub address: String,
    pub args: Vec<OscType>,
}

impl OscMessage {
    pub fn new(address: impl Into<String>) -> Self {
        Self {
            address: address.into(),
            args: Vec::new(),
        }
    }

    pub fn with_args(address: impl Into<String>, args: Vec<OscType>) -> Self {
        Self {
            address: address.into(),
            args,
        }
    }

    /// Append one argument and return self. Accepts anything that converts
    /// into [`OscType`] — numeric literals, `String`, `&str`, `Vec<u8>`, etc.
    pub fn arg(mut self, value: impl Into<OscType>) -> Self {
        self.args.push(value.into());
        self
    }

    /// Encode as a raw OSC UDP packet.
    pub fn encode(&self) -> Result<Vec<u8>, CommandError> {
        let msg = RoscMessage {
            addr: self.address.clone(),
            args: self.args.clone(),
        };
        rosc::encoder::encode(&OscPacket::Message(msg))
            .map_err(|e| CommandError::OscEncode(format!("{e:?}")))
    }

    /// Decode a raw OSC UDP packet, accepting only plain messages. Bundles
    /// are rejected — use the NRT score reader for those.
    pub fn decode(bytes: &[u8]) -> Result<Self, CommandError> {
        let packet = rosc::decoder::decode_udp(bytes)
            .map_err(|e| CommandError::OscDecode(format!("{e:?}")))?;
        match packet.1 {
            OscPacket::Message(m) => Ok(Self {
                address: m.addr,
                args: m.args,
            }),
            OscPacket::Bundle(_) => Err(CommandError::Custom(
                "expected OSC message, got bundle".into(),
            )),
        }
    }
}

impl From<OscMessage> for RoscMessage {
    fn from(m: OscMessage) -> Self {
        RoscMessage {
            addr: m.address,
            args: m.args,
        }
    }
}

impl From<RoscMessage> for OscMessage {
    fn from(m: RoscMessage) -> Self {
        OscMessage {
            address: m.addr,
            args: m.args,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_status_message() {
        let msg = OscMessage::new("/status");
        let bytes = msg.encode().unwrap();
        let back = OscMessage::decode(&bytes).unwrap();
        assert_eq!(back.address, "/status");
        assert_eq!(back.args.len(), 0);
    }

    #[test]
    fn round_trip_s_new_message() {
        let msg = OscMessage::new("/s_new")
            .arg("sine")
            .arg(1001i32)
            .arg(0i32)
            .arg(1i32)
            .arg("freq")
            .arg(440.0f32);
        let back = OscMessage::decode(&msg.encode().unwrap()).unwrap();
        assert_eq!(back.args.len(), 6);
        match &back.args[0] {
            OscType::String(s) => assert_eq!(s, "sine"),
            _ => panic!("expected String"),
        }
    }
}
