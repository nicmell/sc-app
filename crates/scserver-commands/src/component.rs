//! WebAssembly Component Model bindings (gated behind the `component`
//! Cargo feature).
//!
//! The host calls one exported function per crate surface:
//! * `commands::encode(server-message)` — serialise a typed command.
//! * `replies::decode(bytes)` — classify a server reply.
//! * `nrt::nrt-score` resource — assemble an NRT score from typed
//!   server messages.

#![allow(warnings)]

pub(crate) mod bindings {
    #![allow(warnings)]
    include!("bindings.rs");
}

use std::cell::RefCell;

use bindings::exports::scserver::commands::commands::{
    self as wit_cmd, Guest as CommandsGuest, ServerMessage as WitServerMessage,
};
use bindings::exports::scserver::commands::core::OscArg as WitOscArg;
use bindings::exports::scserver::commands::nrt::{Guest as NrtGuest, GuestNrtScore};
use bindings::exports::scserver::commands::replies::{
    BSetnReply, DoneInfo, FailInfo, Guest as RepliesGuest, LateInfo, NodeInfo as WitNodeInfo,
    OtherReply, ServerReply as WitServerReply, StatusReplyInfo, SyncedReply, TrInfo,
};

use crate::commands::*;
use crate::{NodeInfo, NrtScore, OscMessage, ServerReply, StatusReply};

pub(crate) struct Component;

// `core` exposes only the `osc-arg` type — no guest functions/resources.

impl CommandsGuest for Component {
    fn encode(msg: WitServerMessage) -> Result<Vec<u8>, String> {
        wit_to_rust(msg).encode().map_err(|e| e.to_string())
    }
}

impl NrtGuest for Component {
    type NrtScore = NrtScoreResource;
}

impl RepliesGuest for Component {
    fn decode(bytes: Vec<u8>) -> Result<WitServerReply, String> {
        let reply = ServerReply::decode(&bytes).map_err(|e| e.to_string())?;
        Ok(reply_to_wit(reply))
    }
}

// ── NRT score resource ──────────────────────────────────────────────────

pub struct NrtScoreResource {
    inner: RefCell<NrtScore>,
}

impl GuestNrtScore for NrtScoreResource {
    fn new() -> Self {
        Self {
            inner: RefCell::new(NrtScore::new()),
        }
    }

    fn at(&self, seconds: f64, msg: WitServerMessage) {
        let osc = wit_to_rust(msg).to_osc_message();
        let current = std::mem::take(&mut *self.inner.borrow_mut());
        *self.inner.borrow_mut() = current.at(seconds, osc);
    }

    fn encode(&self) -> Result<Vec<u8>, String> {
        self.inner.borrow().encode().map_err(|e| e.to_string())
    }
}

bindings::export!(Component with_types_in bindings);

// ── osc-arg ↔ rosc::OscType ─────────────────────────────────────────────

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

fn osc_args_to_wit(args: &[rosc::OscType]) -> Vec<WitOscArg> {
    args.iter().map(osc_to_wit).collect()
}

// ── polymorphic arg variants ────────────────────────────────────────────

fn wit_control_id(c: wit_cmd::ControlId) -> ControlId {
    match c {
        wit_cmd::ControlId::Index(i) => ControlId::Index(i),
        wit_cmd::ControlId::Name(s) => ControlId::Name(s),
    }
}

fn wit_numeric(n: wit_cmd::NumericValue) -> NumericValue {
    match n {
        wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
        wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
    }
}

fn wit_control_value(v: wit_cmd::ControlValue) -> ControlValue {
    match v {
        wit_cmd::ControlValue::Float(f) => ControlValue::Float(f),
        wit_cmd::ControlValue::Int(i) => ControlValue::Int(i),
        wit_cmd::ControlValue::Bus(s) => ControlValue::Bus(s),
    }
}

// ── replies ─────────────────────────────────────────────────────────────

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
        ServerReply::Fail {
            address,
            error,
            extras,
        } => WitServerReply::Fail(FailInfo {
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
        ServerReply::BSetn(b) => WitServerReply::BSetn(BSetnReply {
            bufnum: b.bufnum,
            start: b.start,
            samples: b.samples,
        }),
        ServerReply::Synced { sync_id } => WitServerReply::Synced(SyncedReply { sync_id }),
        ServerReply::Other { address, args } => WitServerReply::Other(OtherReply {
            address,
            args: osc_args_to_wit(&args),
        }),
    }
}

// ── WIT ServerMessage → Rust ServerMessage ──────────────────────────────

