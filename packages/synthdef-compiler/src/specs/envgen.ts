// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "Done",
    rates: ['control'],
    defaults: [
      { name: "src", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Outputs a one when the src ugen (typically an envelope) has finished",
    signalRange: null,
    argDocs: [
      { name: "src", doc: "ugen to monitor" },
    ],
  },
  {
    name: "EnvGen",
    rates: ['audio', 'control'],
    defaults: [
      { name: "envelope", default: null },
      { name: "gate", default: 1 },
      { name: "levelScale", default: 1 },
      { name: "levelBias", default: 0 },
      { name: "timeScale", default: 1 },
      { name: "action", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "envelope generator, interpolates across a path of control points over time, see the overtone.sc.envelope functions to generate the control points array Note: The actual minimum duration of a segment is not zero, but one sample step for audio rate and one block for control rate. This may result in asynchronicity when in two envelopes of different number of levels, the envelope times add up to the same total duration. Similarly, when modulating times, the new time is only updated at the end of the current segment - this may lead to asynchronicity of two envelopes with modulated times.",
    signalRange: null,
    argDocs: [
      { name: "action", doc: "an integer representing an action to be executed when the env is finished playing. This can be used to free the enclosing synth, etc." },
      { name: "envelope", doc: "an Array of Controls." },
      { name: "gate", doc: "this triggers the envelope and holds it open while > 0. If the envelope is fixed-length (e.g. perc), the gate argument is used as a simple trigger. If it is an sustaining envelope (e.g. adsr, asr), the envelope is held open until the gate becomes 0, at which point is released. If the gate of an env-gen is set to -1 or below, then the envelope will cutoff immediately. The time for it to cutoff is the amount less than -1, with -1 being as fast as possible, -1.5 being a cutoff in 0.5 seconds, etc. The cutoff shape is linear." },
      { name: "levelBias", doc: "offsets the levels of the breakpoints." },
      { name: "levelScale", doc: "scales the levels of the breakpoints." },
      { name: "timeScale", doc: "scales the durations of the segments." },
    ],
  },
  {
    name: "Free",
    rates: ['control'],
    defaults: [
      { name: "trig", default: null },
      { name: "id", default: null },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Free the specified node when triggered",
    signalRange: null,
    argDocs: [
      { name: "id", doc: "node to be freed" },
      { name: "trig", doc: "when triggered, frees node" },
    ],
  },
  {
    name: "FreeSelf",
    rates: ['control'],
    defaults: [
      { name: "in", default: null },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Free the enclosing synth when triggered",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "FreeSelfWhenDone",
    rates: ['control'],
    defaults: [
      { name: "src", default: null },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Free the enclosing synth when the src ugen finishes (e.g. env-gen, play-buf, linen...)",
    signalRange: null,
    argDocs: [
      { name: "src", doc: "the ugen to check for done" },
    ],
  },
  {
    name: "IEnvGen",
    rates: ['audio', 'control'],
    defaults: [
      { name: "ienvelope", default: null },
      { name: "index", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: null,
    signalRange: null,
    argDocs: [
      { name: "ienvelope", doc: "an InterplEnv (this is static for the life of the UGen)" },
      { name: "index", doc: "a point to access within the InterplEnv" },
    ],
  },
  {
    name: "Linen",
    rates: ['control'],
    defaults: [
      { name: "gate", default: 1 },
      { name: "attackTime", default: 0.009999999776482582 },
      { name: "susLevel", default: 1 },
      { name: "releaseTime", default: 1 },
      { name: "action", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "A linear envelope generator, rises to sus-level over attack-time seconds and after the gate goes non-positive falls over release-time to finally perform the (optional) action",
    signalRange: null,
    argDocs: [
      { name: "action", doc: "done action" },
      { name: "attackTime", doc: "Time taken to rise to susLevel in seconds" },
      { name: "gate", doc: "Input trigger" },
      { name: "releaseTime", doc: "Time to fall from susLevel back to 0 after the gate has been triggered" },
      { name: "susLevel", doc: "Level to hold the envelope at until gate is triggered" },
    ],
  },
  {
    name: "Pause",
    rates: ['control'],
    defaults: [
      { name: "gate", default: null },
      { name: "id", default: null },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Pause a specified node when triggered",
    signalRange: null,
    argDocs: [
      { name: "gate", doc: "when gate is 0, node is paused, when 1 it runs" },
      { name: "id", doc: "node to be paused" },
    ],
  },
  {
    name: "PauseSelf",
    rates: ['control'],
    defaults: [
      { name: "in", default: null },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Pause the enclosing synth when triggered",
    signalRange: null,
    argDocs: [
      { name: "in", doc: "input signal" },
    ],
  },
  {
    name: "PauseSelfWhenDone",
    rates: ['control'],
    defaults: [
      { name: "src", default: null },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Pause the enclosing synth when the src ugen finishes (e.g. env-gen, play-buf, linen...)",
    signalRange: null,
    argDocs: [
      { name: "src", doc: "the ugen to check for done" },
    ],
  },
];
