// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

use crate::registry::UGenRegistryEntry;
use crate::Rate;

pub(crate) const UGENS: &[UGenRegistryEntry] = &[
    UGenRegistryEntry {
        name: r"GrainBuf",
        rates: &[Rate::Audio],
        defaults: &[(r"numChannels", Some(1.0)), (r"trigger", Some(0.0)), (r"dur", Some(1.0)), (r"sndbuf", None), (r"rate", Some(1.0)), (r"pos", Some(1.0)), (r"interp", Some(2.0)), (r"pan", Some(0.0)), (r"envbufnum", Some(-1.0)), (r"maxGrains", Some(512.0))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Granular synthesis with sound stored in a buffer"),
        signal_range: None,
        arg_docs: &[(r"dur", r"size of the grain (in seconds)."), (r"envbufnum", r"the buffer number containing a singal to use for the grain envelope. -1 uses a built-in Hanning envelope."), (r"interp", r"the interpolation method used for pitchshifting grains: 1 = no interpolation 2 = linear 4 = cubic interpolation (more computationally intensive)"), (r"maxGrains", r"the maximum number of overlapping grains that can be used at a given time. This value is set at the UGens init time and can't be modified. This can be set lower for more efficient use of memory."), (r"numChannels", r"the number of channels to output. If 1, mono is returned and pan is ignored."), (r"pan", r"Determines where to pan the output. If num-channels = 1, no panning is done; if num-channels = 2, panning is similar to Pan2; if num-channels > 2, pannins is the same as PanAz."), (r"pos", r"the playback position for the grain to start with (0 is beginning, 1 is end of file)"), (r"rate", r"the playback rate of the sampled sound"), (r"sndbuf", r"the buffer holding a mono audio signal. If using multi-channel files, use Buffer.readChannel."), (r"trigger", r"a kr or ar trigger to start a new grain. If ar, grains after the start of the synth are sample accurate.")],
    },
    UGenRegistryEntry {
        name: r"GrainFM",
        rates: &[Rate::Audio],
        defaults: &[(r"numChannels", Some(1.0)), (r"trigger", Some(0.0)), (r"dur", Some(1.0)), (r"carFreq", Some(440.0)), (r"modFreq", Some(440.0)), (r"index", Some(1.0)), (r"pan", Some(0.0)), (r"envbufnum", Some(-1.0)), (r"maxGrains", Some(512.0))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Granular synthesis with frequency modulated sine tones"),
        signal_range: None,
        arg_docs: &[(r"carFreq", r"the frequency of the FM grain's carrier oscillator"), (r"dur", r"size of the grain."), (r"envbufnum", r"the buffer number containing a singal to use for the grain envelope. -1 uses a built-in Hanning envelope."), (r"index", r"the FM index"), (r"maxGrains", r"the maximum number of overlapping grains that can be used at a given time. This value is set at the UGens init time and can't be modified. This can be set lower for more efficient use of memory."), (r"modFreq", r"the frequency of the FM grain's modulating oscillator"), (r"numChannels", r"the number of channels to output. If 1, mono is returned and pan is ignored."), (r"pan", r"Determines where to pan the output. If num-channels = 1, no panning is done; if num-channels = 2, panning is similar to Pan2; if numChannels > 2, pannins is the same as PanAz."), (r"trigger", r"a kr or ar trigger to start a new grain. If ar, grains after the start of the synth are sample accurate.")],
    },
    UGenRegistryEntry {
        name: r"GrainIn",
        rates: &[Rate::Audio],
        defaults: &[(r"numChannels", Some(1.0)), (r"trigger", Some(0.0)), (r"dur", Some(1.0)), (r"in", None), (r"pan", Some(0.0)), (r"envbufnum", Some(-1.0)), (r"maxGrains", Some(512.0))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Granulate an input signal"),
        signal_range: None,
        arg_docs: &[(r"dur", r"size of the grain."), (r"envbufnum", r"the buffer number containing a singal to use for the grain envelope. -1 uses a built-in Hanning envelope."), (r"in", r"the input to granulate"), (r"maxGrains", r"the maximum number of overlapping grains that can be used at a given time. This value is set at the UGens init time and can't be modified. This can be set lower for more efficient use of memory."), (r"numChannels", r"the number of channels to output. If 1, mono is returned and pan is ignored."), (r"pan", r"Determines where to pan the output. If num-channels = 1, no panning is done; if num-channels = 2, panning is similar to Pan2; if num-channels > 2, pannins is the same as PanAz."), (r"trigger", r"a kr or ar trigger to start a new grain. If ar, grains after the start of the synth are sample accurate.")],
    },
    UGenRegistryEntry {
        name: r"GrainSin",
        rates: &[Rate::Audio],
        defaults: &[(r"numChannels", Some(1.0)), (r"trigger", Some(0.0)), (r"dur", Some(1.0)), (r"freq", Some(440.0)), (r"pan", Some(0.0)), (r"envbufnum", Some(-1.0)), (r"maxGrains", Some(512.0))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"Granular synthesis with sine tones"),
        signal_range: None,
        arg_docs: &[(r"dur", r"size of the grain."), (r"envbufnum", r"the buffer number containing a singal to use for the grain envelope. -1 uses a built-in Hanning envelope."), (r"freq", r"the frequency of the grain's oscillator"), (r"maxGrains", r"the maximum number of overlapping grains that can be used at a given time. This value is set at the UGens init time and can't be modified. This can be set lower for more efficient use of memory."), (r"numChannels", r"the number of channels to output. If 1, mono is returned and pan is ignored."), (r"pan", r"Determines where to pan the output. If num-channels = 1, no panning is done; if num-channels = 2, panning is similar to Pan2; if numChannels > 2, pannins is the same as PanAz."), (r"trigger", r"a kr or ar trigger to start a new grain. If ar, grains after the start of the synth are sample accurate.")],
    },
    UGenRegistryEntry {
        name: r"Warp1",
        rates: &[Rate::Audio],
        defaults: &[(r"numChannels", Some(1.0)), (r"bufnum", Some(0.0)), (r"pointer", Some(0.0)), (r"freqScale", Some(1.0)), (r"windowSize", Some(0.1)), (r"envbufnum", Some(-1.0)), (r"overlaps", Some(8.0)), (r"windowRandRatio", Some(0.0)), (r"interp", Some(1.0))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"A granular time stretcher and pitchshifter. Inspired by Chad Kirby's SuperCollider2 Warp1 class, which was inspired by Richard Karpen's sndwarp for CSound."),
        signal_range: None,
        arg_docs: &[(r"bufnum", r"the buffer number of a mono soundfile."), (r"envbufnum", r"the buffer number containing a singal to use for the grain envelope. -1 uses a built-in Hanning envelope."), (r"freqScale", r"the amount of frequency shift. 1.0 is normal, 0.5 is one octave down, 2.0 is one octave up. Negative values play the soundfile backwards."), (r"interp", r"the interpolation method used for pitchshifting grains. 1 = no interpolation. 2 = linear. 4 = cubic interpolation (more computationally intensive)."), (r"numChannels", r"the number of channels in the soundfile used in bufnum."), (r"overlaps", r"the number of overlaping windows."), (r"pointer", r"the position in the buffer. The value should be between 0 and 1, with 0 being the begining of the buffer, and 1 the end."), (r"windowRandRatio", r"the amount of randomness to the windowing function. Must be between 0 (no randomness) to 1.0 (probably to random actually)"), (r"windowSize", r"the size of each grain window.")],
    },
];
