//! Typed parsers for the server-sent OSC replies documented in the SC
//! Server Command Reference.
//!
//! Usage:
//!
//! ```no_run
//! use scserver_commands::{ServerMessage, ServerReply};
//! let bytes = [/* … from UDP socket … */];
//! let msg = ServerMessage::decode(&bytes).unwrap();
//! match ServerReply::from_message(msg).unwrap() {
//!     ServerReply::Done { address, .. } => println!("done: {address}"),
//!     ServerReply::Fail { address, error, .. } => eprintln!("fail {address}: {error}"),
//!     ServerReply::NGo(n) => println!("node {} started in group {}", n.node_id, n.parent_id),
//!     _ => {}
//! }
//! ```

use rosc::OscType;
use serde::Serialize;

use crate::{CommandError, ServerMessage};

/// Typed representation of every server-to-client reply.
#[derive(Debug, Clone, PartialEq)]
pub enum ServerReply {
    Done {
        /// Address of the command being acknowledged.
        address: String,
        /// Remaining args (e.g. `/b_alloc`'s bufnum echo) as raw OSC.
        extras: Vec<OscType>,
    },
    Fail {
        address: String,
        error: String,
        extras: Vec<OscType>,
    },
    Late {
        seconds: i32,
        fractions: i32,
        late_secs: i32,
        late_fracs: i32,
    },
    NGo(NodeInfo),
    NEnd(NodeInfo),
    NOn(NodeInfo),
    NOff(NodeInfo),
    NMove(NodeInfo),
    NInfo(NodeInfo),
    StatusReply(StatusReply),
    Tr {
        node_id: i32,
        trigger_id: i32,
        value: f32,
    },
    /// Any OSC message whose address doesn't match a known reply shape.
    Other(ServerMessage),
}

/// Shared arg layout for `/n_go`, `/n_end`, `/n_on`, `/n_off`, `/n_move`,
/// `/n_info`. The last two fields are only present when the node is a
/// group.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct NodeInfo {
    pub node_id: i32,
    pub parent_id: i32,
    pub prev_node: i32,
    pub next_node: i32,
    /// 1 if the node is a group, 0 if a synth.
    pub is_group: i32,
    pub head_node: Option<i32>,
    pub tail_node: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StatusReply {
    pub unused: i32,
    pub num_ugens: i32,
    pub num_synths: i32,
    pub num_groups: i32,
    pub num_synth_defs: i32,
    pub avg_cpu: f32,
    pub peak_cpu: f32,
    pub nominal_sample_rate: f64,
    pub actual_sample_rate: f64,
}

impl ServerReply {
    /// Parse a raw OSC packet.
    pub fn parse(bytes: &[u8]) -> Result<Self, CommandError> {
        Self::from_message(ServerMessage::decode(bytes)?)
    }

    /// Dispatch an already-decoded message into the typed variant whose
    /// OSC address it matches. Unknown addresses become `Other(..)`.
    pub fn from_message(msg: ServerMessage) -> Result<Self, CommandError> {
        match msg.address.as_str() {
            "/done" => Ok(Self::Done {
                address: take_string(&msg, 0, "/done")?,
                extras: msg.args[1..].to_vec(),
            }),
            "/fail" => Ok(Self::Fail {
                address: take_string(&msg, 0, "/fail")?,
                error: take_string(&msg, 1, "/fail").unwrap_or_default(),
                extras: msg.args.get(2..).map(|s| s.to_vec()).unwrap_or_default(),
            }),
            "/late" => Ok(Self::Late {
                seconds: take_int(&msg, 0, "/late")?,
                fractions: take_int(&msg, 1, "/late")?,
                late_secs: take_int(&msg, 2, "/late")?,
                late_fracs: take_int(&msg, 3, "/late")?,
            }),
            "/n_go" => Ok(Self::NGo(parse_node_info(&msg)?)),
            "/n_end" => Ok(Self::NEnd(parse_node_info(&msg)?)),
            "/n_on" => Ok(Self::NOn(parse_node_info(&msg)?)),
            "/n_off" => Ok(Self::NOff(parse_node_info(&msg)?)),
            "/n_move" => Ok(Self::NMove(parse_node_info(&msg)?)),
            "/n_info" => Ok(Self::NInfo(parse_node_info(&msg)?)),
            "/status.reply" => Ok(Self::StatusReply(StatusReply {
                unused: take_int(&msg, 0, "/status.reply")?,
                num_ugens: take_int(&msg, 1, "/status.reply")?,
                num_synths: take_int(&msg, 2, "/status.reply")?,
                num_groups: take_int(&msg, 3, "/status.reply")?,
                num_synth_defs: take_int(&msg, 4, "/status.reply")?,
                avg_cpu: take_float(&msg, 5, "/status.reply")?,
                peak_cpu: take_float(&msg, 6, "/status.reply")?,
                nominal_sample_rate: take_double(&msg, 7, "/status.reply")?,
                actual_sample_rate: take_double(&msg, 8, "/status.reply")?,
            })),
            "/tr" => Ok(Self::Tr {
                node_id: take_int(&msg, 0, "/tr")?,
                trigger_id: take_int(&msg, 1, "/tr")?,
                value: take_float(&msg, 2, "/tr")?,
            }),
            _ => Ok(Self::Other(msg)),
        }
    }
}

