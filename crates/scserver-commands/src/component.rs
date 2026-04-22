//! WebAssembly Component Model bindings (gated behind the `component`
//! Cargo feature).

#![allow(warnings)]

pub(crate) mod bindings {
    #![allow(warnings)]
    include!("bindings.rs");
}

use std::cell::RefCell;

use bindings::exports::scserver::commands::core::{
    Guest as CoreGuest, GuestNrtScore, GuestServerMessage, OscArg as WitOscArg,
    ServerMessage as WitServerMessageResource, ServerMessageBorrow,
};
use bindings::exports::scserver::commands::replies::{
    DoneInfo, FailInfo, Guest as RepliesGuest, LateInfo, NodeInfo as WitNodeInfo, OtherReply,
    ServerReply as WitServerReply, StatusReplyInfo, TrInfo,
};
use bindings::exports::scserver::commands::commands as wit_cmd;

use crate::commands::*;
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
}

impl RepliesGuest for Component {
    fn parse_reply(bytes: Vec<u8>) -> Result<WitServerReply, String> {
        let reply = ServerReply::parse(&bytes).map_err(|e| e.to_string())?;
        Ok(reply_to_wit(reply))
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
        ServerReply::Other { address, args } => WitServerReply::Other(OtherReply {
            address,
            args: osc_args_to_wit(&args),
        }),
    }
}

// ── WIT Guest impl for every command ────────────────────────────────────

