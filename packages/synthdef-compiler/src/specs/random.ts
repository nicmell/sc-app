// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "CoinGate",
    rates: ['control', 'scalar'],
    defaults: [
      { name: "prob", default: null },
      { name: "trig", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "When it receives a trigger, it tosses a coin, and either passes the trigger or doesn't.",
    signalRange: null,
    argDocs: [
      { name: "prob", doc: "Value between 0 and 1 determines probability of either possibilities" },
      { name: "trig", doc: "Trigger signal" },
    ],
  },
  {
    name: "ExpRand",
    rates: ['scalar'],
    defaults: [
      { name: "lo", default: 0.009999999776482582 },
      { name: "hi", default: 1 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a single random float value in an exponential distributions from lo to hi.",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated float" },
      { name: "lo", doc: "Minimum value of generated float" },
    ],
  },
  {
    name: "IRand",
    rates: ['scalar'],
    defaults: [
      { name: "lo", default: 0 },
      { name: "hi", default: 127 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a single random integer value in uniform distribution from lo to hi",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated integer" },
      { name: "lo", doc: "Minimum value of generated integer" },
    ],
  },
  {
    name: "LinRand",
    rates: ['scalar'],
    defaults: [
      { name: "lo", default: 0 },
      { name: "hi", default: 1 },
      { name: "minmax", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a single random float value in linear distribution from lo to hi, skewed towards lo if minmax < 0, otherwise skewed towards hi.",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated float" },
      { name: "lo", doc: "Minimum value of generated float" },
      { name: "minmax", doc: "Skew direction (towards lo if negative otherwise hi)" },
    ],
  },
  {
    name: "NRand",
    rates: ['scalar'],
    defaults: [
      { name: "lo", default: 0 },
      { name: "hi", default: 1 },
      { name: "n", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a single random float value in a sum of n uniform distributions from lo to hi. n = 1 : uniform distribution - same as Rand n = 2 : triangular distribution n = 3 : smooth hump As n increases, distribution converges towards gaussian",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated float" },
      { name: "lo", doc: "Minimum value of generated float" },
      { name: "n", doc: "Distribution choice" },
    ],
  },
  {
    name: "Rand",
    rates: ['scalar'],
    defaults: [
      { name: "lo", default: 0 },
      { name: "hi", default: 1 },
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
    name: "RandID",
    rates: ['scalar', 'control'],
    defaults: [
      { name: "seed", default: 0 },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "Choose which random number generator to use for this synth. All synths that use the same generator reproduce the same sequence of numbers when the same seed is set again.",
    signalRange: null,
    argDocs: [
      { name: "seed", doc: "Seed id" },
    ],
  },
  {
    name: "RandSeed",
    rates: ['scalar', 'control'],
    defaults: [
      { name: "trig", default: 0 },
      { name: "seed", default: 56789 },
    ],
    numOutputs: 1,
    extends: null,
    summary: null,
    doc: "When the trigger signal changes from nonpositive to positive, the synth's random generator seed is reset to the given value. All synths that use the same random number generator reproduce the same sequence of numbers again.",
    signalRange: null,
    argDocs: [
      { name: "seed", doc: "Seed value" },
      { name: "trig", doc: "Trigger signal" },
    ],
  },
  {
    name: "TExpRand",
    rates: ['audio', 'control'],
    defaults: [
      { name: "lo", default: 0.009999999776482582 },
      { name: "hi", default: 1 },
      { name: "trig", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a random float value in exponential distribution from lo to hi each time the trig signal changes from nonpositive to positive values lo and hi must both have the same sign and be non-zero.",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated float" },
      { name: "lo", doc: "Minimum value of generated float" },
      { name: "trig", doc: "Trigger signal" },
    ],
  },
  {
    name: "TIRand",
    rates: ['control', 'audio'],
    defaults: [
      { name: "lo", default: 0 },
      { name: "hi", default: 127 },
      { name: "trig", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a random integer value in uniform distribution from lo to hi each time the trig signal changes from nonpositive to positive values",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated integer" },
      { name: "lo", doc: "Minimum value of generated integer" },
      { name: "trig", doc: "Trigger signal" },
    ],
  },
  {
    name: "TRand",
    rates: ['control', 'audio'],
    defaults: [
      { name: "lo", default: 0 },
      { name: "hi", default: 1 },
      { name: "trig", default: 0 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Generates a random float value in uniform distribution from lo to hi each time the trig signal changes from nonpositive to positive values",
    signalRange: null,
    argDocs: [
      { name: "hi", doc: "Maximum value of generated float" },
      { name: "lo", doc: "Minimum value of generated float" },
      { name: "trig", doc: "Trigger signal" },
    ],
  },
];
