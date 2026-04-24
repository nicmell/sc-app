// @generated — DO NOT EDIT. Regenerate with scripts/generate_graph_types.mjs.
//
// Typed shape of the `g` namespace passed into `synthdef(name, fn)`
// callbacks. One entry per bundled UGen, plus arithmetic/math operator
// helpers on the root. Positional arguments follow each UGen's
// registry order; args with defaults are optional.

import type { UGenInput, UGenInputLike } from '../ugen-input.js';

export interface GraphOperators {
  /** `a * b` — BinaryOpUGen (specialIndex 2). */
  readonly mul: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** `a + b` — BinaryOpUGen (specialIndex 0). */
  readonly add: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** `a - b` — BinaryOpUGen (specialIndex 1). */
  readonly sub: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** `a / b` — BinaryOpUGen (specialIndex 4). */
  readonly div: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** `a % b` — BinaryOpUGen (specialIndex 5). */
  readonly mod: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** `a ** b` — BinaryOpUGen (specialIndex 25). */
  readonly pow: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** Element-wise minimum. */
  readonly min: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** Element-wise maximum. */
  readonly max: (a: UGenInputLike, b: UGenInputLike) => UGenInput;
  /** `-a` — UnaryOpUGen (specialIndex 0). */
  readonly neg: (a: UGenInputLike) => UGenInput;
  /** `|a|` — UnaryOpUGen (specialIndex 5). */
  readonly abs: (a: UGenInputLike) => UGenInput;
  /** `1 / a` — UnaryOpUGen. */
  readonly reciprocal: (a: UGenInputLike) => UGenInput;
  /** MIDI note → frequency. */
  readonly midicps: (a: UGenInputLike) => UGenInput;
  /** Frequency → MIDI note. */
  readonly cpsmidi: (a: UGenInputLike) => UGenInput;
  /** Amplitude → decibels. */
  readonly ampdb: (a: UGenInputLike) => UGenInput;
  /** Decibels → amplitude. */
  readonly dbamp: (a: UGenInputLike) => UGenInput;
}

