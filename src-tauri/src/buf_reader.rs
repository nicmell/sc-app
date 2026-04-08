//! Fast buffer reader that sends /b_getn and parses /b_setn entirely in Rust,
//! bypassing the osc-js + Tauri event chain. Used by sc-scope for real-time
//! buffer visualization.

use std::time::Duration;
use tokio::net::UdpSocket;
use rosc::{encoder, OscMessage, OscPacket, OscType};

const TIMEOUT: Duration = Duration::from_secs(2);

/// Send /b_getn to scsynth and return parsed float data from the /b_setn response.
/// Uses a dedicated ephemeral UDP socket to avoid contention with the main OSC socket.
pub async fn read_buffer(
    target: &str,
    bufnum: i32,
    start: i32,
    count: i32,
) -> Result<Vec<f32>, String> {
    let sock = UdpSocket::bind("0.0.0.0:0")
        .await
        .map_err(|e| e.to_string())?;

    let msg = OscPacket::Message(OscMessage {
        addr: "/b_getn".to_string(),
        args: vec![
            OscType::Int(bufnum),
            OscType::Int(start),
            OscType::Int(count),
        ],
    });
    let bytes = encoder::encode(&msg).map_err(|e| e.to_string())?;

    sock.send_to(&bytes, target)
        .await
        .map_err(|e| e.to_string())?;

    // Response includes: address (~8B) + type tags (~count+4 bytes, padded) + data (~count*4 bytes)
    let mut buf = vec![0u8; 65536];
    let len = tokio::time::timeout(TIMEOUT, sock.recv(&mut buf))
        .await
        .map_err(|_| "timeout".to_string())?
        .map_err(|e| e.to_string())?;

    let (_, packet) = rosc::decoder::decode_udp(&buf[..len])
        .map_err(|e| format!("OSC decode error: {e:?}"))?;

    match packet {
        OscPacket::Message(resp) => {
            if resp.addr == "/fail" {
                return Err("server returned /fail".to_string());
            }
            if resp.addr != "/b_setn" {
                return Err(format!("unexpected response: {}", resp.addr));
            }
            // args: [bufnum: Int, start: Int, count: Int, ...floats: Float]
            let resp_bufnum = match resp.args.first() {
                Some(OscType::Int(n)) => *n,
                _ => return Err("missing bufnum in response".to_string()),
            };
            if resp_bufnum != bufnum {
                return Err("bufnum mismatch".to_string());
            }
            // Extract floats starting at index 3
            let floats: Vec<f32> = resp.args[3..]
                .iter()
                .filter_map(|a| match a {
                    OscType::Float(f) => Some(*f),
                    _ => None,
                })
                .collect();
            Ok(floats)
        }
        _ => Err("unexpected OSC bundle response".to_string()),
    }
}
