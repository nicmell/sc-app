//! Non-realtime score assembly.
//!
//! A score is a sequence of timestamped OSC bundles, serialised to the
//! length-prefixed binary file scsynth's `-N` mode consumes. See the
//! [`NrtScore`] type for the Rust-side builder and the sibling `nrt`
//! WIT interface for the component surface.

use rosc::{OscBundle, OscPacket, OscTime};

use crate::{CommandError, OscMessage};

/// A sequence of timestamped OSC bundles, ready to be serialised as an
/// NRT command file. scsynth's `-N` mode reads this file and applies
/// each bundle at its declared time.
///
/// On-disk layout per entry:
/// ```text
///     [u32 BE] length of the OSC bundle that follows
///     [bundle] standard OSC bundle bytes (timetag + messages)
/// ```
#[derive(Debug, Clone, Default)]
pub struct NrtScore {
    bundles: Vec<OscBundle>,
}

impl NrtScore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Append a single message at the given time (seconds since the start
    /// of the score).
    pub fn at(mut self, time_seconds: f64, msg: OscMessage) -> Self {
        self.bundles.push(OscBundle {
            timetag: seconds_to_osc_time(time_seconds),
            content: vec![OscPacket::Message(msg.into())],
        });
        self
    }

    /// Append several messages as a single bundle at the given time.
    pub fn bundle_at(mut self, time_seconds: f64, msgs: Vec<OscMessage>) -> Self {
        self.bundles.push(OscBundle {
            timetag: seconds_to_osc_time(time_seconds),
            content: msgs.into_iter().map(|m| OscPacket::Message(m.into())).collect(),
        });
        self
    }

    /// Number of bundles in the score.
    pub fn len(&self) -> usize {
        self.bundles.len()
    }

    pub fn is_empty(&self) -> bool {
        self.bundles.is_empty()
    }

    /// Encode to the binary NRT command-file layout.
    pub fn encode(&self) -> Result<Vec<u8>, CommandError> {
        let mut out = Vec::new();
        for bundle in &self.bundles {
            let bytes = rosc::encoder::encode(&OscPacket::Bundle(bundle.clone()))
                .map_err(|e| CommandError::Nrt(format!("encode: {e:?}")))?;
            let len = u32::try_from(bytes.len())
                .map_err(|_| CommandError::Nrt("bundle exceeds 4 GiB".into()))?;
            out.extend_from_slice(&len.to_be_bytes());
            out.extend_from_slice(&bytes);
        }
        Ok(out)
    }

    /// Parse a binary NRT score back into its sequence of bundles.
    /// Inverse of [`encode`](Self::encode).
    pub fn decode(bytes: &[u8]) -> Result<Self, CommandError> {
        let mut bundles = Vec::new();
        let mut pos = 0usize;
        while pos < bytes.len() {
            if bytes.len() - pos < 4 {
                return Err(CommandError::Nrt(format!(
                    "truncated length prefix at offset {pos}"
                )));
            }
            let len = u32::from_be_bytes([
                bytes[pos],
                bytes[pos + 1],
                bytes[pos + 2],
                bytes[pos + 3],
            ]) as usize;
            pos += 4;
            if bytes.len() - pos < len {
                return Err(CommandError::Nrt(format!(
                    "truncated bundle at offset {pos}: need {len} bytes"
                )));
            }
            let packet = rosc::decoder::decode_udp(&bytes[pos..pos + len])
                .map_err(|e| CommandError::Nrt(format!("decode: {e:?}")))?;
            match packet.1 {
                OscPacket::Bundle(b) => bundles.push(b),
                OscPacket::Message(_) => {
                    return Err(CommandError::Nrt(format!(
                        "expected bundle at offset {}, got a bare message",
                        pos - 4
                    )));
                }
            }
            pos += len;
        }
        Ok(Self { bundles })
    }

    /// Iterate the score's bundles.
    pub fn bundles(&self) -> &[OscBundle] {
        &self.bundles
    }
}

/// Convert a `seconds` offset into the OSC timetag scsynth expects for NRT
/// scheduling. For NRT, the server treats the timetag as a straight time
/// offset from the score's origin — the NTP epoch isn't involved.
fn seconds_to_osc_time(secs: f64) -> OscTime {
    let whole = secs.trunc();
    let frac = secs - whole;
    OscTime {
        seconds: whole as u32,
        fractional: (frac * 4_294_967_296.0) as u32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_score_encodes_to_empty_bytes() {
        assert_eq!(NrtScore::new().encode().unwrap().len(), 0);
    }

    #[test]
    fn round_trip_single_nrt_entry() {
        let score = NrtScore::new().at(1.5, OscMessage::new("/quit"));
        let bytes = score.encode().unwrap();
        assert!(bytes.len() > 4);
        let len = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
        assert_eq!(len, bytes.len() - 4);
        let back = NrtScore::decode(&bytes).unwrap();
        assert_eq!(back.len(), 1);
        assert_eq!(back.bundles()[0].timetag.seconds, 1);
    }

    #[test]
    fn round_trip_multiple_nrt_entries() {
        let score = NrtScore::new()
            .at(0.0, OscMessage::new("/g_new").arg(1001i32).arg(0i32).arg(0i32))
            .at(0.5, OscMessage::new("/s_new").arg("sine").arg(1002i32).arg(0i32).arg(1001i32))
            .at(2.0, OscMessage::new("/n_free").arg(1002i32));
        let back = NrtScore::decode(&score.encode().unwrap()).unwrap();
        assert_eq!(back.len(), 3);
    }
}
