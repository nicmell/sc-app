//! OSC-wire encoder/decoder for a single server command or reply.
//!
//! Thin wrapper over [`rosc`]. Each server command is one OSC message
//! (address + typed arg list); bundles are used only for the NRT score
//! format (see [`crate::nrt`]).

use rosc::{OscMessage, OscPacket, OscType};

use crate::CommandError;

/// A single OSC message carrying a server command or reply.
#[derive(Debug, Clone, PartialEq)]
pub struct ServerMessage {
    pub address: String,
    pub args: Vec<OscType>,
}

impl ServerMessage {
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
        let msg = OscMessage {
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

impl From<ServerMessage> for OscMessage {
    fn from(m: ServerMessage) -> Self {
        OscMessage {
            addr: m.address,
            args: m.args,
        }
    }
}

impl From<OscMessage> for ServerMessage {
    fn from(m: OscMessage) -> Self {
        ServerMessage {
            address: m.addr,
            args: m.args,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_status() {
        let msg = ServerMessage::new("/status");
        let bytes = msg.encode().unwrap();
        let back = ServerMessage::decode(&bytes).unwrap();
        assert_eq!(back.address, "/status");
        assert_eq!(back.args.len(), 0);
    }

    #[test]
    fn round_trip_s_new() {
        let msg = ServerMessage::new("/s_new")
            .arg("sine") // def_name
            .arg(1001i32) // node_id
            .arg(0i32) // add_action (head)
            .arg(1i32) // target
            .arg("freq")
            .arg(440.0f32);
        let bytes = msg.encode().unwrap();
        let back = ServerMessage::decode(&bytes).unwrap();
        assert_eq!(back.address, "/s_new");
        assert_eq!(back.args.len(), 6);
        match &back.args[0] {
            OscType::String(s) => assert_eq!(s, "sine"),
            _ => panic!("expected String"),
        }
        match &back.args[5] {
            OscType::Float(f) => assert_eq!(*f, 440.0),
            _ => panic!("expected Float"),
        }
    }
}
