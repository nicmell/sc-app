//! Parity harness: compile each fixture in `crates/scsynthdef-compiler/fixtures/`
//! with both our Rust compiler and `sclang`, byte-diff the results.
//!
//! Usage:
//!     cargo run --example sclang_parity
//!
//! If `sclang` is not on `$PATH`, the run is skipped with a clear message
//! (exit code 0).
//!
//! Expected outcome today:
//! - `sine` (1 param): byte-identical.
//! - `sc_test_recorder` (3 params): diverges on Control encoding. sclang groups
//!   all kr controls into a single Control UGen with N outputs, while our
//!   compiler emits one Control UGen per param (matching the TS compiler's
//!   convention). Harness reports the divergence honestly.
//! - `global_clock_phase` (0 params): should match apart from unrelated
//!   differences in UGen ordering (sclang may reorder for topological
//!   efficiency).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

use serde::Deserialize;

use scsynthdef_compiler::{compile_synthdef, UGenSpec};

#[derive(Debug, Deserialize)]
struct FixtureSpec {
    name: String,
    #[serde(default)]
    params: Vec<(String, f32)>,
    specs: Vec<UGenSpec>,
}

fn sclang_available() -> bool {
    Command::new("sclang")
        .arg("-v")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn rust_bytes(spec: &FixtureSpec) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    Ok(compile_synthdef(&spec.name, &spec.params, &spec.specs)?)
}

