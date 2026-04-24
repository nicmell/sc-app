// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "BufChannels",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "buf", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "current number of channels of soundfile in buffer",
    signalRange: null,
    argDocs: [
      { name: "buf", doc: "a buffer" },
    ],
  },
  {
    name: "BufDur",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "buf", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the current duration of a buffer in seconds.",
    signalRange: null,
    argDocs: [
      { name: "buf", doc: "a buffer" },
    ],
  },
  {
    name: "BufFrames",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "buf", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the current number of allocated frames i.e. the size of the buffer. This is the equivalent of Clojure's count on a seq.",
    signalRange: null,
    argDocs: [
      { name: "buf", doc: "a buffer" },
    ],
  },
  {
    name: "BufRateScale",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "buf", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns a ratio by which the playback of a buffer is to be scaled",
    signalRange: null,
    argDocs: [
      { name: "buf", doc: "a buffer" },
    ],
  },
  {
    name: "BufSampleRate",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "buf", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the buffers current sample rate",
    signalRange: null,
    argDocs: [
      { name: "buf", doc: "a buffer" },
    ],
  },
  {
    name: "BufSamples",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "buf", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "current number of samples allocated in the buffer",
    signalRange: null,
    argDocs: [
      { name: "buf", doc: "a buffer" },
    ],
  },
  {
    name: "CheckBadValues",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "in", default: null },
      { name: "id", default: 0 },
      { name: "post", default: 2 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "test for infinity, not-a-number, and denormals. If one of these is found, it posts a warning. Its output is as follows: 0 = a normal float, 1 = NaN, 2 = infinity, and 3 = a denormal.",
    signalRange: null,
    argDocs: [
      { name: "id", doc: "an id number to identify this UGen." },
      { name: "in", doc: "the UGen whose output is to be tested" },
      { name: "post", doc: "One of three post modes: 0 = no posting; 1 = post a line for every bad value; 2 = post a line only when the floating-point classification changes (e.g., normal -> NaN and vice versa)" },
    ],
  },
  {
    name: "ControlDur",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the current control rate block duration of the server in seconds",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "ControlRate",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the current control rate of the server",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "NumAudioBuses",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the number of audio buses allocated on the server.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "NumBuffers",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the number of buffers allocated on the server",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "NumControlBuses",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the number of control buses allocated on the server",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "NumInputBuses",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the number of input buses allocated on the server. This is the number of hardware inputs provided by the host machine such as a mic.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "NumOutputBuses",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the number of output buses allocated on the server. This is the number of hardware outputs provided by the host machine such as left and right speakers.",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "NumRunningSynths",
    rates: ['scalar', 'control'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the number of currently running synths",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "Poll",
    rates: ['audio', 'control'],
    defaults: [
      { name: "trig", default: 0 },
      { name: "in", default: 0 },
      { name: "label", default: null },
      { name: "trigId", default: -1 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "This ugen has been internalised for scserver compatibility. Please use the poll cgen instead.",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "the signal you want to poll" },
      { name: "label", doc: "a string or symbol to be printed with the polled value" },
      { name: "trig", doc: "a non-positive to positive transition telling Poll to return a value" },
      { name: "trigId", doc: "if greater than 0, a '/tr' message is sent back to the client (similar to send-trig)" },
    ],
  },
  {
    name: "RadiansPerSample",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: null,
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "SampleDur",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the current sample duration of the server in seconds",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "SampleRate",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "returns the current sample rate",
    signalRange: null,
    argDocs: [
    ],
  },
  {
    name: "SubsampleOffset",
    rates: ['scalar'],
    defaults: [
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "offset from synth start within one sample",
    signalRange: null,
    argDocs: [
    ],
  },
];
