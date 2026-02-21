import { UGen, UGenOutput, type UGenInput, Rate } from './ugen';
import { defineUGen, defineMultiOutUGen } from './define';

// ═══════════════════════════════════════════════════════════════════════════
// Oscillators
// ═══════════════════════════════════════════════════════════════════════════

export const SinOsc = defineUGen({
  name: 'SinOsc',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['phase', 0]],
});

export const Saw = defineUGen({
  name: 'Saw',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440]],
});

export const Pulse = defineUGen({
  name: 'Pulse',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['width', 0.5]],
});

export const LFSaw = defineUGen({
  name: 'LFSaw',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['iphase', 0]],
});

export const LFPulse = defineUGen({
  name: 'LFPulse',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['iphase', 0], ['width', 0.5]],
});

export const LFTri = defineUGen({
  name: 'LFTri',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['iphase', 0]],
});

export const Impulse = defineUGen({
  name: 'Impulse',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['phase', 0]],
});

export const VarSaw = defineUGen({
  name: 'VarSaw',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['iphase', 0], ['width', 0.5]],
});

export const SyncSaw = defineUGen({
  name: 'SyncSaw',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['syncFreq', 440], ['sawFreq', 440]],
});

// ═══════════════════════════════════════════════════════════════════════════
// Noise
// ═══════════════════════════════════════════════════════════════════════════

export const WhiteNoise = defineUGen({
  name: 'WhiteNoise',
  rates: [Rate.Audio, Rate.Control],
  defaults: [],
});

export const PinkNoise = defineUGen({
  name: 'PinkNoise',
  rates: [Rate.Audio, Rate.Control],
  defaults: [],
});

export const BrownNoise = defineUGen({
  name: 'BrownNoise',
  rates: [Rate.Audio, Rate.Control],
  defaults: [],
});

export const ClipNoise = defineUGen({
  name: 'ClipNoise',
  rates: [Rate.Audio, Rate.Control],
  defaults: [],
});

export const LFNoise0 = defineUGen({
  name: 'LFNoise0',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 500]],
});

export const LFNoise1 = defineUGen({
  name: 'LFNoise1',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 500]],
});

export const LFNoise2 = defineUGen({
  name: 'LFNoise2',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 500]],
});

export const Dust = defineUGen({
  name: 'Dust',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['density', 0]],
});

export const Dust2 = defineUGen({
  name: 'Dust2',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['density', 0]],
});

// ═══════════════════════════════════════════════════════════════════════════
// Filters
// ═══════════════════════════════════════════════════════════════════════════

export const LPF = defineUGen({
  name: 'LPF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 440]],
});

export const HPF = defineUGen({
  name: 'HPF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 440]],
});

export const BPF = defineUGen({
  name: 'BPF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 440], ['rq', 1]],
});

export const BRF = defineUGen({
  name: 'BRF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 440], ['rq', 1]],
});

export const RLPF = defineUGen({
  name: 'RLPF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 440], ['rq', 1]],
});

export const RHPF = defineUGen({
  name: 'RHPF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 440], ['rq', 1]],
});

export const MoogFF = defineUGen({
  name: 'MoogFF',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['freq', 100], ['gain', 2], ['reset', 0]],
});

// ═══════════════════════════════════════════════════════════════════════════
// Envelopes / Lines
// ═══════════════════════════════════════════════════════════════════════════

export const Line = defineUGen({
  name: 'Line',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['start', 0], ['end', 1], ['dur', 1], ['doneAction', 0]],
});

export const XLine = defineUGen({
  name: 'XLine',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['start', 1], ['end', 2], ['dur', 1], ['doneAction', 0]],
});

