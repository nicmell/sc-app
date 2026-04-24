// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "Amplitude",
    rates: ['audio', 'control'],
    defaults: [
      { name: "in", default: 0 },
      { name: "attackTime", default: 0.009999999776482582 },
      { name: "releaseTime", default: 0.009999999776482582 },
    ],
    numOutputs: null,
    extends: null,
    summary: "Amplitude follower",
    doc: "Tracks the peak amplitude of a signal.",
    signalRange: null,
    argDocs: [
      { name: "attackTime", doc: "60dB convergence time for following attacks" },
      { name: "in", doc: "input signal" },
      { name: "releaseTime", doc: "60dB convergence time for following decays" },
    ],
  },
  {
    name: "Compander",
    rates: ['audio'],
    defaults: [
      { name: "in", default: 0 },
      { name: "control", default: 0 },
      { name: "thresh", default: 0.5 },
      { name: "slopeBelow", default: 1 },
      { name: "slopeAbove", default: 1 },
      { name: "clampTime", default: 0.009999999776482582 },
      { name: "relaxTime", default: 0.10000000149011612 },
    ],
    numOutputs: null,
    extends: null,
    summary: "General purpose hard-knee dynamic range processor.",
    doc: "The compander will modify the amplitude of the in signal based on an analysis of the control signal. Typically the in and control signals are the same. The amplitude of the control signal is calcuated using RMS (Root Mean Square) and the final amplitude of the in signal is calculated as a function of the amplitude threshold, and slopes either side (below and above) with some temporal modifications in terms of attack and release phases. It is a hard-knee processor which means that the response curve is a sharp angle rather than a rounded edge. If the control amplitude is less than the threshold, the slope below is used to calculate the amplitude modification. If this is steep (greater than 1) this will reduce the amplitude of quiet signals (the quieter the control amplitude the greater the reduction affect). Values < 1.0 are possible, but it means that a very low-level control signal will cause the input signal to be amplified, which would raise the noise floor. If the control amplitude is greater than the threshold, the slope above is used to calculate the amplitude modification. If this is steep (greater than 1) this will create expansion - loud signals will be made louder). Less than 1 will achieve compressions (louder signals are attenuated). The clamp and relax times modify when the amplitude modification takes place and ends. May be used to define: compressers, expanders, limiters, gates and duckers. For more information see: http://en.wikipedia.org/wiki/Audio_level_compression",
    signalRange: null,
    argDocs: [
      { name: "clampTime", doc: "Time taken for the amplitude adjustment to kick in fully (in seconds). This is usually pretty small, not much more than 10 milliseconds (the default value). Also known as the time of the attack phase." },
      { name: "control", doc: "The signal whose amplitude determines the gain applied to the input signal. Often the same as in (for standard gating or compression) but should be different for ducking." },
      { name: "in", doc: "The signal to be compressed / expanded / gated" },
      { name: "relaxTime", doc: "The amount of time for the amplitude adjustment to be released. Usually a bit longer than clamp-time; if both times are too short, you can get some (possibly unwanted) artifacts. Also known as the time of the release phase." },
      { name: "slopeAbove", doc: "Slope of the amplitude curve above the threshold. A value of 1 means the output amplitude will match the control signal amplitude." },
      { name: "slopeBelow", doc: "Slope of the amplitude curve below the threshold. A value of 1 means the output amplitude will match the control signal amplitude." },
      { name: "thresh", doc: "Control signal amplitude threshold, which determines the break point between slope-below and slope-above. Typically a value between 0 and 1." },
    ],
  },
  {
    name: "Limiter",
    rates: ['audio'],
    defaults: [
      { name: "in", default: null },
      { name: "level", default: 1 },
      { name: "dur", default: 0.009999999776482582 },
    ],
    numOutputs: null,
    extends: "Normalizer",
    summary: null,
    doc: "Limits the input amplitude to the given level. Limiter will not overshoot like Compander will, but it needs to look ahead in the audio. Thus there is a delay equal to twice the lookAheadTime. Limiter, unlike Compander, is completely transparent for an in range signal.",
    signalRange: null,
    argDocs: [
      { name: "dur", doc: "The buffer delay time. Shorter times will produce smaller delays and quicker transient response times, but may introduce amplitude modulation artifacts. (AKA lookAheadTime)" },
      { name: "in", doc: "The input signal" },
      { name: "level", doc: "The peak output amplitude level to which to normalize the input" },
    ],
  },
  {
    name: "Normalizer",
    rates: ['audio'],
    defaults: [
      { name: "in", default: null },
      { name: "level", default: 1 },
      { name: "dur", default: 0.009999999776482582 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "flattens dynamics. Normalizes the input amplitude to the given level. Normalize will not overshoot like Compander will, but it needs to look ahead in the audio. Thus there is a delay equal to twice the lookAheadTime.",
    signalRange: null,
    argDocs: [
      { name: "dur", doc: "The buffer delay time. Shorter times will produce smaller delays and quicker transient response times, but may introduce amplitude modulation artifacts. (AKA lookAheadTime)" },
      { name: "in", doc: "The input signal" },
      { name: "level", doc: "The peak output amplitude level to which to normalize the input" },
    ],
  },
];