fn sclang_bytes(
    fixture_dir: &Path,
    spec: &FixtureSpec,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Copy the .scd into a fresh tempdir and run sclang there; the script's
    // `thisProcess.nowExecutingPath.dirname` resolves to the tempdir, so the
    // .scsyndef lands next to the script.
    let src = fixture_dir.join("sclang.scd");
    let tmp = std::env::temp_dir().join(format!(
        "sclang_parity_{}_{}",
        spec.name,
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp)?;
    let script = tmp.join("sclang.scd");
    fs::copy(&src, &script)?;

    let output = Command::new("sclang").arg(&script).output()?;
    let def_path = tmp.join(format!("{}.scsyndef", spec.name));
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

fn print_header() {
    println!("sclang parity harness");
    println!("=====================");
}

fn fixture_dirs() -> Result<Vec<PathBuf>, std::io::Error> {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let root = Path::new(manifest_dir).join("fixtures");
    let mut dirs = Vec::new();
    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() && entry.path().join("spec.json").exists() {
            dirs.push(entry.path());
        }
    }
    dirs.sort();
    Ok(dirs)
}

fn run() -> Result<ExitCode, Box<dyn std::error::Error>> {
    print_header();

    if !sclang_available() {
        println!("sclang not installed — skipped");
        return Ok(ExitCode::SUCCESS);
    }

    let dirs = fixture_dirs()?;
    if dirs.is_empty() {
        println!("no fixtures found — run `node scripts/dump_synthdef_fixtures.mjs` first");
        return Ok(ExitCode::FAILURE);
    }

    let mut mismatches = 0usize;

    for dir in dirs {
        let fixture_name = dir.file_name().unwrap().to_string_lossy().into_owned();
        println!("\n▸ {}", fixture_name);

        let raw = fs::read_to_string(dir.join("spec.json"))?;
        let spec: FixtureSpec = serde_json::from_str(&raw)?;

        let rust = match rust_bytes(&spec) {
            Ok(b) => b,
            Err(e) => {
                println!("  rust: compile failed: {e}");
                mismatches += 1;
                continue;
            }
        };

        let sclang = match sclang_bytes(&dir, &spec) {
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

        // Parse both byte streams into SynthDefJson for a structural summary.
        let rust_json = scgf_reader::parse(&rust).ok();
        match scgf_reader::parse(&sclang) {
            Ok(sclang_json) => {
                println!("  ── structural summary ──");
                println!(
                    "    rust   : {} ugens, {} constants, {} params",
                    rust_json.as_ref().map(|j| j.ugens.len()).unwrap_or(0),
                    rust_json.as_ref().map(|j| j.constants.len()).unwrap_or(0),
                    rust_json
                        .as_ref()
                        .map(|j| j.parameters.names.len())
                        .unwrap_or(0),
                );
                println!(
                    "    sclang : {} ugens, {} constants, {} params",
                    sclang_json.ugens.len(),
                    sclang_json.constants.len(),
                    sclang_json.parameters.names.len(),
                );
                let ugens_line = |j: &scsynthdef_compiler::SynthDefJson| {
                    j.ugens
                        .iter()
                        .map(|u| u.class_name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                };
                if let Some(j) = &rust_json {
                    println!("    rust   ugens: {}", ugens_line(j));
                }
                println!("    sclang ugens: {}", ugens_line(&sclang_json));
            }
            Err(e) => {
                println!("  (could not parse sclang bytes for structural diff: {e})");
            }
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

// ---------------------------------------------------------------------------
// Minimal SCgf v2 reader, used only to produce a structural diff when bytes
// differ. It builds a `SynthDefJson` compatible with the crate's own.
// ---------------------------------------------------------------------------

mod scgf_reader {
    use scsynthdef_compiler::{
        InputSpec, OutputSpec, ParamName, Parameters, SynthDefJson, UGenJson,
    };

    pub fn parse(bytes: &[u8]) -> Result<SynthDefJson, String> {
        let mut r = Reader { buf: bytes, pos: 0 };
        let magic = r.i32()?;
        if magic != 0x5343_6766 {
            return Err(format!("bad magic: {:#x}", magic));
        }
        let version = r.i32()?;
        if version != 2 {
            return Err(format!("unsupported version: {}", version));
        }
        let n_defs = r.i16()?;
        if n_defs != 1 {
            return Err(format!("expected 1 synthdef, got {}", n_defs));
        }
        let name = r.pstring()?;
        let nconst = r.i32()?;
        let mut constants = Vec::with_capacity(nconst.max(0) as usize);
        for _ in 0..nconst {
            constants.push(r.f32()?);
        }
        let nparams = r.i32()?;
        let mut values = Vec::with_capacity(nparams.max(0) as usize);
        for _ in 0..nparams {
            values.push(r.f32()?);
        }
        let nnames = r.i32()?;
        let mut names = Vec::with_capacity(nnames.max(0) as usize);
        for _ in 0..nnames {
            let nm = r.pstring()?;
            let idx = r.i32()?;
            names.push(ParamName {
                name: nm,
                index: idx as u32,
            });
        }
        let nugens = r.i32()?;
        let mut ugens = Vec::with_capacity(nugens.max(0) as usize);
        for _ in 0..nugens {
            let class_name = r.pstring()?;
            let rate = r.i8()?;
            let ninputs = r.i32()?;
            let nouts = r.i32()?;
            let special_index = r.i16()?;
            let mut inputs = Vec::with_capacity(ninputs.max(0) as usize);
            for _ in 0..ninputs {
                let u = r.i32()?;
                let o = r.i32()?;
                inputs.push(InputSpec {
                    ugen_index: u,
                    output_index: o as u32,
                });
            }
            let mut outputs = Vec::with_capacity(nouts.max(0) as usize);
            for _ in 0..nouts {
                outputs.push(OutputSpec { rate: r.i8()? });
            }
            ugens.push(UGenJson {
                class_name,
                rate,
                num_inputs: ninputs as u32,
                num_outputs: nouts as u32,
                special_index,
                inputs,
                outputs,
            });
        }
        // variants — ignored.
        Ok(SynthDefJson {
            name,
            constants,
            parameters: Parameters { values, names },
            ugens,
            variants: Vec::new(),
        })
    }

    struct Reader<'a> {
        buf: &'a [u8],
        pos: usize,
    }

    impl<'a> Reader<'a> {
        fn need(&self, n: usize) -> Result<(), String> {
            if self.pos + n > self.buf.len() {
                Err(format!(
                    "truncated: need {} bytes at offset {}",
                    n, self.pos
                ))
            } else {
                Ok(())
            }
        }
        fn i8(&mut self) -> Result<i8, String> {
            self.need(1)?;
            let v = self.buf[self.pos] as i8;
            self.pos += 1;
            Ok(v)
        }
        fn i16(&mut self) -> Result<i16, String> {
            self.need(2)?;
            let v = i16::from_be_bytes(self.buf[self.pos..self.pos + 2].try_into().unwrap());
            self.pos += 2;
            Ok(v)
        }
        fn i32(&mut self) -> Result<i32, String> {
            self.need(4)?;
            let v = i32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
            self.pos += 4;
            Ok(v)
        }
        fn f32(&mut self) -> Result<f32, String> {
            self.need(4)?;
            let v = f32::from_be_bytes(self.buf[self.pos..self.pos + 4].try_into().unwrap());
            self.pos += 4;
            Ok(v)
        }
        fn pstring(&mut self) -> Result<String, String> {
            self.need(1)?;
            let len = self.buf[self.pos] as usize;
            self.pos += 1;
            self.need(len)?;
            let s = std::str::from_utf8(&self.buf[self.pos..self.pos + len])
                .map_err(|e| e.to_string())?
                .to_string();
            self.pos += len;
            Ok(s)
        }
    }
}

