//! Integration tests exercising typed builders + reply parsing.
//!
//! Every builder takes all required args in its `new()` constructor, and
//! exposes public fields so optional trailing args can be set via struct
//! update syntax (`{ field: Some(v), ..Foo::new(required) }`).

use scserver_commands::commands::{BAlloc, GNew, NFree, SNew, Status};
use scserver_commands::{ControlId, ControlValue, OscMessage, OscType, ServerMessage, ServerReply};

#[test]
fn status_builds_and_decodes() {
    let bytes = Status::new().encode().unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/status");
    assert!(msg.args.is_empty());
}

#[test]
fn s_new_with_controls_round_trips() {
    // /s_new with two kr control pairs ("freq", 440.0) and ("amp", 0.5).
    // All required args in the constructor; controls are a typed Vec of
    // (ControlId, ControlValue) tuples.
    let bytes = SNew::new(
        "sine".to_string(),
        1001,
        0,
        1,
        vec![
            ("freq".into(), 440.0f32.into()),
            ("amp".into(), 0.5f32.into()),
        ],
    )
    .encode()
    .unwrap();

    let msg = OscMessage::decode(&bytes).unwrap();
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

/// Exercise the `ControlId::Index` path: `/s_new` with a numeric control
/// index instead of a name.
#[test]
fn s_new_by_control_index() {
    let bytes = SNew::new(
        "sine".to_string(),
        1001,
        0,
        1,
        vec![(ControlId::Index(0), ControlValue::Float(220.0))],
    )
    .encode()
    .unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    match &msg.args[4] {
        OscType::Int(i) => assert_eq!(*i, 0),
        other => panic!("arg4 not Int: {other:?}"),
    }
}

#[test]
fn g_new_builds() {
    let bytes = GNew::new(vec![(1000i32, 0i32, 0i32)]).encode().unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/g_new");
    assert_eq!(msg.args.len(), 3);
}

#[test]
fn n_free_builds() {
    let bytes = NFree::new(vec![1001]).encode().unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/n_free");
    assert_eq!(msg.args.len(), 1);

    // Multi-ID is the real reason N*int exists.
    let bytes = NFree::new(vec![1001, 1002, 1003]).encode().unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.args.len(), 3);
}

/// `/b_alloc` with just the two required args — channels / completion /
/// sample-rate all left at their `None` defaults, omitted from the wire.
#[test]
fn b_alloc_minimal() {
    let bytes = BAlloc::new(0, 8192).encode().unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/b_alloc");
    assert_eq!(msg.args.len(), 2);
}

/// `/b_alloc` with an optional `num_channels` override — struct update
/// syntax keeps the required args from the constructor.
#[test]
fn b_alloc_with_optional_channels() {
    let bytes = BAlloc {
        num_channels: Some(2),
        ..BAlloc::new(0, 8192)
    }
    .encode()
    .unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/b_alloc");
    assert_eq!(msg.args.len(), 3, "bufnum + num_frames + num_channels");
    match &msg.args[2] {
        OscType::Int(i) => assert_eq!(*i, 2),
        other => panic!("arg2 not Int: {other:?}"),
    }
}

/// Parity check: the OSC wire format is deterministic per the spec, so
/// hand-computed reference bytes must match our rosc-backed encoder.
#[test]
fn status_matches_osc_wire_format() {
    let expected: &[u8] = &[
        0x2f, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0x00, // "/status\0"
        0x2c, 0x00, 0x00, 0x00, // ",\0\0\0"
    ];
    let actual = Status::new().encode().unwrap();
    assert_eq!(actual, expected);
}

/// Exercise the unified `ServerMessage` enum: a unit variant and a
/// payload variant both produce the same wire bytes as the per-struct
/// path, via `From<Cmd>` + dispatching `encode`.
#[test]
fn server_message_variant_matches_per_struct_encode() {
    let status_direct = Status::new().encode().unwrap();
    let status_via_enum = ServerMessage::Status.encode().unwrap();
    assert_eq!(status_direct, status_via_enum);

    let b_alloc_direct = BAlloc::new(0, 8192).encode().unwrap();
    let b_alloc_via_enum: ServerMessage = BAlloc::new(0, 8192).into();
    assert_eq!(b_alloc_direct, b_alloc_via_enum.encode().unwrap());
}

/// `ServerMessage::Other` is the escape hatch for addresses outside the
/// catalogue — carries a raw address + arg list.
#[test]
fn server_message_other_round_trips() {
    let bytes = ServerMessage::Other {
        address: "/my-plugin-cmd".into(),
        args: vec![OscType::Int(1), OscType::String("hello".into())],
    }
    .encode()
    .unwrap();
    let msg = OscMessage::decode(&bytes).unwrap();
    assert_eq!(msg.address, "/my-plugin-cmd");
    assert_eq!(msg.args.len(), 2);
}

#[test]
fn status_reply_round_trip_via_wire() {
    let raw = OscMessage::new("/status.reply")
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