export interface GraphUGens {
  readonly A2K: {
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly APF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, radius?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, radius?: UGenInputLike): UGenInput;
  };
  readonly AllpassC: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly AllpassL: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly AllpassN: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly AmpComp: {
    ir(freq?: UGenInputLike, root?: UGenInputLike, exp?: UGenInputLike): UGenInput;
    ar(freq?: UGenInputLike, root?: UGenInputLike, exp?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, root?: UGenInputLike, exp?: UGenInputLike): UGenInput;
  };
  readonly AmpCompA: {
    ir(freq?: UGenInputLike, root?: UGenInputLike, minAmp?: UGenInputLike, rootAmp?: UGenInputLike): UGenInput;
    ar(freq?: UGenInputLike, root?: UGenInputLike, minAmp?: UGenInputLike, rootAmp?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, root?: UGenInputLike, minAmp?: UGenInputLike, rootAmp?: UGenInputLike): UGenInput;
  };
  readonly Amplitude: {
    ar(in_?: UGenInputLike, attackTime?: UGenInputLike, releaseTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, attackTime?: UGenInputLike, releaseTime?: UGenInputLike): UGenInput;
  };
  readonly BAllPass: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly BBandPass: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, bw?: UGenInputLike): UGenInput;
  };
  readonly BBandStop: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, bw?: UGenInputLike): UGenInput;
  };
  readonly BHiPass: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly BHiShelf: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, rs?: UGenInputLike, db?: UGenInputLike): UGenInput;
  };
  readonly BLowPass: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly BLowShelf: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, rs?: UGenInputLike, db?: UGenInputLike): UGenInput;
  };
  readonly BPF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly BPZ2: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly BPeakEQ: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike, db?: UGenInputLike): UGenInput;
  };
  readonly BRF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly BRZ2: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly Balance2: {
    ar(left: UGenInputLike, right: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly Ball: {
    ar(in_?: UGenInputLike, g?: UGenInputLike, damp?: UGenInputLike, friction?: UGenInputLike): UGenInput;
  };
  readonly BeatTrack: {
    kr(chain: UGenInputLike, lock?: UGenInputLike): UGenInput;
  };
  readonly BeatTrack2: {
    kr(busindex: UGenInputLike, numfeatures: UGenInputLike, windowsize?: UGenInputLike, phaseaccuracy?: UGenInputLike, lock?: UGenInputLike, weightingscheme?: UGenInputLike): UGenInput;
  };
  readonly BiPanB2: {
    ar(inA: UGenInputLike, inB: UGenInputLike, azimuth: UGenInputLike, gain?: UGenInputLike): UGenInput;
    kr(inA: UGenInputLike, inB: UGenInputLike, azimuth: UGenInputLike, gain?: UGenInputLike): UGenInput;
  };
  readonly BinaryOpUGen: {
    ir(a: UGenInputLike, b: UGenInputLike): UGenInput;
    ar(a: UGenInputLike, b: UGenInputLike): UGenInput;
    kr(a: UGenInputLike, b: UGenInputLike): UGenInput;
  };
  readonly Blip: {
    ar(freq?: UGenInputLike, numharm?: UGenInputLike): UGenInput;
  };
  readonly BrownNoise: {
    ar(): UGenInput;
    kr(): UGenInput;
  };
  readonly BufAllpassC: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly BufAllpassL: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly BufAllpassN: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly BufChannels: {
    kr(buf?: UGenInputLike): UGenInput;
    ir(buf?: UGenInputLike): UGenInput;
  };
  readonly BufCombC: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly BufCombL: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly BufCombN: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly BufDelayC: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
    kr(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
  };
  readonly BufDelayL: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
    kr(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
  };
  readonly BufDelayN: {
    ar(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
    kr(buf?: UGenInputLike, in_?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
  };
  readonly BufDur: {
    kr(buf?: UGenInputLike): UGenInput;
    ir(buf?: UGenInputLike): UGenInput;
  };
  readonly BufFrames: {
    kr(buf?: UGenInputLike): UGenInput;
    ir(buf?: UGenInputLike): UGenInput;
  };
  readonly BufRateScale: {
    kr(buf?: UGenInputLike): UGenInput;
    ir(buf?: UGenInputLike): UGenInput;
  };
  readonly BufRd: {
    ar(numChannels?: number, bufnum?: UGenInputLike, phase?: UGenInputLike, loop?: UGenInputLike, interpolation?: UGenInputLike): UGenInput;
    kr(numChannels?: number, bufnum?: UGenInputLike, phase?: UGenInputLike, loop?: UGenInputLike, interpolation?: UGenInputLike): UGenInput;
  };
  readonly BufSampleRate: {
    kr(buf?: UGenInputLike): UGenInput;
    ir(buf?: UGenInputLike): UGenInput;
  };
  readonly BufSamples: {
    kr(buf?: UGenInputLike): UGenInput;
    ir(buf?: UGenInputLike): UGenInput;
  };
  readonly BufWr: {
    ar(inputArray: UGenInputLike | UGenInputLike[], bufnum?: UGenInputLike, phase?: UGenInputLike, loop?: UGenInputLike): UGenInput;
    kr(inputArray: UGenInputLike | UGenInputLike[], bufnum?: UGenInputLike, phase?: UGenInputLike, loop?: UGenInputLike): UGenInput;
  };
  readonly COsc: {
    ar(bufnum: UGenInputLike, freq?: UGenInputLike, beats?: UGenInputLike): UGenInput;
    kr(bufnum: UGenInputLike, freq?: UGenInputLike, beats?: UGenInputLike): UGenInput;
  };
  readonly CheckBadValues: {
    kr(in_: UGenInputLike, id?: UGenInputLike, post?: UGenInputLike): UGenInput;
    ir(in_: UGenInputLike, id?: UGenInputLike, post?: UGenInputLike): UGenInput;
  };
  readonly ClearBuf: {
    ir(buf: UGenInputLike): UGenInput;
  };
  readonly Clip: {
    ar(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly ClipNoise: {
    ar(): UGenInput;
  };
  readonly CoinGate: {
    kr(prob: UGenInputLike, trig: UGenInputLike): UGenInput;
    ir(prob: UGenInputLike, trig: UGenInputLike): UGenInput;
  };
  readonly CombC: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly CombL: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly CombN: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly Compander: {
    ar(in_?: UGenInputLike, control?: UGenInputLike, thresh?: UGenInputLike, slopeBelow?: UGenInputLike, slopeAbove?: UGenInputLike, clampTime?: UGenInputLike, relaxTime?: UGenInputLike): UGenInput;
  };
  readonly ControlDur: {
    ir(): UGenInput;
  };
  readonly ControlRate: {
    ir(): UGenInput;
  };
  readonly Convolution: {
    ar(in_: UGenInputLike, kernel: UGenInputLike, framesize?: UGenInputLike): UGenInput;
  };
  readonly Convolution2: {
    ar(in_: UGenInputLike, kernel: UGenInputLike, trigger: UGenInputLike, framesize?: UGenInputLike): UGenInput;
  };
  readonly Convolution2L: {
    ar(in_: UGenInputLike, kernel: UGenInputLike, trigger: UGenInputLike, framesize?: UGenInputLike, crossfade?: UGenInputLike): UGenInput;
  };
  readonly Convolution3: {
    ar(in_: UGenInputLike, kernel: UGenInputLike, trigger?: UGenInputLike, framesize?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, kernel: UGenInputLike, trigger?: UGenInputLike, framesize?: UGenInputLike): UGenInput;
  };
  readonly Crackle: {
    ar(chaosParam?: UGenInputLike): UGenInput;
    kr(chaosParam?: UGenInputLike): UGenInput;
  };
  readonly CuspL: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly CuspN: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly DC: {
    ar(in_: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike): UGenInput;
  };
  readonly Dbrown: {
  };
  readonly Dbufrd: {
  };
  readonly Dbufwr: {
  };
  readonly Decay: {
    ar(in_?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly Decay2: {
    ar(in_?: UGenInputLike, attackTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, attackTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly DecodeB2: {
    ar(numChannels: number, w: UGenInputLike, x: UGenInputLike, y: UGenInputLike, orientation?: UGenInputLike): UGenInput;
    kr(numChannels: number, w: UGenInputLike, x: UGenInputLike, y: UGenInputLike, orientation?: UGenInputLike): UGenInput;
  };
  readonly DegreeToKey: {
    ar(bufnum: UGenInputLike, in_?: UGenInputLike, octave?: UGenInputLike): UGenInput;
    kr(bufnum: UGenInputLike, in_?: UGenInputLike, octave?: UGenInputLike): UGenInput;
  };
  readonly DelTapRd: {
    ar(buffer?: UGenInputLike, phase?: UGenInputLike, delay?: UGenInputLike, interp?: UGenInputLike): UGenInput;
    kr(buffer?: UGenInputLike, phase?: UGenInputLike, delay?: UGenInputLike, interp?: UGenInputLike): UGenInput;
  };
  readonly DelTapWr: {
    ar(buffer?: UGenInputLike, in_?: UGenInputLike): UGenInput;
    kr(buffer?: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly Delay1: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly Delay2: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly DelayC: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
  };
  readonly DelayL: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
  };
  readonly DelayN: {
    ar(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, maxDelayTime?: UGenInputLike, delayTime?: UGenInputLike): UGenInput;
  };
  readonly Demand: {
    ar(trig: UGenInputLike, reset?: UGenInputLike, demandUgens?: UGenInputLike): UGenInput;
    kr(trig: UGenInputLike, reset?: UGenInputLike, demandUgens?: UGenInputLike): UGenInput;
  };
  readonly DemandEnvGen: {
    ar(level: UGenInputLike, dur: UGenInputLike, shape?: UGenInputLike, curve?: UGenInputLike, gate?: UGenInputLike, reset?: UGenInputLike, levelScale?: UGenInputLike, levelBias?: UGenInputLike, timeScale?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(level: UGenInputLike, dur: UGenInputLike, shape?: UGenInputLike, curve?: UGenInputLike, gate?: UGenInputLike, reset?: UGenInputLike, levelScale?: UGenInputLike, levelBias?: UGenInputLike, timeScale?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly DetectIndex: {
    kr(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
    ir(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly DetectSilence: {
    ar(in_?: UGenInputLike, amp?: UGenInputLike, time?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, amp?: UGenInputLike, time?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly Dgeom: {
  };
  readonly Dibrown: {
  };
  readonly DiskIn: {
    ar(numChannels: number, bufnum: UGenInputLike, loop?: UGenInputLike): UGenInput;
  };
  readonly DiskOut: {
    ar(bufnum: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly Diwhite: {
  };
  readonly Donce: {
  };
  readonly Done: {
    kr(src: UGenInputLike): UGenInput;
  };
  readonly Dpoll: {
  };
  readonly Drand: {
  };
  readonly Dseq: {
  };
  readonly Dser: {
  };
  readonly Dseries: {
  };
  readonly Dshuf: {
  };
  readonly Dstutter: {
  };
  readonly Dswitch: {
  };
  readonly Dswitch1: {
  };
  readonly Dust: {
    ar(density?: UGenInputLike): UGenInput;
    kr(density?: UGenInputLike): UGenInput;
  };
  readonly Dust2: {
    ar(density?: UGenInputLike): UGenInput;
    kr(density?: UGenInputLike): UGenInput;
  };
  readonly Duty: {
    ar(dur?: UGenInputLike, reset?: UGenInputLike, action?: UGenInputLike, level?: UGenInputLike): UGenInput;
    kr(dur?: UGenInputLike, reset?: UGenInputLike, action?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly Dwhite: {
  };
  readonly Dxrand: {
  };
  readonly EnvGen: {
    ar(envelope: UGenInputLike, gate?: UGenInputLike, levelScale?: UGenInputLike, levelBias?: UGenInputLike, timeScale?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(envelope: UGenInputLike, gate?: UGenInputLike, levelScale?: UGenInputLike, levelBias?: UGenInputLike, timeScale?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly ExpRand: {
    ir(lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly FBSineC: {
    ar(freq?: UGenInputLike, im?: UGenInputLike, fb?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, im?: UGenInputLike, fb?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly FBSineL: {
    ar(freq?: UGenInputLike, im?: UGenInputLike, fb?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, im?: UGenInputLike, fb?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly FBSineN: {
    ar(freq?: UGenInputLike, im?: UGenInputLike, fb?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, im?: UGenInputLike, fb?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly FFT: {
    kr(buffer: UGenInputLike, in_?: UGenInputLike, hop?: UGenInputLike, wintype?: UGenInputLike, active?: UGenInputLike, winsize?: UGenInputLike): UGenInput;
  };
  readonly FFTTrigger: {
    kr(buffer: UGenInputLike, hop?: UGenInputLike, polar?: UGenInputLike): UGenInput;
  };
  readonly FOS: {
    ar(in_?: UGenInputLike, a0?: UGenInputLike, a1?: UGenInputLike, b1?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, a0?: UGenInputLike, a1?: UGenInputLike, b1?: UGenInputLike): UGenInput;
  };
  readonly FSinOsc: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
  };
  readonly Fold: {
    ar(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly Formant: {
    ar(fundfreq?: UGenInputLike, formfreq?: UGenInputLike, bwfreq?: UGenInputLike): UGenInput;
  };
  readonly Formlet: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, attackTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, attackTime?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly Free: {
    kr(trig: UGenInputLike, id: UGenInputLike): UGenInput;
  };
  readonly FreeSelf: {
    kr(in_: UGenInputLike): UGenInput;
  };
  readonly FreeSelfWhenDone: {
    kr(src: UGenInputLike): UGenInput;
  };
  readonly FreeVerb: {
    ar(in_: UGenInputLike, mix?: UGenInputLike, room?: UGenInputLike, damp?: UGenInputLike): UGenInput;
  };
  readonly FreeVerb2: {
    ar(in_: UGenInputLike, in2: UGenInputLike, mix?: UGenInputLike, room?: UGenInputLike, damp?: UGenInputLike): UGenInput;
  };
  readonly FreqShift: {
    ar(in_: UGenInputLike, freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
  };
  readonly GVerb: {
    ar(in_: UGenInputLike, roomsize?: UGenInputLike, revtime?: UGenInputLike, damping?: UGenInputLike, inputbw?: UGenInputLike, spread?: UGenInputLike, drylevel?: UGenInputLike, earlyreflevel?: UGenInputLike, taillevel?: UGenInputLike, maxroomsize?: UGenInputLike): UGenInput;
  };
  readonly Gate: {
    ar(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly GbmanL: {
    ar(freq?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly GbmanN: {
    ar(freq?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly Gendy1: {
    ar(ampdist?: UGenInputLike, durdist?: UGenInputLike, adparam?: UGenInputLike, ddparam?: UGenInputLike, minfreq?: UGenInputLike, maxfreq?: UGenInputLike, ampscale?: UGenInputLike, durscale?: UGenInputLike, initCps?: UGenInputLike, knum?: UGenInputLike): UGenInput;
    kr(ampdist?: UGenInputLike, durdist?: UGenInputLike, adparam?: UGenInputLike, ddparam?: UGenInputLike, minfreq?: UGenInputLike, maxfreq?: UGenInputLike, ampscale?: UGenInputLike, durscale?: UGenInputLike, initCps?: UGenInputLike, knum?: UGenInputLike): UGenInput;
  };
  readonly Gendy2: {
    ar(ampdist?: UGenInputLike, durdist?: UGenInputLike, adparam?: UGenInputLike, ddparam?: UGenInputLike, minfreq?: UGenInputLike, maxfreq?: UGenInputLike, ampscale?: UGenInputLike, durscale?: UGenInputLike, initCps?: UGenInputLike, knum?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike): UGenInput;
    kr(ampdist?: UGenInputLike, durdist?: UGenInputLike, adparam?: UGenInputLike, ddparam?: UGenInputLike, minfreq?: UGenInputLike, maxfreq?: UGenInputLike, ampscale?: UGenInputLike, durscale?: UGenInputLike, initCps?: UGenInputLike, knum?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike): UGenInput;
  };
  readonly Gendy3: {
    ar(ampdist?: UGenInputLike, durdist?: UGenInputLike, adparam?: UGenInputLike, ddparam?: UGenInputLike, freq?: UGenInputLike, ampscale?: UGenInputLike, durscale?: UGenInputLike, initCps?: UGenInputLike, knum?: UGenInputLike): UGenInput;
    kr(ampdist?: UGenInputLike, durdist?: UGenInputLike, adparam?: UGenInputLike, ddparam?: UGenInputLike, freq?: UGenInputLike, ampscale?: UGenInputLike, durscale?: UGenInputLike, initCps?: UGenInputLike, knum?: UGenInputLike): UGenInput;
  };
  readonly GrainBuf: {
    ar(numChannels?: number, trigger?: UGenInputLike, dur?: UGenInputLike, sndbuf?: UGenInputLike, rate?: UGenInputLike, pos?: UGenInputLike, interp?: UGenInputLike, pan?: UGenInputLike, envbufnum?: UGenInputLike, maxGrains?: UGenInputLike): UGenInput;
  };
  readonly GrainFM: {
    ar(numChannels?: number, trigger?: UGenInputLike, dur?: UGenInputLike, carFreq?: UGenInputLike, modFreq?: UGenInputLike, index?: UGenInputLike, pan?: UGenInputLike, envbufnum?: UGenInputLike, maxGrains?: UGenInputLike): UGenInput;
  };
  readonly GrainIn: {
    ar(numChannels?: number, trigger?: UGenInputLike, dur?: UGenInputLike, in_?: UGenInputLike, pan?: UGenInputLike, envbufnum?: UGenInputLike, maxGrains?: UGenInputLike): UGenInput;
  };
  readonly GrainSin: {
    ar(numChannels?: number, trigger?: UGenInputLike, dur?: UGenInputLike, freq?: UGenInputLike, pan?: UGenInputLike, envbufnum?: UGenInputLike, maxGrains?: UGenInputLike): UGenInput;
  };
  readonly GrayNoise: {
    ar(): UGenInput;
  };
  readonly HPF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike): UGenInput;
  };
  readonly HPZ1: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly HPZ2: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly Hasher: {
    ar(in_?: UGenInputLike): UGenInput;
  };
  readonly HenonC: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, x0?: UGenInputLike, x1?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, x0?: UGenInputLike, x1?: UGenInputLike): UGenInput;
  };
  readonly HenonL: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, x0?: UGenInputLike, x1?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, x0?: UGenInputLike, x1?: UGenInputLike): UGenInput;
  };
  readonly HenonN: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, x0?: UGenInputLike, x1?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, x0?: UGenInputLike, x1?: UGenInputLike): UGenInput;
  };
  readonly Hilbert: {
    ar(in_: UGenInputLike): UGenInput;
  };
  readonly IEnvGen: {
    ar(ienvelope: UGenInputLike, index: UGenInputLike): UGenInput;
    kr(ienvelope: UGenInputLike, index: UGenInputLike): UGenInput;
  };
  readonly IFFT: {
    ar(chain: UGenInputLike, wintype?: UGenInputLike, winsize?: UGenInputLike): UGenInput;
    kr(chain: UGenInputLike, wintype?: UGenInputLike, winsize?: UGenInputLike): UGenInput;
  };
  readonly IRand: {
    ir(lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly Impulse: {
    ar(freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
  };
  readonly In: {
    ar(bus?: UGenInputLike, numChannels?: number): UGenInput;
    kr(bus?: UGenInputLike, numChannels?: number): UGenInput;
  };
  readonly InFeedback: {
    ar(bus?: UGenInputLike, numChannels?: number): UGenInput;
  };
  readonly InRange: {
    ar(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly InRect: {
    ar(x?: UGenInputLike, y?: UGenInputLike, left?: UGenInputLike, top?: UGenInputLike, right?: UGenInputLike, bottom?: UGenInputLike): UGenInput;
    kr(x?: UGenInputLike, y?: UGenInputLike, left?: UGenInputLike, top?: UGenInputLike, right?: UGenInputLike, bottom?: UGenInputLike): UGenInput;
  };
  readonly InTrig: {
    kr(bus?: UGenInputLike, numChannels?: number): UGenInput;
  };
  readonly Index: {
    kr(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
    ir(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly IndexInBetween: {
    kr(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
    ir(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly Integrator: {
    ar(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
  };
  readonly K2A: {
    ar(in_?: UGenInputLike): UGenInput;
  };
  readonly KeyState: {
    kr(keycode?: UGenInputLike, minval?: UGenInputLike, maxval?: UGenInputLike, lag?: UGenInputLike): UGenInput;
  };
  readonly KeyTrack: {
    kr(chain: UGenInputLike, keydecay?: UGenInputLike, chromaleak?: UGenInputLike): UGenInput;
  };
  readonly Klang: {
    ar(specs: UGenInputLike, freqscale?: UGenInputLike, freqoffset?: UGenInputLike): UGenInput;
  };
  readonly Klank: {
    ar(specs: UGenInputLike, input: UGenInputLike, freqscale?: UGenInputLike, freqoffset?: UGenInputLike, decayscale?: UGenInputLike): UGenInput;
  };
  readonly LFClipNoise: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFCub: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
  };
  readonly LFDClipNoise: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFDNoise0: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFDNoise1: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFDNoise3: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFGauss: {
    ar(duration?: UGenInputLike, width?: UGenInputLike, iphase?: UGenInputLike, loop?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(duration?: UGenInputLike, width?: UGenInputLike, iphase?: UGenInputLike, loop?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly LFNoise0: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFNoise1: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFNoise2: {
    ar(freq?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike): UGenInput;
  };
  readonly LFPar: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
  };
  readonly LFPulse: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike, width?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike, width?: UGenInputLike): UGenInput;
  };
  readonly LFSaw: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
  };
  readonly LFTri: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
  };
  readonly LPF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike): UGenInput;
  };
  readonly LPZ1: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly LPZ2: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly Lag: {
    ar(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
  };
  readonly Lag2: {
    ar(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
  };
  readonly Lag2UD: {
    ar(in_?: UGenInputLike, lagTimeUp?: UGenInputLike, lagTimeDown?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTimeUp?: UGenInputLike, lagTimeDown?: UGenInputLike): UGenInput;
  };
  readonly Lag3: {
    ar(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
  };
  readonly Lag3UD: {
    ar(in_?: UGenInputLike, lagTimeUp?: UGenInputLike, lagTimeDown?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTimeUp?: UGenInputLike, lagTimeDown?: UGenInputLike): UGenInput;
  };
  readonly LagIn: {
    kr(bus?: UGenInputLike, numChannels?: number, lag?: UGenInputLike): UGenInput;
  };
  readonly LagUD: {
    ar(in_?: UGenInputLike, lagTimeUp?: UGenInputLike, lagTimeDown?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTimeUp?: UGenInputLike, lagTimeDown?: UGenInputLike): UGenInput;
  };
  readonly LastValue: {
    ar(in_?: UGenInputLike, diff?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, diff?: UGenInputLike): UGenInput;
  };
  readonly Latch: {
    ar(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly LatoocarfianC: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly LatoocarfianL: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly LatoocarfianN: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly LeakDC: {
    ar(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
  };
  readonly LeastChange: {
    ar(a?: UGenInputLike, b?: UGenInputLike): UGenInput;
    kr(a?: UGenInputLike, b?: UGenInputLike): UGenInput;
  };
  readonly Limiter: {
    ar(in_: UGenInputLike, level?: UGenInputLike, dur?: UGenInputLike): UGenInput;
  };
  readonly LinCongC: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, m?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, m?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly LinCongL: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, m?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, m?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly LinCongN: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, m?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, c?: UGenInputLike, m?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly LinExp: {
    ar(in_?: UGenInputLike, srclo?: UGenInputLike, srchi?: UGenInputLike, dstlo?: UGenInputLike, dsthi?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, srclo?: UGenInputLike, srchi?: UGenInputLike, dstlo?: UGenInputLike, dsthi?: UGenInputLike): UGenInput;
  };
  readonly LinPan2: {
    ar(in_: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly LinRand: {
    ir(lo?: UGenInputLike, hi?: UGenInputLike, minmax?: UGenInputLike): UGenInput;
  };
  readonly LinXFade2: {
    ar(inA: UGenInputLike, inB: UGenInputLike, pan?: UGenInputLike, level?: UGenInputLike): UGenInput;
    kr(inA: UGenInputLike, inB: UGenInputLike, pan?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly Line: {
    ar(start?: UGenInputLike, end?: UGenInputLike, dur?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(start?: UGenInputLike, end?: UGenInputLike, dur?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly Linen: {
    kr(gate?: UGenInputLike, attackTime?: UGenInputLike, susLevel?: UGenInputLike, releaseTime?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly LocalBuf: {
    ir(numChannels?: number, numFrames?: UGenInputLike): UGenInput;
  };
  readonly LocalIn: {
    ar(numChannels?: number): UGenInput;
    kr(numChannels?: number): UGenInput;
  };
  readonly LocalOut: {
    ar(channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
    kr(channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly Logistic: {
    ar(chaosParam?: UGenInputLike, freq?: UGenInputLike, init?: UGenInputLike): UGenInput;
  };
  readonly LorenzL: {
    ar(freq?: UGenInputLike, s?: UGenInputLike, r?: UGenInputLike, b?: UGenInputLike, h?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike, zi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, s?: UGenInputLike, r?: UGenInputLike, b?: UGenInputLike, h?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike, zi?: UGenInputLike): UGenInput;
  };
  readonly Loudness: {
    kr(chain: UGenInputLike, smask?: UGenInputLike, tmask?: UGenInputLike): UGenInput;
  };
  readonly MFCC: {
    kr(chain: UGenInputLike, numcoeff?: UGenInputLike): UGenInput;
  };
  readonly MantissaMask: {
    ar(in_?: UGenInputLike, bits?: UGenInputLike): UGenInput;
  };
  readonly MaxLocalBufs: {
    ir(numLocalBufs: UGenInputLike): UGenInput;
  };
  readonly Median: {
    ar(length?: UGenInputLike, in_?: UGenInputLike): UGenInput;
    kr(length?: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly MidEQ: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike, db?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike, db?: UGenInputLike): UGenInput;
  };
  readonly MoogFF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, gain?: UGenInputLike, reset?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, gain?: UGenInputLike, reset?: UGenInputLike): UGenInput;
  };
  readonly MostChange: {
    ar(a?: UGenInputLike, b?: UGenInputLike): UGenInput;
    kr(a?: UGenInputLike, b?: UGenInputLike): UGenInput;
  };
  readonly MouseButton: {
    kr(up?: UGenInputLike, down?: UGenInputLike, lag?: UGenInputLike): UGenInput;
  };
  readonly MouseX: {
    kr(min?: UGenInputLike, max?: UGenInputLike, warp?: UGenInputLike, lag?: UGenInputLike): UGenInput;
  };
  readonly MouseY: {
    kr(min?: UGenInputLike, max?: UGenInputLike, warp?: UGenInputLike, lag?: UGenInputLike): UGenInput;
  };
  readonly MulAdd: {
    ir(in_: UGenInputLike, mul: UGenInputLike, add: UGenInputLike): UGenInput;
    ar(in_: UGenInputLike, mul: UGenInputLike, add: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, mul: UGenInputLike, add: UGenInputLike): UGenInput;
  };
  readonly NRand: {
    ir(lo?: UGenInputLike, hi?: UGenInputLike, n?: UGenInputLike): UGenInput;
  };
  readonly Normalizer: {
    ar(in_: UGenInputLike, level?: UGenInputLike, dur?: UGenInputLike): UGenInput;
  };
  readonly NumAudioBuses: {
    ir(): UGenInput;
  };
  readonly NumBuffers: {
    ir(): UGenInput;
  };
  readonly NumControlBuses: {
    ir(): UGenInput;
  };
  readonly NumInputBuses: {
    ir(): UGenInput;
  };
  readonly NumOutputBuses: {
    ir(): UGenInput;
  };
  readonly NumRunningSynths: {
    ir(): UGenInput;
    kr(): UGenInput;
  };
  readonly OffsetOut: {
    ar(bus: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly OnePole: {
    ar(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
  };
  readonly OneZero: {
    ar(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, coef?: UGenInputLike): UGenInput;
  };
  readonly Onsets: {
    kr(chain: UGenInputLike, threshold?: UGenInputLike, odftype?: UGenInputLike, relaxtime?: UGenInputLike, floor?: UGenInputLike, mingap?: UGenInputLike, medianspan?: UGenInputLike, whtype?: UGenInputLike, rawodf?: UGenInputLike): UGenInput;
  };
  readonly Osc: {
    ar(buffer: UGenInputLike, freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
    kr(buffer: UGenInputLike, freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
  };
  readonly Out: {
    ar(bus: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
    kr(bus: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly PSinGrain: {
    ar(freq?: UGenInputLike, dur?: UGenInputLike, amp?: UGenInputLike): UGenInput;
  };
  readonly PV_Add: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_BinScramble: {
    kr(buffer: UGenInputLike, wipe?: UGenInputLike, width?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly PV_BinShift: {
    kr(buffer: UGenInputLike, stretch?: UGenInputLike, shift?: UGenInputLike): UGenInput;
  };
  readonly PV_BinWipe: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike, wipe?: UGenInputLike): UGenInput;
  };
  readonly PV_BrickWall: {
    kr(buffer: UGenInputLike, wipe?: UGenInputLike): UGenInput;
  };
  readonly PV_ConformalMap: {
    kr(buffer: UGenInputLike, areal?: UGenInputLike, aimag?: UGenInputLike): UGenInput;
  };
  readonly PV_Conj: {
    kr(buffer: UGenInputLike): UGenInput;
  };
  readonly PV_Copy: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_CopyPhase: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_Diffuser: {
    kr(buffer: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly PV_Div: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_HainsworthFoote: {
    ar(buffer: UGenInputLike, proph?: UGenInputLike, propf?: UGenInputLike, threshold?: UGenInputLike, waitTime?: UGenInputLike): UGenInput;
  };
  readonly PV_JensenAndersen: {
    ar(buffer: UGenInputLike, propsc?: UGenInputLike, prophfe?: UGenInputLike, prophfc?: UGenInputLike, propsf?: UGenInputLike, threshold?: UGenInputLike, waitTime?: UGenInputLike): UGenInput;
  };
  readonly PV_LocalMax: {
    kr(buffer: UGenInputLike, threshold?: UGenInputLike): UGenInput;
  };
  readonly PV_MagAbove: {
    kr(buffer: UGenInputLike, threshold?: UGenInputLike): UGenInput;
  };
  readonly PV_MagBelow: {
    kr(buffer: UGenInputLike, threshold?: UGenInputLike): UGenInput;
  };
  readonly PV_MagClip: {
    kr(buffer: UGenInputLike, threshold?: UGenInputLike): UGenInput;
  };
  readonly PV_MagDiv: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike, zeroed?: UGenInputLike): UGenInput;
  };
  readonly PV_MagFreeze: {
    kr(buffer: UGenInputLike, freeze?: UGenInputLike): UGenInput;
  };
  readonly PV_MagMul: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_MagNoise: {
    kr(buffer: UGenInputLike): UGenInput;
  };
  readonly PV_MagShift: {
    kr(buffer: UGenInputLike, stretch?: UGenInputLike, shift?: UGenInputLike): UGenInput;
  };
  readonly PV_MagSmear: {
    kr(buffer: UGenInputLike, bins?: UGenInputLike): UGenInput;
  };
  readonly PV_MagSquared: {
    kr(buffer: UGenInputLike): UGenInput;
  };
  readonly PV_Max: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_Min: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_Mul: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike): UGenInput;
  };
  readonly PV_PhaseShift: {
    kr(buffer: UGenInputLike, shift: UGenInputLike): UGenInput;
  };
  readonly PV_PhaseShift270: {
    kr(buffer: UGenInputLike): UGenInput;
  };
  readonly PV_PhaseShift90: {
    kr(buffer: UGenInputLike): UGenInput;
  };
  readonly PV_RandComb: {
    kr(buffer: UGenInputLike, wipe?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly PV_RandWipe: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike, wipe?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly PV_RectComb: {
    kr(buffer: UGenInputLike, numTeeth?: UGenInputLike, phase?: UGenInputLike, width?: UGenInputLike): UGenInput;
  };
  readonly PV_RectComb2: {
    kr(bufferA: UGenInputLike, bufferB: UGenInputLike, numTeeth?: UGenInputLike, phase?: UGenInputLike, width?: UGenInputLike): UGenInput;
  };
  readonly Pan2: {
    ar(in_: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly Pan4: {
    ar(in_: UGenInputLike, xpos?: UGenInputLike, ypos?: UGenInputLike, level?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, xpos?: UGenInputLike, ypos?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly PanAz: {
    ar(numChannels: number, in_: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike, width?: UGenInputLike, orientation?: UGenInputLike): UGenInput;
    kr(numChannels: number, in_: UGenInputLike, pos?: UGenInputLike, level?: UGenInputLike, width?: UGenInputLike, orientation?: UGenInputLike): UGenInput;
  };
  readonly PanB: {
    ar(in_: UGenInputLike, azimuth?: UGenInputLike, elevation?: UGenInputLike, gain?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, azimuth?: UGenInputLike, elevation?: UGenInputLike, gain?: UGenInputLike): UGenInput;
  };
  readonly PanB2: {
    ar(in_: UGenInputLike, azimuth?: UGenInputLike, gain?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, azimuth?: UGenInputLike, gain?: UGenInputLike): UGenInput;
  };
  readonly PartConv: {
    ar(in_: UGenInputLike, fftsize: UGenInputLike, irbufnum: UGenInputLike): UGenInput;
  };
  readonly Pause: {
    kr(gate: UGenInputLike, id: UGenInputLike): UGenInput;
  };
  readonly PauseSelf: {
    kr(in_: UGenInputLike): UGenInput;
  };
  readonly PauseSelfWhenDone: {
    kr(src: UGenInputLike): UGenInput;
  };
  readonly Peak: {
    ar(trig?: UGenInputLike, reset?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, reset?: UGenInputLike): UGenInput;
  };
  readonly PeakFollower: {
    ar(in_?: UGenInputLike, decay?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, decay?: UGenInputLike): UGenInput;
  };
  readonly Phasor: {
    ar(trig?: UGenInputLike, rate?: UGenInputLike, start?: UGenInputLike, end?: UGenInputLike, resetPos?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, rate?: UGenInputLike, start?: UGenInputLike, end?: UGenInputLike, resetPos?: UGenInputLike): UGenInput;
  };
  readonly PinkNoise: {
    ar(): UGenInput;
    kr(): UGenInput;
  };
  readonly Pitch: {
    kr(in_: UGenInputLike, initFreq?: UGenInputLike, minFreq?: UGenInputLike, maxFreq?: UGenInputLike, execFreq?: UGenInputLike, maxBinsPerOctave?: UGenInputLike, median?: UGenInputLike, ampThreshold?: UGenInputLike, peakThreshold?: UGenInputLike, downSample?: UGenInputLike, clar?: UGenInputLike): UGenInput;
  };
  readonly PitchShift: {
    ar(in_: UGenInputLike, windowSize?: UGenInputLike, pitchRatio?: UGenInputLike, pitchDispersion?: UGenInputLike, timeDispersion?: UGenInputLike): UGenInput;
  };
  readonly PlayBuf: {
    ar(numChannels: number, bufnum?: UGenInputLike, rate?: UGenInputLike, trigger?: UGenInputLike, startPos?: UGenInputLike, loop?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(numChannels: number, bufnum?: UGenInputLike, rate?: UGenInputLike, trigger?: UGenInputLike, startPos?: UGenInputLike, loop?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly Pluck: {
    ar(in_?: UGenInputLike, trig?: UGenInputLike, maxdelaytime?: UGenInputLike, delaytime?: UGenInputLike, decaytime?: UGenInputLike, coef?: UGenInputLike): UGenInput;
  };
  readonly Poll: {
    ar(trig?: UGenInputLike, in_?: UGenInputLike, label?: UGenInputLike, trigId?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, in_?: UGenInputLike, label?: UGenInputLike, trigId?: UGenInputLike): UGenInput;
  };
  readonly Pulse: {
    ar(freq?: UGenInputLike, width?: UGenInputLike): UGenInput;
  };
  readonly PulseCount: {
    ar(trig?: UGenInputLike, reset?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, reset?: UGenInputLike): UGenInput;
  };
  readonly PulseDivider: {
    ar(trig?: UGenInputLike, div?: UGenInputLike, startVal?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, div?: UGenInputLike, startVal?: UGenInputLike): UGenInput;
  };
  readonly QuadC: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly QuadL: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly QuadN: {
    ar(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, xi?: UGenInputLike): UGenInput;
  };
  readonly RHPF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly RLPF: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, rq?: UGenInputLike): UGenInput;
  };
  readonly RadiansPerSample: {
    ir(): UGenInput;
  };
  readonly Ramp: {
    ar(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lagTime?: UGenInputLike): UGenInput;
  };
  readonly Rand: {
    ir(lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly RandID: {
    ir(seed?: UGenInputLike): UGenInput;
    kr(seed?: UGenInputLike): UGenInput;
  };
  readonly RandSeed: {
    ir(trig?: UGenInputLike, seed?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, seed?: UGenInputLike): UGenInput;
  };
  readonly RecordBuf: {
    ar(inputArray: UGenInputLike | UGenInputLike[], bufnum?: UGenInputLike, offset?: UGenInputLike, recLevel?: UGenInputLike, preLevel?: UGenInputLike, run?: UGenInputLike, loop?: UGenInputLike, trigger?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(inputArray: UGenInputLike | UGenInputLike[], bufnum?: UGenInputLike, offset?: UGenInputLike, recLevel?: UGenInputLike, preLevel?: UGenInputLike, run?: UGenInputLike, loop?: UGenInputLike, trigger?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly ReplaceOut: {
    ar(bus: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
    kr(bus: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly Resonz: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, bwr?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, bwr?: UGenInputLike): UGenInput;
  };
  readonly Ringz: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, decayTime?: UGenInputLike): UGenInput;
  };
  readonly Rotate2: {
    ar(x: UGenInputLike, y: UGenInputLike, pos?: UGenInputLike): UGenInput;
    kr(x: UGenInputLike, y: UGenInputLike, pos?: UGenInputLike): UGenInput;
  };
  readonly RunningMax: {
    ar(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly RunningMin: {
    ar(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly RunningSum: {
    ar(in_: UGenInputLike, numsamp?: UGenInputLike): UGenInput;
    kr(in_: UGenInputLike, numsamp?: UGenInputLike): UGenInput;
  };
  readonly SOS: {
    ar(in_?: UGenInputLike, a0?: UGenInputLike, a1?: UGenInputLike, a2?: UGenInputLike, b1?: UGenInputLike, b2?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, a0?: UGenInputLike, a1?: UGenInputLike, a2?: UGenInputLike, b1?: UGenInputLike, b2?: UGenInputLike): UGenInput;
  };
  readonly SampleDur: {
    ir(): UGenInput;
  };
  readonly SampleRate: {
    ir(): UGenInput;
  };
  readonly Saw: {
    ar(freq?: UGenInputLike): UGenInput;
  };
  readonly Schmidt: {
    ar(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly ScopeOut: {
    ar(inputArray: UGenInputLike | UGenInputLike[], bufnum?: UGenInputLike): UGenInput;
  };
  readonly ScopeOut2: {
    ar(inputArray: UGenInputLike | UGenInputLike[], scopeNum?: UGenInputLike, maxFrames?: UGenInputLike, scopeFrames?: UGenInputLike): UGenInput;
    kr(inputArray: UGenInputLike | UGenInputLike[], scopeNum?: UGenInputLike, maxFrames?: UGenInputLike, scopeFrames?: UGenInputLike): UGenInput;
  };
  readonly Select: {
    ar(which: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
    kr(which: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly SendReply: {
    ar(trig?: UGenInputLike, cmdName?: UGenInputLike, values?: UGenInputLike, replyId?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, cmdName?: UGenInputLike, values?: UGenInputLike, replyId?: UGenInputLike): UGenInput;
  };
  readonly SendTrig: {
    ar(in_?: UGenInputLike, id?: UGenInputLike, value?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, id?: UGenInputLike, value?: UGenInputLike): UGenInput;
  };
  readonly SetBuf: {
    ar(buf: UGenInputLike, values: UGenInputLike, offset?: UGenInputLike): UGenInput;
    kr(buf: UGenInputLike, values: UGenInputLike, offset?: UGenInputLike): UGenInput;
  };
  readonly SetResetFF: {
    ar(trig?: UGenInputLike, reset?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, reset?: UGenInputLike): UGenInput;
  };
  readonly Shaper: {
    kr(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
    ir(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly SharedIn: {
    kr(bus?: UGenInputLike, numChannels?: number): UGenInput;
  };
  readonly SharedOut: {
    kr(bus: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly Silent: {
    ar(numChannels?: number): UGenInput;
  };
  readonly SinOsc: {
    ar(freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
  };
  readonly SinOscFB: {
    ar(freq?: UGenInputLike, feedback?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, feedback?: UGenInputLike): UGenInput;
  };
  readonly Slew: {
    ar(in_?: UGenInputLike, up?: UGenInputLike, dn?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, up?: UGenInputLike, dn?: UGenInputLike): UGenInput;
  };
  readonly Slope: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly SpecCentroid: {
    kr(chain: UGenInputLike): UGenInput;
  };
  readonly SpecFlatness: {
    kr(chain: UGenInputLike): UGenInput;
  };
  readonly SpecPcile: {
    kr(chain: UGenInputLike, fraction?: UGenInputLike, interpolate?: UGenInputLike): UGenInput;
  };
  readonly Spring: {
    ar(in_?: UGenInputLike, spring?: UGenInputLike, damp?: UGenInputLike): UGenInput;
  };
  readonly StandardL: {
    ar(freq?: UGenInputLike, k?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, k?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly StandardN: {
    ar(freq?: UGenInputLike, k?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, k?: UGenInputLike, xi?: UGenInputLike, yi?: UGenInputLike): UGenInput;
  };
  readonly Stepper: {
    ar(trig?: UGenInputLike, reset?: UGenInputLike, min?: UGenInputLike, max?: UGenInputLike, step?: UGenInputLike, resetval?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, reset?: UGenInputLike, min?: UGenInputLike, max?: UGenInputLike, step?: UGenInputLike, resetval?: UGenInputLike): UGenInput;
  };
  readonly StereoConvolution2L: {
    ar(in_: UGenInputLike, kernelL: UGenInputLike, kernelR: UGenInputLike, trigger: UGenInputLike, framesize?: UGenInputLike, crossfade?: UGenInputLike): UGenInput;
  };
  readonly SubsampleOffset: {
    ir(): UGenInput;
  };
  readonly Sweep: {
    ar(trig?: UGenInputLike, rate?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, rate?: UGenInputLike): UGenInput;
  };
  readonly SyncSaw: {
    ar(syncFreq?: UGenInputLike, sawFreq?: UGenInputLike): UGenInput;
    kr(syncFreq?: UGenInputLike, sawFreq?: UGenInputLike): UGenInput;
  };
  readonly T2A: {
    ar(in_?: UGenInputLike, offset?: UGenInputLike): UGenInput;
  };
  readonly T2K: {
    kr(in_?: UGenInputLike): UGenInput;
  };
  readonly TBall: {
    ar(in_?: UGenInputLike, g?: UGenInputLike, damp?: UGenInputLike, friction?: UGenInputLike): UGenInput;
  };
  readonly TDelay: {
    ar(trig?: UGenInputLike, dur?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, dur?: UGenInputLike): UGenInput;
  };
  readonly TDuty: {
    ar(dur?: UGenInputLike, reset?: UGenInputLike, action?: UGenInputLike, level?: UGenInputLike, gapFirst?: UGenInputLike): UGenInput;
    kr(dur?: UGenInputLike, reset?: UGenInputLike, action?: UGenInputLike, level?: UGenInputLike, gapFirst?: UGenInputLike): UGenInput;
  };
  readonly TExpRand: {
    ar(lo?: UGenInputLike, hi?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    kr(lo?: UGenInputLike, hi?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly TGrains: {
    ar(numChannels?: number, trigger?: UGenInputLike, bufnum?: UGenInputLike, rate?: UGenInputLike, centerPos?: UGenInputLike, dur?: UGenInputLike, pan?: UGenInputLike, amp?: UGenInputLike, interp?: UGenInputLike): UGenInput;
  };
  readonly TIRand: {
    kr(lo?: UGenInputLike, hi?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    ar(lo?: UGenInputLike, hi?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly TRand: {
    kr(lo?: UGenInputLike, hi?: UGenInputLike, trig?: UGenInputLike): UGenInput;
    ar(lo?: UGenInputLike, hi?: UGenInputLike, trig?: UGenInputLike): UGenInput;
  };
  readonly TWindex: {
    ar(trig: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[], normalize?: UGenInputLike): UGenInput;
    kr(trig: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[], normalize?: UGenInputLike): UGenInput;
  };
  readonly Timer: {
    ar(trig?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike): UGenInput;
  };
  readonly ToggleFF: {
    ar(trig?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike): UGenInput;
  };
  readonly Trapezoid: {
    ar(in_?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, a?: UGenInputLike, b?: UGenInputLike, c?: UGenInputLike, d?: UGenInputLike): UGenInput;
  };
  readonly Trig: {
    ar(trig?: UGenInputLike, dur?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, dur?: UGenInputLike): UGenInput;
  };
  readonly Trig1: {
    ar(trig?: UGenInputLike, dur?: UGenInputLike): UGenInput;
    kr(trig?: UGenInputLike, dur?: UGenInputLike): UGenInput;
  };
  readonly TwoPole: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, radius?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, radius?: UGenInputLike): UGenInput;
  };
  readonly TwoZero: {
    ar(in_?: UGenInputLike, freq?: UGenInputLike, radius?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, freq?: UGenInputLike, radius?: UGenInputLike): UGenInput;
  };
  readonly UnaryOpUGen: {
    ir(a: UGenInputLike): UGenInput;
    ar(a: UGenInputLike): UGenInput;
    kr(a: UGenInputLike): UGenInput;
  };
  readonly VDiskIn: {
    ar(numChannels: number, bufnum: UGenInputLike, rate?: UGenInputLike, loop?: UGenInputLike, sendID?: UGenInputLike): UGenInput;
  };
  readonly VOsc: {
    ar(bufpos: UGenInputLike, freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
    kr(bufpos: UGenInputLike, freq?: UGenInputLike, phase?: UGenInputLike): UGenInput;
  };
  readonly VOsc3: {
    ar(bufpos: UGenInputLike, freq1?: UGenInputLike, freq2?: UGenInputLike, freq3?: UGenInputLike): UGenInput;
    kr(bufpos: UGenInputLike, freq1?: UGenInputLike, freq2?: UGenInputLike, freq3?: UGenInputLike): UGenInput;
  };
  readonly VarSaw: {
    ar(freq?: UGenInputLike, iphase?: UGenInputLike, width?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, iphase?: UGenInputLike, width?: UGenInputLike): UGenInput;
  };
  readonly Vibrato: {
    ar(freq?: UGenInputLike, rate?: UGenInputLike, depth?: UGenInputLike, delay?: UGenInputLike, onset?: UGenInputLike, rateVariation?: UGenInputLike, depthVariation?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
    kr(freq?: UGenInputLike, rate?: UGenInputLike, depth?: UGenInputLike, delay?: UGenInputLike, onset?: UGenInputLike, rateVariation?: UGenInputLike, depthVariation?: UGenInputLike, iphase?: UGenInputLike): UGenInput;
  };
  readonly Warp1: {
    ar(numChannels?: number, bufnum?: UGenInputLike, pointer?: UGenInputLike, freqScale?: UGenInputLike, windowSize?: UGenInputLike, envbufnum?: UGenInputLike, overlaps?: UGenInputLike, windowRandRatio?: UGenInputLike, interp?: UGenInputLike): UGenInput;
  };
  readonly WhiteNoise: {
    ar(): UGenInput;
    kr(): UGenInput;
  };
  readonly Wrap: {
    ar(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike, lo?: UGenInputLike, hi?: UGenInputLike): UGenInput;
  };
  readonly WrapIndex: {
    kr(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
    ir(bufnum: UGenInputLike, in_?: UGenInputLike): UGenInput;
  };
  readonly XFade2: {
    ar(inA: UGenInputLike, inB: UGenInputLike, pan?: UGenInputLike, level?: UGenInputLike): UGenInput;
    kr(inA: UGenInputLike, inB: UGenInputLike, pan?: UGenInputLike, level?: UGenInputLike): UGenInput;
  };
  readonly XLine: {
    ar(start?: UGenInputLike, end?: UGenInputLike, dur?: UGenInputLike, action?: UGenInputLike): UGenInput;
    kr(start?: UGenInputLike, end?: UGenInputLike, dur?: UGenInputLike, action?: UGenInputLike): UGenInput;
  };
  readonly XOut: {
    ar(bus: UGenInputLike, xfade: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
    kr(bus: UGenInputLike, xfade: UGenInputLike, channelsArray: UGenInputLike | UGenInputLike[]): UGenInput;
  };
  readonly ZeroCrossing: {
    ar(in_?: UGenInputLike): UGenInput;
    kr(in_?: UGenInputLike): UGenInput;
  };
}

export type Graph = GraphUGens & GraphOperators;