fn wit_to_rust(msg: WitServerMessage) -> ServerMessage {
    match msg {
        WitServerMessage::BAlloc(a) => ServerMessage::BAlloc(BAlloc {
            num_channels: a.num_channels,
            completion_msg: a.completion_msg,
            sample_rate: a.sample_rate,
            ..BAlloc::new(a.bufnum, a.num_frames)
        }),
        WitServerMessage::BAllocRead(a) => ServerMessage::BAllocRead(BAllocRead {
            start_frame: a.start_frame,
            number_of_frames: a.number_of_frames,
            completion_msg: a.completion_msg,
            ..BAllocRead::new(a.bufnum, a.path)
        }),
        WitServerMessage::BAllocReadChannel(a) => ServerMessage::BAllocReadChannel(
            BAllocReadChannel {
                completion_msg: a.completion_msg,
                ..BAllocReadChannel::new(
                    a.bufnum,
                    a.path,
                    a.start_frame,
                    a.number_of_frames,
                    a.channels,
                )
            },
        ),
        WitServerMessage::BClose(a) => ServerMessage::BClose(BClose {
            completion_msg: a.completion_msg,
            ..BClose::new(a.bufnum)
        }),
        WitServerMessage::BFill(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            ServerMessage::BFill(BFill::new(a.bufnum, tail))
        }
        WitServerMessage::BFree(a) => ServerMessage::BFree(BFree {
            completion_msg: a.completion_msg,
            ..BFree::new(a.bufnum)
        }),
        WitServerMessage::BGen(a) => ServerMessage::BGen(BGen::new(
            a.bufnum,
            a.cmd,
            a.command_arguments.into_iter().map(wit_to_osc).collect(),
        )),
        WitServerMessage::BGet(a) => ServerMessage::BGet(BGet::new(a.bufnum, a.sample_indices)),
        WitServerMessage::BGetn(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::BGetn(BGetn::new(a.bufnum, tail))
        }
        WitServerMessage::BQuery(a) => ServerMessage::BQuery(BQuery::new(a.bufnums)),
        WitServerMessage::BRead(a) => ServerMessage::BRead(BRead {
            start_frame: a.start_frame,
            number_of_frames: a.number_of_frames,
            starting_frame: a.starting_frame,
            leave_file_open: a.leave_file_open,
            completion_msg: a.completion_msg,
            ..BRead::new(a.bufnum, a.path)
        }),
        WitServerMessage::BReadChannel(a) => ServerMessage::BReadChannel(BReadChannel {
            completion_msg: a.completion_msg,
            ..BReadChannel::new(
                a.bufnum,
                a.path,
                a.start_frame,
                a.number_of_frames,
                a.starting_frame,
                a.leave_file_open,
                a.channels,
            )
        }),
        WitServerMessage::BSet(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::BSet(BSet::new(a.bufnum, tail))
        }
        WitServerMessage::BSetSampleRate(a) => {
            ServerMessage::BSetSampleRate(BSetSampleRate::new(a.bufnum, a.the_desired_sampling))
        }
        WitServerMessage::BSetn(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::BSetn(BSetn::new(a.bufnum, tail))
        }
        WitServerMessage::BWrite(a) => ServerMessage::BWrite(BWrite {
            number_of_frames: a.number_of_frames,
            starting_frame: a.starting_frame,
            leave_file_open: a.leave_file_open,
            completion_msg: a.completion_msg,
            ..BWrite::new(a.bufnum, a.path, a.header_format, a.sample_format)
        }),
        WitServerMessage::BZero(a) => ServerMessage::BZero(BZero {
            completion_msg: a.completion_msg,
            ..BZero::new(a.bufnum)
        }),
        WitServerMessage::CFill(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (t.0, t.1, wit_numeric(t.2)))
                .collect();
            ServerMessage::CFill(CFill::new(tail))
        }
        WitServerMessage::CGet(a) => ServerMessage::CGet(CGet::new(a.bus_indices)),
        WitServerMessage::CGetn(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::CGetn(CGetn::new(tail))
        }
        WitServerMessage::CSet(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, wit_numeric(t.1))).collect();
            ServerMessage::CSet(CSet::new(tail))
        }
        WitServerMessage::CSetn(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|(start, values)| (start, values.into_iter().map(wit_numeric).collect()))
                .collect();
            ServerMessage::CSetn(CSetn::new(tail))
        }
        WitServerMessage::ClearSched => ServerMessage::ClearSched,
        WitServerMessage::Cmd(a) => ServerMessage::Cmd(Cmd::new(
            a.cmd,
            a.any_arguments.into_iter().map(wit_to_osc).collect(),
        )),
        WitServerMessage::DFree(a) => ServerMessage::DFree(DFree::new(a.synth_def_names)),
        WitServerMessage::DLoad(a) => ServerMessage::DLoad(DLoad {
            completion_msg: a.completion_msg,
            ..DLoad::new(a.pathname_of_file)
        }),
        WitServerMessage::DLoadDir(a) => ServerMessage::DLoadDir(DLoadDir {
            completion_msg: a.completion_msg,
            ..DLoadDir::new(a.pathname_of_directory)
        }),
        WitServerMessage::DRecv(a) => ServerMessage::DRecv(DRecv {
            completion_msg: a.completion_msg,
            ..DRecv::new(a.buffer_of_data)
        }),
        WitServerMessage::DumpOsc(a) => ServerMessage::DumpOSC(DumpOSC::new(a.code)),
        WitServerMessage::Error(a) => ServerMessage::Error(Error::new(a.mode)),
        WitServerMessage::GDeepFree(a) => ServerMessage::GDeepFree(GDeepFree::new(a.group_ids)),
        WitServerMessage::GDumpTree(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::GDumpTree(GDumpTree::new(tail))
        }
        WitServerMessage::GFreeAll(a) => ServerMessage::GFreeAll(GFreeAll::new(a.group_ids)),
        WitServerMessage::GHead(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::GHead(GHead::new(tail))
        }
        WitServerMessage::GNew(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            ServerMessage::GNew(GNew::new(tail))
        }
        WitServerMessage::GQueryTree(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::GQueryTree(GQueryTree::new(tail))
        }
        WitServerMessage::GTail(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::GTail(GTail::new(tail))
        }
        WitServerMessage::NAfter(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::NAfter(NAfter::new(tail))
        }
        WitServerMessage::NBefore(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::NBefore(NBefore::new(tail))
        }
        WitServerMessage::NFill(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), t.1, wit_numeric(t.2)))
                .collect();
            ServerMessage::NFill(NFill::new(a.node_id, tail))
        }
        WitServerMessage::NFree(a) => ServerMessage::NFree(NFree::new(a.node_ids)),
        WitServerMessage::NMap(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), t.1))
                .collect();
            ServerMessage::NMap(NMap::new(a.node_id, tail))
        }
        WitServerMessage::NMapa(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), t.1))
                .collect();
            ServerMessage::NMapa(NMapa::new(a.node_id, tail))
        }
        WitServerMessage::NMapan(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), t.1, t.2))
                .collect();
            ServerMessage::NMapan(NMapan::new(a.node_id, tail))
        }
        WitServerMessage::NMapn(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), t.1, t.2))
                .collect();
            ServerMessage::NMapn(NMapn::new(a.node_id, tail))
        }
        WitServerMessage::NOrder(a) => {
            ServerMessage::NOrder(NOrder::new(a.add_action, a.target_id, a.node_ids))
        }
        WitServerMessage::NQuery(a) => ServerMessage::NQuery(NQuery::new(a.node_ids)),
        WitServerMessage::NRun(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1)).collect();
            ServerMessage::NRun(NRun::new(tail))
        }
        WitServerMessage::NSet(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), wit_numeric(t.1)))
                .collect();
            ServerMessage::NSet(NSet::new(a.node_id, tail))
        }
        WitServerMessage::NSetn(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|(ctrl, values)| {
                    (
                        wit_control_id(ctrl),
                        values.into_iter().map(wit_numeric).collect(),
                    )
                })
                .collect();
            ServerMessage::NSetn(NSetn::new(a.node_id, tail))
        }
        WitServerMessage::NTrace(a) => ServerMessage::NTrace(NTrace::new(a.node_ids)),
        WitServerMessage::Notify(a) => ServerMessage::Notify(Notify {
            client_id: a.client_id,
            ..Notify::new(a.enable)
        }),
        WitServerMessage::NrtEnd => ServerMessage::NrtEnd,
        WitServerMessage::PNew(a) => {
            let tail: Vec<_> = a.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
            ServerMessage::PNew(PNew::new(tail))
        }
        WitServerMessage::Quit => ServerMessage::Quit,
        WitServerMessage::RtMemoryStatus => ServerMessage::RtMemoryStatus,
        WitServerMessage::SGet(a) => {
            let controls: Vec<_> = a.controls.into_iter().map(wit_control_id).collect();
            ServerMessage::SGet(SGet::new(a.node_id, controls))
        }
        WitServerMessage::SGetn(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), t.1))
                .collect();
            ServerMessage::SGetn(SGetn::new(a.node_id, tail))
        }
        WitServerMessage::SNew(a) => {
            let tail: Vec<_> = a
                .tail
                .into_iter()
                .map(|t| (wit_control_id(t.0), wit_control_value(t.1)))
                .collect();
            ServerMessage::SNew(SNew::new(
                a.def_name,
                a.node_id,
                a.add_action,
                a.target_id,
                tail,
            ))
        }
        WitServerMessage::SNoid(a) => ServerMessage::SNoid(SNoid::new(a.synth_ids)),
        WitServerMessage::Status => ServerMessage::Status,
        WitServerMessage::Sync(a) => ServerMessage::Sync(Sync::new(a.a_unique_number)),
        WitServerMessage::UCmd(a) => ServerMessage::UCmd(UCmd::new(
            a.node_id,
            a.unit_generator_index,
            a.cmd,
            a.any_arguments.into_iter().map(wit_to_osc).collect(),
        )),
        WitServerMessage::Version => ServerMessage::Version,
        WitServerMessage::Other(m) => ServerMessage::Other {
            address: m.address,
            args: m.args.into_iter().map(wit_to_osc).collect(),
        },
    }
}
