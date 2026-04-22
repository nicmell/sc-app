// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_server_commands_component.mjs`.

use crate::component::bindings::exports::scserver::commands::commands as wit_cmd;
use crate::component::{Component, ServerMessageResource};
use crate::component::bindings::exports::scserver::commands::core::ServerMessage as WitServerMessageResource;

impl wit_cmd::Guest for Component {
    fn b_alloc(
        args: wit_cmd::BAllocArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BAlloc {
            num_channels: args.num_channels,
            an_osc_message: args.an_osc_message,
            the_required_sample: args.the_required_sample,
            ..crate::builders::BAlloc::new(args.bufnum, args.num_frames)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_alloc_read(
        args: wit_cmd::BAllocReadArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BAllocRead {
            start_frame: args.start_frame,
            number_of_frames: args.number_of_frames,
            an_osc_message: args.an_osc_message,
            ..crate::builders::BAllocRead::new(args.bufnum, args.path)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_alloc_read_channel(
        args: wit_cmd::BAllocReadChannelArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::BAllocReadChannel::new(args.bufnum, args.path, args.start_frame, args.number_of_frames, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_close(
        args: wit_cmd::BCloseArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BClose {
            an_osc_message: args.an_osc_message,
            ..crate::builders::BClose::new(args.bufnum)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_fill(
        args: wit_cmd::BFillArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = crate::builders::BFill::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_free(
        args: wit_cmd::BFreeArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BFree {
            an_osc_message: args.an_osc_message,
            ..crate::builders::BFree::new(args.bufnum)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_gen(
        args: wit_cmd::BGenArgs,
    ) -> WitServerMessageResource {
        let command_arguments = rosc::OscType::Blob(args.command_arguments);
        let msg = crate::builders::BGen::new(args.bufnum, args.cmd, command_arguments).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_get(
        args: wit_cmd::BGetArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BGet::new(args.bufnum, args.a_sample_index).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_getn(
        args: wit_cmd::BGetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::BGetn::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_query(
        args: wit_cmd::BQueryArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BQuery::new(args.bufnum).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_read(
        args: wit_cmd::BReadArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BRead {
            start_frame: args.start_frame,
            number_of_frames: args.number_of_frames,
            starting_frame: args.starting_frame,
            leave_file_open: args.leave_file_open,
            an_osc_message: args.an_osc_message,
            ..crate::builders::BRead::new(args.bufnum, args.path)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_read_channel(
        args: wit_cmd::BReadChannelArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::BReadChannel::new(args.bufnum, args.path, args.start_frame, args.number_of_frames, args.starting_frame, args.leave_file_open, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_set(
        args: wit_cmd::BSetArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::BSet::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_set_sample_rate(
        args: wit_cmd::BSetSampleRateArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BSetSampleRate::new(args.bufnum, args.the_desired_sampling).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_setn(
        args: wit_cmd::BSetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = crate::builders::BSetn::new(args.bufnum, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_write(
        args: wit_cmd::BWriteArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BWrite {
            number_of_frames: args.number_of_frames,
            starting_frame: args.starting_frame,
            leave_file_open: args.leave_file_open,
            an_osc_message: args.an_osc_message,
            ..crate::builders::BWrite::new(args.bufnum, args.path, args.header_format, args.sample_format)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn b_zero(
        args: wit_cmd::BZeroArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::BZero {
            an_osc_message: args.an_osc_message,
            ..crate::builders::BZero::new(args.bufnum)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn c_fill(
        args: wit_cmd::CFillArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, match t.2 {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            })).collect();
        let msg = crate::builders::CFill::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn c_get(
        args: wit_cmd::CGetArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::CGet::new(args.a_bus_index).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn c_getn(
        args: wit_cmd::CGetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::CGetn::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn c_set(
        args: wit_cmd::CSetArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, match t.1 {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            })).collect();
        let msg = crate::builders::CSet::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn c_setn(
        args: wit_cmd::CSetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, rosc::OscType::Blob(t.2), match t.3 {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            })).collect();
        let msg = crate::builders::CSetn::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn clear_sched(
    ) -> WitServerMessageResource {
        let msg = crate::builders::ClearSched::new().to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn cmd(
        args: wit_cmd::CmdArgs,
    ) -> WitServerMessageResource {
        let any_arguments = rosc::OscType::Blob(args.any_arguments);
        let msg = crate::builders::Cmd::new(args.cmd, any_arguments).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn d_free(
        args: wit_cmd::DFreeArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::DFree::new(args.synth_def_name).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn d_load(
        args: wit_cmd::DLoadArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::DLoad {
            an_osc_message: args.an_osc_message,
            ..crate::builders::DLoad::new(args.pathname_of_file)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn d_load_dir(
        args: wit_cmd::DLoadDirArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::DLoadDir {
            an_osc_message: args.an_osc_message,
            ..crate::builders::DLoadDir::new(args.pathname_of_directory)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn d_recv(
        args: wit_cmd::DRecvArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::DRecv {
            an_osc_message: args.an_osc_message,
            ..crate::builders::DRecv::new(args.buffer_of_data)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn dump_osc(
        args: wit_cmd::DumpOscArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::DumpOSC::new(args.code).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn error(
        args: wit_cmd::ErrorArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::Error::new(args.mode).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_deep_free(
        args: wit_cmd::GDeepFreeArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::GDeepFree::new(args.group_id).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_dump_tree(
        args: wit_cmd::GDumpTreeArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::GDumpTree::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_free_all(
        args: wit_cmd::GFreeAllArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::GFreeAll::new(args.group_id).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_head(
        args: wit_cmd::GHeadArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::GHead::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_new(
        args: wit_cmd::GNewArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = crate::builders::GNew::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_query_tree(
        args: wit_cmd::GQueryTreeArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::GQueryTree::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn g_tail(
        args: wit_cmd::GTailArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::GTail::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_after(
        args: wit_cmd::NAfterArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::NAfter::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_before(
        args: wit_cmd::NBeforeArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::NBefore::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_fill(
        args: wit_cmd::NFillArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1, match t.2 {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            })).collect();
        let msg = crate::builders::NFill::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_free(
        args: wit_cmd::NFreeArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::NFree::new(args.node_id).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_map(
        args: wit_cmd::NMapArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1)).collect();
        let msg = crate::builders::NMap::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_mapa(
        args: wit_cmd::NMapaArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1)).collect();
        let msg = crate::builders::NMapa::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_mapan(
        args: wit_cmd::NMapanArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1, t.2)).collect();
        let msg = crate::builders::NMapan::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_mapn(
        args: wit_cmd::NMapnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1, t.2)).collect();
        let msg = crate::builders::NMapn::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_order(
        args: wit_cmd::NOrderArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::NOrder::new(args.add_action, args.target_id, args.node_ids).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_query(
        args: wit_cmd::NQueryArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::NQuery::new(args.node_id).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_run(
        args: wit_cmd::NRunArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1)).collect();
        let msg = crate::builders::NRun::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_set(
        args: wit_cmd::NSetArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, match t.1 {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            })).collect();
        let msg = crate::builders::NSet::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_setn(
        args: wit_cmd::NSetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1, match t.2 {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            })).collect();
        let msg = crate::builders::NSetn::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn n_trace(
        args: wit_cmd::NTraceArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::NTrace::new(args.node_ids).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn notify(
        args: wit_cmd::NotifyArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::Notify {
            client_id: args.client_id,
            ..crate::builders::Notify::new(args.enable)
        }.to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn nrt_end(
    ) -> WitServerMessageResource {
        let msg = crate::builders::NrtEnd::new().to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn p_new(
        args: wit_cmd::PNewArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (t.0, t.1, t.2)).collect();
        let msg = crate::builders::PNew::new(tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn quit(
    ) -> WitServerMessageResource {
        let msg = crate::builders::Quit::new().to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn rt_memory_status(
    ) -> WitServerMessageResource {
        let msg = crate::builders::RtMemoryStatus::new().to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn s_get(
        args: wit_cmd::SGetArgs,
    ) -> WitServerMessageResource {
        let control = match args.control {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            };
        let msg = crate::builders::SGet::new(args.node_id, control).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn s_getn(
        args: wit_cmd::SGetnArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, t.1)).collect();
        let msg = crate::builders::SGetn::new(args.node_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn s_new(
        args: wit_cmd::SNewArgs,
    ) -> WitServerMessageResource {
        let tail: Vec<_> = args.tail.into_iter().map(|t| (match t.0 {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }, match t.1 {
                wit_cmd::ControlValue::Float(f) => crate::args::ControlValue::Float(f),
                wit_cmd::ControlValue::Int(i) => crate::args::ControlValue::Int(i),
                wit_cmd::ControlValue::Bus(s) => crate::args::ControlValue::Bus(s),
            })).collect();
        let msg = crate::builders::SNew::new(args.def_name, args.node_id, args.add_action, args.target_id, tail).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn s_noid(
        args: wit_cmd::SNoidArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::SNoid::new(args.synth_ids).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn status(
    ) -> WitServerMessageResource {
        let msg = crate::builders::Status::new().to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn sync(
        args: wit_cmd::SyncArgs,
    ) -> WitServerMessageResource {
        let msg = crate::builders::Sync::new(args.a_unique_number).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn u_cmd(
        args: wit_cmd::UCmdArgs,
    ) -> WitServerMessageResource {
        let any_arguments = rosc::OscType::Blob(args.any_arguments);
        let msg = crate::builders::UCmd::new(args.node_id, args.unit_generator_index, args.cmd, any_arguments).to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
    fn version(
    ) -> WitServerMessageResource {
        let msg = crate::builders::Version::new().to_message();
        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))
    }
}
