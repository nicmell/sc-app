// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "A2K",
    rates: ['control'],
    defaults: [
      { name: "in", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "audio rate to control rate converter via linear interpolation",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "AmpComp",
    rates: ['scalar', 'audio', 'control'],
    defaults: [
      { name: "freq", default: 261.6256103515625 },
      { name: "root", default: 261.6256103515625 },
      { name: "exp", default: 0.33329999446868896 },
    ],
    numOutputs: null,
    extends: null,
    summary: "Basic psychoacoustic amplitude compensation.\" , :rates #{:ir :ar :kr} :check (when-ar (first-input-ar \"freq must be audio rate\")) :doc \"amplitude compensation: because higher frequencies are normally perceived as louder. Note that for frequencies very much smaller than root the amplitudes can become very high. In this case limit the freqor use amp-comp-a Implements the (optimized) formula: compensationFactor = (root / freq) ** exp",
    doc: "amplitude compensation: because higher frequencies are normally perceived as louder. Note that for frequencies very much smaller than root the amplitudes can become very high. In this case limit the freqor use amp-comp-a Implements the (optimized) formula: compensationFactor = (root / freq) ** exp",
    signalRange: null,
    argDocs: [
      { name: "exp", doc: "Exponent: how steep the curve decreases for increasing freq" },
      { name: "freq", doc: "Input frequency value. For freq == root, the output is 1.0." },
      { name: "root", doc: "Root freq relative to which the curve is calculated (usually lowest freq)" },
    ],
  },
  {
    name: "AmpCompA",
    rates: ['scalar', 'audio', 'control'],
    defaults: [
      { name: "freq", default: 1000 },
      { name: "root", default: 0 },
      { name: "minAmp", default: 0.3199999928474426 },
      { name: "rootAmp", default: 1 },
    ],
    numOutputs: null,
    extends: "AmpComp",
    summary: "Basic psychoacoustic amplitude compensation (ANSI A-weighting curve).",
    doc: "Higher frequencies are normally perceived as louder, which amp-comp-a compensates. Following the measurings by Fletcher and Munson, the ANSI standard describes a function for loudness vs. frequency. Note that this curve is only valid for standardized amplitude. 1 For a simpler but more flexible curve, see amp-comp",
    signalRange: null,
    argDocs: [
      { name: "freq", doc: "Input frequency value. For freq == root, the output is root-amp" },
      { name: "minAmp", doc: "Amplitude at the minimum point of the curve (around 2512 Hz)" },
      { name: "root", doc: "Root freq relative to which the curve is calculated (usually lowest freq)" },
      { name: "rootAmp", doc: "Amplitude at the root frequency." },
    ],
  },
  {
    name: "DC",
    rates: ['audio', 'control'],
    defaults: [
      { name: "in", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "outputs the initial value you give it.",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "constant value to output, cannot be modulated, set at initialisation time" },
    ],
  },
  {
    name: "K2A",
    rates: ['audio'],
    defaults: [
      { name: "in", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "control rate to audio rate converter via linear interpolation.",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "LinExp",
    rates: ['audio', 'control'],
    defaults: [
      { name: "in", default: 0 },
      { name: "srclo", default: 0 },
      { name: "srchi", default: 1 },
      { name: "dstlo", default: 1 },
      { name: "dsthi", default: 2 },
    ],
    numOutputs: null,
    extends: null,
    summary: "Map a linear range to an exponential range",
    doc: "Convert from a linear range to an exponential range. The dstlo and dsthi arguments must be nonzero and have the same sign.",
    signalRange: null,
    argDocs: [
      { name: "dsthi", doc: "Upper limit of output range" },
      { name: "dstlo", doc: "Lower limit of output range" },
      { name: "in", doc: "Input to convert" },
      { name: "srchi", doc: "Upper limit of input range" },
      { name: "srclo", doc: "Lower limit of input range" },
    ],
  },
  {
    name: "Line",
    rates: ['audio', 'control'],
    defaults: [
      { name: "start", default: 0 },
      { name: "end", default: 1 },
      { name: "dur", default: 1 },
      { name: "action", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: "Line generator.",
    doc: "Generates a line from the start value to the end value.",
    signalRange: null,
    argDocs: [
      { name: "action", doc: "A done action to be evaluated when the line is completed. Default: NO-ACTION" },
      { name: "dur", doc: "Duration in seconds" },
      { name: "end", doc: "Ending value" },
      { name: "start", doc: "Starting value" },
    ],
  },
  {
    name: "Silent",
    rates: ['audio'],
    defaults: [
      { name: "numChannels", default: 1 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Continuously outputs 0",
    signalRange: null,
    argDocs: [
      { name: "numChannels", doc: "Number of channels of silence." },
    ],
  },
  {
    name: "T2A",
    rates: ['audio'],
    defaults: [
      { name: "in", default: 0 },
      { name: "offset", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "control rate trigger to audio rate trigger converter (maximally one per control period).",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
      { name: "offset", doc: "sample offset within control period" },
    ],
  },
  {
    name: "T2K",
    rates: ['control'],
    defaults: [
      { name: "in", default: 0 },
    ],
    numOutputs: null,
    extends: "A2K",
    summary: null,
    doc: "audio rate trigger to control rate trigger converter. Uses the maxiumum trigger in the input during each control period.",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "XLine",
    rates: ['audio', 'control'],
    defaults: [
      { name: "start", default: 1 },
      { name: "end", default: 2 },
      { name: "dur", default: 1 },
      { name: "action", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: "Exponential line generator.",
    doc: "Generates an exponential curve from the start value to the end value. Both the start and end values must be non-zero and have the same sign.",
    signalRange: null,
    argDocs: [
      { name: "action", doc: "A done action to be evaluated when the line is completed. Default: NO-ACTION" },
      { name: "dur", doc: "Duration in seconds" },
      { name: "end", doc: "Ending value" },
      { name: "start", doc: "Starting value" },
    ],
  },
];
