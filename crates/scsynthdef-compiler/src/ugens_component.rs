// @generated — DO NOT EDIT. Regenerate via scripts/generate_ugens_component.mjs
//
// Implements the typed `ugens` WIT interface. Each method is a thin
// shim that appends a UGen node to the borrowed SynthDef via the
// shared `delegate_ugen` helper. The canonical PascalCase class name
// for each UGen is baked in at generation time, pulled from the
// `pub struct` declarations under src/builders/.

#![allow(warnings)]

use super::bindings;
use super::bindings::exports::scsynthdef::compiler::ugens::{
    Guest as UgensGuest, Rate as WitRate,
    SynthDefBorrow, UgenInput as WitUgenInput,
};
use super::{Component, SynthDefResource, rate_from_wit, ugen_input_from_wit, ugen_input_to_wit};
use crate::UGenInput;

/// Shared body for every typed ugen shim. Appends a UGen node to the
/// borrowed SynthDef and returns its synth-index wrapped as a
/// `UgenInput::Ugen(...)`. `num_outputs` defaults to the value from
/// the bundled registry for the given class, unless a caller has
/// passed an explicit override (for `num-channels` UGens).
fn delegate_ugen(
    def: SynthDefBorrow<'_>,
    class_name: &'static str,
    ugen_rate: WitRate,
    inputs: Vec<UGenInput>,
    num_outputs_override: Option<u32>,
) -> WitUgenInput {
    let num_outputs = num_outputs_override.unwrap_or_else(|| {
        crate::registry::lookup_ugen(class_name)
            .and_then(|e| e.num_outputs)
            .unwrap_or(1)
    });
    let idx = def.get::<SynthDefResource>().inner.borrow_mut().add_ugen(
        class_name,
        rate_from_wit(ugen_rate),
        inputs,
        num_outputs,
        0,
    );
    WitUgenInput::Ugen(idx)
}