impl wit_cmd::Guest for Component {
    fn b_alloc(
        args: wit_cmd::BAllocArgs,
    ) -> WitServerMessageResource {
        let msg = BAlloc {
            num_channels: args.num_channels,
            completion_msg: args.completion_msg,
            sample_rate: args.sample_rate,
            ..BAlloc::new(args.bufnum, args.num_frames)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_alloc_read(
        args: wit_cmd::BAllocReadArgs,
    ) -> WitServerMessageResource {
        let msg = BAllocRead {
            start_frame: args.start_frame,
            number_of_frames: args.number_of_frames,
            completion_msg: args.completion_msg,
            ..BAllocRead::new(args.bufnum, args.path)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_alloc_read_channel(
        args: wit_cmd::BAllocReadChannelArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = BAllocReadChannel::new(args.bufnum, args.path, args.start_frame, args.number_of_frames, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_close(
        args: wit_cmd::BCloseArgs,
    ) -> WitServerMessageResource {
        let msg = BClose {
            completion_msg: args.completion_msg,
            ..BClose::new(args.bufnum)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_fill(
        args: wit_cmd::BFillArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = BFill::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_free(
        args: wit_cmd::BFreeArgs,
    ) -> WitServerMessageResource {
        let msg = BFree {
            completion_msg: args.completion_msg,
            ..BFree::new(args.bufnum)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_gen(
        args: wit_cmd::BGenArgs,
    ) -> WitServerMessageResource {
        let command_arguments = rosc::OscType::Blob(args.command_arguments);
        let msg = BGen::new(args.bufnum, args.cmd, command_arguments).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_get(
        args: wit_cmd::BGetArgs,
    ) -> WitServerMessageResource {
        let msg = BGet::new(args.bufnum, args.a_sample_index).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_getn(
        args: wit_cmd::BGetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = BGetn::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_query(
        args: wit_cmd::BQueryArgs,
    ) -> WitServerMessageResource {
        let msg = BQuery::new(args.bufnum).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_read(
        args: wit_cmd::BReadArgs,
    ) -> WitServerMessageResource {
        let msg = BRead {
            start_frame: args.start_frame,
            number_of_frames: args.number_of_frames,
            starting_frame: args.starting_frame,
            leave_file_open: args.leave_file_open,
            completion_msg: args.completion_msg,
            ..BRead::new(args.bufnum, args.path)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_read_channel(
        args: wit_cmd::BReadChannelArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = BReadChannel::new(args.bufnum, args.path, args.start_frame, args.number_of_frames, args.starting_frame, args.leave_file_open, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_set(
        args: wit_cmd::BSetArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = BSet::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_set_sample_rate(
        args: wit_cmd::BSetSampleRateArgs,
    ) -> WitServerMessageResource {
        let msg = BSetSampleRate::new(args.bufnum, args.the_desired_sampling).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_setn(
        args: wit_cmd::BSetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = BSetn::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_write(
        args: wit_cmd::BWriteArgs,
    ) -> WitServerMessageResource {
        let msg = BWrite {
            number_of_frames: args.number_of_frames,
            starting_frame: args.starting_frame,
            leave_file_open: args.leave_file_open,
            completion_msg: args.completion_msg,
            ..BWrite::new(args.bufnum, args.path, args.header_format, args.sample_format)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn b_zero(
        args: wit_cmd::BZeroArgs,
    ) -> WitServerMessageResource {
        let msg = BZero {
            completion_msg: args.completion_msg,
            ..BZero::new(args.bufnum)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn c_fill(
        args: wit_cmd::CFillArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, match t.2 {
                wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
            })).collect();
        let msg = CFill::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn c_get(
        args: wit_cmd::CGetArgs,
    ) -> WitServerMessageResource {
        let msg = CGet::new(args.a_bus_index).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn c_getn(
        args: wit_cmd::CGetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = CGetn::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn c_set(
        args: wit_cmd::CSetArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, match t.1 {
                wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
            })).collect();
        let msg = CSet::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn c_setn(
        args: wit_cmd::CSetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, rosc::OscType::Blob(t.2), match t.3 {
                wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
            })).collect();
        let msg = CSetn::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn clear_sched(
    ) -> WitServerMessageResource {
        let msg = ClearSched::new().to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn cmd(
        args: wit_cmd::CmdArgs,
    ) -> WitServerMessageResource {
        let any_arguments = rosc::OscType::Blob(args.any_arguments);
        let msg = Cmd::new(args.cmd, any_arguments).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn d_free(
        args: wit_cmd::DFreeArgs,
    ) -> WitServerMessageResource {
        let msg = DFree::new(args.synth_def_name).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn d_load(
        args: wit_cmd::DLoadArgs,
    ) -> WitServerMessageResource {
        let msg = DLoad {
            completion_msg: args.completion_msg,
            ..DLoad::new(args.pathname_of_file)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn d_load_dir(
        args: wit_cmd::DLoadDirArgs,
    ) -> WitServerMessageResource {
        let msg = DLoadDir {
            completion_msg: args.completion_msg,
            ..DLoadDir::new(args.pathname_of_directory)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn d_recv(
        args: wit_cmd::DRecvArgs,
    ) -> WitServerMessageResource {
        let msg = DRecv {
            completion_msg: args.completion_msg,
            ..DRecv::new(args.buffer_of_data)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn dump_osc(
        args: wit_cmd::DumpOscArgs,
    ) -> WitServerMessageResource {
        let msg = DumpOSC::new(args.code).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn error(
        args: wit_cmd::ErrorArgs,
    ) -> WitServerMessageResource {
        let msg = Error::new(args.mode).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_deep_free(
        args: wit_cmd::GDeepFreeArgs,
    ) -> WitServerMessageResource {
        let msg = GDeepFree::new(args.group_id).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_dump_tree(
        args: wit_cmd::GDumpTreeArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = GDumpTree::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_free_all(
        args: wit_cmd::GFreeAllArgs,
    ) -> WitServerMessageResource {
        let msg = GFreeAll::new(args.group_id).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_head(
        args: wit_cmd::GHeadArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = GHead::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_new(
        args: wit_cmd::GNewArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = GNew::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_query_tree(
        args: wit_cmd::GQueryTreeArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = GQueryTree::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn g_tail(
        args: wit_cmd::GTailArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = GTail::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_after(
        args: wit_cmd::NAfterArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = NAfter::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_before(
        args: wit_cmd::NBeforeArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = NBefore::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_fill(
        args: wit_cmd::NFillArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1, match t.2 {
                wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
            })).collect();
        let msg = NFill::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_free(
        args: wit_cmd::NFreeArgs,
    ) -> WitServerMessageResource {
        let msg = NFree::new(args.node_id).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_map(
        args: wit_cmd::NMapArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1)).collect();
        let msg = NMap::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_mapa(
        args: wit_cmd::NMapaArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1)).collect();
        let msg = NMapa::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_mapan(
        args: wit_cmd::NMapanArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1, t.2)).collect();
        let msg = NMapan::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_mapn(
        args: wit_cmd::NMapnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1, t.2)).collect();
        let msg = NMapn::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_order(
        args: wit_cmd::NOrderArgs,
    ) -> WitServerMessageResource {
        let msg = NOrder::new(args.add_action, args.target_id, args.node_ids).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_query(
        args: wit_cmd::NQueryArgs,
    ) -> WitServerMessageResource {
        let msg = NQuery::new(args.node_id).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_run(
        args: wit_cmd::NRunArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = NRun::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_set(
        args: wit_cmd::NSetArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, match t.1 {
                wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
            })).collect();
        let msg = NSet::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_setn(
        args: wit_cmd::NSetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1, match t.2 {
                wit_cmd::NumericValue::Float(f) => NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => NumericValue::Int(i),
            })).collect();
        let msg = NSetn::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn n_trace(
        args: wit_cmd::NTraceArgs,
    ) -> WitServerMessageResource {
        let msg = NTrace::new(args.node_ids).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn notify(
        args: wit_cmd::NotifyArgs,
    ) -> WitServerMessageResource {
        let msg = Notify {
            client_id: args.client_id,
            ..Notify::new(args.enable)
        }.to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn nrt_end(
    ) -> WitServerMessageResource {
        let msg = NrtEnd::new().to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn p_new(
        args: wit_cmd::PNewArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = PNew::new(tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn quit(
    ) -> WitServerMessageResource {
        let msg = Quit::new().to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn rt_memory_status(
    ) -> WitServerMessageResource {
        let msg = RtMemoryStatus::new().to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn s_get(
        args: wit_cmd::SGetArgs,
    ) -> WitServerMessageResource {
        let control = match args.control {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            };
        let msg = SGet::new(args.node_id, control).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn s_getn(
        args: wit_cmd::SGetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, t.1)).collect();
        let msg = SGetn::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn s_new(
        args: wit_cmd::SNewArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => ControlId::Name(s),
            }, match t.1 {
                wit_cmd::ControlValue::Float(f) => ControlValue::Float(f),
                wit_cmd::ControlValue::Int(i) => ControlValue::Int(i),
                wit_cmd::ControlValue::Bus(s) => ControlValue::Bus(s),
            })).collect();
        let msg = SNew::new(args.def_name, args.node_id, args.add_action, args.target_id, tail).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn s_noid(
        args: wit_cmd::SNoidArgs,
    ) -> WitServerMessageResource {
        let msg = SNoid::new(args.synth_ids).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn status(
    ) -> WitServerMessageResource {
        let msg = Status::new().to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn sync(
        args: wit_cmd::SyncArgs,
    ) -> WitServerMessageResource {
        let msg = Sync::new(args.a_unique_number).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn u_cmd(
        args: wit_cmd::UCmdArgs,
    ) -> WitServerMessageResource {
        let any_arguments = rosc::OscType::Blob(args.any_arguments);
        let msg = UCmd::new(args.node_id, args.unit_generator_index, args.cmd, any_arguments).to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
    fn version(
    ) -> WitServerMessageResource {
        let msg = Version::new().to_message();
        WitServerMessageResource::new(ServerMessageResource::new(msg))
    }
}
