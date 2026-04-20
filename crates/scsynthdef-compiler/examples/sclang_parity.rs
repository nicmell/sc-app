//! Parity harness: compile each fixture with our Rust compiler and with
//! sclang, byte-diff the results.
//!
//! Usage:
//!     cargo run --example sclang_parity
//!
//! Fixtures are defined inline below as Rust builders. Each fixture's SC
//! source lives alongside this example at
//! `crates/scsynthdef-compiler/fixtures/<name>.scd`.
//!
//! If `sclang` is not on `$PATH`, the run is skipped with a clear message
//! (exit code 0).

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

use scsynthdef_compiler::{compile_synthdef, SynthDef, UGenSpec};

// ── Fixture definitions ──────────────────────────────────────────────────
//
// Constants mirrored from src/constants/osc.ts — keep in sync by hand.
const PHASE_BUS: i32 = 1000;
const SHARED_FRAMES: i32 = 8192;
const CLOCK_TRIGGER_ID: i32 = 4242;

struct Fixture {
    /// Used both as the SynthDef name and to find `fixtures/<name>.scd`.
    name: &'static str,
    build: fn() -> Result<Vec<u8>, Box<dyn std::error::Error>>,
}

fn inputs<const N: usize>(pairs: [(&str, &str); N]) -> BTreeMap<String, String> {
    pairs
        .into_iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

fn spec(name: &str, ty: &str, rate: &str, inputs_map: BTreeMap<String, String>) -> UGenSpec {
    UGenSpec {
        name: name.to_string(),
        ugen_type: ty.to_string(),
        rate: rate.to_string(),
        inputs: inputs_map,
    }
}

/// Exemplar: `SinOsc.ar(freq) → Out.ar(0, …)` with one kr param.
fn fixture_sine() -> Fixture {
    Fixture {
        name: "sine",
        build: || {
            let params = vec![("freq".to_string(), 440.0_f32)];
            let specs = vec![
                spec("osc", "SinOsc", "ar", inputs([("freq", "freq"), ("phase", "0")])),
                spec("out", "Out", "ar", inputs([("bus", "0"), ("channelsArray", "osc")])),
            ];
            Ok(compile_synthdef("sine", &params, &specs)?)
        },
    }
}

/// Mirrors `src/sc-elements/sc-test.ts` — `In + In + BufWr` with three kr params.
fn fixture_sc_test_recorder() -> Fixture {
    Fixture {
        name: "sc_test_recorder",
        build: || {
            let params = vec![
                ("bus".to_string(), 0.0_f32),
                ("bufnum".to_string(), 0.0_f32),
                ("phaseBus".to_string(), 0.0_f32),
            ];
            let specs = vec![
                spec("audio", "In", "ar", inputs([("bus", "bus"), ("numChannels", "1")])),
                spec("phase", "In", "ar", inputs([("bus", "phaseBus"), ("numChannels", "1")])),
                spec(
                    "write",
                    "BufWr",
                    "ar",
                    inputs([
                        ("inputArray", "audio"),
                        ("bufnum", "bufnum"),
                        ("phase", "phase"),
                        ("loop", "1"),
                    ]),
                ),
            ];
            Ok(compile_synthdef("__sc_test_rec__", &params, &specs)?)
        },
    }
}

/// Mirrors `src/lib/clock/globalClock.ts` — `Phasor + Out + A2K + Impulse +
/// SendTrig` with zero params.
fn fixture_global_clock_phase() -> Fixture {
    Fixture {
        name: "global_clock_phase",
        build: || {
            let specs = vec![
                spec(
                    "phase",
                    "Phasor",
                    "ar",
                    inputs([
                        ("trig", "0"),
                        ("rate", "1"),
                        ("start", "0"),
                        ("end", &SHARED_FRAMES.to_string()),
                        ("resetPos", "0"),
                    ]),
                ),
                spec(
                    "out",
                    "Out",
                    "ar",
                    inputs([
                        ("bus", &PHASE_BUS.to_string()),
                        ("channelsArray", "phase"),
                    ]),
                ),
                spec("pkr", "A2K", "kr", inputs([("in", "phase")])),
                spec(
                    "tick",
                    "Impulse",
                    "kr",
                    inputs([("freq", "10"), ("phase", "0")]),
                ),
                spec(
                    "reply",
                    "SendTrig",
                    "kr",
                    inputs([
                        ("in", "tick"),
                        ("id", &CLOCK_TRIGGER_ID.to_string()),
                        ("value", "pkr"),
                    ]),
                ),
            ];
            Ok(compile_synthdef("__global_clock__", &[], &specs)?)
        },
    }
}

fn fixtures() -> [Fixture; 3] {
    [
        fixture_global_clock_phase(),
        fixture_sc_test_recorder(),
        fixture_sine(),
    ]
}

// ── sclang invocation ────────────────────────────────────────────────────

fn sclang_available() -> bool {
    Command::new("sclang")
        .arg("-v")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn sclang_bytes(
    scd_path: &Path,
    synthdef_name: &str,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Copy the .scd into a fresh tempdir and run sclang there — the script's
    // `thisProcess.nowExecutingPath.dirname` resolves to the tempdir, so the
    // compiled `<name>.scsyndef` lands next to the script.
    let tmp = std::env::temp_dir().join(format!(
        "sclang_parity_{}_{}",
        synthdef_name,
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp)?;
    let script = tmp.join("sclang.scd");
    fs::copy(scd_path, &script)?;

    let output = Command::new("sclang").arg(&script).output()?;
    let def_path = tmp.join(format!("{synthdef_name}.scsyndef"));
    if !def_path.exists() {
        eprintln!(
            "    sclang did not produce {:?}\n    stdout:\n{}\n    stderr:\n{}",
            def_path,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr),
        );
        return Err("sclang produced no output".into());
    }
    let bytes = fs::read(&def_path)?;
    let _ = fs::remove_dir_all(&tmp);
    Ok(bytes)
}

// ── Diff helpers ─────────────────────────────────────────────────────────

fn find_mismatch(a: &[u8], b: &[u8]) -> Option<usize> {
    for (i, (x, y)) in a.iter().zip(b.iter()).enumerate() {
        if x != y {
            return Some(i);
        }
    }
    if a.len() != b.len() {
        Some(a.len().min(b.len()))
    } else {
        None
    }
}

fn hex_line(label: &str, bytes: &[u8], offset: usize, width: usize) -> String {
    let end = (offset + width).min(bytes.len());
    let slice = &bytes[offset..end];
    let hex: Vec<String> = slice.iter().map(|b| format!("{:02x}", b)).collect();
    format!("  {:8} @ {:#06x}  {}", label, offset, hex.join(" "))
}

fn dump_diff_context(rust: &[u8], sclang: &[u8], offset: usize) {
    let window = 24usize;
    let start = offset.saturating_sub(4);
    println!("{}", hex_line("rust", rust, start, window));
    println!("{}", hex_line("sclang", sclang, start, window));
}

fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures")
}

// ── Main loop ────────────────────────────────────────────────────────────

fn run() -> Result<ExitCode, Box<dyn std::error::Error>> {
    println!("sclang parity harness");
    println!("=====================");

    if !sclang_available() {
        println!("sclang not installed — skipped");
        return Ok(ExitCode::SUCCESS);
    }

    let dir = fixtures_dir();
    let mut mismatches = 0usize;

    for fx in fixtures() {
        println!("\n▸ {}", fx.name);
        let scd_path = dir.join(format!("{}.scd", fx.name));
        if !scd_path.exists() {
            println!("  (missing {}.scd — skipped)", fx.name);
            mismatches += 1;
            continue;
        }

        let rust = (fx.build)()?;

        // sclang uses the SynthDef's own name (not the fixture file name) to
        // find the emitted `.scsyndef`. Grab that from the Rust-compiled
        // bytes to avoid hand-maintaining a second name.
        let synthdef_name = SynthDef::from_bytes(&rust)?.name().to_string();

        let sclang = match sclang_bytes(&scd_path, &synthdef_name) {
            Ok(b) => b,
            Err(e) => {
                println!("  sclang: {e}");
                mismatches += 1;
                continue;
            }
        };

        if rust == sclang {
            println!("  ✓ byte-identical ({} bytes)", rust.len());
            continue;
        }

        mismatches += 1;
        println!(
            "  ✗ diverged (rust: {} bytes, sclang: {} bytes)",
            rust.len(),
            sclang.len()
        );
        if let Some(off) = find_mismatch(&rust, &sclang) {
            println!("  first mismatch at offset {:#06x}:", off);
            dump_diff_context(&rust, &sclang, off);
        }

        // Structural summary using the library's SCgf reader.
        let rust_json = SynthDef::from_bytes(&rust).ok().and_then(|d| d.to_json().ok());
        match SynthDef::from_bytes(&sclang).and_then(|d| d.to_json()) {
            Ok(sclang_json) => {
                let names = |j: &scsynthdef_compiler::SynthDefJson| {
                    j.ugens
                        .iter()
                        .map(|u| u.class_name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                };
                println!("  ── structural summary ──");
                if let Some(j) = &rust_json {
                    println!(
                        "    rust   : {} ugens, {} constants, {} params",
                        j.ugens.len(),
                        j.constants.len(),
                        j.parameters.names.len()
                    );
                    println!("    rust   ugens: {}", names(j));
                }
                println!(
                    "    sclang : {} ugens, {} constants, {} params",
                    sclang_json.ugens.len(),
                    sclang_json.constants.len(),
                    sclang_json.parameters.names.len()
                );
                println!("    sclang ugens: {}", names(&sclang_json));
            }
            Err(e) => println!("  (could not parse sclang bytes: {e})"),
        }
    }

    println!();
    if mismatches == 0 {
        println!("all fixtures matched");
        Ok(ExitCode::SUCCESS)
    } else {
        println!("{} fixture(s) diverged", mismatches);
        Ok(ExitCode::FAILURE)
    }
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
