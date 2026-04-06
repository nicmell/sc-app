import {Rate} from './ugen';

import basicops from '@/assets/ugens/basicops.json';
import beq_suite from '@/assets/ugens/beq_suite.json';
import buf_io from '@/assets/ugens/buf_io.json';
import chaos from '@/assets/ugens/chaos.json';
import compander from '@/assets/ugens/compander.json';
import delay from '@/assets/ugens/delay.json';
import demand from '@/assets/ugens/demand.json';
import envgen from '@/assets/ugens/envgen.json';
import ff_osc from '@/assets/ugens/ff_osc.json';
import fft from '@/assets/ugens/fft.json';
import fft2 from '@/assets/ugens/fft2.json';
import filter from '@/assets/ugens/filter.json';
import grain from '@/assets/ugens/grain.json';
import info from '@/assets/ugens/info.json';
import input from '@/assets/ugens/input.json';
import io from '@/assets/ugens/io.json';
import line from '@/assets/ugens/line.json';
import machine_listening from '@/assets/ugens/machine_listening.json';
import misc from '@/assets/ugens/misc.json';
import noise from '@/assets/ugens/noise.json';
import osc from '@/assets/ugens/osc.json';
import pan from '@/assets/ugens/pan.json';
import random from '@/assets/ugens/random.json';
import trig from '@/assets/ugens/trig.json';

// ── Types ─────────────────────────────────────────────────────────────────

export interface UGenSpec {
  name: string;
  rates: Rate[];
  defaults: [name: string, defaultValue: number | undefined][];
  numOutputs?: number;
}

type JsonUGen = {
  name: string;
  extends?: string;
  rates: string[];
  defaults: [string, number | null][];
  numOutputs?: number;
  summary?: string;
  doc?: string;
  signalRange?: string;
  argDocs?: Record<string, string>;
};

// ── Registry ──────────────────────────────────────────────────────────────

const RATE_MAP: Record<string, Rate> = {ar: Rate.Audio, kr: Rate.Control, ir: Rate.Scalar};

const registry = new Map<string, UGenSpec>();

export function registerUGen(entry: UGenSpec): void {
  registry.set(entry.name, entry);
}

export function lookupUGen(name: string): UGenSpec | undefined {
  return registry.get(name);
}

// ── Populate from JSON metadata ───────────────────────────────────────────

function registerAll(ugens: JsonUGen[]) {
  for (const u of ugens) {
    registerUGen({
      name: u.name,
      rates: u.rates.map(r => RATE_MAP[r]).filter(Boolean),
      defaults: u.defaults.map(([name, value]) => [name, value ?? undefined]),
      numOutputs: u.numOutputs,
    });
  }
}

[
  basicops, beq_suite, buf_io, chaos, compander, delay, demand, envgen, ff_osc, fft, fft2, filter, grain, info, input, io, line, machine_listening, misc, noise, osc, pan, random, trig,
].forEach(m => {
  registerAll(m as JsonUGen[])
});