fn parse_node_info(msg: &ServerMessage) -> Result<NodeInfo, CommandError> {
    let addr = msg.address.clone();
    Ok(NodeInfo {
        node_id: take_int(msg, 0, &addr)?,
        parent_id: take_int(msg, 1, &addr)?,
        prev_node: take_int(msg, 2, &addr)?,
        next_node: take_int(msg, 3, &addr)?,
        is_group: take_int(msg, 4, &addr)?,
        head_node: msg.args.get(5).and_then(as_int),
        tail_node: msg.args.get(6).and_then(as_int),
    })
}

fn take_int(msg: &ServerMessage, i: usize, addr: &str) -> Result<i32, CommandError> {
    msg.args.get(i).and_then(as_int).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "int32",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn take_float(msg: &ServerMessage, i: usize, addr: &str) -> Result<f32, CommandError> {
    msg.args.get(i).and_then(as_float).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "float32",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn take_double(msg: &ServerMessage, i: usize, addr: &str) -> Result<f64, CommandError> {
    msg.args.get(i).and_then(as_double).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "float64",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn take_string(msg: &ServerMessage, i: usize, addr: &str) -> Result<String, CommandError> {
    msg.args.get(i).and_then(as_string).map(|s| s.to_string()).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "string",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn as_int(v: &OscType) -> Option<i32> {
    match v {
        OscType::Int(i) => Some(*i),
        _ => None,
    }
}

fn as_float(v: &OscType) -> Option<f32> {
    match v {
        OscType::Float(f) => Some(*f),
        _ => None,
    }
}

fn as_double(v: &OscType) -> Option<f64> {
    match v {
        OscType::Double(d) => Some(*d),
        _ => None,
    }
}

fn as_string(v: &OscType) -> Option<&str> {
    match v {
        OscType::String(s) => Some(s.as_str()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn done_reply_roundtrip() {
        let m = ServerMessage::new("/done").arg("/notify").arg(0i32);
        match ServerReply::from_message(m).unwrap() {
            ServerReply::Done { address, extras } => {
                assert_eq!(address, "/notify");
                assert_eq!(extras.len(), 1);
            }
            other => panic!("expected Done, got {:?}", other),
        }
    }

    #[test]
    fn status_reply_roundtrip() {
        let m = ServerMessage::new("/status.reply")
            .arg(1i32) // unused
            .arg(10i32) // ugens
            .arg(2i32) // synths
            .arg(3i32) // groups
            .arg(5i32) // defs
            .arg(0.1f32) // avg cpu
            .arg(0.5f32) // peak cpu
            .arg(44100.0f64)
            .arg(44100.0f64);
        match ServerReply::from_message(m).unwrap() {
            ServerReply::StatusReply(s) => {
                assert_eq!(s.num_ugens, 10);
                assert_eq!(s.num_synths, 2);
                assert_eq!(s.nominal_sample_rate, 44100.0);
            }
            other => panic!("expected StatusReply, got {:?}", other),
        }
    }

    #[test]
    fn n_go_roundtrip() {
        let m = ServerMessage::new("/n_go")
            .arg(1001i32) // node
            .arg(0i32) // parent
            .arg(-1i32) // prev
            .arg(-1i32) // next
            .arg(0i32); // not a group
        match ServerReply::from_message(m).unwrap() {
            ServerReply::NGo(info) => {
                assert_eq!(info.node_id, 1001);
                assert_eq!(info.parent_id, 0);
                assert_eq!(info.is_group, 0);
                assert_eq!(info.head_node, None);
            }
            other => panic!("expected NGo, got {:?}", other),
        }
    }

    #[test]
    fn unknown_address_becomes_other() {
        let m = ServerMessage::new("/some/random/addr").arg(42i32);
        let reply = ServerReply::from_message(m).unwrap();
        assert!(matches!(reply, ServerReply::Other(_)));
    }
}
