//! WebAssembly Component Model bindings (gated behind the `component`
//! Cargo feature).

#![allow(warnings)]

mod bindings {
    #![allow(warnings)]
    include!("bindings.rs");
}

use std::cell::RefCell;

use bindings::exports::scserver::commands::core::{
    Guest as CoreGuest, GuestNrtScore, GuestServerMessage, OscArg as WitOscArg,
    ServerMessage as WitServerMessageResource, ServerMessageBorrow,
};

use crate::{NrtScore, ServerMessage, ServerReply};

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

struct Component;

impl CoreGuest for Component {
    type ServerMessage = ServerMessageResource;
    type NrtScore = NrtScoreResource;

    fn decode_message(bytes: Vec<u8>) -> Result<WitServerMessageResource, String> {
        let m = ServerMessage::decode(&bytes).map_err(|e| e.to_string())?;
        Ok(WitServerMessageResource::new(ServerMessageResource {
            inner: RefCell::new(m),
        }))
    }

    fn parse_reply(bytes: Vec<u8>) -> Result<String, String> {
        let reply = ServerReply::parse(&bytes).map_err(|e| e.to_string())?;
        serde_json::to_string(&ReplyJson::from(reply)).map_err(|e| e.to_string())
    }

    fn registry_json() -> String {
        serde_json::to_string(crate::all_commands())
            .unwrap_or_else(|e| format!(r#"{{"error":"{e}"}}"#))
    }
}

pub struct ServerMessageResource {
    inner: RefCell<ServerMessage>,
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

#[derive(serde::Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
enum ReplyJson {
    Done { address: String, extras: serde_json::Value },
    Fail { address: String, error: String, extras: serde_json::Value },
    Late { seconds: i32, fractions: i32, late_secs: i32, late_fracs: i32 },
    NGo(crate::NodeInfo),
    NEnd(crate::NodeInfo),
    NOn(crate::NodeInfo),
    NOff(crate::NodeInfo),
    NMove(crate::NodeInfo),
    NInfo(crate::NodeInfo),
    StatusReply(crate::StatusReply),
    Tr { node_id: i32, trigger_id: i32, value: f32 },
    Other { address: String, args: serde_json::Value },
}

impl From<ServerReply> for ReplyJson {
    fn from(r: ServerReply) -> Self {
        use ServerReply::*;
        match r {
            Done { address, extras } => ReplyJson::Done {
                address,
                extras: osc_args_to_json(&extras),
            },
            Fail { address, error, extras } => ReplyJson::Fail {
                address,
                error,
                extras: osc_args_to_json(&extras),
            },
            Late { seconds, fractions, late_secs, late_fracs } => ReplyJson::Late {
                seconds, fractions, late_secs, late_fracs,
            },
            NGo(n) => ReplyJson::NGo(n),
            NEnd(n) => ReplyJson::NEnd(n),
            NOn(n) => ReplyJson::NOn(n),
            NOff(n) => ReplyJson::NOff(n),
            NMove(n) => ReplyJson::NMove(n),
            NInfo(n) => ReplyJson::NInfo(n),
            StatusReply(s) => ReplyJson::StatusReply(s),
            Tr { node_id, trigger_id, value } => ReplyJson::Tr {
                node_id, trigger_id, value,
            },
            Other(m) => ReplyJson::Other {
                address: m.address,
                args: osc_args_to_json(&m.args),
            },
        }
    }
}

fn osc_args_to_json(args: &[rosc::OscType]) -> serde_json::Value {
    serde_json::Value::Array(
        args.iter()
            .map(|a| match a {
                rosc::OscType::Int(v) => serde_json::json!(v),
                rosc::OscType::Float(v) => serde_json::json!(v),
                rosc::OscType::Double(v) => serde_json::json!(v),
                rosc::OscType::String(s) => serde_json::json!(s),
                rosc::OscType::Blob(b) => serde_json::json!(b),
                other => serde_json::json!(format!("{other:?}")),
            })
            .collect(),
    )
}
