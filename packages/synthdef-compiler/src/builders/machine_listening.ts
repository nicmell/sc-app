// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Autocorrelation based beat tracker" , :rates #{:kr} :num-outs 4 :doc "The
 * underlying model assumes 4/4, but it should work on any isochronous beat
 * structure, though there are biases to 100-120 bpm; a fast 7/8 may not be
 * tracked in that sense. There are four k-rate outputs, being ticks at quarter,
 * eighth and sixteenth level from the determined beat, and the current detected
 * tempo. Note that the sixteenth note output won't necessarily make much sense
 * if the music being tracked has swing; it is provided just as a convenience.
 * This beat tracker determines the beat, biased to the midtempo range by
 * weighting functions. It does not determine the measure level, only a tactus.
 * It is also slow reacting, using a 6 second temporal window for its
 * autocorrelation maneouvres. Don't expect human musician level predictive
 * tracking. On the other hand, it is tireless, relatively general (though
 * obviously best at transient 4/4 heavy material without much expressive tempo
 * variation), and can form the basis of computer processing that is decidedly
 * faster than human.
 * 
 * The underlying model assumes 4/4, but it should work on any isochronous beat
 * structure, though there are biases to 100-120 bpm; a fast 7/8 may not be
 * tracked in that sense. There are four k-rate outputs, being ticks at quarter,
 * eighth and sixteenth level from the determined beat, and the current detected
 * tempo. Note that the sixteenth note output won't necessarily make much sense
 * if the music being tracked has swing; it is provided just as a convenience.
 * This beat tracker determines the beat, biased to the midtempo range by
 * weighting functions. It does not determine the measure level, only a tactus.
 * It is also slow reacting, using a 6 second temporal window for its
 * autocorrelation maneouvres. Don't expect human musician level predictive
 * tracking. On the other hand, it is tireless, relatively general (though
 * obviously best at transient 4/4 heavy material without much expressive tempo
 * variation), and can form the basis of computer processing that is decidedly
 * faster than human.
 */
