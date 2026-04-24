// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "BinaryOpUGen",
    rates: ['scalar', 'audio', 'control'],
    defaults: [
      { name: "a", default: null },
      { name: "b", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Multi-function binary ugen representing many operations (e.g. +, *, <, min, max, etc...)",
    signalRange: null,
    argDocs: [
      { name: "a", doc: "First input" },
      { name: "b", doc: "Second input" },
    ],
  },
  {
    name: "MulAdd",
    rates: ['scalar', 'audio', 'control'],
    defaults: [
      { name: "in", default: null },
      { name: "mul", default: null },
      { name: "add", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Multiply the input source by mul then add the add value. Equivalent to, but more efficient than, (+ add (* mul in))",
    signalRange: null,
    argDocs: [
      { name: "add", doc: "Addition Value" },
      { name: "in", doc: "Input to modify" },
      { name: "mul", doc: "Multiplier Value" },
    ],
  },
  {
    name: "UnaryOpUGen",
    rates: ['scalar', 'audio', 'control'],
    defaults: [
      { name: "a", default: null },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Multi-function unary ugen representing many operations (e.g. neg, abs, floor, sqrt, midicps, etc...)",
    signalRange: null,
    argDocs: [
      { name: "a", doc: "input" },
    ],
  },
];