impl UgensGuest for Component {
    fn registry_json() -> String {
        let grouped: Vec<(String, Vec<&_>)> = crate::registry::ugens_by_category()
            .iter()
            .map(|(cat, slice)| (cat.to_string(), slice.iter().collect()))
            .collect();
        serde_json::to_string(&grouped)
            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e))
    }

    fn a2_k(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "A2K", ugen_rate, inputs, None)
    }

    fn apf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, radius: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(radius)];
        delegate_ugen(def, "APF", ugen_rate, inputs, None)
    }

    fn allpass_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "AllpassC", ugen_rate, inputs, None)
    }

    fn allpass_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "AllpassL", ugen_rate, inputs, None)
    }

    fn allpass_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "AllpassN", ugen_rate, inputs, None)
    }

    fn amp_comp(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, root: WitUgenInput, exp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(root), ugen_input_from_wit(exp)];
        delegate_ugen(def, "AmpComp", ugen_rate, inputs, None)
    }

    fn amp_comp_a(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, root: WitUgenInput, min_amp: WitUgenInput, root_amp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(root), ugen_input_from_wit(min_amp), ugen_input_from_wit(root_amp)];
        delegate_ugen(def, "AmpCompA", ugen_rate, inputs, None)
    }

    fn amplitude(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, attack_time: WitUgenInput, release_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(attack_time), ugen_input_from_wit(release_time)];
        delegate_ugen(def, "Amplitude", ugen_rate, inputs, None)
    }

    fn b_all_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "BAllPass", ugen_rate, inputs, None)
    }

    fn b_band_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, bw: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(bw)];
        delegate_ugen(def, "BBandPass", ugen_rate, inputs, None)
    }

    fn b_band_stop(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, bw: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(bw)];
        delegate_ugen(def, "BBandStop", ugen_rate, inputs, None)
    }

    fn b_hi_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "BHiPass", ugen_rate, inputs, None)
    }

    fn b_hi_shelf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rs: WitUgenInput, db: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rs), ugen_input_from_wit(db)];
        delegate_ugen(def, "BHiShelf", ugen_rate, inputs, None)
    }

    fn b_low_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "BLowPass", ugen_rate, inputs, None)
    }

    fn b_low_shelf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rs: WitUgenInput, db: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rs), ugen_input_from_wit(db)];
        delegate_ugen(def, "BLowShelf", ugen_rate, inputs, None)
    }

    fn bpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "BPF", ugen_rate, inputs, None)
    }

    fn bpz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "BPZ2", ugen_rate, inputs, None)
    }

    fn b_peak_eq(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput, db: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq), ugen_input_from_wit(db)];
        delegate_ugen(def, "BPeakEQ", ugen_rate, inputs, None)
    }

    fn brf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "BRF", ugen_rate, inputs, None)
    }

    fn brz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "BRZ2", ugen_rate, inputs, None)
    }

    fn balance2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, left: WitUgenInput, right: WitUgenInput, pos: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(left), ugen_input_from_wit(right), ugen_input_from_wit(pos), ugen_input_from_wit(level)];
        delegate_ugen(def, "Balance2", ugen_rate, inputs, None)
    }

    fn ball(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, g: WitUgenInput, damp: WitUgenInput, friction: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(g), ugen_input_from_wit(damp), ugen_input_from_wit(friction)];
        delegate_ugen(def, "Ball", ugen_rate, inputs, None)
    }

    fn beat_track(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, lock: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(lock)];
        delegate_ugen(def, "BeatTrack", ugen_rate, inputs, None)
    }

    fn beat_track2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, busindex: WitUgenInput, numfeatures: WitUgenInput, windowsize: WitUgenInput, phaseaccuracy: WitUgenInput, lock: WitUgenInput, weightingscheme: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(busindex), ugen_input_from_wit(numfeatures), ugen_input_from_wit(windowsize), ugen_input_from_wit(phaseaccuracy), ugen_input_from_wit(lock), ugen_input_from_wit(weightingscheme)];
        delegate_ugen(def, "BeatTrack2", ugen_rate, inputs, None)
    }

    fn bi_pan_b2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_a: WitUgenInput, in_b: WitUgenInput, azimuth: WitUgenInput, gain: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_a), ugen_input_from_wit(in_b), ugen_input_from_wit(azimuth), ugen_input_from_wit(gain)];
        delegate_ugen(def, "BiPanB2", ugen_rate, inputs, None)
    }

    fn blip(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, numharm: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(numharm)];
        delegate_ugen(def, "Blip", ugen_rate, inputs, None)
    }

    fn brown_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "BrownNoise", ugen_rate, inputs, None)
    }

    fn buf_allpass_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "BufAllpassC", ugen_rate, inputs, None)
    }

    fn buf_allpass_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "BufAllpassL", ugen_rate, inputs, None)
    }

    fn buf_allpass_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "BufAllpassN", ugen_rate, inputs, None)
    }

    fn buf_channels(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "BufChannels", ugen_rate, inputs, None)
    }

    fn buf_comb_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "BufCombC", ugen_rate, inputs, None)
    }

    fn buf_comb_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "BufCombL", ugen_rate, inputs, None)
    }

    fn buf_comb_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "BufCombN", ugen_rate, inputs, None)
    }

    fn buf_delay_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time)];
        delegate_ugen(def, "BufDelayC", ugen_rate, inputs, None)
    }

    fn buf_delay_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time)];
        delegate_ugen(def, "BufDelayL", ugen_rate, inputs, None)
    }

    fn buf_delay_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, in_: WitUgenInput, delay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(in_), ugen_input_from_wit(delay_time)];
        delegate_ugen(def, "BufDelayN", ugen_rate, inputs, None)
    }

    fn buf_dur(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "BufDur", ugen_rate, inputs, None)
    }

    fn buf_frames(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "BufFrames", ugen_rate, inputs, None)
    }

    fn buf_rate_scale(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "BufRateScale", ugen_rate, inputs, None)
    }

    fn buf_rd(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, bufnum: WitUgenInput, phase: WitUgenInput, loop_: WitUgenInput, interpolation: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(phase), ugen_input_from_wit(loop_), ugen_input_from_wit(interpolation)];
        delegate_ugen(def, "BufRd", ugen_rate, inputs, Some(num_channels))
    }

    fn buf_sample_rate(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "BufSampleRate", ugen_rate, inputs, None)
    }

    fn buf_samples(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "BufSamples", ugen_rate, inputs, None)
    }

    fn buf_wr(def: SynthDefBorrow<'_>, ugen_rate: WitRate, input_array: Vec<WitUgenInput>, bufnum: WitUgenInput, phase: WitUgenInput, loop_: WitUgenInput) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array.into_iter().map(ugen_input_from_wit));
        inputs.push(ugen_input_from_wit(bufnum));
        inputs.push(ugen_input_from_wit(phase));
        inputs.push(ugen_input_from_wit(loop_));
        delegate_ugen(def, "BufWr", ugen_rate, inputs, None)
    }

    fn c_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, freq: WitUgenInput, beats: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(freq), ugen_input_from_wit(beats)];
        delegate_ugen(def, "COsc", ugen_rate, inputs, None)
    }

    fn check_bad_values(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, id: WitUgenInput, post: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(id), ugen_input_from_wit(post)];
        delegate_ugen(def, "CheckBadValues", ugen_rate, inputs, None)
    }

    fn clear_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf)];
        delegate_ugen(def, "ClearBuf", ugen_rate, inputs, None)
    }

    fn clip(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Clip", ugen_rate, inputs, None)
    }

    fn clip_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "ClipNoise", ugen_rate, inputs, None)
    }

    fn coin_gate(def: SynthDefBorrow<'_>, ugen_rate: WitRate, prob: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(prob), ugen_input_from_wit(trig)];
        delegate_ugen(def, "CoinGate", ugen_rate, inputs, None)
    }

    fn comb_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "CombC", ugen_rate, inputs, None)
    }

    fn comb_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "CombL", ugen_rate, inputs, None)
    }

    fn comb_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "CombN", ugen_rate, inputs, None)
    }

    fn compander(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, control: WitUgenInput, thresh: WitUgenInput, slope_below: WitUgenInput, slope_above: WitUgenInput, clamp_time: WitUgenInput, relax_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(control), ugen_input_from_wit(thresh), ugen_input_from_wit(slope_below), ugen_input_from_wit(slope_above), ugen_input_from_wit(clamp_time), ugen_input_from_wit(relax_time)];
        delegate_ugen(def, "Compander", ugen_rate, inputs, None)
    }

    fn control_dur(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "ControlDur", ugen_rate, inputs, None)
    }

    fn control_rate(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "ControlRate", ugen_rate, inputs, None)
    }

    fn convolution(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, kernel: WitUgenInput, framesize: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(kernel), ugen_input_from_wit(framesize)];
        delegate_ugen(def, "Convolution", ugen_rate, inputs, None)
    }

    fn convolution2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, kernel: WitUgenInput, trigger: WitUgenInput, framesize: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(kernel), ugen_input_from_wit(trigger), ugen_input_from_wit(framesize)];
        delegate_ugen(def, "Convolution2", ugen_rate, inputs, None)
    }

    fn convolution2_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, kernel: WitUgenInput, trigger: WitUgenInput, framesize: WitUgenInput, crossfade: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(kernel), ugen_input_from_wit(trigger), ugen_input_from_wit(framesize), ugen_input_from_wit(crossfade)];
        delegate_ugen(def, "Convolution2L", ugen_rate, inputs, None)
    }

    fn convolution3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, kernel: WitUgenInput, trigger: WitUgenInput, framesize: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(kernel), ugen_input_from_wit(trigger), ugen_input_from_wit(framesize)];
        delegate_ugen(def, "Convolution3", ugen_rate, inputs, None)
    }

    fn crackle(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chaos_param: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chaos_param)];
        delegate_ugen(def, "Crackle", ugen_rate, inputs, None)
    }

    fn cusp_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(xi)];
        delegate_ugen(def, "CuspL", ugen_rate, inputs, None)
    }

    fn cusp_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(xi)];
        delegate_ugen(def, "CuspN", ugen_rate, inputs, None)
    }

    fn dc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "DC", ugen_rate, inputs, None)
    }

    fn dbrown(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput, step: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(step)];
        delegate_ugen(def, "Dbrown", ugen_rate, inputs, None)
    }

    fn dbufrd(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, phase: WitUgenInput, loop_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(phase), ugen_input_from_wit(loop_)];
        delegate_ugen(def, "Dbufrd", ugen_rate, inputs, None)
    }

    fn dbufwr(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, phase: WitUgenInput, input: WitUgenInput, loop_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(phase), ugen_input_from_wit(input), ugen_input_from_wit(loop_)];
        delegate_ugen(def, "Dbufwr", ugen_rate, inputs, None)
    }

    fn decay(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "Decay", ugen_rate, inputs, None)
    }

    fn decay2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, attack_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(attack_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "Decay2", ugen_rate, inputs, None)
    }

    fn decode_b2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, w: WitUgenInput, x: WitUgenInput, y: WitUgenInput, orientation: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(w), ugen_input_from_wit(x), ugen_input_from_wit(y), ugen_input_from_wit(orientation)];
        delegate_ugen(def, "DecodeB2", ugen_rate, inputs, Some(num_channels))
    }

    fn degree_to_key(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, in_: WitUgenInput, octave: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(in_), ugen_input_from_wit(octave)];
        delegate_ugen(def, "DegreeToKey", ugen_rate, inputs, None)
    }

    fn del_tap_rd(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, phase: WitUgenInput, delay: WitUgenInput, interp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(phase), ugen_input_from_wit(delay), ugen_input_from_wit(interp)];
        delegate_ugen(def, "DelTapRd", ugen_rate, inputs, None)
    }

    fn del_tap_wr(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(in_)];
        delegate_ugen(def, "DelTapWr", ugen_rate, inputs, None)
    }

    fn delay1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "Delay1", ugen_rate, inputs, None)
    }

    fn delay2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "Delay2", ugen_rate, inputs, None)
    }

    fn delay_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time)];
        delegate_ugen(def, "DelayC", ugen_rate, inputs, None)
    }

    fn delay_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time)];
        delegate_ugen(def, "DelayL", ugen_rate, inputs, None)
    }

    fn delay_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, max_delay_time: WitUgenInput, delay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(max_delay_time), ugen_input_from_wit(delay_time)];
        delegate_ugen(def, "DelayN", ugen_rate, inputs, None)
    }

    fn demand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, reset: WitUgenInput, demand_ugens: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(reset), ugen_input_from_wit(demand_ugens)];
        delegate_ugen(def, "Demand", ugen_rate, inputs, None)
    }

    fn demand_env_gen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, level: WitUgenInput, dur: WitUgenInput, shape: WitUgenInput, curve: WitUgenInput, gate: WitUgenInput, reset: WitUgenInput, level_scale: WitUgenInput, level_bias: WitUgenInput, time_scale: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(level), ugen_input_from_wit(dur), ugen_input_from_wit(shape), ugen_input_from_wit(curve), ugen_input_from_wit(gate), ugen_input_from_wit(reset), ugen_input_from_wit(level_scale), ugen_input_from_wit(level_bias), ugen_input_from_wit(time_scale), ugen_input_from_wit(action)];
        delegate_ugen(def, "DemandEnvGen", ugen_rate, inputs, None)
    }

    fn detect_index(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(in_)];
        delegate_ugen(def, "DetectIndex", ugen_rate, inputs, None)
    }

    fn detect_silence(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, amp: WitUgenInput, time: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(amp), ugen_input_from_wit(time), ugen_input_from_wit(action)];
        delegate_ugen(def, "DetectSilence", ugen_rate, inputs, None)
    }

    fn dgeom(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, start: WitUgenInput, grow: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(start), ugen_input_from_wit(grow)];
        delegate_ugen(def, "Dgeom", ugen_rate, inputs, None)
    }

    fn dibrown(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput, step: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(step)];
        delegate_ugen(def, "Dibrown", ugen_rate, inputs, None)
    }

    fn disk_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, bufnum: WitUgenInput, loop_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(loop_)];
        delegate_ugen(def, "DiskIn", ugen_rate, inputs, Some(num_channels))
    }

    fn disk_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(bufnum));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "DiskOut", ugen_rate, inputs, None)
    }

    fn diwhite(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Diwhite", ugen_rate, inputs, None)
    }

    fn donce(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "Donce", ugen_rate, inputs, None)
    }

    fn done(def: SynthDefBorrow<'_>, ugen_rate: WitRate, src: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(src)];
        delegate_ugen(def, "Done", ugen_rate, inputs, None)
    }

    fn dpoll(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, trig_id: WitUgenInput, label: WitUgenInput, run: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(trig_id), ugen_input_from_wit(label), ugen_input_from_wit(run)];
        delegate_ugen(def, "Dpoll", ugen_rate, inputs, None)
    }

    fn drand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, num_repeats: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(num_repeats)];
        delegate_ugen(def, "Drand", ugen_rate, inputs, None)
    }

    fn dseq(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, num_repeats: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(num_repeats)];
        delegate_ugen(def, "Dseq", ugen_rate, inputs, None)
    }

    fn dser(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, count: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(count)];
        delegate_ugen(def, "Dser", ugen_rate, inputs, None)
    }

    fn dseries(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, start: WitUgenInput, step: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(start), ugen_input_from_wit(step)];
        delegate_ugen(def, "Dseries", ugen_rate, inputs, None)
    }

    fn dshuf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, num_repeats: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(num_repeats)];
        delegate_ugen(def, "Dshuf", ugen_rate, inputs, None)
    }

    fn dstutter(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_repeats: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(num_repeats), ugen_input_from_wit(in_)];
        delegate_ugen(def, "Dstutter", ugen_rate, inputs, None)
    }

    fn dswitch(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, index: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(index)];
        delegate_ugen(def, "Dswitch", ugen_rate, inputs, None)
    }

    fn dswitch1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, index: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(index)];
        delegate_ugen(def, "Dswitch1", ugen_rate, inputs, None)
    }

    fn dust(def: SynthDefBorrow<'_>, ugen_rate: WitRate, density: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(density)];
        delegate_ugen(def, "Dust", ugen_rate, inputs, None)
    }

    fn dust2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, density: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(density)];
        delegate_ugen(def, "Dust2", ugen_rate, inputs, None)
    }

    fn duty(def: SynthDefBorrow<'_>, ugen_rate: WitRate, dur: WitUgenInput, reset: WitUgenInput, action: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(dur), ugen_input_from_wit(reset), ugen_input_from_wit(action), ugen_input_from_wit(level)];
        delegate_ugen(def, "Duty", ugen_rate, inputs, None)
    }

    fn dwhite(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Dwhite", ugen_rate, inputs, None)
    }

    fn dxrand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, list: WitUgenInput, num_repeats: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(list), ugen_input_from_wit(num_repeats)];
        delegate_ugen(def, "Dxrand", ugen_rate, inputs, None)
    }

    fn env_gen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, envelope: WitUgenInput, gate: WitUgenInput, level_scale: WitUgenInput, level_bias: WitUgenInput, time_scale: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(envelope), ugen_input_from_wit(gate), ugen_input_from_wit(level_scale), ugen_input_from_wit(level_bias), ugen_input_from_wit(time_scale), ugen_input_from_wit(action)];
        delegate_ugen(def, "EnvGen", ugen_rate, inputs, None)
    }

    fn exp_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "ExpRand", ugen_rate, inputs, None)
    }

    fn fb_sine_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, im: WitUgenInput, fb: WitUgenInput, a: WitUgenInput, c: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(im), ugen_input_from_wit(fb), ugen_input_from_wit(a), ugen_input_from_wit(c), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "FBSineC", ugen_rate, inputs, None)
    }

    fn fb_sine_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, im: WitUgenInput, fb: WitUgenInput, a: WitUgenInput, c: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(im), ugen_input_from_wit(fb), ugen_input_from_wit(a), ugen_input_from_wit(c), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "FBSineL", ugen_rate, inputs, None)
    }

    fn fb_sine_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, im: WitUgenInput, fb: WitUgenInput, a: WitUgenInput, c: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(im), ugen_input_from_wit(fb), ugen_input_from_wit(a), ugen_input_from_wit(c), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "FBSineN", ugen_rate, inputs, None)
    }

    fn fft(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, in_: WitUgenInput, hop: WitUgenInput, wintype: WitUgenInput, active: WitUgenInput, winsize: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(in_), ugen_input_from_wit(hop), ugen_input_from_wit(wintype), ugen_input_from_wit(active), ugen_input_from_wit(winsize)];
        delegate_ugen(def, "FFT", ugen_rate, inputs, None)
    }

    fn fft_trigger(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, hop: WitUgenInput, polar: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(hop), ugen_input_from_wit(polar)];
        delegate_ugen(def, "FFTTrigger", ugen_rate, inputs, None)
    }

    fn fos(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, a0: WitUgenInput, a1: WitUgenInput, b1: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(a0), ugen_input_from_wit(a1), ugen_input_from_wit(b1)];
        delegate_ugen(def, "FOS", ugen_rate, inputs, None)
    }

    fn f_sin_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase)];
        delegate_ugen(def, "FSinOsc", ugen_rate, inputs, None)
    }

    fn fold(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Fold", ugen_rate, inputs, None)
    }

    fn formant(def: SynthDefBorrow<'_>, ugen_rate: WitRate, fundfreq: WitUgenInput, formfreq: WitUgenInput, bwfreq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(fundfreq), ugen_input_from_wit(formfreq), ugen_input_from_wit(bwfreq)];
        delegate_ugen(def, "Formant", ugen_rate, inputs, None)
    }

    fn formlet(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, attack_time: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(attack_time), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "Formlet", ugen_rate, inputs, None)
    }

    fn free(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, id: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(id)];
        delegate_ugen(def, "Free", ugen_rate, inputs, None)
    }

    fn free_self(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "FreeSelf", ugen_rate, inputs, None)
    }

    fn free_self_when_done(def: SynthDefBorrow<'_>, ugen_rate: WitRate, src: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(src)];
        delegate_ugen(def, "FreeSelfWhenDone", ugen_rate, inputs, None)
    }

    fn free_verb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, mix: WitUgenInput, room: WitUgenInput, damp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(mix), ugen_input_from_wit(room), ugen_input_from_wit(damp)];
        delegate_ugen(def, "FreeVerb", ugen_rate, inputs, None)
    }

    fn free_verb2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, in2: WitUgenInput, mix: WitUgenInput, room: WitUgenInput, damp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(in2), ugen_input_from_wit(mix), ugen_input_from_wit(room), ugen_input_from_wit(damp)];
        delegate_ugen(def, "FreeVerb2", ugen_rate, inputs, None)
    }

    fn freq_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, phase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(phase)];
        delegate_ugen(def, "FreqShift", ugen_rate, inputs, None)
    }

    fn g_verb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, roomsize: WitUgenInput, revtime: WitUgenInput, damping: WitUgenInput, inputbw: WitUgenInput, spread: WitUgenInput, drylevel: WitUgenInput, earlyreflevel: WitUgenInput, taillevel: WitUgenInput, maxroomsize: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(roomsize), ugen_input_from_wit(revtime), ugen_input_from_wit(damping), ugen_input_from_wit(inputbw), ugen_input_from_wit(spread), ugen_input_from_wit(drylevel), ugen_input_from_wit(earlyreflevel), ugen_input_from_wit(taillevel), ugen_input_from_wit(maxroomsize)];
        delegate_ugen(def, "GVerb", ugen_rate, inputs, None)
    }

    fn gate(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(trig)];
        delegate_ugen(def, "Gate", ugen_rate, inputs, None)
    }

    fn gbman_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "GbmanL", ugen_rate, inputs, None)
    }

    fn gbman_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "GbmanN", ugen_rate, inputs, None)
    }

    fn gendy1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, ampdist: WitUgenInput, durdist: WitUgenInput, adparam: WitUgenInput, ddparam: WitUgenInput, minfreq: WitUgenInput, maxfreq: WitUgenInput, ampscale: WitUgenInput, durscale: WitUgenInput, init_cps: WitUgenInput, knum: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(ampdist), ugen_input_from_wit(durdist), ugen_input_from_wit(adparam), ugen_input_from_wit(ddparam), ugen_input_from_wit(minfreq), ugen_input_from_wit(maxfreq), ugen_input_from_wit(ampscale), ugen_input_from_wit(durscale), ugen_input_from_wit(init_cps), ugen_input_from_wit(knum)];
        delegate_ugen(def, "Gendy1", ugen_rate, inputs, None)
    }

    fn gendy2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, ampdist: WitUgenInput, durdist: WitUgenInput, adparam: WitUgenInput, ddparam: WitUgenInput, minfreq: WitUgenInput, maxfreq: WitUgenInput, ampscale: WitUgenInput, durscale: WitUgenInput, init_cps: WitUgenInput, knum: WitUgenInput, a: WitUgenInput, c: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(ampdist), ugen_input_from_wit(durdist), ugen_input_from_wit(adparam), ugen_input_from_wit(ddparam), ugen_input_from_wit(minfreq), ugen_input_from_wit(maxfreq), ugen_input_from_wit(ampscale), ugen_input_from_wit(durscale), ugen_input_from_wit(init_cps), ugen_input_from_wit(knum), ugen_input_from_wit(a), ugen_input_from_wit(c)];
        delegate_ugen(def, "Gendy2", ugen_rate, inputs, None)
    }

    fn gendy3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, ampdist: WitUgenInput, durdist: WitUgenInput, adparam: WitUgenInput, ddparam: WitUgenInput, freq: WitUgenInput, ampscale: WitUgenInput, durscale: WitUgenInput, init_cps: WitUgenInput, knum: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(ampdist), ugen_input_from_wit(durdist), ugen_input_from_wit(adparam), ugen_input_from_wit(ddparam), ugen_input_from_wit(freq), ugen_input_from_wit(ampscale), ugen_input_from_wit(durscale), ugen_input_from_wit(init_cps), ugen_input_from_wit(knum)];
        delegate_ugen(def, "Gendy3", ugen_rate, inputs, None)
    }

    fn grain_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, trigger: WitUgenInput, dur: WitUgenInput, sndbuf: WitUgenInput, rate: WitUgenInput, pos: WitUgenInput, interp: WitUgenInput, pan: WitUgenInput, envbufnum: WitUgenInput, max_grains: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trigger), ugen_input_from_wit(dur), ugen_input_from_wit(sndbuf), ugen_input_from_wit(rate), ugen_input_from_wit(pos), ugen_input_from_wit(interp), ugen_input_from_wit(pan), ugen_input_from_wit(envbufnum), ugen_input_from_wit(max_grains)];
        delegate_ugen(def, "GrainBuf", ugen_rate, inputs, Some(num_channels))
    }

    fn grain_fm(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, trigger: WitUgenInput, dur: WitUgenInput, car_freq: WitUgenInput, mod_freq: WitUgenInput, index: WitUgenInput, pan: WitUgenInput, envbufnum: WitUgenInput, max_grains: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trigger), ugen_input_from_wit(dur), ugen_input_from_wit(car_freq), ugen_input_from_wit(mod_freq), ugen_input_from_wit(index), ugen_input_from_wit(pan), ugen_input_from_wit(envbufnum), ugen_input_from_wit(max_grains)];
        delegate_ugen(def, "GrainFM", ugen_rate, inputs, Some(num_channels))
    }

    fn grain_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, trigger: WitUgenInput, dur: WitUgenInput, in_: WitUgenInput, pan: WitUgenInput, envbufnum: WitUgenInput, max_grains: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trigger), ugen_input_from_wit(dur), ugen_input_from_wit(in_), ugen_input_from_wit(pan), ugen_input_from_wit(envbufnum), ugen_input_from_wit(max_grains)];
        delegate_ugen(def, "GrainIn", ugen_rate, inputs, Some(num_channels))
    }

    fn grain_sin(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, trigger: WitUgenInput, dur: WitUgenInput, freq: WitUgenInput, pan: WitUgenInput, envbufnum: WitUgenInput, max_grains: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trigger), ugen_input_from_wit(dur), ugen_input_from_wit(freq), ugen_input_from_wit(pan), ugen_input_from_wit(envbufnum), ugen_input_from_wit(max_grains)];
        delegate_ugen(def, "GrainSin", ugen_rate, inputs, Some(num_channels))
    }

    fn gray_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "GrayNoise", ugen_rate, inputs, None)
    }

    fn hpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq)];
        delegate_ugen(def, "HPF", ugen_rate, inputs, None)
    }

    fn hpz1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "HPZ1", ugen_rate, inputs, None)
    }

    fn hpz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "HPZ2", ugen_rate, inputs, None)
    }

    fn hasher(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "Hasher", ugen_rate, inputs, None)
    }

    fn henon_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, x0: WitUgenInput, x1: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(x0), ugen_input_from_wit(x1)];
        delegate_ugen(def, "HenonC", ugen_rate, inputs, None)
    }

    fn henon_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, x0: WitUgenInput, x1: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(x0), ugen_input_from_wit(x1)];
        delegate_ugen(def, "HenonL", ugen_rate, inputs, None)
    }

    fn henon_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, x0: WitUgenInput, x1: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(x0), ugen_input_from_wit(x1)];
        delegate_ugen(def, "HenonN", ugen_rate, inputs, None)
    }

    fn hilbert(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "Hilbert", ugen_rate, inputs, None)
    }

    fn i_env_gen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, ienvelope: WitUgenInput, index: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(ienvelope), ugen_input_from_wit(index)];
        delegate_ugen(def, "IEnvGen", ugen_rate, inputs, None)
    }

    fn ifft(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, wintype: WitUgenInput, winsize: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(wintype), ugen_input_from_wit(winsize)];
        delegate_ugen(def, "IFFT", ugen_rate, inputs, None)
    }

    fn i_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "IRand", ugen_rate, inputs, None)
    }

    fn impulse(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, phase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(phase)];
        delegate_ugen(def, "Impulse", ugen_rate, inputs, None)
    }

    fn in_(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, num_channels: u32) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bus)];
        delegate_ugen(def, "In", ugen_rate, inputs, Some(num_channels))
    }

    fn in_feedback(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, num_channels: u32) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bus)];
        delegate_ugen(def, "InFeedback", ugen_rate, inputs, Some(num_channels))
    }

    fn in_range(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "InRange", ugen_rate, inputs, None)
    }

    fn in_rect(def: SynthDefBorrow<'_>, ugen_rate: WitRate, x: WitUgenInput, y: WitUgenInput, left: WitUgenInput, top: WitUgenInput, right: WitUgenInput, bottom: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(x), ugen_input_from_wit(y), ugen_input_from_wit(left), ugen_input_from_wit(top), ugen_input_from_wit(right), ugen_input_from_wit(bottom)];
        delegate_ugen(def, "InRect", ugen_rate, inputs, None)
    }

    fn in_trig(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, num_channels: u32) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bus)];
        delegate_ugen(def, "InTrig", ugen_rate, inputs, Some(num_channels))
    }

    fn index(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(in_)];
        delegate_ugen(def, "Index", ugen_rate, inputs, None)
    }

    fn index_in_between(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(in_)];
        delegate_ugen(def, "IndexInBetween", ugen_rate, inputs, None)
    }

    fn integrator(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, coef: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(coef)];
        delegate_ugen(def, "Integrator", ugen_rate, inputs, None)
    }

    fn k2_a(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "K2A", ugen_rate, inputs, None)
    }

    fn key_state(def: SynthDefBorrow<'_>, ugen_rate: WitRate, keycode: WitUgenInput, minval: WitUgenInput, maxval: WitUgenInput, lag: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(keycode), ugen_input_from_wit(minval), ugen_input_from_wit(maxval), ugen_input_from_wit(lag)];
        delegate_ugen(def, "KeyState", ugen_rate, inputs, None)
    }

    fn key_track(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, keydecay: WitUgenInput, chromaleak: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(keydecay), ugen_input_from_wit(chromaleak)];
        delegate_ugen(def, "KeyTrack", ugen_rate, inputs, None)
    }

    fn klang(def: SynthDefBorrow<'_>, ugen_rate: WitRate, specs: WitUgenInput, freqscale: WitUgenInput, freqoffset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(specs), ugen_input_from_wit(freqscale), ugen_input_from_wit(freqoffset)];
        delegate_ugen(def, "Klang", ugen_rate, inputs, None)
    }

    fn klank(def: SynthDefBorrow<'_>, ugen_rate: WitRate, specs: WitUgenInput, input: WitUgenInput, freqscale: WitUgenInput, freqoffset: WitUgenInput, decayscale: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(specs), ugen_input_from_wit(input), ugen_input_from_wit(freqscale), ugen_input_from_wit(freqoffset), ugen_input_from_wit(decayscale)];
        delegate_ugen(def, "Klank", ugen_rate, inputs, None)
    }

    fn lf_clip_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFClipNoise", ugen_rate, inputs, None)
    }

    fn lf_cub(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase)];
        delegate_ugen(def, "LFCub", ugen_rate, inputs, None)
    }

    fn lfd_clip_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFDClipNoise", ugen_rate, inputs, None)
    }

    fn lfd_noise0(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFDNoise0", ugen_rate, inputs, None)
    }

    fn lfd_noise1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFDNoise1", ugen_rate, inputs, None)
    }

    fn lfd_noise3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFDNoise3", ugen_rate, inputs, None)
    }

    fn lf_gauss(def: SynthDefBorrow<'_>, ugen_rate: WitRate, duration: WitUgenInput, width: WitUgenInput, iphase: WitUgenInput, loop_: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(duration), ugen_input_from_wit(width), ugen_input_from_wit(iphase), ugen_input_from_wit(loop_), ugen_input_from_wit(action)];
        delegate_ugen(def, "LFGauss", ugen_rate, inputs, None)
    }

    fn lf_noise0(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFNoise0", ugen_rate, inputs, None)
    }

    fn lf_noise1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFNoise1", ugen_rate, inputs, None)
    }

    fn lf_noise2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "LFNoise2", ugen_rate, inputs, None)
    }

    fn lf_par(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase)];
        delegate_ugen(def, "LFPar", ugen_rate, inputs, None)
    }

    fn lf_pulse(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput, width: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase), ugen_input_from_wit(width)];
        delegate_ugen(def, "LFPulse", ugen_rate, inputs, None)
    }

    fn lf_saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase)];
        delegate_ugen(def, "LFSaw", ugen_rate, inputs, None)
    }

    fn lf_tri(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase)];
        delegate_ugen(def, "LFTri", ugen_rate, inputs, None)
    }

    fn lpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq)];
        delegate_ugen(def, "LPF", ugen_rate, inputs, None)
    }

    fn lpz1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "LPZ1", ugen_rate, inputs, None)
    }

    fn lpz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "LPZ2", ugen_rate, inputs, None)
    }

    fn lag(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time)];
        delegate_ugen(def, "Lag", ugen_rate, inputs, None)
    }

    fn lag2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time)];
        delegate_ugen(def, "Lag2", ugen_rate, inputs, None)
    }

    fn lag2_ud(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time_up: WitUgenInput, lag_time_down: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time_up), ugen_input_from_wit(lag_time_down)];
        delegate_ugen(def, "Lag2UD", ugen_rate, inputs, None)
    }

    fn lag3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time)];
        delegate_ugen(def, "Lag3", ugen_rate, inputs, None)
    }

    fn lag3_ud(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time_up: WitUgenInput, lag_time_down: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time_up), ugen_input_from_wit(lag_time_down)];
        delegate_ugen(def, "Lag3UD", ugen_rate, inputs, None)
    }

    fn lag_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, num_channels: u32, lag: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bus), ugen_input_from_wit(lag)];
        delegate_ugen(def, "LagIn", ugen_rate, inputs, Some(num_channels))
    }

    fn lag_ud(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time_up: WitUgenInput, lag_time_down: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time_up), ugen_input_from_wit(lag_time_down)];
        delegate_ugen(def, "LagUD", ugen_rate, inputs, None)
    }

    fn last_value(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, diff: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(diff)];
        delegate_ugen(def, "LastValue", ugen_rate, inputs, None)
    }

    fn latch(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(trig)];
        delegate_ugen(def, "Latch", ugen_rate, inputs, None)
    }

    fn latoocarfian_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, d: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(d), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "LatoocarfianC", ugen_rate, inputs, None)
    }

    fn latoocarfian_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, d: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(d), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "LatoocarfianL", ugen_rate, inputs, None)
    }

    fn latoocarfian_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, d: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(d), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "LatoocarfianN", ugen_rate, inputs, None)
    }

    fn leak_dc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, coef: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(coef)];
        delegate_ugen(def, "LeakDC", ugen_rate, inputs, None)
    }

    fn least_change(def: SynthDefBorrow<'_>, ugen_rate: WitRate, a: WitUgenInput, b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(a), ugen_input_from_wit(b)];
        delegate_ugen(def, "LeastChange", ugen_rate, inputs, None)
    }

    fn limiter(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, level: WitUgenInput, dur: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(level), ugen_input_from_wit(dur)];
        delegate_ugen(def, "Limiter", ugen_rate, inputs, None)
    }

    fn lin_cong_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, c: WitUgenInput, m: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(c), ugen_input_from_wit(m), ugen_input_from_wit(xi)];
        delegate_ugen(def, "LinCongC", ugen_rate, inputs, None)
    }

    fn lin_cong_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, c: WitUgenInput, m: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(c), ugen_input_from_wit(m), ugen_input_from_wit(xi)];
        delegate_ugen(def, "LinCongL", ugen_rate, inputs, None)
    }

    fn lin_cong_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, c: WitUgenInput, m: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(c), ugen_input_from_wit(m), ugen_input_from_wit(xi)];
        delegate_ugen(def, "LinCongN", ugen_rate, inputs, None)
    }

    fn lin_exp(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, srclo: WitUgenInput, srchi: WitUgenInput, dstlo: WitUgenInput, dsthi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(srclo), ugen_input_from_wit(srchi), ugen_input_from_wit(dstlo), ugen_input_from_wit(dsthi)];
        delegate_ugen(def, "LinExp", ugen_rate, inputs, None)
    }

    fn lin_pan2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, pos: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(pos), ugen_input_from_wit(level)];
        delegate_ugen(def, "LinPan2", ugen_rate, inputs, None)
    }

    fn lin_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput, minmax: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(minmax)];
        delegate_ugen(def, "LinRand", ugen_rate, inputs, None)
    }

    fn lin_x_fade2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_a: WitUgenInput, in_b: WitUgenInput, pan: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_a), ugen_input_from_wit(in_b), ugen_input_from_wit(pan), ugen_input_from_wit(level)];
        delegate_ugen(def, "LinXFade2", ugen_rate, inputs, None)
    }

    fn line(def: SynthDefBorrow<'_>, ugen_rate: WitRate, start: WitUgenInput, end: WitUgenInput, dur: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(start), ugen_input_from_wit(end), ugen_input_from_wit(dur), ugen_input_from_wit(action)];
        delegate_ugen(def, "Line", ugen_rate, inputs, None)
    }

    fn linen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, gate: WitUgenInput, attack_time: WitUgenInput, sus_level: WitUgenInput, release_time: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(gate), ugen_input_from_wit(attack_time), ugen_input_from_wit(sus_level), ugen_input_from_wit(release_time), ugen_input_from_wit(action)];
        delegate_ugen(def, "Linen", ugen_rate, inputs, None)
    }

    fn local_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, num_frames: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(num_frames)];
        delegate_ugen(def, "LocalBuf", ugen_rate, inputs, Some(num_channels))
    }

    fn local_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "LocalIn", ugen_rate, inputs, Some(num_channels))
    }

    fn local_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "LocalOut", ugen_rate, inputs, None)
    }

    fn logistic(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chaos_param: WitUgenInput, freq: WitUgenInput, init: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chaos_param), ugen_input_from_wit(freq), ugen_input_from_wit(init)];
        delegate_ugen(def, "Logistic", ugen_rate, inputs, None)
    }

    fn lorenz_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, s: WitUgenInput, r: WitUgenInput, b: WitUgenInput, h: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput, zi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(s), ugen_input_from_wit(r), ugen_input_from_wit(b), ugen_input_from_wit(h), ugen_input_from_wit(xi), ugen_input_from_wit(yi), ugen_input_from_wit(zi)];
        delegate_ugen(def, "LorenzL", ugen_rate, inputs, None)
    }

    fn loudness(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, smask: WitUgenInput, tmask: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(smask), ugen_input_from_wit(tmask)];
        delegate_ugen(def, "Loudness", ugen_rate, inputs, None)
    }

    fn mfcc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, numcoeff: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(numcoeff)];
        delegate_ugen(def, "MFCC", ugen_rate, inputs, None)
    }

    fn mantissa_mask(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, bits: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(bits)];
        delegate_ugen(def, "MantissaMask", ugen_rate, inputs, None)
    }

    fn max_local_bufs(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_local_bufs: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(num_local_bufs)];
        delegate_ugen(def, "MaxLocalBufs", ugen_rate, inputs, None)
    }

    fn median(def: SynthDefBorrow<'_>, ugen_rate: WitRate, length: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(length), ugen_input_from_wit(in_)];
        delegate_ugen(def, "Median", ugen_rate, inputs, None)
    }

    fn mid_eq(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput, db: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq), ugen_input_from_wit(db)];
        delegate_ugen(def, "MidEQ", ugen_rate, inputs, None)
    }

    fn moog_ff(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, gain: WitUgenInput, reset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(gain), ugen_input_from_wit(reset)];
        delegate_ugen(def, "MoogFF", ugen_rate, inputs, None)
    }

    fn most_change(def: SynthDefBorrow<'_>, ugen_rate: WitRate, a: WitUgenInput, b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(a), ugen_input_from_wit(b)];
        delegate_ugen(def, "MostChange", ugen_rate, inputs, None)
    }

    fn mouse_button(def: SynthDefBorrow<'_>, ugen_rate: WitRate, up: WitUgenInput, down: WitUgenInput, lag: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(up), ugen_input_from_wit(down), ugen_input_from_wit(lag)];
        delegate_ugen(def, "MouseButton", ugen_rate, inputs, None)
    }

    fn mouse_x(def: SynthDefBorrow<'_>, ugen_rate: WitRate, min: WitUgenInput, max: WitUgenInput, warp: WitUgenInput, lag: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(min), ugen_input_from_wit(max), ugen_input_from_wit(warp), ugen_input_from_wit(lag)];
        delegate_ugen(def, "MouseX", ugen_rate, inputs, None)
    }

    fn mouse_y(def: SynthDefBorrow<'_>, ugen_rate: WitRate, min: WitUgenInput, max: WitUgenInput, warp: WitUgenInput, lag: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(min), ugen_input_from_wit(max), ugen_input_from_wit(warp), ugen_input_from_wit(lag)];
        delegate_ugen(def, "MouseY", ugen_rate, inputs, None)
    }

    fn mul_add(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, mul: WitUgenInput, add: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(mul), ugen_input_from_wit(add)];
        delegate_ugen(def, "MulAdd", ugen_rate, inputs, None)
    }

    fn n_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput, n: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(n)];
        delegate_ugen(def, "NRand", ugen_rate, inputs, None)
    }

    fn normalizer(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, level: WitUgenInput, dur: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(level), ugen_input_from_wit(dur)];
        delegate_ugen(def, "Normalizer", ugen_rate, inputs, None)
    }

    fn num_audio_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumAudioBuses", ugen_rate, inputs, None)
    }

    fn num_buffers(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumBuffers", ugen_rate, inputs, None)
    }

    fn num_control_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumControlBuses", ugen_rate, inputs, None)
    }

    fn num_input_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumInputBuses", ugen_rate, inputs, None)
    }

    fn num_output_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumOutputBuses", ugen_rate, inputs, None)
    }

    fn num_running_synths(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumRunningSynths", ugen_rate, inputs, None)
    }

    fn offset_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(bus));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "OffsetOut", ugen_rate, inputs, None)
    }

    fn one_pole(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, coef: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(coef)];
        delegate_ugen(def, "OnePole", ugen_rate, inputs, None)
    }

    fn one_zero(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, coef: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(coef)];
        delegate_ugen(def, "OneZero", ugen_rate, inputs, None)
    }

    fn onsets(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, threshold: WitUgenInput, odftype: WitUgenInput, relaxtime: WitUgenInput, floor: WitUgenInput, mingap: WitUgenInput, medianspan: WitUgenInput, whtype: WitUgenInput, rawodf: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(threshold), ugen_input_from_wit(odftype), ugen_input_from_wit(relaxtime), ugen_input_from_wit(floor), ugen_input_from_wit(mingap), ugen_input_from_wit(medianspan), ugen_input_from_wit(whtype), ugen_input_from_wit(rawodf)];
        delegate_ugen(def, "Onsets", ugen_rate, inputs, None)
    }

    fn osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, freq: WitUgenInput, phase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(freq), ugen_input_from_wit(phase)];
        delegate_ugen(def, "Osc", ugen_rate, inputs, None)
    }

    fn out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(bus));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "Out", ugen_rate, inputs, None)
    }

    fn p_sin_grain(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, dur: WitUgenInput, amp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(dur), ugen_input_from_wit(amp)];
        delegate_ugen(def, "PSinGrain", ugen_rate, inputs, None)
    }

    fn pv_add(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_Add", ugen_rate, inputs, None)
    }

    fn pv_bin_scramble(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, wipe: WitUgenInput, width: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(wipe), ugen_input_from_wit(width), ugen_input_from_wit(trig)];
        delegate_ugen(def, "PV_BinScramble", ugen_rate, inputs, None)
    }

    fn pv_bin_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, stretch: WitUgenInput, shift: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(stretch), ugen_input_from_wit(shift)];
        delegate_ugen(def, "PV_BinShift", ugen_rate, inputs, None)
    }

    fn pv_bin_wipe(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput, wipe: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b), ugen_input_from_wit(wipe)];
        delegate_ugen(def, "PV_BinWipe", ugen_rate, inputs, None)
    }

    fn pv_brick_wall(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, wipe: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(wipe)];
        delegate_ugen(def, "PV_BrickWall", ugen_rate, inputs, None)
    }

    fn pv_conformal_map(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, areal: WitUgenInput, aimag: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(areal), ugen_input_from_wit(aimag)];
        delegate_ugen(def, "PV_ConformalMap", ugen_rate, inputs, None)
    }

    fn pv_conj(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer)];
        delegate_ugen(def, "PV_Conj", ugen_rate, inputs, None)
    }

    fn pv_copy(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_Copy", ugen_rate, inputs, None)
    }

    fn pv_copy_phase(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_CopyPhase", ugen_rate, inputs, None)
    }

    fn pv_diffuser(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(trig)];
        delegate_ugen(def, "PV_Diffuser", ugen_rate, inputs, None)
    }

    fn pv_div(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_Div", ugen_rate, inputs, None)
    }

    fn pv_hainsworth_foote(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, proph: WitUgenInput, propf: WitUgenInput, threshold: WitUgenInput, wait_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(proph), ugen_input_from_wit(propf), ugen_input_from_wit(threshold), ugen_input_from_wit(wait_time)];
        delegate_ugen(def, "PV_HainsworthFoote", ugen_rate, inputs, None)
    }

    fn pv_jensen_andersen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, propsc: WitUgenInput, prophfe: WitUgenInput, prophfc: WitUgenInput, propsf: WitUgenInput, threshold: WitUgenInput, wait_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(propsc), ugen_input_from_wit(prophfe), ugen_input_from_wit(prophfc), ugen_input_from_wit(propsf), ugen_input_from_wit(threshold), ugen_input_from_wit(wait_time)];
        delegate_ugen(def, "PV_JensenAndersen", ugen_rate, inputs, None)
    }

    fn pv_local_max(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, threshold: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(threshold)];
        delegate_ugen(def, "PV_LocalMax", ugen_rate, inputs, None)
    }

    fn pv_mag_above(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, threshold: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(threshold)];
        delegate_ugen(def, "PV_MagAbove", ugen_rate, inputs, None)
    }

    fn pv_mag_below(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, threshold: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(threshold)];
        delegate_ugen(def, "PV_MagBelow", ugen_rate, inputs, None)
    }

    fn pv_mag_clip(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, threshold: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(threshold)];
        delegate_ugen(def, "PV_MagClip", ugen_rate, inputs, None)
    }

    fn pv_mag_div(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput, zeroed: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b), ugen_input_from_wit(zeroed)];
        delegate_ugen(def, "PV_MagDiv", ugen_rate, inputs, None)
    }

    fn pv_mag_freeze(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, freeze: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(freeze)];
        delegate_ugen(def, "PV_MagFreeze", ugen_rate, inputs, None)
    }

    fn pv_mag_mul(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_MagMul", ugen_rate, inputs, None)
    }

    fn pv_mag_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer)];
        delegate_ugen(def, "PV_MagNoise", ugen_rate, inputs, None)
    }

    fn pv_mag_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, stretch: WitUgenInput, shift: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(stretch), ugen_input_from_wit(shift)];
        delegate_ugen(def, "PV_MagShift", ugen_rate, inputs, None)
    }

    fn pv_mag_smear(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, bins: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(bins)];
        delegate_ugen(def, "PV_MagSmear", ugen_rate, inputs, None)
    }

    fn pv_mag_squared(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer)];
        delegate_ugen(def, "PV_MagSquared", ugen_rate, inputs, None)
    }

    fn pv_max(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_Max", ugen_rate, inputs, None)
    }

    fn pv_min(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_Min", ugen_rate, inputs, None)
    }

    fn pv_mul(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b)];
        delegate_ugen(def, "PV_Mul", ugen_rate, inputs, None)
    }

    fn pv_phase_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, shift: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(shift)];
        delegate_ugen(def, "PV_PhaseShift", ugen_rate, inputs, None)
    }

    fn pv_phase_shift270(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer)];
        delegate_ugen(def, "PV_PhaseShift270", ugen_rate, inputs, None)
    }

    fn pv_phase_shift90(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer)];
        delegate_ugen(def, "PV_PhaseShift90", ugen_rate, inputs, None)
    }

    fn pv_rand_comb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, wipe: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(wipe), ugen_input_from_wit(trig)];
        delegate_ugen(def, "PV_RandComb", ugen_rate, inputs, None)
    }

    fn pv_rand_wipe(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput, wipe: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b), ugen_input_from_wit(wipe), ugen_input_from_wit(trig)];
        delegate_ugen(def, "PV_RandWipe", ugen_rate, inputs, None)
    }

    fn pv_rect_comb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer: WitUgenInput, num_teeth: WitUgenInput, phase: WitUgenInput, width: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer), ugen_input_from_wit(num_teeth), ugen_input_from_wit(phase), ugen_input_from_wit(width)];
        delegate_ugen(def, "PV_RectComb", ugen_rate, inputs, None)
    }

    fn pv_rect_comb2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buffer_a: WitUgenInput, buffer_b: WitUgenInput, num_teeth: WitUgenInput, phase: WitUgenInput, width: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buffer_a), ugen_input_from_wit(buffer_b), ugen_input_from_wit(num_teeth), ugen_input_from_wit(phase), ugen_input_from_wit(width)];
        delegate_ugen(def, "PV_RectComb2", ugen_rate, inputs, None)
    }

    fn pan2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, pos: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(pos), ugen_input_from_wit(level)];
        delegate_ugen(def, "Pan2", ugen_rate, inputs, None)
    }

    fn pan4(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, xpos: WitUgenInput, ypos: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(xpos), ugen_input_from_wit(ypos), ugen_input_from_wit(level)];
        delegate_ugen(def, "Pan4", ugen_rate, inputs, None)
    }

    fn pan_az(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, in_: WitUgenInput, pos: WitUgenInput, level: WitUgenInput, width: WitUgenInput, orientation: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(pos), ugen_input_from_wit(level), ugen_input_from_wit(width), ugen_input_from_wit(orientation)];
        delegate_ugen(def, "PanAz", ugen_rate, inputs, Some(num_channels))
    }

    fn pan_b(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, azimuth: WitUgenInput, elevation: WitUgenInput, gain: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(azimuth), ugen_input_from_wit(elevation), ugen_input_from_wit(gain)];
        delegate_ugen(def, "PanB", ugen_rate, inputs, None)
    }

    fn pan_b2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, azimuth: WitUgenInput, gain: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(azimuth), ugen_input_from_wit(gain)];
        delegate_ugen(def, "PanB2", ugen_rate, inputs, None)
    }

    fn part_conv(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, fftsize: WitUgenInput, irbufnum: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(fftsize), ugen_input_from_wit(irbufnum)];
        delegate_ugen(def, "PartConv", ugen_rate, inputs, None)
    }

    fn pause(def: SynthDefBorrow<'_>, ugen_rate: WitRate, gate: WitUgenInput, id: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(gate), ugen_input_from_wit(id)];
        delegate_ugen(def, "Pause", ugen_rate, inputs, None)
    }

    fn pause_self(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "PauseSelf", ugen_rate, inputs, None)
    }

    fn pause_self_when_done(def: SynthDefBorrow<'_>, ugen_rate: WitRate, src: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(src)];
        delegate_ugen(def, "PauseSelfWhenDone", ugen_rate, inputs, None)
    }

    fn peak(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, reset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(reset)];
        delegate_ugen(def, "Peak", ugen_rate, inputs, None)
    }

    fn peak_follower(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, decay: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(decay)];
        delegate_ugen(def, "PeakFollower", ugen_rate, inputs, None)
    }

    fn phasor(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, rate: WitUgenInput, start: WitUgenInput, end: WitUgenInput, reset_pos: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(rate), ugen_input_from_wit(start), ugen_input_from_wit(end), ugen_input_from_wit(reset_pos)];
        delegate_ugen(def, "Phasor", ugen_rate, inputs, None)
    }

    fn pink_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "PinkNoise", ugen_rate, inputs, None)
    }

    fn pitch(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, init_freq: WitUgenInput, min_freq: WitUgenInput, max_freq: WitUgenInput, exec_freq: WitUgenInput, max_bins_per_octave: WitUgenInput, median: WitUgenInput, amp_threshold: WitUgenInput, peak_threshold: WitUgenInput, down_sample: WitUgenInput, clar: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(init_freq), ugen_input_from_wit(min_freq), ugen_input_from_wit(max_freq), ugen_input_from_wit(exec_freq), ugen_input_from_wit(max_bins_per_octave), ugen_input_from_wit(median), ugen_input_from_wit(amp_threshold), ugen_input_from_wit(peak_threshold), ugen_input_from_wit(down_sample), ugen_input_from_wit(clar)];
        delegate_ugen(def, "Pitch", ugen_rate, inputs, None)
    }

    fn pitch_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, window_size: WitUgenInput, pitch_ratio: WitUgenInput, pitch_dispersion: WitUgenInput, time_dispersion: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(window_size), ugen_input_from_wit(pitch_ratio), ugen_input_from_wit(pitch_dispersion), ugen_input_from_wit(time_dispersion)];
        delegate_ugen(def, "PitchShift", ugen_rate, inputs, None)
    }

    fn play_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, bufnum: WitUgenInput, rate: WitUgenInput, trigger: WitUgenInput, start_pos: WitUgenInput, loop_: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(rate), ugen_input_from_wit(trigger), ugen_input_from_wit(start_pos), ugen_input_from_wit(loop_), ugen_input_from_wit(action)];
        delegate_ugen(def, "PlayBuf", ugen_rate, inputs, Some(num_channels))
    }

    fn pluck(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, trig: WitUgenInput, maxdelaytime: WitUgenInput, delaytime: WitUgenInput, decaytime: WitUgenInput, coef: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(trig), ugen_input_from_wit(maxdelaytime), ugen_input_from_wit(delaytime), ugen_input_from_wit(decaytime), ugen_input_from_wit(coef)];
        delegate_ugen(def, "Pluck", ugen_rate, inputs, None)
    }

    fn poll(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, in_: WitUgenInput, label: WitUgenInput, trig_id: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(in_), ugen_input_from_wit(label), ugen_input_from_wit(trig_id)];
        delegate_ugen(def, "Poll", ugen_rate, inputs, None)
    }

    fn pulse(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, width: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(width)];
        delegate_ugen(def, "Pulse", ugen_rate, inputs, None)
    }

    fn pulse_count(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, reset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(reset)];
        delegate_ugen(def, "PulseCount", ugen_rate, inputs, None)
    }

    fn pulse_divider(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, div: WitUgenInput, start_val: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(div), ugen_input_from_wit(start_val)];
        delegate_ugen(def, "PulseDivider", ugen_rate, inputs, None)
    }

    fn quad_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(xi)];
        delegate_ugen(def, "QuadC", ugen_rate, inputs, None)
    }

    fn quad_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(xi)];
        delegate_ugen(def, "QuadL", ugen_rate, inputs, None)
    }

    fn quad_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, xi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(xi)];
        delegate_ugen(def, "QuadN", ugen_rate, inputs, None)
    }

    fn rhpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "RHPF", ugen_rate, inputs, None)
    }

    fn rlpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, rq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(rq)];
        delegate_ugen(def, "RLPF", ugen_rate, inputs, None)
    }

    fn radians_per_sample(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "RadiansPerSample", ugen_rate, inputs, None)
    }

    fn ramp(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lag_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lag_time)];
        delegate_ugen(def, "Ramp", ugen_rate, inputs, None)
    }

    fn rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Rand", ugen_rate, inputs, None)
    }

    fn rand_id(def: SynthDefBorrow<'_>, ugen_rate: WitRate, seed: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(seed)];
        delegate_ugen(def, "RandID", ugen_rate, inputs, None)
    }

    fn rand_seed(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, seed: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(seed)];
        delegate_ugen(def, "RandSeed", ugen_rate, inputs, None)
    }

    fn record_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, input_array: Vec<WitUgenInput>, bufnum: WitUgenInput, offset: WitUgenInput, rec_level: WitUgenInput, pre_level: WitUgenInput, run: WitUgenInput, loop_: WitUgenInput, trigger: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array.into_iter().map(ugen_input_from_wit));
        inputs.push(ugen_input_from_wit(bufnum));
        inputs.push(ugen_input_from_wit(offset));
        inputs.push(ugen_input_from_wit(rec_level));
        inputs.push(ugen_input_from_wit(pre_level));
        inputs.push(ugen_input_from_wit(run));
        inputs.push(ugen_input_from_wit(loop_));
        inputs.push(ugen_input_from_wit(trigger));
        inputs.push(ugen_input_from_wit(action));
        delegate_ugen(def, "RecordBuf", ugen_rate, inputs, None)
    }

    fn replace_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(bus));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "ReplaceOut", ugen_rate, inputs, None)
    }

    fn resonz(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, bwr: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(bwr)];
        delegate_ugen(def, "Resonz", ugen_rate, inputs, None)
    }

    fn ringz(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, decay_time: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(decay_time)];
        delegate_ugen(def, "Ringz", ugen_rate, inputs, None)
    }

    fn rotate2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, x: WitUgenInput, y: WitUgenInput, pos: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(x), ugen_input_from_wit(y), ugen_input_from_wit(pos)];
        delegate_ugen(def, "Rotate2", ugen_rate, inputs, None)
    }

    fn running_max(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(trig)];
        delegate_ugen(def, "RunningMax", ugen_rate, inputs, None)
    }

    fn running_min(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(trig)];
        delegate_ugen(def, "RunningMin", ugen_rate, inputs, None)
    }

    fn running_sum(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, numsamp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(numsamp)];
        delegate_ugen(def, "RunningSum", ugen_rate, inputs, None)
    }

    fn sos(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, a0: WitUgenInput, a1: WitUgenInput, a2: WitUgenInput, b1: WitUgenInput, b2: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(a0), ugen_input_from_wit(a1), ugen_input_from_wit(a2), ugen_input_from_wit(b1), ugen_input_from_wit(b2)];
        delegate_ugen(def, "SOS", ugen_rate, inputs, None)
    }

    fn sample_dur(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "SampleDur", ugen_rate, inputs, None)
    }

    fn sample_rate(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "SampleRate", ugen_rate, inputs, None)
    }

    fn saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq)];
        delegate_ugen(def, "Saw", ugen_rate, inputs, None)
    }

    fn schmidt(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Schmidt", ugen_rate, inputs, None)
    }

    fn scope_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, input_array: Vec<WitUgenInput>, bufnum: WitUgenInput) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array.into_iter().map(ugen_input_from_wit));
        inputs.push(ugen_input_from_wit(bufnum));
        delegate_ugen(def, "ScopeOut", ugen_rate, inputs, None)
    }

    fn scope_out2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, input_array: Vec<WitUgenInput>, scope_num: WitUgenInput, max_frames: WitUgenInput, scope_frames: WitUgenInput) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array.into_iter().map(ugen_input_from_wit));
        inputs.push(ugen_input_from_wit(scope_num));
        inputs.push(ugen_input_from_wit(max_frames));
        inputs.push(ugen_input_from_wit(scope_frames));
        delegate_ugen(def, "ScopeOut2", ugen_rate, inputs, None)
    }

    fn select(def: SynthDefBorrow<'_>, ugen_rate: WitRate, which: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(which));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "Select", ugen_rate, inputs, None)
    }

    fn send_reply(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, cmd_name: WitUgenInput, values: WitUgenInput, reply_id: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(cmd_name), ugen_input_from_wit(values), ugen_input_from_wit(reply_id)];
        delegate_ugen(def, "SendReply", ugen_rate, inputs, None)
    }

    fn send_trig(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, id: WitUgenInput, value: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(id), ugen_input_from_wit(value)];
        delegate_ugen(def, "SendTrig", ugen_rate, inputs, None)
    }

    fn set_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, buf: WitUgenInput, values: WitUgenInput, offset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(buf), ugen_input_from_wit(values), ugen_input_from_wit(offset)];
        delegate_ugen(def, "SetBuf", ugen_rate, inputs, None)
    }

    fn set_reset_ff(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, reset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(reset)];
        delegate_ugen(def, "SetResetFF", ugen_rate, inputs, None)
    }

    fn shaper(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(in_)];
        delegate_ugen(def, "Shaper", ugen_rate, inputs, None)
    }

    fn shared_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, num_channels: u32) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bus)];
        delegate_ugen(def, "SharedIn", ugen_rate, inputs, Some(num_channels))
    }

    fn shared_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(bus));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "SharedOut", ugen_rate, inputs, None)
    }

    fn silent(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "Silent", ugen_rate, inputs, Some(num_channels))
    }

    fn sin_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, phase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(phase)];
        delegate_ugen(def, "SinOsc", ugen_rate, inputs, None)
    }

    fn sin_osc_fb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, feedback: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(feedback)];
        delegate_ugen(def, "SinOscFB", ugen_rate, inputs, None)
    }

    fn slew(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, up: WitUgenInput, dn: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(up), ugen_input_from_wit(dn)];
        delegate_ugen(def, "Slew", ugen_rate, inputs, None)
    }

    fn slope(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "Slope", ugen_rate, inputs, None)
    }

    fn spec_centroid(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain)];
        delegate_ugen(def, "SpecCentroid", ugen_rate, inputs, None)
    }

    fn spec_flatness(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain)];
        delegate_ugen(def, "SpecFlatness", ugen_rate, inputs, None)
    }

    fn spec_pcile(def: SynthDefBorrow<'_>, ugen_rate: WitRate, chain: WitUgenInput, fraction: WitUgenInput, interpolate: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(chain), ugen_input_from_wit(fraction), ugen_input_from_wit(interpolate)];
        delegate_ugen(def, "SpecPcile", ugen_rate, inputs, None)
    }

    fn spring(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, spring: WitUgenInput, damp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(spring), ugen_input_from_wit(damp)];
        delegate_ugen(def, "Spring", ugen_rate, inputs, None)
    }

    fn standard_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, k: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(k), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "StandardL", ugen_rate, inputs, None)
    }

    fn standard_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, k: WitUgenInput, xi: WitUgenInput, yi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(k), ugen_input_from_wit(xi), ugen_input_from_wit(yi)];
        delegate_ugen(def, "StandardN", ugen_rate, inputs, None)
    }

    fn stepper(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, reset: WitUgenInput, min: WitUgenInput, max: WitUgenInput, step: WitUgenInput, resetval: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(reset), ugen_input_from_wit(min), ugen_input_from_wit(max), ugen_input_from_wit(step), ugen_input_from_wit(resetval)];
        delegate_ugen(def, "Stepper", ugen_rate, inputs, None)
    }

    fn stereo_convolution2_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, kernel_l: WitUgenInput, kernel_r: WitUgenInput, trigger: WitUgenInput, framesize: WitUgenInput, crossfade: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(kernel_l), ugen_input_from_wit(kernel_r), ugen_input_from_wit(trigger), ugen_input_from_wit(framesize), ugen_input_from_wit(crossfade)];
        delegate_ugen(def, "StereoConvolution2L", ugen_rate, inputs, None)
    }

    fn subsample_offset(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "SubsampleOffset", ugen_rate, inputs, None)
    }

    fn sweep(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, rate: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(rate)];
        delegate_ugen(def, "Sweep", ugen_rate, inputs, None)
    }

    fn sync_saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, sync_freq: WitUgenInput, saw_freq: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(sync_freq), ugen_input_from_wit(saw_freq)];
        delegate_ugen(def, "SyncSaw", ugen_rate, inputs, None)
    }

    fn t2_a(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, offset: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(offset)];
        delegate_ugen(def, "T2A", ugen_rate, inputs, None)
    }

    fn t2_k(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "T2K", ugen_rate, inputs, None)
    }

    fn t_ball(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, g: WitUgenInput, damp: WitUgenInput, friction: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(g), ugen_input_from_wit(damp), ugen_input_from_wit(friction)];
        delegate_ugen(def, "TBall", ugen_rate, inputs, None)
    }

    fn t_delay(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, dur: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(dur)];
        delegate_ugen(def, "TDelay", ugen_rate, inputs, None)
    }

    fn t_duty(def: SynthDefBorrow<'_>, ugen_rate: WitRate, dur: WitUgenInput, reset: WitUgenInput, action: WitUgenInput, level: WitUgenInput, gap_first: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(dur), ugen_input_from_wit(reset), ugen_input_from_wit(action), ugen_input_from_wit(level), ugen_input_from_wit(gap_first)];
        delegate_ugen(def, "TDuty", ugen_rate, inputs, None)
    }

    fn t_exp_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(trig)];
        delegate_ugen(def, "TExpRand", ugen_rate, inputs, None)
    }

    fn t_grains(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, trigger: WitUgenInput, bufnum: WitUgenInput, rate: WitUgenInput, center_pos: WitUgenInput, dur: WitUgenInput, pan: WitUgenInput, amp: WitUgenInput, interp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trigger), ugen_input_from_wit(bufnum), ugen_input_from_wit(rate), ugen_input_from_wit(center_pos), ugen_input_from_wit(dur), ugen_input_from_wit(pan), ugen_input_from_wit(amp), ugen_input_from_wit(interp)];
        delegate_ugen(def, "TGrains", ugen_rate, inputs, Some(num_channels))
    }

    fn ti_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(trig)];
        delegate_ugen(def, "TIRand", ugen_rate, inputs, None)
    }

    fn t_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, lo: WitUgenInput, hi: WitUgenInput, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(lo), ugen_input_from_wit(hi), ugen_input_from_wit(trig)];
        delegate_ugen(def, "TRand", ugen_rate, inputs, None)
    }

    fn t_windex(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, channels_array: Vec<WitUgenInput>, normalize: WitUgenInput) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(trig));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        inputs.push(ugen_input_from_wit(normalize));
        delegate_ugen(def, "TWindex", ugen_rate, inputs, None)
    }

    fn timer(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig)];
        delegate_ugen(def, "Timer", ugen_rate, inputs, None)
    }

    fn toggle_ff(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig)];
        delegate_ugen(def, "ToggleFF", ugen_rate, inputs, None)
    }

    fn trapezoid(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, a: WitUgenInput, b: WitUgenInput, c: WitUgenInput, d: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(a), ugen_input_from_wit(b), ugen_input_from_wit(c), ugen_input_from_wit(d)];
        delegate_ugen(def, "Trapezoid", ugen_rate, inputs, None)
    }

    fn trig(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, dur: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(dur)];
        delegate_ugen(def, "Trig", ugen_rate, inputs, None)
    }

    fn trig1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, trig: WitUgenInput, dur: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(trig), ugen_input_from_wit(dur)];
        delegate_ugen(def, "Trig1", ugen_rate, inputs, None)
    }

    fn two_pole(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, radius: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(radius)];
        delegate_ugen(def, "TwoPole", ugen_rate, inputs, None)
    }

    fn two_zero(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, freq: WitUgenInput, radius: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(freq), ugen_input_from_wit(radius)];
        delegate_ugen(def, "TwoZero", ugen_rate, inputs, None)
    }

    fn v_disk_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, bufnum: WitUgenInput, rate: WitUgenInput, loop_: WitUgenInput, send_id: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(rate), ugen_input_from_wit(loop_), ugen_input_from_wit(send_id)];
        delegate_ugen(def, "VDiskIn", ugen_rate, inputs, Some(num_channels))
    }

    fn v_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufpos: WitUgenInput, freq: WitUgenInput, phase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufpos), ugen_input_from_wit(freq), ugen_input_from_wit(phase)];
        delegate_ugen(def, "VOsc", ugen_rate, inputs, None)
    }

    fn v_osc3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufpos: WitUgenInput, freq1: WitUgenInput, freq2: WitUgenInput, freq3: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufpos), ugen_input_from_wit(freq1), ugen_input_from_wit(freq2), ugen_input_from_wit(freq3)];
        delegate_ugen(def, "VOsc3", ugen_rate, inputs, None)
    }

    fn var_saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, iphase: WitUgenInput, width: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(iphase), ugen_input_from_wit(width)];
        delegate_ugen(def, "VarSaw", ugen_rate, inputs, None)
    }

    fn vibrato(def: SynthDefBorrow<'_>, ugen_rate: WitRate, freq: WitUgenInput, rate: WitUgenInput, depth: WitUgenInput, delay: WitUgenInput, onset: WitUgenInput, rate_variation: WitUgenInput, depth_variation: WitUgenInput, iphase: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(freq), ugen_input_from_wit(rate), ugen_input_from_wit(depth), ugen_input_from_wit(delay), ugen_input_from_wit(onset), ugen_input_from_wit(rate_variation), ugen_input_from_wit(depth_variation), ugen_input_from_wit(iphase)];
        delegate_ugen(def, "Vibrato", ugen_rate, inputs, None)
    }

    fn warp1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, num_channels: u32, bufnum: WitUgenInput, pointer: WitUgenInput, freq_scale: WitUgenInput, window_size: WitUgenInput, envbufnum: WitUgenInput, overlaps: WitUgenInput, window_rand_ratio: WitUgenInput, interp: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(pointer), ugen_input_from_wit(freq_scale), ugen_input_from_wit(window_size), ugen_input_from_wit(envbufnum), ugen_input_from_wit(overlaps), ugen_input_from_wit(window_rand_ratio), ugen_input_from_wit(interp)];
        delegate_ugen(def, "Warp1", ugen_rate, inputs, Some(num_channels))
    }

    fn white_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "WhiteNoise", ugen_rate, inputs, None)
    }

    fn wrap(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput, lo: WitUgenInput, hi: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_), ugen_input_from_wit(lo), ugen_input_from_wit(hi)];
        delegate_ugen(def, "Wrap", ugen_rate, inputs, None)
    }

    fn wrap_index(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bufnum: WitUgenInput, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(bufnum), ugen_input_from_wit(in_)];
        delegate_ugen(def, "WrapIndex", ugen_rate, inputs, None)
    }

    fn x_fade2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_a: WitUgenInput, in_b: WitUgenInput, pan: WitUgenInput, level: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_a), ugen_input_from_wit(in_b), ugen_input_from_wit(pan), ugen_input_from_wit(level)];
        delegate_ugen(def, "XFade2", ugen_rate, inputs, None)
    }

    fn x_line(def: SynthDefBorrow<'_>, ugen_rate: WitRate, start: WitUgenInput, end: WitUgenInput, dur: WitUgenInput, action: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(start), ugen_input_from_wit(end), ugen_input_from_wit(dur), ugen_input_from_wit(action)];
        delegate_ugen(def, "XLine", ugen_rate, inputs, None)
    }

    fn x_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, bus: WitUgenInput, xfade: WitUgenInput, channels_array: Vec<WitUgenInput>) -> WitUgenInput {
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(ugen_input_from_wit(bus));
        inputs.push(ugen_input_from_wit(xfade));
        inputs.extend(channels_array.into_iter().map(ugen_input_from_wit));
        delegate_ugen(def, "XOut", ugen_rate, inputs, None)
    }

    fn zero_crossing(def: SynthDefBorrow<'_>, ugen_rate: WitRate, in_: WitUgenInput) -> WitUgenInput {
        let inputs: Vec<UGenInput> = vec![ugen_input_from_wit(in_)];
        delegate_ugen(def, "ZeroCrossing", ugen_rate, inputs, None)
    }

}