export const Linen = defineUGen({
  name: 'Linen',
  rates: [Rate.Control],
  defaults: [
    ['gate', 1], ['attackTime', 0.01], ['susLevel', 1],
    ['releaseTime', 1], ['doneAction', 0],
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// I/O — Out, ReplaceOut (0 outputs, signals array flattened)
// ═══════════════════════════════════════════════════════════════════════════

function outFactory(name: string) {
  return {
    ar(bus: UGenInput, signals: UGenInput | UGenInput[]): UGen {
      const sigs = Array.isArray(signals) ? signals : [signals];
      return new UGen(name, Rate.Audio, [bus, ...sigs], 0);
    },
    kr(bus: UGenInput, signals: UGenInput | UGenInput[]): UGen {
      const sigs = Array.isArray(signals) ? signals : [signals];
      return new UGen(name, Rate.Control, [bus, ...sigs], 0);
    },
  };
}

export const Out = outFactory('Out');
export const ReplaceOut = outFactory('ReplaceOut');
export const OffsetOut = outFactory('OffsetOut');

// ═══════════════════════════════════════════════════════════════════════════
// I/O — In (multi-output, numChannels is structural, not a signal input)
// ═══════════════════════════════════════════════════════════════════════════

function inFactory(name: string, rates: Rate[]) {
  const methods: Record<string, (bus: UGenInput, numChannels?: number) => UGen | UGenOutput[]> = {};
  for (const rate of rates) {
    const methodName = rate === Rate.Audio ? 'ar' : rate === Rate.Control ? 'kr' : 'ir';
    methods[methodName] = (bus: UGenInput, numChannels = 1) => {
      const ugen = new UGen(name, rate, [bus], numChannels);
      if (numChannels === 1) return ugen;
      return Array.from({ length: numChannels }, (_, i) => ugen.output(i));
    };
  }
  return methods as {
    ar: (bus: UGenInput, numChannels?: number) => UGen | UGenOutput[];
    kr: (bus: UGenInput, numChannels?: number) => UGen | UGenOutput[];
  };
}

export const In = inFactory('In', [Rate.Audio, Rate.Control]);
export const InFeedback = inFactory('InFeedback', [Rate.Audio]);
export const LocalIn = inFactory('LocalIn', [Rate.Audio, Rate.Control]);

// LocalOut — like Out but for local buses
export const LocalOut = outFactory('LocalOut');

// ═══════════════════════════════════════════════════════════════════════════
// Panning (multi-output)
// ═══════════════════════════════════════════════════════════════════════════

export const Pan2 = defineMultiOutUGen({
  name: 'Pan2',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['pos', 0], ['level', 1]],
  numOutputs: 2,
});

export const Balance2 = defineMultiOutUGen({
  name: 'Balance2',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['left', undefined], ['right', undefined], ['pos', 0], ['level', 1]],
  numOutputs: 2,
});

// ═══════════════════════════════════════════════════════════════════════════
// Delays
// ═══════════════════════════════════════════════════════════════════════════

const delayDefaults: [string, number | undefined][] = [
  ['in', undefined], ['maxDelayTime', 0.2], ['delayTime', 0.2],
];

export const DelayN = defineUGen({ name: 'DelayN', rates: [Rate.Audio, Rate.Control], defaults: delayDefaults });
export const DelayL = defineUGen({ name: 'DelayL', rates: [Rate.Audio, Rate.Control], defaults: delayDefaults });
export const DelayC = defineUGen({ name: 'DelayC', rates: [Rate.Audio, Rate.Control], defaults: delayDefaults });

const combDefaults: [string, number | undefined][] = [
  ['in', undefined], ['maxDelayTime', 0.2], ['delayTime', 0.2], ['decayTime', 1],
];

export const CombN = defineUGen({ name: 'CombN', rates: [Rate.Audio, Rate.Control], defaults: combDefaults });
export const CombL = defineUGen({ name: 'CombL', rates: [Rate.Audio, Rate.Control], defaults: combDefaults });
export const CombC = defineUGen({ name: 'CombC', rates: [Rate.Audio, Rate.Control], defaults: combDefaults });

export const AllpassN = defineUGen({ name: 'AllpassN', rates: [Rate.Audio, Rate.Control], defaults: combDefaults });
export const AllpassL = defineUGen({ name: 'AllpassL', rates: [Rate.Audio, Rate.Control], defaults: combDefaults });
export const AllpassC = defineUGen({ name: 'AllpassC', rates: [Rate.Audio, Rate.Control], defaults: combDefaults });

// ═══════════════════════════════════════════════════════════════════════════
// Amplitude / Dynamics
// ═══════════════════════════════════════════════════════════════════════════

export const Decay = defineUGen({
  name: 'Decay',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['decayTime', 1]],
});

export const Decay2 = defineUGen({
  name: 'Decay2',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['attackTime', 0.01], ['decayTime', 1]],
});

export const Integrator = defineUGen({
  name: 'Integrator',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['coef', 1]],
});

export const Lag = defineUGen({
  name: 'Lag',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['lagTime', 0.1]],
});

export const Lag2 = defineUGen({
  name: 'Lag2',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['lagTime', 0.1]],
});

export const Lag3 = defineUGen({
  name: 'Lag3',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['lagTime', 0.1]],
});

// ═══════════════════════════════════════════════════════════════════════════
// Effects
// ═══════════════════════════════════════════════════════════════════════════

export const FreeVerb = defineUGen({
  name: 'FreeVerb',
  rates: [Rate.Audio],
  defaults: [['in', undefined], ['mix', 0.33], ['room', 0.5], ['damp', 0.5]],
});

export const FreeVerb2 = defineMultiOutUGen({
  name: 'FreeVerb2',
  rates: [Rate.Audio],
  defaults: [
    ['in', undefined], ['in2', undefined],
    ['mix', 0.33], ['room', 0.5], ['damp', 0.5],
  ],
  numOutputs: 2,
});

// ═══════════════════════════════════════════════════════════════════════════
// Triggers
// ═══════════════════════════════════════════════════════════════════════════

export const Trig = defineUGen({
  name: 'Trig',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', 0], ['dur', 0.1]],
});

export const Trig1 = defineUGen({
  name: 'Trig1',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', 0], ['dur', 0.1]],
});

export const TDelay = defineUGen({
  name: 'TDelay',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['trigger', 0], ['dur', 0.1]],
});

// ═══════════════════════════════════════════════════════════════════════════
// Math / Utility
// ═══════════════════════════════════════════════════════════════════════════

export const Clip = defineUGen({
  name: 'Clip',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['lo', 0], ['hi', 1]],
});

export const Wrap = defineUGen({
  name: 'Wrap',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['lo', 0], ['hi', 1]],
});

export const Fold = defineUGen({
  name: 'Fold',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', undefined], ['lo', 0], ['hi', 1]],
});

export const LinLin = defineUGen({
  name: 'LinLin',
  rates: [Rate.Audio, Rate.Control],
  defaults: [
    ['in', undefined], ['srclo', 0], ['srchi', 1],
    ['dstlo', 0], ['dsthi', 1],
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// Demand-rate helpers (scalar outputs)
// ═══════════════════════════════════════════════════════════════════════════

export const DC = defineUGen({
  name: 'DC',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['in', 0]],
});

// ═══════════════════════════════════════════════════════════════════════════
// Done actions
// ═══════════════════════════════════════════════════════════════════════════

export const FreeSelf = defineUGen({
  name: 'FreeSelf',
  rates: [Rate.Control],
  defaults: [['in', undefined]],
});

export const PauseSelf = defineUGen({
  name: 'PauseSelf',
  rates: [Rate.Control],
  defaults: [['in', undefined]],
});
