// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "BrownNoise",
    rates: ['audio', 'control'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: "Noise whose spectrum falls off in power by 6 dB per octave.",
    doc: "Useful for generating percussive sounds such as snares and hand claps. Also useful for simulating wind or sea effects, for producing breath effects in wind instrument timbres or for producing the typical trance leads.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "ClipNoise",
    rates: ['audio'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: "Noise whose values are either -1 or 1.",
    doc: "This produces the maximum energy for the least peak to peak amplitude. Useful for generating percussive sounds such as snares and hand claps. Also useful for simulating wind or sea effects, for producing breath effects in wind instrument timbres or for producing the typical trance leads.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "Crackle",
    rates: ['audio', 'control'],
    defaults: [
      { name: "chaosParam", default: 1.5 },
    ],
    numOutputs: null,
    extends: null,
    summary: "Chaotic noise generator",
    doc: "A noise generator based on a chaotic function. Useful for generating percussive sounds such as snares and hand claps. Also useful for simulating wind or sea effects, for producing breath effects in wind instrument timbres or for producing the typical trance leads.",
    signalRange: null,
    argDocs: [
      { name: "chaosParam", doc: "a parameter of the chaotic function with useful values from just below 1.0 to just above 2.0. Towards 2.0 the sound crackles." },
    ],
  },
  {
    name: "Dust",
    rates: ['audio', 'control'],
    defaults: [
      { name: "density", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates random impulses from 0 to +1.",
    signalRange: null,
    argDocs: [
      { name: "density", doc: "average number of impulses per second" },
    ],
  },
  {
    name: "Dust2",
    rates: ['audio', 'control'],
    defaults: [
      { name: "density", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates random impulses from -1 to +1.",
    signalRange: null,
    argDocs: [
      { name: "density", doc: "average number of impulses per second." },
    ],
  },
  {
    name: "GrayNoise",
    rates: ['audio'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: "Random impulses from -1 to +1 given a density",
    doc: "Creates a sequence of random impulses from -1 to +1. Generates noise which results from flipping random bits in a word. This type of noise has a high RMS level relative to its peak to peak level. The spectrum is emphasized towards lower frequencies. Useful for generating percussive sounds such as snares and hand claps. Also useful for simulating wind or sea effects, for producing breath effects in wind instrument timbres or for producing the typical trance leads.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "Hasher",
    rates: ['audio'],
    defaults: [
      { name: "in", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Returns a unique output value from zero to one for each input value according to a hash function. The same input value will always produce the same output value. The input need not be from zero to one.",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "LFClipNoise",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Randomly generates the values -1 or +1 at a rate given by the nearest integer division of the sample rate by the freq argument. It is probably pretty hard on your speakers!",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "approximate rate at which to generate random values." },
    ],
  },
  {
    name: "LFDClipNoise",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Like lf-clip-noise, it generates the values -1 or +1 at a rate given by the freq argument, with two differences: * no time quantization * fast recovery from low freq values. (lf-clip-noise, as well as lf-noise0,1,2 quantize to the nearest integer division of the samplerate, and they poll the freq argument only when scheduled; thus they often seem to hang when freqs get very low). If you don't need very high or very low freqs, or use fixed freqs lf-noise0 is more efficient.",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "rate at which to generate random values." },
    ],
  },
  {
    name: "LFDNoise0",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Like lf-noise0, it generates random values between -1 and 1 at a rate given by the freq argument, with two differences: p * no time quantization * fast recovery from low freq values. (lf-noise0,1,2 quantize to the nearest integer division of the samplerate and they poll the freq argument only when scheduled, and thus seem to hang when freqs get very low). If you don't need very high or very low freqs, or use fixed freqs lf-noise0 is more efficient.",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "rate at which to generate random values." },
    ],
  },
  {
    name: "LFDNoise1",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Like lf-noise1, it generates linearly interpolated random values between -1 and 1 at a rate given by the freq argument, with two differences: * no time quantization * fast recovery from low freq values. (lf-noise0,1,2 quantize to the nearest integer division of the samplerate and they poll the freq argument only when scheduled, and thus seem to hang when freqs get very low). If you don't need very high or very low freqs, or use fixed freqs lf-noise1 is more efficient.",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "rate at which to generate random values." },
    ],
  },
  {
    name: "LFDNoise3",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Similar to lf-noise2, it generates polynomially interpolated random values between -1 and 1 at a rate given by the freq argument, with 3 differences: * no time quantization * fast recovery from low freq values * cubic instead of quadratic interpolation (lf-noise0,1,2 quantize to the nearest integer division of the samplerate and they poll the freq argument only when scheduled, and thus seem to hang when freqs get very low). If you don't need very high or very low freqs, or use fixed freqs lf-noise2 is more efficient.",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "rate at which to generate random values." },
    ],
  },
  {
    name: "LFNoise0",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates random values between -1 and 1 at a rate (the rate is not guaranteed but approximate)",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "approximate rate at which to generate random values." },
    ],
  },
  {
    name: "LFNoise1",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates linearly interpolated random values between -1 and 1 at the supplied rate (the rate is not guaranteed but approximate).",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "approximate rate at which to generate random values." },
    ],
  },
  {
    name: "LFNoise2",
    rates: ['audio', 'control'],
    defaults: [
      { name: "freq", default: 500 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates quadratically interpolated random values between -1 and 1 at the supplied rate (the rate is not guaranteed but approximate). Note: quadratic interpolation means that the noise values can occasionally extend beyond the normal range of +-1, if the freq varies in certain ways. If this is undesirable then you might like to clip2 the values or use a linearly-interpolating unit instead.",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "approximate rate at which to generate random values." },
    ],
  },
  {
    name: "Logistic",
    rates: ['audio'],
    defaults: [
      { name: "chaosParam", default: 3 },
      { name: "freq", default: 1000 },
      { name: "init", default: 0.5 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "A noise generator based on the logistic map: y = chaos-param * y * (1.0 - y) y will stay in the range of 0.0 to 1.0 for normal values of the chaos-param. This leads to a DC offset and may cause a pop when you stop the Synth. For output you might want to combine this UGen with a LeakDC or rescale around 0.0 via mul and add: see example below.",
    signalRange: null,
    argDocs: [
      { name: "chaosParam", doc: "a parameter of the chaotic function with useful values from 0.0 to 4.0. Chaos occurs from 3.57 up. Don't use values outside this range if you don't want the UGen to blow up." },
      { name: "freq", doc: "Frequency of calculation; if over the sampling rate, this is clamped to the sampling rate" },
      { name: "init", doc: "Initial value of y (see equation below)" },
    ],
  },
  {
    name: "MantissaMask",
    rates: ['audio'],
    defaults: [
      { name: "in", default: 0 },
      { name: "bits", default: 3 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Masks off bits in the mantissa of the floating point sample value. This introduces a quantization noise, but is less severe than linearly quantizing the signal.",
    signalRange: null,
    argDocs: [
      { name: "bits", doc: "the number of mantissa bits to preserve. a number from 0 to 23." },
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "PinkNoise",
    rates: ['audio', 'control'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: "Noise whose spectrum falls off in power by 3 dB per octave.",
    doc: "Noise that gives equal power over the span of each octave. Useful for generating percussive sounds such as snares and hand claps. Also useful for simulating wind or sea effects, for producing breath effects in wind instrument timbres or for producing the typical trance leads. This version gives 8 octaves of pink noise.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "WhiteNoise",
    rates: ['audio', 'control'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: "Noise whose spectrum has equal power at all frequencies.",
    doc: "Noise that contains equal amounts of energy at every frequency - comparable to radio static. Useful for generating percussive sounds such as snares and hand claps. Also useful for simulating wind or sea effects, for producing breath effects in wind instrument timbres or for producing the typical trance leads.",
    signalRange: null,
    argDocs: [
    ],
  },
];
