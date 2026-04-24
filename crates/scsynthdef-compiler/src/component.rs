//! WebAssembly Component Model bindings (gated behind the `component`
//! Cargo feature). Implements the `scsynthdef:compiler/core` interface
//! from `wit/scsynthdef.wit`, backed by the same `SynthDef` builder the
//! native Rust API exposes.
//!
//! Build the component with `cargo component build --release --target
//! wasm32-wasip1 --features component`, then run `jco transpile` on
//! the resulting `.wasm` to generate JS/TS bindings.

#![allow(warnings)]

mod bindings {
    #![allow(warnings)]
    include!("bindings.rs");
}

#[path = "ugens_component.rs"]
mod ugens_component;

use std::cell::RefCell;

use bindings::exports::scsynthdef::compiler::core::{
    Guest as CoreGuest, GuestSynthDef, Rate as WitRate, UgenInput as WitUgenInput,
};

use crate::{CompileError, Rate, SynthDef, UGenInput};

type WitString = String;
type WitVec<T> = Vec<T>;

// ── Type mapping ────────────────────────────────────────────────────────

fn rate_from_wit(r: WitRate) -> Rate {
    match r {
        WitRate::Scalar => Rate::Scalar,
        WitRate::Control => Rate::Control,
        WitRate::Audio => Rate::Audio,
    }
}

fn ugen_input_from_wit(v: WitUgenInput) -> UGenInput {
    match v {
        WitUgenInput::Constant(c) => UGenInput::Constant(c),
        WitUgenInput::Ugen(i) => UGenInput::UGen(i),
        WitUgenInput::UgenOutput((i, o)) => UGenInput::UGenOutput(i, o),
    }
}

fn ugen_input_to_wit(v: UGenInput) -> WitUgenInput {
    match v {
        UGenInput::Constant(c) => WitUgenInput::Constant(c),
        UGenInput::UGen(i) => WitUgenInput::Ugen(i),
        UGenInput::UGenOutput(i, o) => WitUgenInput::UgenOutput((i, o)),
    }
}

fn err_string(e: CompileError) -> WitString {
    e.to_string().into()
}

// ── Component ──────────────────────────────────────────────────────────

struct Component;

impl CoreGuest for Component {
    type SynthDef = SynthDefResource;

    fn parse_scgf(bytes: WitVec<u8>) -> Result<WitString, WitString> {
        match crate::parse_scgf(&bytes) {
            Ok(json) => serde_json::to_string(&json)
                .map(Into::into)
                .map_err(|e| e.to_string().into()),
            Err(e) => Err(err_string(e)),
        }
    }

    fn registry_json() -> WitString {
        let grouped: Vec<(String, Vec<&_>)> = crate::ugens_by_category()
            .iter()
            .map(|(cat, slice)| (cat.to_string(), slice.iter().collect()))
            .collect();
        serde_json::to_string(&grouped).unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e))
    }
}

pub struct SynthDefResource {
    inner: RefCell<SynthDef>,
}

impl GuestSynthDef for SynthDefResource {
    fn new(name: WitString) -> Self {
        Self {
            inner: RefCell::new(SynthDef::new(name.as_str())),
        }
    }

    fn name(&self) -> WitString {
        self.inner.borrow().name().to_string().into()
    }

    fn add_control(
        &self,
        name: WitString,
        default: f32,
        rate: WitRate,
    ) -> Result<WitUgenInput, WitString> {
        self.inner
            .borrow_mut()
            .add_control(name.as_str(), default, rate_from_wit(rate))
            .map(ugen_input_to_wit)
            .map_err(err_string)
    }

    fn add_ugen(
        &self,
        class_name: WitString,
        rate: WitRate,
        inputs: WitVec<WitUgenInput>,
        num_outputs: u32,
        special_index: i16,
    ) -> u32 {
        let inputs: Vec<UGenInput> = inputs.into_iter().map(ugen_input_from_wit).collect();
        self.inner.borrow_mut().add_ugen(
            class_name.as_str(),
            rate_from_wit(rate),
            inputs,
            num_outputs,
            special_index,
        )
    }

    fn to_bytes(&self) -> Result<WitVec<u8>, WitString> {
        self.inner
            .borrow()
            .to_bytes()
            .map(Into::into)
            .map_err(err_string)
    }

    fn to_json(&self) -> Result<WitString, WitString> {
        let json = self.inner.borrow().to_json().map_err(err_string)?;
        serde_json::to_string(&json)
            .map(Into::into)
            .map_err(|e| e.to_string().into())
    }
}

bindings::export!(Component with_types_in bindings);
