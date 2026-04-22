//! WebAssembly Component Model bindings (gated behind the `component`
//! Cargo feature).

#![allow(warnings)]

pub(crate) mod bindings {
    #![allow(warnings)]
    include!("bindings.rs");
}

#[path = "component_commands.rs"]
mod component_commands;

use std::cell::RefCell;

use bindings::exports::scserver::commands::core::{
    DoneInfo, FailInfo, Guest as CoreGuest, GuestNrtScore, GuestServerMessage, LateInfo,
    NodeInfo as WitNodeInfo, OscArg as WitOscArg, OtherReply,
    ServerMessage as WitServerMessageResource, ServerMessageBorrow,
    ServerReply as WitServerReply, StatusReplyInfo, TrInfo,
};

use crate::{NodeInfo, NrtScore, ServerMessage, ServerReply, StatusReply};

// ── osc-arg mapping ─────────────────────────────────────────────────────

fn wit_to_osc(a: WitOscArg) -> rosc::OscType {
    match a {
        WitOscArg::Int32(v) => rosc::OscType::Int(v),
        WitOscArg::Float32(v) => rosc::OscType::Float(v),
        WitOscArg::Float64(v) => rosc::OscType::Double(v),
        WitOscArg::String(s) => rosc::OscType::String(s),
        WitOscArg::Blob(b) => rosc::OscType::Blob(b),
    }
}

fn osc_to_wit(a: &rosc::OscType) -> WitOscArg {
    match a {
        rosc::OscType::Int(v) => WitOscArg::Int32(*v),
        rosc::OscType::Float(v) => WitOscArg::Float32(*v),
        rosc::OscType::Double(v) => WitOscArg::Float64(*v),
        rosc::OscType::String(s) => WitOscArg::String(s.clone()),
        rosc::OscType::Blob(b) => WitOscArg::Blob(b.clone()),
        _ => WitOscArg::Blob(Vec::new()),
    }
}

pub(crate) struct Component;

impl CoreGuest for Component {
    type ServerMessage = ServerMessageResource;
    type NrtScore = NrtScoreResource;

    fn decode_message(bytes: Vec<u8>) -> Result<WitServerMessageResource, String> {
        let m = ServerMessage::decode(&bytes).map_err(|e| e.to_string())?;
        Ok(WitServerMessageResource::new(ServerMessageResource {
            inner: RefCell::new(m),
        }))
    }

    fn parse_reply(bytes: Vec<u8>) -> Result<WitServerReply, String> {
        let reply = ServerReply::parse(&bytes).map_err(|e| e.to_string())?;
        Ok(reply_to_wit(reply))
    }

    fn registry_json() -> String {
        serde_json::to_string(crate::all_commands())
            .unwrap_or_else(|e| format!(r#"{{"error":"{e}"}}"#))
    }
}

pub(crate) struct ServerMessageResource {
    pub(crate) inner: RefCell<ServerMessage>,
}

impl ServerMessageResource {
    pub(crate) fn new(inner: ServerMessage) -> Self {
        Self {
            inner: RefCell::new(inner),
        }
    }
}

impl GuestServerMessage for ServerMessageResource {
    fn new(address: String) -> Self {
        Self {
            inner: RefCell::new(ServerMessage::new(address)),
        }
    }

    fn address(&self) -> String {
        self.inner.borrow().address.clone()
    }

    fn args(&self) -> Vec<WitOscArg> {
        self.inner.borrow().args.iter().map(osc_to_wit).collect()
    }

    fn push(&self, arg: WitOscArg) {
        self.inner.borrow_mut().args.push(wit_to_osc(arg));
    }

    fn encode(&self) -> Result<Vec<u8>, String> {
        self.inner.borrow().encode().map_err(|e| e.to_string())
    }
}

pub struct NrtScoreResource {
    inner: RefCell<NrtScore>,
}

impl GuestNrtScore for NrtScoreResource {
    fn new() -> Self {
        Self {
            inner: RefCell::new(NrtScore::new()),
        }
    }

    fn at(&self, seconds: f64, msg: ServerMessageBorrow<'_>) {
        let msg_res: &ServerMessageResource = msg.get();
        let cloned = msg_res.inner.borrow().clone();
        let current = std::mem::take(&mut *self.inner.borrow_mut());
        *self.inner.borrow_mut() = current.at(seconds, cloned);
    }

    fn encode(&self) -> Result<Vec<u8>, String> {
        self.inner.borrow().encode().map_err(|e| e.to_string())
    }
}

bindings::export!(Component with_types_in bindings);

fn osc_args_to_wit(args: &[rosc::OscType]) -> Vec<WitOscArg> {
    args.iter().map(osc_to_wit).collect()
}

fn node_info_to_wit(n: NodeInfo) -> WitNodeInfo {
    WitNodeInfo {
        node_id: n.node_id,
        parent_id: n.parent_id,
        prev_id: n.prev_node,
        next_id: n.next_node,
        is_group: n.is_group,
        head_id: n.head_node,
        tail_id: n.tail_node,
    }
}

fn status_reply_to_wit(s: StatusReply) -> StatusReplyInfo {
    StatusReplyInfo {
        unused: s.unused,
        num_ugens: s.num_ugens,
        num_synths: s.num_synths,
        num_groups: s.num_groups,
        num_synth_defs: s.num_synth_defs,
        avg_cpu: s.avg_cpu,
        peak_cpu: s.peak_cpu,
        nominal_sample_rate: s.nominal_sample_rate,
        actual_sample_rate: s.actual_sample_rate,
    }
}

fn reply_to_wit(reply: ServerReply) -> WitServerReply {
    match reply {
        ServerReply::Done { address, extras } => WitServerReply::Done(DoneInfo {
            address,
            extras: osc_args_to_wit(&extras),
        }),
        ServerReply::Fail { address, error, extras } => WitServerReply::Fail(FailInfo {
            address,
            error,
            extras: osc_args_to_wit(&extras),
        }),
        ServerReply::Late {
            seconds,
            fractions,
            late_secs,
            late_fracs,
        } => WitServerReply::Late(LateInfo {
            seconds,
            fractions,
            late_secs,
            late_fracs,
        }),
        ServerReply::NGo(n) => WitServerReply::NGo(node_info_to_wit(n)),
        ServerReply::NEnd(n) => WitServerReply::NEnd(node_info_to_wit(n)),
        ServerReply::NOn(n) => WitServerReply::NOn(node_info_to_wit(n)),
        ServerReply::NOff(n) => WitServerReply::NOff(node_info_to_wit(n)),
        ServerReply::NMove(n) => WitServerReply::NMove(node_info_to_wit(n)),
        ServerReply::NInfo(n) => WitServerReply::NInfo(node_info_to_wit(n)),
        ServerReply::StatusReply(s) => WitServerReply::StatusReply(status_reply_to_wit(s)),
        ServerReply::Tr {
            node_id,
            trigger_id,
            value,
        } => WitServerReply::Tr(TrInfo {
            node_id,
            trigger_id,
            value,
        }),
        ServerReply::Other(m) => WitServerReply::Other(OtherReply {
            address: m.address,
            args: osc_args_to_wit(&m.args),
        }),
    }
}
