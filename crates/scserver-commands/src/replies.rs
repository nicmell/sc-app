//! Typed parsers for the server-sent OSC replies documented in the SC
//! Server Command Reference.
//!
//! Usage:
//!
//! ```no_run
//! use scserver_commands::ServerReply;
//! let bytes = [/* … from UDP socket … */];
//! match ServerReply::decode(&bytes).unwrap() {
//!     ServerReply::Done { address, .. } => println!("done: {address}"),
//!     ServerReply::Fail { address, error, .. } => eprintln!("fail {address}: {error}"),
//!     ServerReply::NGo(n) => println!("node {} started in group {}", n.node_id, n.parent_id),
//!     _ => {}
//! }
//! ```

use rosc::OscType;

use crate::{CommandError, OscMessage};

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
    /// Samples read from a buffer in response to `/b_getn`. The payload
    /// is extracted as a typed `Vec<f32>` so the component boundary can
    /// lift it as a `Float32Array` without per-element boxing.
    BSetn(BSetnReply),
    /// Response to a `/sync` command — carries the sync id supplied by
    /// the client so callers can correlate request ↔ reply.
    Synced {
        sync_id: i32,
    },
    /// Any OSC message whose address doesn't match a known reply shape.
    /// Mirrors the `other-reply` WIT record: raw address + args.
    Other {
        address: String,
        args: Vec<OscType>,
    },
}

/// Shared arg layout for `/n_go`, `/n_end`, `/n_on`, `/n_off`, `/n_move`,
/// `/n_info`. The last two fields are only present when the node is a
/// group.
#[derive(Debug, Clone, PartialEq)]
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

#[derive(Debug, Clone, PartialEq)]
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

/// Payload of a `/b_setn` reply — samples read from a buffer.
///
/// The SC wire format is: `/b_setn bufnum startIndex N sample0 sample1 … sampleN-1`.
/// Exposing `samples` as a typed `Vec<f32>` means the WIT surface lifts
/// as `Float32Array` (one memcpy) rather than a boxed per-element list.
#[derive(Debug, Clone, PartialEq)]
pub struct BSetnReply {
    pub bufnum: i32,
    pub start: i32,
    pub samples: Vec<f32>,
}

impl ServerReply {
    /// Decode raw OSC reply bytes into a typed variant.
    pub fn decode(bytes: &[u8]) -> Result<Self, CommandError> {
        Self::from_message(OscMessage::decode(bytes)?)
    }

    /// Dispatch an already-decoded message into the typed variant whose
    /// OSC address it matches. Unknown addresses become `Other(..)`.
    pub fn from_message(msg: OscMessage) -> Result<Self, CommandError> {
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
            "/b_setn" => {
                // /b_setn bufnum startIndex N sample0 sample1 … sampleN-1
                // When emitted as a reply by the server (in response to
                // /b_getn), the count + samples trail the header.
                let bufnum = take_int(&msg, 0, "/b_setn")?;
                let start = take_int(&msg, 1, "/b_setn")?;
                let count = take_int(&msg, 2, "/b_setn")? as usize;
                let mut samples = Vec::with_capacity(count);
                for i in 0..count {
                    samples.push(take_float(&msg, 3 + i, "/b_setn")?);
                }
                Ok(Self::BSetn(BSetnReply { bufnum, start, samples }))
            }
            "/synced" => Ok(Self::Synced {
                sync_id: take_int(&msg, 0, "/synced")?,
            }),
            _ => Ok(Self::Other {
                address: msg.address,
                args: msg.args,
            }),
        }
    }
}

fn parse_node_info(msg: &OscMessage) -> Result<NodeInfo, CommandError> {
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

fn take_int(msg: &OscMessage, i: usize, addr: &str) -> Result<i32, CommandError> {
    msg.args.get(i).and_then(as_int).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "int32",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn take_float(msg: &OscMessage, i: usize, addr: &str) -> Result<f32, CommandError> {
    msg.args.get(i).and_then(as_float).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "float32",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn take_double(msg: &OscMessage, i: usize, addr: &str) -> Result<f64, CommandError> {
    msg.args.get(i).and_then(as_double).ok_or_else(|| CommandError::ArgType {
        address: addr.to_string(),
        pos: i,
        expected: "float64",
        got: msg.args.get(i).map(|a| format!("{a:?}")).unwrap_or_else(|| "missing".into()),
    })
}

fn take_string(msg: &OscMessage, i: usize, addr: &str) -> Result<String, CommandError> {
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
        let m = OscMessage::new("/done").arg("/notify").arg(0i32);
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
        let m = OscMessage::new("/status.reply")
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
        let m = OscMessage::new("/n_go")
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
        let m = OscMessage::new("/some/random/addr").arg(42i32);
        let reply = ServerReply::from_message(m).unwrap();
        assert!(matches!(reply, ServerReply::Other { .. }));
    }

    #[test]
    fn b_setn_reply_lifts_samples() {
        // /b_setn bufnum=7, start=16, count=4, values 0.1..0.4
        let m = OscMessage::new("/b_setn")
            .arg(7i32)
            .arg(16i32)
            .arg(4i32)
            .arg(0.1f32)
            .arg(0.2f32)
            .arg(0.3f32)
            .arg(0.4f32);
        match ServerReply::from_message(m).unwrap() {
            ServerReply::BSetn(b) => {
                assert_eq!(b.bufnum, 7);
                assert_eq!(b.start, 16);
                assert_eq!(b.samples, vec![0.1, 0.2, 0.3, 0.4]);
            }
            other => panic!("expected BSetn, got {:?}", other),
        }
    }

    #[test]
    fn synced_reply_carries_id() {
        let m = OscMessage::new("/synced").arg(42i32);
        match ServerReply::from_message(m).unwrap() {
            ServerReply::Synced { sync_id } => assert_eq!(sync_id, 42),
            other => panic!("expected Synced, got {:?}", other),
        }
    }
}
