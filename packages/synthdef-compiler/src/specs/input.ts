// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.
//
// Auto-generated UGen spec data — one file per source category.

import { UGenRegistryEntry } from '../registry.js';

export const UGENS: UGenRegistryEntry[] = [
  {
    name: "KeyState",
    rates: ['control'],
    defaults: [
      { name: "keycode", default: 0 },
      { name: "minval", default: 0 },
      { name: "maxval", default: 1 },
      { name: "lag", default: 0.20000000298023224 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "Toggles between two values when a key on the keyboard is up or down. Note that this ugen does not prevent normal typing.",
    signalRange: null,
    argDocs: [
      { name: "keycode", doc: "The keycode value of the key to check." },
      { name: "lag", doc: "lag factor" },
      { name: "maxval", doc: "The value to output when the key is pressed." },
      { name: "minval", doc: "The value to output when the key is not pressed." },
    ],
  },
  {
    name: "MouseButton",
    rates: ['control'],
    defaults: [
      { name: "up", default: 0 },
      { name: "down", default: 1 },
      { name: "lag", default: 0.20000000298023224 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "toggles between two values when the left mouse button is up or down",
    signalRange: null,
    argDocs: [
      { name: "down", doc: "value when the key is pressed" },
      { name: "lag", doc: "lag factor" },
      { name: "up", doc: "value when the key is not pressed" },
    ],
  },
  {
    name: "MouseX",
    rates: ['control'],
    defaults: [
      { name: "min", default: 0 },
      { name: "max", default: 1 },
      { name: "warp", default: 0 },
      { name: "lag", default: 0.20000000298023224 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "maps the current mouse X coordinate to a value between min and max",
    signalRange: null,
    argDocs: [
      { name: "lag", doc: "lag factor to dezipper cursor movement." },
      { name: "max", doc: "maximum value (when mouse is at the right of the screen)" },
      { name: "min", doc: "minimum value (when mouse is at the left of the screen)" },
      { name: "warp", doc: "mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are allowed). Default is LINEAR." },
    ],
  },
  {
    name: "MouseY",
    rates: ['control'],
    defaults: [
      { name: "min", default: 0 },
      { name: "max", default: 1 },
      { name: "warp", default: 0 },
      { name: "lag", default: 0.20000000298023224 },
    ],
    numOutputs: null,
    extends: null,
    summary: null,
    doc: "maps the current mouse Y coordinate to a value between min and max",
    signalRange: null,
    argDocs: [
      { name: "lag", doc: "lag factor to smooth out cursor movement." },
      { name: "max", doc: "maximum value (when mouse is at the bottom of the screen)" },
      { name: "min", doc: "minimum value (when mouse is at the top of the screen)" },
      { name: "warp", doc: "mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are allowed). Default is LINEAR" },
    ],
  },
];