export class BeatTrack {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _lock!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BeatTrack {
    const b = new BeatTrack();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._lock = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Audio input to track, already passed through an FFT UGen; the expected size of
   * FFT is 1024 for 44100 and 48000 sampling rate, and 2048 for double those. No
   * other sampling rates are supported.
   */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * If this argument is greater than 0.5, the tracker will lock at its current
   * periodicity and continue from the current phase. Whilst it updates the model's
   * phase and period, this is not reflected in the output until lock goes back
   * below 0.5.
   */
  lock(v: UGenInputLike): this {
    this._lock = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._lock);
    const idx = def.addUgen("BeatTrack", this._calcRate, inputs, 4, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Template matching beat tracker. This beat tracker is based on exhaustively
 * testing particular template patterns against feature streams; the testing
 * takes place every 0.5 seconds. The two basic templates are a straight
 * (groove=0) and a swung triplet (groove=1) pattern of 16th notes; this pattern
 * is tried out at scalings corresponding to the tempi from 60 to 180 bpm. This
 * is the cross-corellation method of beat tracking. A majority vote is taken on
 * the best tempo detected, but this must be confirmed by a consistency check
 * after a phase estimate. Such a consistency check helps to avoid wild
 * fluctuating estimates, but is at the expense of an additional half second
 * delay. The latency of the beat tracker with default settings is thus at least
 * 2.5 seconds; because of block-based amortisation of calculation, it is
 * actually around 2.8 seconds latency for a 2.0 second temporal window. This
 * beat tracker is designed to be flexible for user needs; you can try out
 * different window sizes, tempo weights and combinations of features. However,
 * there are no guarantees on stability and effectiveness, and you will need to
 * explore such parameters for a particular situation.
 */
export class BeatTrack2 {
  private _calcRate!: Rate;
  private _busindex!: UGenInput;
  private _numfeatures!: UGenInput;
  private _windowsize!: UGenInput;
  private _phaseaccuracy!: UGenInput;
  private _lock!: UGenInput;
  private _weightingscheme!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BeatTrack2 {
    const b = new BeatTrack2();
    b._calcRate = 'control';
    b._busindex = { tag: 'constant', val: 0 };
    b._numfeatures = { tag: 'constant', val: 0 };
    b._windowsize = { tag: 'constant', val: 2 };
    b._phaseaccuracy = { tag: 'constant', val: 0.02 };
    b._lock = { tag: 'constant', val: 0 };
    b._weightingscheme = { tag: 'constant', val: -2.1 };
    return b;
  }

  /**
   * Audio input to track, already analysed into N features, passed in via a
   * control bus number from which to retrieve consecutive streams.
   */
  busindex(v: UGenInputLike): this {
    this._busindex = toUGenInput(v);
    return this;
  }

  /** How many features (ie how many control buses) are provided */
  numfeatures(v: UGenInputLike): this {
    this._numfeatures = toUGenInput(v);
    return this;
  }

  /**
   * Size of the temporal window desired (2.0 to 3.0 seconds models the human
   * temporal window). You might use longer values for stability of estimate at the
   * expense of reactiveness.
   */
  windowsize(v: UGenInputLike): this {
    this._windowsize = toUGenInput(v);
    return this;
  }

  /**
   * Relates to how many different phases to test. At the default, 50 different
   * phases spaced by phaseaccuracy seconds would be tried out for 60bpm; 16 would
   * be trialed for 180 bpm. Larger phaseaccuracy means more tests and more CPU
   * cost.
   */
  phaseaccuracy(v: UGenInputLike): this {
    this._phaseaccuracy = toUGenInput(v);
    return this;
  }

  /**
   * If this argument is greater than 0.5, the tracker will lock at its current
   * periodicity and continue from the current phase. Whilst it updates the model's
   * phase and period, this is not reflected in the output until lock goes back
   * below 0.5.
   */
  lock(v: UGenInputLike): this {
    this._lock = toUGenInput(v);
    return this;
  }

  /**
   * Use (-2.5) for flat weighting of tempi, (-1.5) for compensation weighting
   * based on the number of events tested (because different periods allow
   * different numbers of events within the temporal window) or otherwise a bufnum
   * from 0 upwards for passing an array of 120 individual tempo weights; tempi go
   * from 60 to 179 bpm in steps of one bpm, so you must have a buffer of 120
   * values.
   */
  weightingscheme(v: UGenInputLike): this {
    this._weightingscheme = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._busindex);
    inputs.push(this._numfeatures);
    inputs.push(this._windowsize);
    inputs.push(this._phaseaccuracy);
    inputs.push(this._lock);
    inputs.push(this._weightingscheme);
    const idx = def.addUgen("BeatTrack2", this._calcRate, inputs, 6, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A (12TET major/minor) key tracker based on a pitch class profile of energy
 * across FFT bins and matching this to templates for major and minor scales in
 * all transpositions. It assumes a 440 Hz concert A reference. Output is 0-11 C
 * major to B major, 12-23 C minor to B minor
 */
export class KeyTrack {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _keydecay!: UGenInput;
  private _chromaleak!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): KeyTrack {
    const b = new KeyTrack();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._keydecay = { tag: 'constant', val: 2 };
    b._chromaleak = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Audio input to track. This must have been pre-analysed by a 4096 size FFT. */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * Number of seconds for the influence of a window on the final key decision to
   * decay by 40dB (to 0.01 its original value)
   */
  keydecay(v: UGenInputLike): this {
    this._keydecay = toUGenInput(v);
    return this;
  }

  /**
   * Each frame, the chroma values are set to the previous value multiplied by the
   * chromadecay. 0.0 will start each frame afresh with no memory.
   */
  chromaleak(v: UGenInputLike): this {
    this._chromaleak = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._keydecay);
    inputs.push(this._chromaleak);
    const idx = def.addUgen("KeyTrack", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A perceptual loudness function which outputs loudness in sones; this is a
 * variant of an MP3 perceptual model, summing excitation in ERB bands. It models
 * simple spectral and temporal masking, with equal loudness contour correction
 * in ERB bands to obtain phons (relative dB), then a phon to sone transform. The
 * final output is typically in the range of 0 to 64 sones, though higher values
 * can occur with specific synthesised stimuli.
 */
export class Loudness {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _smask!: UGenInput;
  private _tmask!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Loudness {
    const b = new Loudness();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._smask = { tag: 'constant', val: 0.25 };
    b._tmask = { tag: 'constant', val: 1 };
    return b;
  }

  /** Audio input to track, which has been pre-analysed by the FFT UGen */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * Spectral masking param: lower bins mask higher bin power within ERB bands,
   * with a power falloff (leaky integration multiplier) of smask per bin
   */
  smask(v: UGenInputLike): this {
    this._smask = toUGenInput(v);
    return this;
  }

  /**
   * Temporal masking param: the phon level let through in an ERB band is the
   * maximum of the new measurement, and the previous minus tmask phons
   */
  tmask(v: UGenInputLike): this {
    this._tmask = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._smask);
    inputs.push(this._tmask);
    const idx = def.addUgen("Loudness", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class MFCC {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _numcoeff!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): MFCC {
    const b = new MFCC();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._numcoeff = { tag: 'constant', val: 13 };
    return b;
  }

  /** Audio input to track, which has been pre-analysed by the FFT UGen */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /** Number of coefficients, defaults to 13, maximum of 42 */
  numcoeff(v: UGenInputLike): this {
    this._numcoeff = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._numcoeff);
    const idx = def.addUgen("MFCC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * An onset detector for musical audio signals - detects the beginning of
 * notes/drumbeats/etc. Outputs a control-rate trigger signal which is 1 when an
 * onset is detected, and 0 otherwise. For the FFT chain, you should typically
 * use a frame size of 512 or 1024 (at 44.1 kHz sampling rate) and 50% hop size
 * (which is the default setting in SC). For different sampling rates choose an
 * FFT size to cover a similar time-span (around 10 to 20 ms). The onset
 * detection should work well for a general range of monophonic and polyphonic
 * audio signals. The onset detection is purely based on signal analysis and does
 * not make use of any top-down inferences such as tempo.
 */
export class Onsets {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _threshold!: UGenInput;
  private _odftype!: UGenInput;
  private _relaxtime!: UGenInput;
  private _floor!: UGenInput;
  private _mingap!: UGenInput;
  private _medianspan!: UGenInput;
  private _whtype!: UGenInput;
  private _rawodf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Onsets {
    const b = new Onsets();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._threshold = { tag: 'constant', val: 0.5 };
    b._odftype = { tag: 'constant', val: 3 };
    b._relaxtime = { tag: 'constant', val: 1 };
    b._floor = { tag: 'constant', val: 0.1 };
    b._mingap = { tag: 'constant', val: 10 };
    b._medianspan = { tag: 'constant', val: 11 };
    b._whtype = { tag: 'constant', val: 1 };
    b._rawodf = { tag: 'constant', val: 0 };
    return b;
  }

  /** an FFT chain */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * the detection threshold, typically between 0 and 1, although in rare cases you
   * may find values outside this range useful
   */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * the function used to analyse the signal. Options: nPOWER, MAGSUM, COMPLEX,
   * RCOMPLEX (default), PHASE, WPHASE and MKL. Default is RCOMPLEX.
   */
  odftype(v: UGenInputLike): this {
    this._odftype = toUGenInput(v);
    return this;
  }

  /**
   * specifies the time (in seconds) for the normalisation to forget about a recent
   * onset. If you find too much re-triggering (e.g. as a note dies away unevenly)
   * then you might wish to increase this value.
   */
  relaxtime(v: UGenInputLike): this {
    this._relaxtime = toUGenInput(v);
    return this;
  }

  /**
   * is a lower limit, connected to the idea of how quiet the sound is expected to
   * get without becoming indistinguishable from noise. For some cleanly-recorded
   * classical music with wide dynamic variations, I found it helpful to go down as
   * far as 0.000001.
   */
  floor(v: UGenInputLike): this {
    this._floor = toUGenInput(v);
    return this;
  }

  /**
   * specifies a minimum gap (in FFT frames) between onset detections, a
   * brute-force way to prevent too many doubled detections.
   */
  mingap(v: UGenInputLike): this {
    this._mingap = toUGenInput(v);
    return this;
  }

  /**
   * specifies the size (in FFT frames) of the median window used for smoothing the
   * detection function before triggering.
   */
  medianspan(v: UGenInputLike): this {
    this._medianspan = toUGenInput(v);
    return this;
  }

  whtype(v: UGenInputLike): this {
    this._whtype = toUGenInput(v);
    return this;
  }

  rawodf(v: UGenInputLike): this {
    this._rawodf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._threshold);
    inputs.push(this._odftype);
    inputs.push(this._relaxtime);
    inputs.push(this._floor);
    inputs.push(this._mingap);
    inputs.push(this._medianspan);
    inputs.push(this._whtype);
    inputs.push(this._rawodf);
    const idx = def.addUgen("Onsets", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Given an FFT chain, this measures the spectral centroid, which is the weighted
 * mean frequency, or the centre of mass of the spectrum. (DC is ignored.) This
 * can be a useful indicator of the perceptual brightness of a signal.
 */
export class SpecCentroid {
  private _calcRate!: Rate;
  private _chain!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): SpecCentroid {
    const b = new SpecCentroid();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    return b;
  }

  /** An FFT chain */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    const idx = def.addUgen("SpecCentroid", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Given an FFT chain this calculates the Spectral Flatness measure, defined as a
 * power spectrum's geometric mean divided by its arithmetic mean. This gives a
 * measure which ranges from approx 0 for a pure sinusoid, to approx 1 for white
 * noise. The measure is calculated linearly. For some applications you may wish
 * to convert the value to a decibel scale - an example of such conversion is
 * shown below.
 */
export class SpecFlatness {
  private _calcRate!: Rate;
  private _chain!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): SpecFlatness {
    const b = new SpecFlatness();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    return b;
  }

  /** An FFT chain */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    const idx = def.addUgen("SpecFlatness", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Find a percentile of FFT magnitude spectrum" , :rates #{:kr} :doc "Given an
 * FFT chain this calculates the cumulative distribution of the frequency
 * spectrum, and outputs the frequency value which corresponds to the desired
 * percentile. For example, to find the frequency at which 90% of the spectral
 * energy lies below that frequency, you want the 90-percentile, which means the
 * value of fraction should be 0.9. The 90-percentile or 95-percentile is often
 * used as a measure of spectral roll-off. The optional third argument
 * interpolate specifies whether interpolation should be used to try and make the
 * percentile frequency estimate more accurate, at the cost of a little higher
 * CPU usage. Set it to 1 to enable this.
 * 
 * Given an FFT chain this calculates the cumulative distribution of the
 * frequency spectrum, and outputs the frequency value which corresponds to the
 * desired percentile. For example, to find the frequency at which 90% of the
 * spectral energy lies below that frequency, you want the 90-percentile, which
 * means the value of fraction should be 0.9. The 90-percentile or 95-percentile
 * is often used as a measure of spectral roll-off. The optional third argument
 * interpolate specifies whether interpolation should be used to try and make the
 * percentile frequency estimate more accurate, at the cost of a little higher
 * CPU usage. Set it to 1 to enable this.
 */
export class SpecPcile {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _fraction!: UGenInput;
  private _interpolate!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): SpecPcile {
    const b = new SpecPcile();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._fraction = { tag: 'constant', val: 0.5 };
    b._interpolate = { tag: 'constant', val: 0 };
    return b;
  }

  /** An FFT chain */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /** percentage of the spectral energy you which to find the frequency for */
  fraction(v: UGenInputLike): this {
    this._fraction = toUGenInput(v);
    return this;
  }

  /** Interpolation toggle - 0 off 1 on. */
  interpolate(v: UGenInputLike): this {
    this._interpolate = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._fraction);
    inputs.push(this._interpolate);
    const idx = def.addUgen("SpecPcile", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
