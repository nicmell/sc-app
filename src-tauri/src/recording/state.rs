use crate::ipc::buffer::{BufferSink, BufferStreamState, SubId};
use crate::recording::manager;
use std::fs::{File, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

/// Canonical RIFF/WAVE header size for a mono/stereo IEEE float file: RIFF
/// chunk descriptor (12) + `fmt ` subchunk (24) + `data` subchunk marker + size
/// (8) = 44 bytes.
const WAV_HEADER_BYTES: u64 = 44;

/// A `BufferSink` that (a) forwards ticks to an inner sink (WS or Tauri
/// Channel, for the live waveform) and (b) streams the same samples into a WAV
/// file on disk as IEEE float32 LE. The WAV header is patched with the final
/// sizes when the sink is dropped — which happens automatically when the
/// inner sink's connection closes and `BufferStreamState` evicts us.
pub struct RecordingSink {
    inner: Box<dyn BufferSink>,
    file: Option<File>,
    path: PathBuf,
    data_bytes: u32,
}

impl RecordingSink {
    fn finalise(&mut self) {
        let Some(mut file) = self.file.take() else { return };
        let data_bytes = self.data_bytes;
        let riff_size = data_bytes.saturating_add(36);
        if let Err(e) = file.seek(SeekFrom::Start(4))
            .and_then(|_| file.write_all(&riff_size.to_le_bytes()))
            .and_then(|_| file.seek(SeekFrom::Start(40)))
            .and_then(|_| file.write_all(&data_bytes.to_le_bytes()))
            .and_then(|_| file.flush())
        {
            eprintln!("record finalise {}: {e}", self.path.display());
        }
    }
}

impl BufferSink for RecordingSink {
    fn send(&mut self, tick: &[f32]) -> bool {
        if let Some(file) = &mut self.file {
            let mut buf = Vec::with_capacity(tick.len() * 4);
            for s in tick {
                buf.extend_from_slice(&s.to_le_bytes());
            }
            if let Err(e) = file.write_all(&buf) {
                eprintln!("record write {}: {e}", self.path.display());
                // Close the file so we don't keep logging; keep forwarding to
                // the inner sink so the live viz still works.
                self.file = None;
            } else {
                self.data_bytes = self.data_bytes.saturating_add(buf.len() as u32);
            }
        }
        self.inner.send(tick)
    }

    fn close(&mut self) {
        self.finalise();
        self.inner.close();
    }
}

impl Drop for RecordingSink {
    fn drop(&mut self) {
        self.finalise();
    }
}

/// Open the WAV file for `id`, write a placeholder header, wrap `inner_sink`
/// with a `RecordingSink`, and subscribe on `BufferStreamState`. Returns the
/// `SubId` the caller must unsubscribe to stop streaming.
pub async fn start_stream(
    data_dir: &Path,
    id: &str,
    bufnum: i32,
    frames: i32,
    chunk: i32,
    sample_rate: u32,
    channels: u16,
    scsynth_addr: &str,
    inner_sink: Box<dyn BufferSink>,
    buffer_state: &BufferStreamState,
) -> Result<SubId, String> {
    let path = manager::path_for(data_dir, id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create recordings dir: {e}"))?;
    }
    let file = open_wav_for_write(&path, sample_rate, channels)
        .map_err(|e| format!("open wav {}: {e}", path.display()))?;

    let recording_sink: Box<dyn BufferSink> = Box::new(RecordingSink {
        inner: inner_sink,
        file: Some(file),
        path,
        data_bytes: 0,
    });

    buffer_state
        .subscribe(
            bufnum,
            frames,
            chunk,
            sample_rate as i32,
            scsynth_addr,
            recording_sink,
        )
        .await
}

/// Creates (truncates) the file and writes a 44-byte RIFF/WAVE header with
/// placeholder RIFF + data sizes. Format is IEEE float32 (code 3), `channels`
/// channels, `sample_rate` Hz, 32-bit samples.
fn open_wav_for_write(path: &Path, sample_rate: u32, channels: u16) -> std::io::Result<File> {
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)?;

    let bytes_per_sample: u16 = 4;
    let block_align: u16 = channels * bytes_per_sample;
    let byte_rate: u32 = sample_rate * block_align as u32;

    let mut header = Vec::with_capacity(44);
    header.extend_from_slice(b"RIFF");
    header.extend_from_slice(&0u32.to_le_bytes()); // RIFF size (patched on finalise)
    header.extend_from_slice(b"WAVE");
    header.extend_from_slice(b"fmt ");
    header.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    header.extend_from_slice(&3u16.to_le_bytes());  // format = IEEE float
    header.extend_from_slice(&channels.to_le_bytes());
    header.extend_from_slice(&sample_rate.to_le_bytes());
    header.extend_from_slice(&byte_rate.to_le_bytes());
    header.extend_from_slice(&block_align.to_le_bytes());
    header.extend_from_slice(&(bytes_per_sample as u16 * 8).to_le_bytes()); // bits per sample
    header.extend_from_slice(b"data");
    header.extend_from_slice(&0u32.to_le_bytes()); // data size (patched on finalise)
    debug_assert_eq!(header.len() as u64, WAV_HEADER_BYTES);

    file.write_all(&header)?;
    Ok(file)
}
