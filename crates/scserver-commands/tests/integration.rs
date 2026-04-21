//! Integration tests exercising typed builders + reply parsing.

use scserver_commands::builders::{BAlloc, GNew, NFree, SNew, Status};
use scserver_commands::{OscType, ServerMessage, ServerReply};

#[test]
fn status_builds_and_decodes() {
    let bytes = Status::new().encode().unwrap();
    let msg = ServerMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/status");
    assert!(msg.args.is_empty());
}

#[test]
fn s_new_with_controls_round_trips() {
    // /s_new with one kr control pair ("freq", 440.0).
    let bytes = SNew::new()
        .def_name("sine".to_string())
        .node_id(1001)
        .add_action(0)
        .target_id(1)
        .tail("freq", 440.0f32)
        .tail("amp", 0.5f32)
        .encode()
        .unwrap();

    let msg = ServerMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/s_new");
    assert_eq!(msg.args.len(), 8, "4 header args + 2 control pairs");

    match &msg.args[0] {
        OscType::String(s) => assert_eq!(s, "sine"),
        other => panic!("arg0 not String: {other:?}"),
    }
    match &msg.args[4] {
        OscType::String(s) => assert_eq!(s, "freq"),
        other => panic!("arg4 not String: {other:?}"),
    }
    match &msg.args[5] {
        OscType::Float(f) => assert_eq!(*f, 440.0),
        other => panic!("arg5 not Float: {other:?}"),
    }
}

#[test]
fn g_new_builds() {
    let bytes = GNew::new().tail(1000i32, 0i32, 0i32).encode().unwrap();
    let msg = ServerMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/g_new");
    assert_eq!(msg.args.len(), 3);
}

#[test]
fn n_free_builds() {
    let bytes = NFree::new().node_id(1001).encode().unwrap();
    let msg = ServerMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/n_free");
    assert_eq!(msg.args.len(), 1);
}

#[test]
fn b_alloc_builds() {
    let bytes = BAlloc::new()
        .bufnum(0)
        .num_frames(8192)
        .number_of_channels(1)
        .encode()
        .unwrap();
    let msg = ServerMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/b_alloc");
    assert_eq!(msg.args.len(), 3);
}

#[test]
fn status_reply_round_trip_via_wire() {
    // Simulate the server-side status.reply wire bytes.
    let raw = ServerMessage::new("/status.reply")
        .arg(1i32)
        .arg(42i32)
        .arg(3i32)
        .arg(2i32)
        .arg(10i32)
        .arg(0.05f32)
        .arg(0.2f32)
        .arg(44100.0f64)
        .arg(44100.0f64)
        .encode()
        .unwrap();
    match ServerReply::parse(&raw).unwrap() {
        ServerReply::StatusReply(s) => {
            assert_eq!(s.num_ugens, 42);
            assert_eq!(s.num_synths, 3);
            assert_eq!(s.actual_sample_rate, 44100.0);
        }
        other => panic!("expected StatusReply, got {other:?}"),
    }
}
