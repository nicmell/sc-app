// @generated — DO NOT EDIT. Regenerate with scripts/generate_ugens_component.mjs
//
// Implements the typed `ugens` WIT interface. Each method receives
// a per-UGen args record, unpacks it (applying registry defaults
// for optional fields), and delegates to `SynthDef::add_ugen` via
// the shared `delegate_ugen` helper. The canonical PascalCase
// class name for each UGen is baked in at generation time,
// pulled from the `pub struct` declarations under src/builders/.

#![allow(warnings)]

use super::bindings;
use super::bindings::exports::scsynthdef::compiler::ugens::{
    Guest as UgensGuest, Rate as WitRate,
    SynthDefBorrow, UgenInput as WitUgenInput,
    A2KArgs,
    AllpassCArgs,
    AllpassLArgs,
    AllpassNArgs,
    AmpCompAArgs,
    AmpCompArgs,
    AmplitudeArgs,
    ApfArgs,
    BAllPassArgs,
    BBandPassArgs,
    BBandStopArgs,
    BHiPassArgs,
    BHiShelfArgs,
    BLowPassArgs,
    BLowShelfArgs,
    BPeakEqArgs,
    Balance2Args,
    BallArgs,
    BeatTrack2Args,
    BeatTrackArgs,
    BiPanB2Args,
    BlipArgs,
    BpfArgs,
    Bpz2Args,
    BrfArgs,
    Brz2Args,
    BufAllpassCArgs,
    BufAllpassLArgs,
    BufAllpassNArgs,
    BufChannelsArgs,
    BufCombCArgs,
    BufCombLArgs,
    BufCombNArgs,
    BufDelayCArgs,
    BufDelayLArgs,
    BufDelayNArgs,
    BufDurArgs,
    BufFramesArgs,
    BufRateScaleArgs,
    BufRdArgs,
    BufSampleRateArgs,
    BufSamplesArgs,
    BufWrArgs,
    COscArgs,
    CheckBadValuesArgs,
    ClearBufArgs,
    ClipArgs,
    CoinGateArgs,
    CombCArgs,
    CombLArgs,
    CombNArgs,
    CompanderArgs,
    Convolution2Args,
    Convolution2LArgs,
    Convolution3Args,
    ConvolutionArgs,
    CrackleArgs,
    CuspLArgs,
    CuspNArgs,
    DbrownArgs,
    DbufrdArgs,
    DbufwrArgs,
    DcArgs,
    Decay2Args,
    DecayArgs,
    DecodeB2Args,
    DegreeToKeyArgs,
    DelTapRdArgs,
    DelTapWrArgs,
    Delay1Args,
    Delay2Args,
    DelayCArgs,
    DelayLArgs,
    DelayNArgs,
    DemandArgs,
    DemandEnvGenArgs,
    DetectIndexArgs,
    DetectSilenceArgs,
    DgeomArgs,
    DibrownArgs,
    DiskInArgs,
    DiskOutArgs,
    DiwhiteArgs,
    DonceArgs,
    DoneArgs,
    DpollArgs,
    DrandArgs,
    DseqArgs,
    DserArgs,
    DseriesArgs,
    DshufArgs,
    DstutterArgs,
    Dswitch1Args,
    DswitchArgs,
    Dust2Args,
    DustArgs,
    DutyArgs,
    DwhiteArgs,
    DxrandArgs,
    EnvGenArgs,
    ExpRandArgs,
    FSinOscArgs,
    FbSineCArgs,
    FbSineLArgs,
    FbSineNArgs,
    FftArgs,
    FftTriggerArgs,
    FoldArgs,
    FormantArgs,
    FormletArgs,
    FosArgs,
    FreeArgs,
    FreeSelfArgs,
    FreeSelfWhenDoneArgs,
    FreeVerb2Args,
    FreeVerbArgs,
    FreqShiftArgs,
    GVerbArgs,
    GateArgs,
    GbmanLArgs,
    GbmanNArgs,
    Gendy1Args,
    Gendy2Args,
    Gendy3Args,
    GrainBufArgs,
    GrainFmArgs,
    GrainInArgs,
    GrainSinArgs,
    HasherArgs,
    HenonCArgs,
    HenonLArgs,
    HenonNArgs,
    HilbertArgs,
    HpfArgs,
    Hpz1Args,
    Hpz2Args,
    IEnvGenArgs,
    IRandArgs,
    IfftArgs,
    ImpulseArgs,
    InArgs,
    InFeedbackArgs,
    InRangeArgs,
    InRectArgs,
    InTrigArgs,
    IndexArgs,
    IndexInBetweenArgs,
    IntegratorArgs,
    K2AArgs,
    KeyStateArgs,
    KeyTrackArgs,
    KlangArgs,
    KlankArgs,
    Lag2Args,
    Lag2UdArgs,
    Lag3Args,
    Lag3UdArgs,
    LagArgs,
    LagInArgs,
    LagUdArgs,
    LastValueArgs,
    LatchArgs,
    LatoocarfianCArgs,
    LatoocarfianLArgs,
    LatoocarfianNArgs,
    LeakDcArgs,
    LeastChangeArgs,
    LfClipNoiseArgs,
    LfCubArgs,
    LfGaussArgs,
    LfNoise0Args,
    LfNoise1Args,
    LfNoise2Args,
    LfParArgs,
    LfPulseArgs,
    LfSawArgs,
    LfTriArgs,
    LfdClipNoiseArgs,
    LfdNoise0Args,
    LfdNoise1Args,
    LfdNoise3Args,
    LimiterArgs,
    LinCongCArgs,
    LinCongLArgs,
    LinCongNArgs,
    LinExpArgs,
    LinPan2Args,
    LinRandArgs,
    LinXFade2Args,
    LineArgs,
    LinenArgs,
    LocalBufArgs,
    LocalInArgs,
    LocalOutArgs,
    LogisticArgs,
    LorenzLArgs,
    LoudnessArgs,
    LpfArgs,
    Lpz1Args,
    Lpz2Args,
    MantissaMaskArgs,
    MaxLocalBufsArgs,
    MedianArgs,
    MfccArgs,
    MidEqArgs,
    MoogFfArgs,
    MostChangeArgs,
    MouseButtonArgs,
    MouseXArgs,
    MouseYArgs,
    MulAddArgs,
    NRandArgs,
    NormalizerArgs,
    OffsetOutArgs,
    OnePoleArgs,
    OneZeroArgs,
    OnsetsArgs,
    OscArgs,
    OutArgs,
    PSinGrainArgs,
    Pan2Args,
    Pan4Args,
    PanAzArgs,
    PanB2Args,
    PanBArgs,
    PartConvArgs,
    PauseArgs,
    PauseSelfArgs,
    PauseSelfWhenDoneArgs,
    PeakArgs,
    PeakFollowerArgs,
    PhasorArgs,
    PitchArgs,
    PitchShiftArgs,
    PlayBufArgs,
    PluckArgs,
    PollArgs,
    PulseArgs,
    PulseCountArgs,
    PulseDividerArgs,
    PvAddArgs,
    PvBinScrambleArgs,
    PvBinShiftArgs,
    PvBinWipeArgs,
    PvBrickWallArgs,
    PvConformalMapArgs,
    PvConjArgs,
    PvCopyArgs,
    PvCopyPhaseArgs,
    PvDiffuserArgs,
    PvDivArgs,
    PvHainsworthFooteArgs,
    PvJensenAndersenArgs,
    PvLocalMaxArgs,
    PvMagAboveArgs,
    PvMagBelowArgs,
    PvMagClipArgs,
    PvMagDivArgs,
    PvMagFreezeArgs,
    PvMagMulArgs,
    PvMagNoiseArgs,
    PvMagShiftArgs,
    PvMagSmearArgs,
    PvMagSquaredArgs,
    PvMaxArgs,
    PvMinArgs,
    PvMulArgs,
    PvPhaseShift270Args,
    PvPhaseShift90Args,
    PvPhaseShiftArgs,
    PvRandCombArgs,
    PvRandWipeArgs,
    PvRectComb2Args,
    PvRectCombArgs,
    QuadCArgs,
    QuadLArgs,
    QuadNArgs,
    RampArgs,
    RandArgs,
    RandIdArgs,
    RandSeedArgs,
    RecordBufArgs,
    ReplaceOutArgs,
    ResonzArgs,
    RhpfArgs,
    RingzArgs,
    RlpfArgs,
    Rotate2Args,
    RunningMaxArgs,
    RunningMinArgs,
    RunningSumArgs,
    SawArgs,
    SchmidtArgs,
    ScopeOut2Args,
    ScopeOutArgs,
    SelectArgs,
    SendReplyArgs,
    SendTrigArgs,
    SetBufArgs,
    SetResetFfArgs,
    ShaperArgs,
    SharedInArgs,
    SharedOutArgs,
    SilentArgs,
    SinOscArgs,
    SinOscFbArgs,
    SlewArgs,
    SlopeArgs,
    SosArgs,
    SpecCentroidArgs,
    SpecFlatnessArgs,
    SpecPcileArgs,
    SpringArgs,
    StandardLArgs,
    StandardNArgs,
    StepperArgs,
    StereoConvolution2LArgs,
    SweepArgs,
    SyncSawArgs,
    T2AArgs,
    T2KArgs,
    TBallArgs,
    TDelayArgs,
    TDutyArgs,
    TExpRandArgs,
    TGrainsArgs,
    TRandArgs,
    TWindexArgs,
    TiRandArgs,
    TimerArgs,
    ToggleFfArgs,
    TrapezoidArgs,
    Trig1Args,
    TrigArgs,
    TwoPoleArgs,
    TwoZeroArgs,
    VDiskInArgs,
    VOsc3Args,
    VOscArgs,
    VarSawArgs,
    VibratoArgs,
    Warp1Args,
    WrapArgs,
    WrapIndexArgs,
    XFade2Args,
    XLineArgs,
    XOutArgs,
    ZeroCrossingArgs,
};
use super::{Component, SynthDefResource, rate_from_wit, ugen_input_from_wit, ugen_input_to_wit};
use crate::UGenInput;

/// Shared body for every typed ugen shim. Appends a UGen node to the
/// borrowed SynthDef and returns its synth-index wrapped as a
/// `UgenInput::Ugen(...)`. `num_outputs` defaults to the value from
/// the bundled registry for the given class, unless a caller has
/// passed an explicit override (for `num-channels` UGens).
fn delegate_ugen(
    def: SynthDefBorrow<'_>,
    class_name: &'static str,
    ugen_rate: WitRate,
    inputs: Vec<UGenInput>,
    num_outputs_override: Option<u32>,
) -> WitUgenInput {
    let num_outputs = num_outputs_override.unwrap_or_else(|| {
        crate::registry::lookup_ugen(class_name)
            .and_then(|e| e.num_outputs)
            .unwrap_or(1)
    });
    let idx = def.get::<SynthDefResource>().inner.borrow_mut().add_ugen(
        class_name,
        rate_from_wit(ugen_rate),
        inputs,
        num_outputs,
        0,
    );
    WitUgenInput::Ugen(idx)
}

impl UgensGuest for Component {
    fn registry_json() -> String {
        let grouped: Vec<(String, Vec<&_>)> = crate::registry::ugens_by_category()
            .iter()
            .map(|(cat, slice)| (cat.to_string(), slice.iter().collect()))
            .collect();
        serde_json::to_string(&grouped)
            .unwrap_or_else(|e| format!(r#"{{"error":"{}"}}"#, e))
    }

    fn a2_k(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: A2KArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "A2K", ugen_rate, inputs, None)
    }

    fn allpass_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: AllpassCArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time, decay_time];
        delegate_ugen(def, "AllpassC", ugen_rate, inputs, None)
    }

    fn allpass_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: AllpassLArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time, decay_time];
        delegate_ugen(def, "AllpassL", ugen_rate, inputs, None)
    }

    fn allpass_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: AllpassNArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time, decay_time];
        delegate_ugen(def, "AllpassN", ugen_rate, inputs, None)
    }

    fn amp_comp(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: AmpCompArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(261.6256));
        let root = args.root.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(261.6256));
        let exp = args.exp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.3333));
        let inputs: Vec<UGenInput> = vec![freq, root, exp];
        delegate_ugen(def, "AmpComp", ugen_rate, inputs, None)
    }

    fn amp_comp_a(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: AmpCompAArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1000.0));
        let root = args.root.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let min_amp = args.min_amp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.32));
        let root_amp = args.root_amp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![freq, root, min_amp, root_amp];
        delegate_ugen(def, "AmpCompA", ugen_rate, inputs, None)
    }

    fn amplitude(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: AmplitudeArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let attack_time = args.attack_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let release_time = args.release_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![in_, attack_time, release_time];
        delegate_ugen(def, "Amplitude", ugen_rate, inputs, None)
    }

    fn apf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ApfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let radius = args.radius.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.8));
        let inputs: Vec<UGenInput> = vec![in_, freq, radius];
        delegate_ugen(def, "APF", ugen_rate, inputs, None)
    }

    fn b_all_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BAllPassArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "BAllPass", ugen_rate, inputs, None)
    }

    fn b_band_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BBandPassArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let bw = args.bw.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, bw];
        delegate_ugen(def, "BBandPass", ugen_rate, inputs, None)
    }

    fn b_band_stop(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BBandStopArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let bw = args.bw.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, bw];
        delegate_ugen(def, "BBandStop", ugen_rate, inputs, None)
    }

    fn b_hi_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BHiPassArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "BHiPass", ugen_rate, inputs, None)
    }

    fn b_hi_shelf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BHiShelfArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let rs = args.rs.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let db = args.db.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rs, db];
        delegate_ugen(def, "BHiShelf", ugen_rate, inputs, None)
    }

    fn b_low_pass(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BLowPassArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "BLowPass", ugen_rate, inputs, None)
    }

    fn b_low_shelf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BLowShelfArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let rs = args.rs.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let db = args.db.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rs, db];
        delegate_ugen(def, "BLowShelf", ugen_rate, inputs, None)
    }

    fn b_peak_eq(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BPeakEqArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1200.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let db = args.db.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq, db];
        delegate_ugen(def, "BPeakEQ", ugen_rate, inputs, None)
    }

    fn balance2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Balance2Args) -> WitUgenInput {
        let left = ugen_input_from_wit(args.left);
        let right = ugen_input_from_wit(args.right);
        let pos = args.pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![left, right, pos, level];
        delegate_ugen(def, "Balance2", ugen_rate, inputs, None)
    }

    fn ball(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BallArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let g = args.g.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let damp = args.damp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let friction = args.friction.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![in_, g, damp, friction];
        delegate_ugen(def, "Ball", ugen_rate, inputs, None)
    }

    fn beat_track(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BeatTrackArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let lock = args.lock.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![chain, lock];
        delegate_ugen(def, "BeatTrack", ugen_rate, inputs, None)
    }

    fn beat_track2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BeatTrack2Args) -> WitUgenInput {
        let busindex = ugen_input_from_wit(args.busindex);
        let numfeatures = ugen_input_from_wit(args.numfeatures);
        let windowsize = args.windowsize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let phaseaccuracy = args.phaseaccuracy.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.02));
        let lock = args.lock.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let weightingscheme = args.weightingscheme.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-2.1));
        let inputs: Vec<UGenInput> = vec![busindex, numfeatures, windowsize, phaseaccuracy, lock, weightingscheme];
        delegate_ugen(def, "BeatTrack2", ugen_rate, inputs, None)
    }

    fn bi_pan_b2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BiPanB2Args) -> WitUgenInput {
        let in_a = ugen_input_from_wit(args.in_a);
        let in_b = ugen_input_from_wit(args.in_b);
        let azimuth = ugen_input_from_wit(args.azimuth);
        let gain = args.gain.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_a, in_b, azimuth, gain];
        delegate_ugen(def, "BiPanB2", ugen_rate, inputs, None)
    }

    fn blip(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BlipArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let numharm = args.numharm.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(200.0));
        let inputs: Vec<UGenInput> = vec![freq, numharm];
        delegate_ugen(def, "Blip", ugen_rate, inputs, None)
    }

    fn bpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BpfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "BPF", ugen_rate, inputs, None)
    }

    fn bpz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Bpz2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "BPZ2", ugen_rate, inputs, None)
    }

    fn brf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BrfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "BRF", ugen_rate, inputs, None)
    }

    fn brown_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "BrownNoise", ugen_rate, inputs, None)
    }

    fn brz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Brz2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "BRZ2", ugen_rate, inputs, None)
    }

    fn buf_allpass_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufAllpassCArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time, decay_time];
        delegate_ugen(def, "BufAllpassC", ugen_rate, inputs, None)
    }

    fn buf_allpass_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufAllpassLArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time, decay_time];
        delegate_ugen(def, "BufAllpassL", ugen_rate, inputs, None)
    }

    fn buf_allpass_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufAllpassNArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time, decay_time];
        delegate_ugen(def, "BufAllpassN", ugen_rate, inputs, None)
    }

    fn buf_channels(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufChannelsArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "BufChannels", ugen_rate, inputs, None)
    }

    fn buf_comb_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufCombCArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time, decay_time];
        delegate_ugen(def, "BufCombC", ugen_rate, inputs, None)
    }

    fn buf_comb_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufCombLArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time, decay_time];
        delegate_ugen(def, "BufCombL", ugen_rate, inputs, None)
    }

    fn buf_comb_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufCombNArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time, decay_time];
        delegate_ugen(def, "BufCombN", ugen_rate, inputs, None)
    }

    fn buf_delay_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufDelayCArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time];
        delegate_ugen(def, "BufDelayC", ugen_rate, inputs, None)
    }

    fn buf_delay_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufDelayLArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time];
        delegate_ugen(def, "BufDelayL", ugen_rate, inputs, None)
    }

    fn buf_delay_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufDelayNArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![buf, in_, delay_time];
        delegate_ugen(def, "BufDelayN", ugen_rate, inputs, None)
    }

    fn buf_dur(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufDurArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "BufDur", ugen_rate, inputs, None)
    }

    fn buf_frames(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufFramesArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "BufFrames", ugen_rate, inputs, None)
    }

    fn buf_rate_scale(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufRateScaleArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "BufRateScale", ugen_rate, inputs, None)
    }

    fn buf_rd(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufRdArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let interpolation = args.interpolation.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let inputs: Vec<UGenInput> = vec![bufnum, phase, loop_, interpolation];
        delegate_ugen(def, "BufRd", ugen_rate, inputs, Some(num_channels))
    }

    fn buf_sample_rate(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufSampleRateArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "BufSampleRate", ugen_rate, inputs, None)
    }

    fn buf_samples(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufSamplesArgs) -> WitUgenInput {
        let buf = args.buf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "BufSamples", ugen_rate, inputs, None)
    }

    fn buf_wr(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: BufWrArgs) -> WitUgenInput {
        let input_array: Vec<UGenInput> = args.input_array.into_iter().map(ugen_input_from_wit).collect();
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array);
        inputs.push(bufnum);
        inputs.push(phase);
        inputs.push(loop_);
        delegate_ugen(def, "BufWr", ugen_rate, inputs, None)
    }

    fn c_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: COscArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let beats = args.beats.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![bufnum, freq, beats];
        delegate_ugen(def, "COsc", ugen_rate, inputs, None)
    }

    fn check_bad_values(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CheckBadValuesArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let id = args.id.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let post = args.post.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let inputs: Vec<UGenInput> = vec![in_, id, post];
        delegate_ugen(def, "CheckBadValues", ugen_rate, inputs, None)
    }

    fn clear_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ClearBufArgs) -> WitUgenInput {
        let buf = ugen_input_from_wit(args.buf);
        let inputs: Vec<UGenInput> = vec![buf];
        delegate_ugen(def, "ClearBuf", ugen_rate, inputs, None)
    }

    fn clip(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ClipArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, lo, hi];
        delegate_ugen(def, "Clip", ugen_rate, inputs, None)
    }

    fn clip_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "ClipNoise", ugen_rate, inputs, None)
    }

    fn coin_gate(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CoinGateArgs) -> WitUgenInput {
        let prob = ugen_input_from_wit(args.prob);
        let trig = ugen_input_from_wit(args.trig);
        let inputs: Vec<UGenInput> = vec![prob, trig];
        delegate_ugen(def, "CoinGate", ugen_rate, inputs, None)
    }

    fn comb_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CombCArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time, decay_time];
        delegate_ugen(def, "CombC", ugen_rate, inputs, None)
    }

    fn comb_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CombLArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time, decay_time];
        delegate_ugen(def, "CombL", ugen_rate, inputs, None)
    }

    fn comb_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CombNArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time, decay_time];
        delegate_ugen(def, "CombN", ugen_rate, inputs, None)
    }

    fn compander(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CompanderArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let control = args.control.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let thresh = args.thresh.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let slope_below = args.slope_below.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let slope_above = args.slope_above.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let clamp_time = args.clamp_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let relax_time = args.relax_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, control, thresh, slope_below, slope_above, clamp_time, relax_time];
        delegate_ugen(def, "Compander", ugen_rate, inputs, None)
    }

    fn control_dur(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "ControlDur", ugen_rate, inputs, None)
    }

    fn control_rate(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "ControlRate", ugen_rate, inputs, None)
    }

    fn convolution(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ConvolutionArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let kernel = ugen_input_from_wit(args.kernel);
        let framesize = args.framesize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![in_, kernel, framesize];
        delegate_ugen(def, "Convolution", ugen_rate, inputs, None)
    }

    fn convolution2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Convolution2Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let kernel = ugen_input_from_wit(args.kernel);
        let trigger = ugen_input_from_wit(args.trigger);
        let framesize = args.framesize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![in_, kernel, trigger, framesize];
        delegate_ugen(def, "Convolution2", ugen_rate, inputs, None)
    }

    fn convolution2_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Convolution2LArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let kernel = ugen_input_from_wit(args.kernel);
        let trigger = ugen_input_from_wit(args.trigger);
        let framesize = args.framesize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let crossfade = args.crossfade.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, kernel, trigger, framesize, crossfade];
        delegate_ugen(def, "Convolution2L", ugen_rate, inputs, None)
    }

    fn convolution3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Convolution3Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let kernel = ugen_input_from_wit(args.kernel);
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let framesize = args.framesize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![in_, kernel, trigger, framesize];
        delegate_ugen(def, "Convolution3", ugen_rate, inputs, None)
    }

    fn crackle(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CrackleArgs) -> WitUgenInput {
        let chaos_param = args.chaos_param.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.5));
        let inputs: Vec<UGenInput> = vec![chaos_param];
        delegate_ugen(def, "Crackle", ugen_rate, inputs, None)
    }

    fn cusp_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CuspLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.9));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, xi];
        delegate_ugen(def, "CuspL", ugen_rate, inputs, None)
    }

    fn cusp_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: CuspNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.9));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, xi];
        delegate_ugen(def, "CuspN", ugen_rate, inputs, None)
    }

    fn dbrown(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DbrownArgs) -> WitUgenInput {
        let length = ugen_input_from_wit(args.length);
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let step = args.step.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![length, lo, hi, step];
        delegate_ugen(def, "Dbrown", ugen_rate, inputs, None)
    }

    fn dbufrd(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DbufrdArgs) -> WitUgenInput {
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![bufnum, phase, loop_];
        delegate_ugen(def, "Dbufrd", ugen_rate, inputs, None)
    }

    fn dbufwr(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DbufwrArgs) -> WitUgenInput {
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let input = args.input.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![bufnum, phase, input, loop_];
        delegate_ugen(def, "Dbufwr", ugen_rate, inputs, None)
    }

    fn dc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DcArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "DC", ugen_rate, inputs, None)
    }

    fn decay(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DecayArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, decay_time];
        delegate_ugen(def, "Decay", ugen_rate, inputs, None)
    }

    fn decay2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Decay2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let attack_time = args.attack_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, attack_time, decay_time];
        delegate_ugen(def, "Decay2", ugen_rate, inputs, None)
    }

    fn decode_b2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DecodeB2Args) -> WitUgenInput {
        let num_channels = args.num_channels;
        let w = ugen_input_from_wit(args.w);
        let x = ugen_input_from_wit(args.x);
        let y = ugen_input_from_wit(args.y);
        let orientation = args.orientation.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![w, x, y, orientation];
        delegate_ugen(def, "DecodeB2", ugen_rate, inputs, Some(num_channels))
    }

    fn degree_to_key(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DegreeToKeyArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let octave = args.octave.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let inputs: Vec<UGenInput> = vec![bufnum, in_, octave];
        delegate_ugen(def, "DegreeToKey", ugen_rate, inputs, None)
    }

    fn del_tap_rd(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DelTapRdArgs) -> WitUgenInput {
        let buffer = args.buffer.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let delay = args.delay.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let interp = args.interp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![buffer, phase, delay, interp];
        delegate_ugen(def, "DelTapRd", ugen_rate, inputs, None)
    }

    fn del_tap_wr(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DelTapWrArgs) -> WitUgenInput {
        let buffer = args.buffer.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, in_];
        delegate_ugen(def, "DelTapWr", ugen_rate, inputs, None)
    }

    fn delay_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DelayCArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time];
        delegate_ugen(def, "DelayC", ugen_rate, inputs, None)
    }

    fn delay_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DelayLArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time];
        delegate_ugen(def, "DelayL", ugen_rate, inputs, None)
    }

    fn delay_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DelayNArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_delay_time = args.max_delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delay_time = args.delay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![in_, max_delay_time, delay_time];
        delegate_ugen(def, "DelayN", ugen_rate, inputs, None)
    }

    fn delay1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Delay1Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "Delay1", ugen_rate, inputs, None)
    }

    fn delay2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Delay2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "Delay2", ugen_rate, inputs, None)
    }

    fn demand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DemandArgs) -> WitUgenInput {
        let trig = ugen_input_from_wit(args.trig);
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let demand_ugens = ugen_input_from_wit(args.demand_ugens);
        let inputs: Vec<UGenInput> = vec![trig, reset, demand_ugens];
        delegate_ugen(def, "Demand", ugen_rate, inputs, None)
    }

    fn demand_env_gen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DemandEnvGenArgs) -> WitUgenInput {
        let level = ugen_input_from_wit(args.level);
        let dur = ugen_input_from_wit(args.dur);
        let shape = args.shape.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let curve = args.curve.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let gate = args.gate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let level_scale = args.level_scale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let level_bias = args.level_bias.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let time_scale = args.time_scale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![level, dur, shape, curve, gate, reset, level_scale, level_bias, time_scale, action];
        delegate_ugen(def, "DemandEnvGen", ugen_rate, inputs, None)
    }

    fn detect_index(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DetectIndexArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, in_];
        delegate_ugen(def, "DetectIndex", ugen_rate, inputs, None)
    }

    fn detect_silence(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DetectSilenceArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let amp = args.amp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0001));
        let time = args.time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, amp, time, action];
        delegate_ugen(def, "DetectSilence", ugen_rate, inputs, None)
    }

    fn dgeom(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DgeomArgs) -> WitUgenInput {
        let length = ugen_input_from_wit(args.length);
        let start = args.start.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let grow = args.grow.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let inputs: Vec<UGenInput> = vec![length, start, grow];
        delegate_ugen(def, "Dgeom", ugen_rate, inputs, None)
    }

    fn dibrown(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DibrownArgs) -> WitUgenInput {
        let length = ugen_input_from_wit(args.length);
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let step = args.step.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![length, lo, hi, step];
        delegate_ugen(def, "Dibrown", ugen_rate, inputs, None)
    }

    fn disk_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DiskInArgs) -> WitUgenInput {
        let num_channels = args.num_channels;
        let bufnum = ugen_input_from_wit(args.bufnum);
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, loop_];
        delegate_ugen(def, "DiskIn", ugen_rate, inputs, Some(num_channels))
    }

    fn disk_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DiskOutArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(bufnum);
        inputs.extend(channels_array);
        delegate_ugen(def, "DiskOut", ugen_rate, inputs, None)
    }

    fn diwhite(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DiwhiteArgs) -> WitUgenInput {
        let length = ugen_input_from_wit(args.length);
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![length, lo, hi];
        delegate_ugen(def, "Diwhite", ugen_rate, inputs, None)
    }

    fn donce(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DonceArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "Donce", ugen_rate, inputs, None)
    }

    fn done(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DoneArgs) -> WitUgenInput {
        let src = ugen_input_from_wit(args.src);
        let inputs: Vec<UGenInput> = vec![src];
        delegate_ugen(def, "Done", ugen_rate, inputs, None)
    }

    fn dpoll(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DpollArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let trig_id = args.trig_id.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let label = ugen_input_from_wit(args.label);
        let run = args.run.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, trig_id, label, run];
        delegate_ugen(def, "Dpoll", ugen_rate, inputs, None)
    }

    fn drand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DrandArgs) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let num_repeats = args.num_repeats.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![list, num_repeats];
        delegate_ugen(def, "Drand", ugen_rate, inputs, None)
    }

    fn dseq(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DseqArgs) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let num_repeats = args.num_repeats.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![list, num_repeats];
        delegate_ugen(def, "Dseq", ugen_rate, inputs, None)
    }

    fn dser(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DserArgs) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let count = args.count.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![list, count];
        delegate_ugen(def, "Dser", ugen_rate, inputs, None)
    }

    fn dseries(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DseriesArgs) -> WitUgenInput {
        let length = ugen_input_from_wit(args.length);
        let start = args.start.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let step = args.step.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![length, start, step];
        delegate_ugen(def, "Dseries", ugen_rate, inputs, None)
    }

    fn dshuf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DshufArgs) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let num_repeats = args.num_repeats.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![list, num_repeats];
        delegate_ugen(def, "Dshuf", ugen_rate, inputs, None)
    }

    fn dstutter(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DstutterArgs) -> WitUgenInput {
        let num_repeats = ugen_input_from_wit(args.num_repeats);
        let in_ = ugen_input_from_wit(args.in_);
        let inputs: Vec<UGenInput> = vec![num_repeats, in_];
        delegate_ugen(def, "Dstutter", ugen_rate, inputs, None)
    }

    fn dswitch(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DswitchArgs) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let index = ugen_input_from_wit(args.index);
        let inputs: Vec<UGenInput> = vec![list, index];
        delegate_ugen(def, "Dswitch", ugen_rate, inputs, None)
    }

    fn dswitch1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Dswitch1Args) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let index = ugen_input_from_wit(args.index);
        let inputs: Vec<UGenInput> = vec![list, index];
        delegate_ugen(def, "Dswitch1", ugen_rate, inputs, None)
    }

    fn dust(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DustArgs) -> WitUgenInput {
        let density = args.density.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![density];
        delegate_ugen(def, "Dust", ugen_rate, inputs, None)
    }

    fn dust2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Dust2Args) -> WitUgenInput {
        let density = args.density.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![density];
        delegate_ugen(def, "Dust2", ugen_rate, inputs, None)
    }

    fn duty(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DutyArgs) -> WitUgenInput {
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![dur, reset, action, level];
        delegate_ugen(def, "Duty", ugen_rate, inputs, None)
    }

    fn dwhite(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DwhiteArgs) -> WitUgenInput {
        let length = ugen_input_from_wit(args.length);
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![length, lo, hi];
        delegate_ugen(def, "Dwhite", ugen_rate, inputs, None)
    }

    fn dxrand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: DxrandArgs) -> WitUgenInput {
        let list = ugen_input_from_wit(args.list);
        let num_repeats = args.num_repeats.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![list, num_repeats];
        delegate_ugen(def, "Dxrand", ugen_rate, inputs, None)
    }

    fn env_gen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: EnvGenArgs) -> WitUgenInput {
        let envelope = ugen_input_from_wit(args.envelope);
        let gate = args.gate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let level_scale = args.level_scale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let level_bias = args.level_bias.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let time_scale = args.time_scale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![envelope, gate, level_scale, level_bias, time_scale, action];
        delegate_ugen(def, "EnvGen", ugen_rate, inputs, None)
    }

    fn exp_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ExpRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![lo, hi];
        delegate_ugen(def, "ExpRand", ugen_rate, inputs, None)
    }

    fn f_sin_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FSinOscArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, iphase];
        delegate_ugen(def, "FSinOsc", ugen_rate, inputs, None)
    }

    fn fb_sine_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FbSineCArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let im = args.im.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let fb = args.fb.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.1));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![freq, im, fb, a, c, xi, yi];
        delegate_ugen(def, "FBSineC", ugen_rate, inputs, None)
    }

    fn fb_sine_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FbSineLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let im = args.im.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let fb = args.fb.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.1));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![freq, im, fb, a, c, xi, yi];
        delegate_ugen(def, "FBSineL", ugen_rate, inputs, None)
    }

    fn fb_sine_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FbSineNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let im = args.im.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let fb = args.fb.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.1));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![freq, im, fb, a, c, xi, yi];
        delegate_ugen(def, "FBSineN", ugen_rate, inputs, None)
    }

    fn fft(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FftArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hop = args.hop.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let wintype = args.wintype.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let active = args.active.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let winsize = args.winsize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, in_, hop, wintype, active, winsize];
        delegate_ugen(def, "FFT", ugen_rate, inputs, None)
    }

    fn fft_trigger(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FftTriggerArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let hop = args.hop.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let polar = args.polar.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, hop, polar];
        delegate_ugen(def, "FFTTrigger", ugen_rate, inputs, None)
    }

    fn fold(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FoldArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, lo, hi];
        delegate_ugen(def, "Fold", ugen_rate, inputs, None)
    }

    fn formant(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FormantArgs) -> WitUgenInput {
        let fundfreq = args.fundfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let formfreq = args.formfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1760.0));
        let bwfreq = args.bwfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(880.0));
        let inputs: Vec<UGenInput> = vec![fundfreq, formfreq, bwfreq];
        delegate_ugen(def, "Formant", ugen_rate, inputs, None)
    }

    fn formlet(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FormletArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let attack_time = args.attack_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, attack_time, decay_time];
        delegate_ugen(def, "Formlet", ugen_rate, inputs, None)
    }

    fn fos(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FosArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let a0 = args.a0.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let a1 = args.a1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let b1 = args.b1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, a0, a1, b1];
        delegate_ugen(def, "FOS", ugen_rate, inputs, None)
    }

    fn free(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FreeArgs) -> WitUgenInput {
        let trig = ugen_input_from_wit(args.trig);
        let id = ugen_input_from_wit(args.id);
        let inputs: Vec<UGenInput> = vec![trig, id];
        delegate_ugen(def, "Free", ugen_rate, inputs, None)
    }

    fn free_self(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FreeSelfArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "FreeSelf", ugen_rate, inputs, None)
    }

    fn free_self_when_done(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FreeSelfWhenDoneArgs) -> WitUgenInput {
        let src = ugen_input_from_wit(args.src);
        let inputs: Vec<UGenInput> = vec![src];
        delegate_ugen(def, "FreeSelfWhenDone", ugen_rate, inputs, None)
    }

    fn free_verb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FreeVerbArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let mix = args.mix.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.33));
        let room = args.room.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let damp = args.damp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![in_, mix, room, damp];
        delegate_ugen(def, "FreeVerb", ugen_rate, inputs, None)
    }

    fn free_verb2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FreeVerb2Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let in2 = ugen_input_from_wit(args.in2);
        let mix = args.mix.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.33));
        let room = args.room.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let damp = args.damp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![in_, in2, mix, room, damp];
        delegate_ugen(def, "FreeVerb2", ugen_rate, inputs, None)
    }

    fn freq_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: FreqShiftArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, phase];
        delegate_ugen(def, "FreqShift", ugen_rate, inputs, None)
    }

    fn g_verb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GVerbArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let roomsize = args.roomsize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(10.0));
        let revtime = args.revtime.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let damping = args.damping.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputbw = args.inputbw.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let spread = args.spread.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(15.0));
        let drylevel = args.drylevel.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let earlyreflevel = args.earlyreflevel.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.7));
        let taillevel = args.taillevel.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let maxroomsize = args.maxroomsize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(300.0));
        let inputs: Vec<UGenInput> = vec![in_, roomsize, revtime, damping, inputbw, spread, drylevel, earlyreflevel, taillevel, maxroomsize];
        delegate_ugen(def, "GVerb", ugen_rate, inputs, None)
    }

    fn gate(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GateArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, trig];
        delegate_ugen(def, "Gate", ugen_rate, inputs, None)
    }

    fn gbman_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GbmanLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.2));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.1));
        let inputs: Vec<UGenInput> = vec![freq, xi, yi];
        delegate_ugen(def, "GbmanL", ugen_rate, inputs, None)
    }

    fn gbman_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GbmanNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.2));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.1));
        let inputs: Vec<UGenInput> = vec![freq, xi, yi];
        delegate_ugen(def, "GbmanN", ugen_rate, inputs, None)
    }

    fn gendy1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Gendy1Args) -> WitUgenInput {
        let ampdist = args.ampdist.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let durdist = args.durdist.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let adparam = args.adparam.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let ddparam = args.ddparam.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let minfreq = args.minfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let maxfreq = args.maxfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(660.0));
        let ampscale = args.ampscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let durscale = args.durscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let init_cps = args.init_cps.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let knum = args.knum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let inputs: Vec<UGenInput> = vec![ampdist, durdist, adparam, ddparam, minfreq, maxfreq, ampscale, durscale, init_cps, knum];
        delegate_ugen(def, "Gendy1", ugen_rate, inputs, None)
    }

    fn gendy2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Gendy2Args) -> WitUgenInput {
        let ampdist = args.ampdist.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let durdist = args.durdist.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let adparam = args.adparam.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let ddparam = args.ddparam.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let minfreq = args.minfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let maxfreq = args.maxfreq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(660.0));
        let ampscale = args.ampscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let durscale = args.durscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let init_cps = args.init_cps.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let knum = args.knum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.17));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.31));
        let inputs: Vec<UGenInput> = vec![ampdist, durdist, adparam, ddparam, minfreq, maxfreq, ampscale, durscale, init_cps, knum, a, c];
        delegate_ugen(def, "Gendy2", ugen_rate, inputs, None)
    }

    fn gendy3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Gendy3Args) -> WitUgenInput {
        let ampdist = args.ampdist.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let durdist = args.durdist.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let adparam = args.adparam.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let ddparam = args.ddparam.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let ampscale = args.ampscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let durscale = args.durscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let init_cps = args.init_cps.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let knum = args.knum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(12.0));
        let inputs: Vec<UGenInput> = vec![ampdist, durdist, adparam, ddparam, freq, ampscale, durscale, init_cps, knum];
        delegate_ugen(def, "Gendy3", ugen_rate, inputs, None)
    }

    fn grain_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GrainBufArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let sndbuf = ugen_input_from_wit(args.sndbuf);
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let pos = args.pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let interp = args.interp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let envbufnum = args.envbufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let max_grains = args.max_grains.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![trigger, dur, sndbuf, rate, pos, interp, pan, envbufnum, max_grains];
        delegate_ugen(def, "GrainBuf", ugen_rate, inputs, Some(num_channels))
    }

    fn grain_fm(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GrainFmArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let car_freq = args.car_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let mod_freq = args.mod_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let index = args.index.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let envbufnum = args.envbufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let max_grains = args.max_grains.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![trigger, dur, car_freq, mod_freq, index, pan, envbufnum, max_grains];
        delegate_ugen(def, "GrainFM", ugen_rate, inputs, Some(num_channels))
    }

    fn grain_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GrainInArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let in_ = ugen_input_from_wit(args.in_);
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let envbufnum = args.envbufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let max_grains = args.max_grains.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![trigger, dur, in_, pan, envbufnum, max_grains];
        delegate_ugen(def, "GrainIn", ugen_rate, inputs, Some(num_channels))
    }

    fn grain_sin(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: GrainSinArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let envbufnum = args.envbufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let max_grains = args.max_grains.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let inputs: Vec<UGenInput> = vec![trigger, dur, freq, pan, envbufnum, max_grains];
        delegate_ugen(def, "GrainSin", ugen_rate, inputs, Some(num_channels))
    }

    fn gray_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "GrayNoise", ugen_rate, inputs, None)
    }

    fn hasher(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: HasherArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "Hasher", ugen_rate, inputs, None)
    }

    fn henon_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: HenonCArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.4));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.3));
        let x0 = args.x0.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let x1 = args.x1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, x0, x1];
        delegate_ugen(def, "HenonC", ugen_rate, inputs, None)
    }

    fn henon_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: HenonLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.4));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.3));
        let x0 = args.x0.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let x1 = args.x1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, x0, x1];
        delegate_ugen(def, "HenonL", ugen_rate, inputs, None)
    }

    fn henon_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: HenonNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.4));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.3));
        let x0 = args.x0.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let x1 = args.x1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, x0, x1];
        delegate_ugen(def, "HenonN", ugen_rate, inputs, None)
    }

    fn hilbert(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: HilbertArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "Hilbert", ugen_rate, inputs, None)
    }

    fn hpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: HpfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let inputs: Vec<UGenInput> = vec![in_, freq];
        delegate_ugen(def, "HPF", ugen_rate, inputs, None)
    }

    fn hpz1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Hpz1Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "HPZ1", ugen_rate, inputs, None)
    }

    fn hpz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Hpz2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "HPZ2", ugen_rate, inputs, None)
    }

    fn i_env_gen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: IEnvGenArgs) -> WitUgenInput {
        let ienvelope = ugen_input_from_wit(args.ienvelope);
        let index = ugen_input_from_wit(args.index);
        let inputs: Vec<UGenInput> = vec![ienvelope, index];
        delegate_ugen(def, "IEnvGen", ugen_rate, inputs, None)
    }

    fn i_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: IRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(127.0));
        let inputs: Vec<UGenInput> = vec![lo, hi];
        delegate_ugen(def, "IRand", ugen_rate, inputs, None)
    }

    fn ifft(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: IfftArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let wintype = args.wintype.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let winsize = args.winsize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![chain, wintype, winsize];
        delegate_ugen(def, "IFFT", ugen_rate, inputs, None)
    }

    fn impulse(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ImpulseArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, phase];
        delegate_ugen(def, "Impulse", ugen_rate, inputs, None)
    }

    fn in_(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: InArgs) -> WitUgenInput {
        let bus = args.bus.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let num_channels = args.num_channels.unwrap_or(1);
        let inputs: Vec<UGenInput> = vec![bus];
        delegate_ugen(def, "In", ugen_rate, inputs, Some(num_channels))
    }

    fn in_feedback(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: InFeedbackArgs) -> WitUgenInput {
        let bus = args.bus.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let num_channels = args.num_channels.unwrap_or(1);
        let inputs: Vec<UGenInput> = vec![bus];
        delegate_ugen(def, "InFeedback", ugen_rate, inputs, Some(num_channels))
    }

    fn in_range(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: InRangeArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, lo, hi];
        delegate_ugen(def, "InRange", ugen_rate, inputs, None)
    }

    fn in_rect(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: InRectArgs) -> WitUgenInput {
        let x = args.x.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let y = args.y.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let left = ugen_input_from_wit(args.left);
        let top = ugen_input_from_wit(args.top);
        let right = ugen_input_from_wit(args.right);
        let bottom = ugen_input_from_wit(args.bottom);
        let inputs: Vec<UGenInput> = vec![x, y, left, top, right, bottom];
        delegate_ugen(def, "InRect", ugen_rate, inputs, None)
    }

    fn in_trig(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: InTrigArgs) -> WitUgenInput {
        let bus = args.bus.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let num_channels = args.num_channels.unwrap_or(1);
        let inputs: Vec<UGenInput> = vec![bus];
        delegate_ugen(def, "InTrig", ugen_rate, inputs, Some(num_channels))
    }

    fn index(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: IndexArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, in_];
        delegate_ugen(def, "Index", ugen_rate, inputs, None)
    }

    fn index_in_between(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: IndexInBetweenArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, in_];
        delegate_ugen(def, "IndexInBetween", ugen_rate, inputs, None)
    }

    fn integrator(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: IntegratorArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let coef = args.coef.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, coef];
        delegate_ugen(def, "Integrator", ugen_rate, inputs, None)
    }

    fn k2_a(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: K2AArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "K2A", ugen_rate, inputs, None)
    }

    fn key_state(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: KeyStateArgs) -> WitUgenInput {
        let keycode = args.keycode.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let minval = args.minval.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let maxval = args.maxval.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let lag = args.lag.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![keycode, minval, maxval, lag];
        delegate_ugen(def, "KeyState", ugen_rate, inputs, None)
    }

    fn key_track(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: KeyTrackArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let keydecay = args.keydecay.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let chromaleak = args.chromaleak.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![chain, keydecay, chromaleak];
        delegate_ugen(def, "KeyTrack", ugen_rate, inputs, None)
    }

    fn klang(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: KlangArgs) -> WitUgenInput {
        let specs = ugen_input_from_wit(args.specs);
        let freqscale = args.freqscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let freqoffset = args.freqoffset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![specs, freqscale, freqoffset];
        delegate_ugen(def, "Klang", ugen_rate, inputs, None)
    }

    fn klank(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: KlankArgs) -> WitUgenInput {
        let specs = ugen_input_from_wit(args.specs);
        let input = ugen_input_from_wit(args.input);
        let freqscale = args.freqscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let freqoffset = args.freqoffset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let decayscale = args.decayscale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![specs, input, freqscale, freqoffset, decayscale];
        delegate_ugen(def, "Klank", ugen_rate, inputs, None)
    }

    fn lag(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LagArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time = args.lag_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time];
        delegate_ugen(def, "Lag", ugen_rate, inputs, None)
    }

    fn lag_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LagInArgs) -> WitUgenInput {
        let bus = args.bus.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let num_channels = args.num_channels.unwrap_or(1);
        let lag = args.lag.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![bus, lag];
        delegate_ugen(def, "LagIn", ugen_rate, inputs, Some(num_channels))
    }

    fn lag_ud(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LagUdArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time_up = args.lag_time_up.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let lag_time_down = args.lag_time_down.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time_up, lag_time_down];
        delegate_ugen(def, "LagUD", ugen_rate, inputs, None)
    }

    fn lag2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Lag2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time = args.lag_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time];
        delegate_ugen(def, "Lag2", ugen_rate, inputs, None)
    }

    fn lag2_ud(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Lag2UdArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time_up = args.lag_time_up.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let lag_time_down = args.lag_time_down.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time_up, lag_time_down];
        delegate_ugen(def, "Lag2UD", ugen_rate, inputs, None)
    }

    fn lag3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Lag3Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time = args.lag_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time];
        delegate_ugen(def, "Lag3", ugen_rate, inputs, None)
    }

    fn lag3_ud(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Lag3UdArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time_up = args.lag_time_up.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let lag_time_down = args.lag_time_down.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time_up, lag_time_down];
        delegate_ugen(def, "Lag3UD", ugen_rate, inputs, None)
    }

    fn last_value(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LastValueArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let diff = args.diff.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![in_, diff];
        delegate_ugen(def, "LastValue", ugen_rate, inputs, None)
    }

    fn latch(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LatchArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, trig];
        delegate_ugen(def, "Latch", ugen_rate, inputs, None)
    }

    fn latoocarfian_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LatoocarfianCArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let d = args.d.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![freq, a, b, c, d, xi, yi];
        delegate_ugen(def, "LatoocarfianC", ugen_rate, inputs, None)
    }

    fn latoocarfian_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LatoocarfianLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let d = args.d.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![freq, a, b, c, d, xi, yi];
        delegate_ugen(def, "LatoocarfianL", ugen_rate, inputs, None)
    }

    fn latoocarfian_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LatoocarfianNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let d = args.d.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![freq, a, b, c, d, xi, yi];
        delegate_ugen(def, "LatoocarfianN", ugen_rate, inputs, None)
    }

    fn leak_dc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LeakDcArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let coef = args.coef.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.995));
        let inputs: Vec<UGenInput> = vec![in_, coef];
        delegate_ugen(def, "LeakDC", ugen_rate, inputs, None)
    }

    fn least_change(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LeastChangeArgs) -> WitUgenInput {
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![a, b];
        delegate_ugen(def, "LeastChange", ugen_rate, inputs, None)
    }

    fn lf_clip_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfClipNoiseArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFClipNoise", ugen_rate, inputs, None)
    }

    fn lf_cub(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfCubArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, iphase];
        delegate_ugen(def, "LFCub", ugen_rate, inputs, None)
    }

    fn lf_gauss(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfGaussArgs) -> WitUgenInput {
        let duration = args.duration.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![duration, width, iphase, loop_, action];
        delegate_ugen(def, "LFGauss", ugen_rate, inputs, None)
    }

    fn lf_noise0(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfNoise0Args) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFNoise0", ugen_rate, inputs, None)
    }

    fn lf_noise1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfNoise1Args) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFNoise1", ugen_rate, inputs, None)
    }

    fn lf_noise2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfNoise2Args) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFNoise2", ugen_rate, inputs, None)
    }

    fn lf_par(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfParArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, iphase];
        delegate_ugen(def, "LFPar", ugen_rate, inputs, None)
    }

    fn lf_pulse(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfPulseArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![freq, iphase, width];
        delegate_ugen(def, "LFPulse", ugen_rate, inputs, None)
    }

    fn lf_saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfSawArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, iphase];
        delegate_ugen(def, "LFSaw", ugen_rate, inputs, None)
    }

    fn lf_tri(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfTriArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, iphase];
        delegate_ugen(def, "LFTri", ugen_rate, inputs, None)
    }

    fn lfd_clip_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfdClipNoiseArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFDClipNoise", ugen_rate, inputs, None)
    }

    fn lfd_noise0(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfdNoise0Args) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFDNoise0", ugen_rate, inputs, None)
    }

    fn lfd_noise1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfdNoise1Args) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFDNoise1", ugen_rate, inputs, None)
    }

    fn lfd_noise3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LfdNoise3Args) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(500.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "LFDNoise3", ugen_rate, inputs, None)
    }

    fn limiter(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LimiterArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![in_, level, dur];
        delegate_ugen(def, "Limiter", ugen_rate, inputs, None)
    }

    fn lin_cong_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinCongCArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.1));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.13));
        let m = args.m.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, c, m, xi];
        delegate_ugen(def, "LinCongC", ugen_rate, inputs, None)
    }

    fn lin_cong_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinCongLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.1));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.13));
        let m = args.m.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, c, m, xi];
        delegate_ugen(def, "LinCongL", ugen_rate, inputs, None)
    }

    fn lin_cong_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinCongNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.1));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.13));
        let m = args.m.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, c, m, xi];
        delegate_ugen(def, "LinCongN", ugen_rate, inputs, None)
    }

    fn lin_exp(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinExpArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let srclo = args.srclo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let srchi = args.srchi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let dstlo = args.dstlo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let dsthi = args.dsthi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let inputs: Vec<UGenInput> = vec![in_, srclo, srchi, dstlo, dsthi];
        delegate_ugen(def, "LinExp", ugen_rate, inputs, None)
    }

    fn lin_pan2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinPan2Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let pos = args.pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, pos, level];
        delegate_ugen(def, "LinPan2", ugen_rate, inputs, None)
    }

    fn lin_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let minmax = args.minmax.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![lo, hi, minmax];
        delegate_ugen(def, "LinRand", ugen_rate, inputs, None)
    }

    fn lin_x_fade2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinXFade2Args) -> WitUgenInput {
        let in_a = ugen_input_from_wit(args.in_a);
        let in_b = ugen_input_from_wit(args.in_b);
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_a, in_b, pan, level];
        delegate_ugen(def, "LinXFade2", ugen_rate, inputs, None)
    }

    fn line(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LineArgs) -> WitUgenInput {
        let start = args.start.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let end = args.end.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![start, end, dur, action];
        delegate_ugen(def, "Line", ugen_rate, inputs, None)
    }

    fn linen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LinenArgs) -> WitUgenInput {
        let gate = args.gate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let attack_time = args.attack_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let sus_level = args.sus_level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let release_time = args.release_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![gate, attack_time, sus_level, release_time, action];
        delegate_ugen(def, "Linen", ugen_rate, inputs, None)
    }

    fn local_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LocalBufArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let num_frames = ugen_input_from_wit(args.num_frames);
        let inputs: Vec<UGenInput> = vec![num_frames];
        delegate_ugen(def, "LocalBuf", ugen_rate, inputs, Some(num_channels))
    }

    fn local_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LocalInArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "LocalIn", ugen_rate, inputs, Some(num_channels))
    }

    fn local_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LocalOutArgs) -> WitUgenInput {
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(channels_array);
        delegate_ugen(def, "LocalOut", ugen_rate, inputs, None)
    }

    fn logistic(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LogisticArgs) -> WitUgenInput {
        let chaos_param = args.chaos_param.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1000.0));
        let init = args.init.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![chaos_param, freq, init];
        delegate_ugen(def, "Logistic", ugen_rate, inputs, None)
    }

    fn lorenz_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LorenzLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let s = args.s.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(10.0));
        let r = args.r.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(28.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.667));
        let h = args.h.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.05));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let zi = args.zi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, s, r, b, h, xi, yi, zi];
        delegate_ugen(def, "LorenzL", ugen_rate, inputs, None)
    }

    fn loudness(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LoudnessArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let smask = args.smask.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.25));
        let tmask = args.tmask.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![chain, smask, tmask];
        delegate_ugen(def, "Loudness", ugen_rate, inputs, None)
    }

    fn lpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: LpfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let inputs: Vec<UGenInput> = vec![in_, freq];
        delegate_ugen(def, "LPF", ugen_rate, inputs, None)
    }

    fn lpz1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Lpz1Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "LPZ1", ugen_rate, inputs, None)
    }

    fn lpz2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Lpz2Args) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "LPZ2", ugen_rate, inputs, None)
    }

    fn mantissa_mask(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MantissaMaskArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let bits = args.bits.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let inputs: Vec<UGenInput> = vec![in_, bits];
        delegate_ugen(def, "MantissaMask", ugen_rate, inputs, None)
    }

    fn max_local_bufs(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MaxLocalBufsArgs) -> WitUgenInput {
        let num_local_bufs = ugen_input_from_wit(args.num_local_bufs);
        let inputs: Vec<UGenInput> = vec![num_local_bufs];
        delegate_ugen(def, "MaxLocalBufs", ugen_rate, inputs, None)
    }

    fn median(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MedianArgs) -> WitUgenInput {
        let length = args.length.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![length, in_];
        delegate_ugen(def, "Median", ugen_rate, inputs, None)
    }

    fn mfcc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MfccArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let numcoeff = args.numcoeff.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(13.0));
        let inputs: Vec<UGenInput> = vec![chain, numcoeff];
        delegate_ugen(def, "MFCC", ugen_rate, inputs, None)
    }

    fn mid_eq(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MidEqArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let db = args.db.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq, db];
        delegate_ugen(def, "MidEQ", ugen_rate, inputs, None)
    }

    fn moog_ff(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MoogFfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(100.0));
        let gain = args.gain.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, gain, reset];
        delegate_ugen(def, "MoogFF", ugen_rate, inputs, None)
    }

    fn most_change(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MostChangeArgs) -> WitUgenInput {
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![a, b];
        delegate_ugen(def, "MostChange", ugen_rate, inputs, None)
    }

    fn mouse_button(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MouseButtonArgs) -> WitUgenInput {
        let up = args.up.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let down = args.down.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let lag = args.lag.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![up, down, lag];
        delegate_ugen(def, "MouseButton", ugen_rate, inputs, None)
    }

    fn mouse_x(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MouseXArgs) -> WitUgenInput {
        let min = args.min.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max = args.max.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let warp = args.warp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag = args.lag.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![min, max, warp, lag];
        delegate_ugen(def, "MouseX", ugen_rate, inputs, None)
    }

    fn mouse_y(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MouseYArgs) -> WitUgenInput {
        let min = args.min.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max = args.max.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let warp = args.warp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag = args.lag.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let inputs: Vec<UGenInput> = vec![min, max, warp, lag];
        delegate_ugen(def, "MouseY", ugen_rate, inputs, None)
    }

    fn mul_add(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: MulAddArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let mul = ugen_input_from_wit(args.mul);
        let add = ugen_input_from_wit(args.add);
        let inputs: Vec<UGenInput> = vec![in_, mul, add];
        delegate_ugen(def, "MulAdd", ugen_rate, inputs, None)
    }

    fn n_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: NRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let n = args.n.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![lo, hi, n];
        delegate_ugen(def, "NRand", ugen_rate, inputs, None)
    }

    fn normalizer(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: NormalizerArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![in_, level, dur];
        delegate_ugen(def, "Normalizer", ugen_rate, inputs, None)
    }

    fn num_audio_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumAudioBuses", ugen_rate, inputs, None)
    }

    fn num_buffers(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumBuffers", ugen_rate, inputs, None)
    }

    fn num_control_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumControlBuses", ugen_rate, inputs, None)
    }

    fn num_input_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumInputBuses", ugen_rate, inputs, None)
    }

    fn num_output_buses(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumOutputBuses", ugen_rate, inputs, None)
    }

    fn num_running_synths(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "NumRunningSynths", ugen_rate, inputs, None)
    }

    fn offset_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: OffsetOutArgs) -> WitUgenInput {
        let bus = ugen_input_from_wit(args.bus);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(bus);
        inputs.extend(channels_array);
        delegate_ugen(def, "OffsetOut", ugen_rate, inputs, None)
    }

    fn one_pole(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: OnePoleArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let coef = args.coef.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![in_, coef];
        delegate_ugen(def, "OnePole", ugen_rate, inputs, None)
    }

    fn one_zero(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: OneZeroArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let coef = args.coef.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![in_, coef];
        delegate_ugen(def, "OneZero", ugen_rate, inputs, None)
    }

    fn onsets(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: OnsetsArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let odftype = args.odftype.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(3.0));
        let relaxtime = args.relaxtime.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let floor = args.floor.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let mingap = args.mingap.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(10.0));
        let medianspan = args.medianspan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(11.0));
        let whtype = args.whtype.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let rawodf = args.rawodf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![chain, threshold, odftype, relaxtime, floor, mingap, medianspan, whtype, rawodf];
        delegate_ugen(def, "Onsets", ugen_rate, inputs, None)
    }

    fn osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: OscArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, freq, phase];
        delegate_ugen(def, "Osc", ugen_rate, inputs, None)
    }

    fn out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: OutArgs) -> WitUgenInput {
        let bus = ugen_input_from_wit(args.bus);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(bus);
        inputs.extend(channels_array);
        delegate_ugen(def, "Out", ugen_rate, inputs, None)
    }

    fn p_sin_grain(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PSinGrainArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let amp = args.amp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![freq, dur, amp];
        delegate_ugen(def, "PSinGrain", ugen_rate, inputs, None)
    }

    fn pan_az(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PanAzArgs) -> WitUgenInput {
        let num_channels = args.num_channels;
        let in_ = ugen_input_from_wit(args.in_);
        let pos = args.pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let orientation = args.orientation.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![in_, pos, level, width, orientation];
        delegate_ugen(def, "PanAz", ugen_rate, inputs, Some(num_channels))
    }

    fn pan_b(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PanBArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let azimuth = args.azimuth.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let elevation = args.elevation.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let gain = args.gain.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, azimuth, elevation, gain];
        delegate_ugen(def, "PanB", ugen_rate, inputs, None)
    }

    fn pan_b2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PanB2Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let azimuth = args.azimuth.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let gain = args.gain.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, azimuth, gain];
        delegate_ugen(def, "PanB2", ugen_rate, inputs, None)
    }

    fn pan2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Pan2Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let pos = args.pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, pos, level];
        delegate_ugen(def, "Pan2", ugen_rate, inputs, None)
    }

    fn pan4(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Pan4Args) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let xpos = args.xpos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let ypos = args.ypos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, xpos, ypos, level];
        delegate_ugen(def, "Pan4", ugen_rate, inputs, None)
    }

    fn part_conv(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PartConvArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let fftsize = ugen_input_from_wit(args.fftsize);
        let irbufnum = ugen_input_from_wit(args.irbufnum);
        let inputs: Vec<UGenInput> = vec![in_, fftsize, irbufnum];
        delegate_ugen(def, "PartConv", ugen_rate, inputs, None)
    }

    fn pause(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PauseArgs) -> WitUgenInput {
        let gate = ugen_input_from_wit(args.gate);
        let id = ugen_input_from_wit(args.id);
        let inputs: Vec<UGenInput> = vec![gate, id];
        delegate_ugen(def, "Pause", ugen_rate, inputs, None)
    }

    fn pause_self(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PauseSelfArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "PauseSelf", ugen_rate, inputs, None)
    }

    fn pause_self_when_done(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PauseSelfWhenDoneArgs) -> WitUgenInput {
        let src = ugen_input_from_wit(args.src);
        let inputs: Vec<UGenInput> = vec![src];
        delegate_ugen(def, "PauseSelfWhenDone", ugen_rate, inputs, None)
    }

    fn peak(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PeakArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig, reset];
        delegate_ugen(def, "Peak", ugen_rate, inputs, None)
    }

    fn peak_follower(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PeakFollowerArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let decay = args.decay.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.999));
        let inputs: Vec<UGenInput> = vec![in_, decay];
        delegate_ugen(def, "PeakFollower", ugen_rate, inputs, None)
    }

    fn phasor(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PhasorArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let start = args.start.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let end = args.end.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let reset_pos = args.reset_pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig, rate, start, end, reset_pos];
        delegate_ugen(def, "Phasor", ugen_rate, inputs, None)
    }

    fn pink_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "PinkNoise", ugen_rate, inputs, None)
    }

    fn pitch(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PitchArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let init_freq = args.init_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let min_freq = args.min_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(60.0));
        let max_freq = args.max_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(4000.0));
        let exec_freq = args.exec_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(100.0));
        let max_bins_per_octave = args.max_bins_per_octave.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(16.0));
        let median = args.median.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let amp_threshold = args.amp_threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let peak_threshold = args.peak_threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let down_sample = args.down_sample.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let clar = args.clar.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, init_freq, min_freq, max_freq, exec_freq, max_bins_per_octave, median, amp_threshold, peak_threshold, down_sample, clar];
        delegate_ugen(def, "Pitch", ugen_rate, inputs, None)
    }

    fn pitch_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PitchShiftArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let window_size = args.window_size.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let pitch_ratio = args.pitch_ratio.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let pitch_dispersion = args.pitch_dispersion.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let time_dispersion = args.time_dispersion.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, window_size, pitch_ratio, pitch_dispersion, time_dispersion];
        delegate_ugen(def, "PitchShift", ugen_rate, inputs, None)
    }

    fn play_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PlayBufArgs) -> WitUgenInput {
        let num_channels = args.num_channels;
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let start_pos = args.start_pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, rate, trigger, start_pos, loop_, action];
        delegate_ugen(def, "PlayBuf", ugen_rate, inputs, Some(num_channels))
    }

    fn pluck(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PluckArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let maxdelaytime = args.maxdelaytime.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let delaytime = args.delaytime.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let decaytime = args.decaytime.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let coef = args.coef.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![in_, trig, maxdelaytime, delaytime, decaytime, coef];
        delegate_ugen(def, "Pluck", ugen_rate, inputs, None)
    }

    fn poll(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PollArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let label = ugen_input_from_wit(args.label);
        let trig_id = args.trig_id.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let inputs: Vec<UGenInput> = vec![trig, in_, label, trig_id];
        delegate_ugen(def, "Poll", ugen_rate, inputs, None)
    }

    fn pulse(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PulseArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![freq, width];
        delegate_ugen(def, "Pulse", ugen_rate, inputs, None)
    }

    fn pulse_count(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PulseCountArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig, reset];
        delegate_ugen(def, "PulseCount", ugen_rate, inputs, None)
    }

    fn pulse_divider(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PulseDividerArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let div = args.div.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let start_val = args.start_val.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig, div, start_val];
        delegate_ugen(def, "PulseDivider", ugen_rate, inputs, None)
    }

    fn pv_add(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvAddArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_Add", ugen_rate, inputs, None)
    }

    fn pv_bin_scramble(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvBinScrambleArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let wipe = args.wipe.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, wipe, width, trig];
        delegate_ugen(def, "PV_BinScramble", ugen_rate, inputs, None)
    }

    fn pv_bin_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvBinShiftArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let stretch = args.stretch.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let shift = args.shift.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, stretch, shift];
        delegate_ugen(def, "PV_BinShift", ugen_rate, inputs, None)
    }

    fn pv_bin_wipe(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvBinWipeArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let wipe = args.wipe.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b, wipe];
        delegate_ugen(def, "PV_BinWipe", ugen_rate, inputs, None)
    }

    fn pv_brick_wall(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvBrickWallArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let wipe = args.wipe.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, wipe];
        delegate_ugen(def, "PV_BrickWall", ugen_rate, inputs, None)
    }

    fn pv_conformal_map(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvConformalMapArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let areal = args.areal.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let aimag = args.aimag.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, areal, aimag];
        delegate_ugen(def, "PV_ConformalMap", ugen_rate, inputs, None)
    }

    fn pv_conj(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvConjArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let inputs: Vec<UGenInput> = vec![buffer];
        delegate_ugen(def, "PV_Conj", ugen_rate, inputs, None)
    }

    fn pv_copy(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvCopyArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_Copy", ugen_rate, inputs, None)
    }

    fn pv_copy_phase(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvCopyPhaseArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_CopyPhase", ugen_rate, inputs, None)
    }

    fn pv_diffuser(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvDiffuserArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, trig];
        delegate_ugen(def, "PV_Diffuser", ugen_rate, inputs, None)
    }

    fn pv_div(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvDivArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_Div", ugen_rate, inputs, None)
    }

    fn pv_hainsworth_foote(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvHainsworthFooteArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let proph = args.proph.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let propf = args.propf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let wait_time = args.wait_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.04));
        let inputs: Vec<UGenInput> = vec![buffer, proph, propf, threshold, wait_time];
        delegate_ugen(def, "PV_HainsworthFoote", ugen_rate, inputs, None)
    }

    fn pv_jensen_andersen(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvJensenAndersenArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let propsc = args.propsc.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.25));
        let prophfe = args.prophfe.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.25));
        let prophfc = args.prophfc.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.25));
        let propsf = args.propsf.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.25));
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let wait_time = args.wait_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.04));
        let inputs: Vec<UGenInput> = vec![buffer, propsc, prophfe, prophfc, propsf, threshold, wait_time];
        delegate_ugen(def, "PV_JensenAndersen", ugen_rate, inputs, None)
    }

    fn pv_local_max(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvLocalMaxArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, threshold];
        delegate_ugen(def, "PV_LocalMax", ugen_rate, inputs, None)
    }

    fn pv_mag_above(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagAboveArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, threshold];
        delegate_ugen(def, "PV_MagAbove", ugen_rate, inputs, None)
    }

    fn pv_mag_below(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagBelowArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, threshold];
        delegate_ugen(def, "PV_MagBelow", ugen_rate, inputs, None)
    }

    fn pv_mag_clip(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagClipArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let threshold = args.threshold.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, threshold];
        delegate_ugen(def, "PV_MagClip", ugen_rate, inputs, None)
    }

    fn pv_mag_div(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagDivArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let zeroed = args.zeroed.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0001));
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b, zeroed];
        delegate_ugen(def, "PV_MagDiv", ugen_rate, inputs, None)
    }

    fn pv_mag_freeze(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagFreezeArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let freeze = args.freeze.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, freeze];
        delegate_ugen(def, "PV_MagFreeze", ugen_rate, inputs, None)
    }

    fn pv_mag_mul(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagMulArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_MagMul", ugen_rate, inputs, None)
    }

    fn pv_mag_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagNoiseArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let inputs: Vec<UGenInput> = vec![buffer];
        delegate_ugen(def, "PV_MagNoise", ugen_rate, inputs, None)
    }

    fn pv_mag_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagShiftArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let stretch = args.stretch.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let shift = args.shift.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, stretch, shift];
        delegate_ugen(def, "PV_MagShift", ugen_rate, inputs, None)
    }

    fn pv_mag_smear(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagSmearArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let bins = args.bins.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, bins];
        delegate_ugen(def, "PV_MagSmear", ugen_rate, inputs, None)
    }

    fn pv_mag_squared(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMagSquaredArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let inputs: Vec<UGenInput> = vec![buffer];
        delegate_ugen(def, "PV_MagSquared", ugen_rate, inputs, None)
    }

    fn pv_max(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMaxArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_Max", ugen_rate, inputs, None)
    }

    fn pv_min(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMinArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_Min", ugen_rate, inputs, None)
    }

    fn pv_mul(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvMulArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b];
        delegate_ugen(def, "PV_Mul", ugen_rate, inputs, None)
    }

    fn pv_phase_shift(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvPhaseShiftArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let shift = ugen_input_from_wit(args.shift);
        let inputs: Vec<UGenInput> = vec![buffer, shift];
        delegate_ugen(def, "PV_PhaseShift", ugen_rate, inputs, None)
    }

    fn pv_phase_shift270(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvPhaseShift270Args) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let inputs: Vec<UGenInput> = vec![buffer];
        delegate_ugen(def, "PV_PhaseShift270", ugen_rate, inputs, None)
    }

    fn pv_phase_shift90(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvPhaseShift90Args) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let inputs: Vec<UGenInput> = vec![buffer];
        delegate_ugen(def, "PV_PhaseShift90", ugen_rate, inputs, None)
    }

    fn pv_rand_comb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvRandCombArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let wipe = args.wipe.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer, wipe, trig];
        delegate_ugen(def, "PV_RandComb", ugen_rate, inputs, None)
    }

    fn pv_rand_wipe(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvRandWipeArgs) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let wipe = args.wipe.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b, wipe, trig];
        delegate_ugen(def, "PV_RandWipe", ugen_rate, inputs, None)
    }

    fn pv_rect_comb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvRectCombArgs) -> WitUgenInput {
        let buffer = ugen_input_from_wit(args.buffer);
        let num_teeth = args.num_teeth.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![buffer, num_teeth, phase, width];
        delegate_ugen(def, "PV_RectComb", ugen_rate, inputs, None)
    }

    fn pv_rect_comb2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: PvRectComb2Args) -> WitUgenInput {
        let buffer_a = ugen_input_from_wit(args.buffer_a);
        let buffer_b = ugen_input_from_wit(args.buffer_b);
        let num_teeth = args.num_teeth.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![buffer_a, buffer_b, num_teeth, phase, width];
        delegate_ugen(def, "PV_RectComb2", ugen_rate, inputs, None)
    }

    fn quad_c(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: QuadCArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-0.75));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, c, xi];
        delegate_ugen(def, "QuadC", ugen_rate, inputs, None)
    }

    fn quad_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: QuadLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-0.75));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, c, xi];
        delegate_ugen(def, "QuadL", ugen_rate, inputs, None)
    }

    fn quad_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: QuadNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-0.75));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, a, b, c, xi];
        delegate_ugen(def, "QuadN", ugen_rate, inputs, None)
    }

    fn radians_per_sample(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "RadiansPerSample", ugen_rate, inputs, None)
    }

    fn ramp(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RampArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lag_time = args.lag_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![in_, lag_time];
        delegate_ugen(def, "Ramp", ugen_rate, inputs, None)
    }

    fn rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![lo, hi];
        delegate_ugen(def, "Rand", ugen_rate, inputs, None)
    }

    fn rand_id(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RandIdArgs) -> WitUgenInput {
        let seed = args.seed.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![seed];
        delegate_ugen(def, "RandID", ugen_rate, inputs, None)
    }

    fn rand_seed(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RandSeedArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let seed = args.seed.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(56789.0));
        let inputs: Vec<UGenInput> = vec![trig, seed];
        delegate_ugen(def, "RandSeed", ugen_rate, inputs, None)
    }

    fn record_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RecordBufArgs) -> WitUgenInput {
        let input_array: Vec<UGenInput> = args.input_array.into_iter().map(ugen_input_from_wit).collect();
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let offset = args.offset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let rec_level = args.rec_level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let pre_level = args.pre_level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let run = args.run.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array);
        inputs.push(bufnum);
        inputs.push(offset);
        inputs.push(rec_level);
        inputs.push(pre_level);
        inputs.push(run);
        inputs.push(loop_);
        inputs.push(trigger);
        inputs.push(action);
        delegate_ugen(def, "RecordBuf", ugen_rate, inputs, None)
    }

    fn replace_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ReplaceOutArgs) -> WitUgenInput {
        let bus = ugen_input_from_wit(args.bus);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(bus);
        inputs.extend(channels_array);
        delegate_ugen(def, "ReplaceOut", ugen_rate, inputs, None)
    }

    fn resonz(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ResonzArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let bwr = args.bwr.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, bwr];
        delegate_ugen(def, "Resonz", ugen_rate, inputs, None)
    }

    fn rhpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RhpfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "RHPF", ugen_rate, inputs, None)
    }

    fn ringz(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RingzArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let decay_time = args.decay_time.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, decay_time];
        delegate_ugen(def, "Ringz", ugen_rate, inputs, None)
    }

    fn rlpf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RlpfArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let rq = args.rq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, freq, rq];
        delegate_ugen(def, "RLPF", ugen_rate, inputs, None)
    }

    fn rotate2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Rotate2Args) -> WitUgenInput {
        let x = ugen_input_from_wit(args.x);
        let y = ugen_input_from_wit(args.y);
        let pos = args.pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![x, y, pos];
        delegate_ugen(def, "Rotate2", ugen_rate, inputs, None)
    }

    fn running_max(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RunningMaxArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, trig];
        delegate_ugen(def, "RunningMax", ugen_rate, inputs, None)
    }

    fn running_min(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RunningMinArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, trig];
        delegate_ugen(def, "RunningMin", ugen_rate, inputs, None)
    }

    fn running_sum(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: RunningSumArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let numsamp = args.numsamp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(40.0));
        let inputs: Vec<UGenInput> = vec![in_, numsamp];
        delegate_ugen(def, "RunningSum", ugen_rate, inputs, None)
    }

    fn sample_dur(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "SampleDur", ugen_rate, inputs, None)
    }

    fn sample_rate(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "SampleRate", ugen_rate, inputs, None)
    }

    fn saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SawArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let inputs: Vec<UGenInput> = vec![freq];
        delegate_ugen(def, "Saw", ugen_rate, inputs, None)
    }

    fn schmidt(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SchmidtArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, lo, hi];
        delegate_ugen(def, "Schmidt", ugen_rate, inputs, None)
    }

    fn scope_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ScopeOutArgs) -> WitUgenInput {
        let input_array: Vec<UGenInput> = args.input_array.into_iter().map(ugen_input_from_wit).collect();
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array);
        inputs.push(bufnum);
        delegate_ugen(def, "ScopeOut", ugen_rate, inputs, None)
    }

    fn scope_out2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ScopeOut2Args) -> WitUgenInput {
        let input_array: Vec<UGenInput> = args.input_array.into_iter().map(ugen_input_from_wit).collect();
        let scope_num = args.scope_num.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max_frames = args.max_frames.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(4096.0));
        let scope_frames = args.scope_frames.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(4096.0));
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.extend(input_array);
        inputs.push(scope_num);
        inputs.push(max_frames);
        inputs.push(scope_frames);
        delegate_ugen(def, "ScopeOut2", ugen_rate, inputs, None)
    }

    fn select(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SelectArgs) -> WitUgenInput {
        let which = ugen_input_from_wit(args.which);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(which);
        inputs.extend(channels_array);
        delegate_ugen(def, "Select", ugen_rate, inputs, None)
    }

    fn send_reply(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SendReplyArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let cmd_name = ugen_input_from_wit(args.cmd_name);
        let values = args.values.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let reply_id = args.reply_id.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let inputs: Vec<UGenInput> = vec![trig, cmd_name, values, reply_id];
        delegate_ugen(def, "SendReply", ugen_rate, inputs, None)
    }

    fn send_trig(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SendTrigArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let id = args.id.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let value = args.value.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, id, value];
        delegate_ugen(def, "SendTrig", ugen_rate, inputs, None)
    }

    fn set_buf(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SetBufArgs) -> WitUgenInput {
        let buf = ugen_input_from_wit(args.buf);
        let values = ugen_input_from_wit(args.values);
        let offset = args.offset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![buf, values, offset];
        delegate_ugen(def, "SetBuf", ugen_rate, inputs, None)
    }

    fn set_reset_ff(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SetResetFfArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig, reset];
        delegate_ugen(def, "SetResetFF", ugen_rate, inputs, None)
    }

    fn shaper(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ShaperArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, in_];
        delegate_ugen(def, "Shaper", ugen_rate, inputs, None)
    }

    fn shared_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SharedInArgs) -> WitUgenInput {
        let bus = args.bus.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let num_channels = args.num_channels.unwrap_or(1);
        let inputs: Vec<UGenInput> = vec![bus];
        delegate_ugen(def, "SharedIn", ugen_rate, inputs, Some(num_channels))
    }

    fn shared_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SharedOutArgs) -> WitUgenInput {
        let bus = ugen_input_from_wit(args.bus);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(bus);
        inputs.extend(channels_array);
        delegate_ugen(def, "SharedOut", ugen_rate, inputs, None)
    }

    fn silent(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SilentArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "Silent", ugen_rate, inputs, Some(num_channels))
    }

    fn sin_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SinOscArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, phase];
        delegate_ugen(def, "SinOsc", ugen_rate, inputs, None)
    }

    fn sin_osc_fb(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SinOscFbArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let feedback = args.feedback.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, feedback];
        delegate_ugen(def, "SinOscFB", ugen_rate, inputs, None)
    }

    fn slew(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SlewArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let up = args.up.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let dn = args.dn.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, up, dn];
        delegate_ugen(def, "Slew", ugen_rate, inputs, None)
    }

    fn slope(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SlopeArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "Slope", ugen_rate, inputs, None)
    }

    fn sos(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SosArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let a0 = args.a0.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let a1 = args.a1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let a2 = args.a2.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let b1 = args.b1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let b2 = args.b2.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, a0, a1, a2, b1, b2];
        delegate_ugen(def, "SOS", ugen_rate, inputs, None)
    }

    fn spec_centroid(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SpecCentroidArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let inputs: Vec<UGenInput> = vec![chain];
        delegate_ugen(def, "SpecCentroid", ugen_rate, inputs, None)
    }

    fn spec_flatness(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SpecFlatnessArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let inputs: Vec<UGenInput> = vec![chain];
        delegate_ugen(def, "SpecFlatness", ugen_rate, inputs, None)
    }

    fn spec_pcile(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SpecPcileArgs) -> WitUgenInput {
        let chain = ugen_input_from_wit(args.chain);
        let fraction = args.fraction.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let interpolate = args.interpolate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![chain, fraction, interpolate];
        delegate_ugen(def, "SpecPcile", ugen_rate, inputs, None)
    }

    fn spring(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SpringArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let spring = args.spring.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let damp = args.damp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, spring, damp];
        delegate_ugen(def, "Spring", ugen_rate, inputs, None)
    }

    fn standard_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: StandardLArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let k = args.k.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, k, xi, yi];
        delegate_ugen(def, "StandardL", ugen_rate, inputs, None)
    }

    fn standard_n(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: StandardNArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(22050.0));
        let k = args.k.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let xi = args.xi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let yi = args.yi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, k, xi, yi];
        delegate_ugen(def, "StandardN", ugen_rate, inputs, None)
    }

    fn stepper(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: StepperArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let min = args.min.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let max = args.max.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(7.0));
        let step = args.step.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let resetval = args.resetval.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![trig, reset, min, max, step, resetval];
        delegate_ugen(def, "Stepper", ugen_rate, inputs, None)
    }

    fn stereo_convolution2_l(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: StereoConvolution2LArgs) -> WitUgenInput {
        let in_ = ugen_input_from_wit(args.in_);
        let kernel_l = ugen_input_from_wit(args.kernel_l);
        let kernel_r = ugen_input_from_wit(args.kernel_r);
        let trigger = ugen_input_from_wit(args.trigger);
        let framesize = args.framesize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(512.0));
        let crossfade = args.crossfade.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, kernel_l, kernel_r, trigger, framesize, crossfade];
        delegate_ugen(def, "StereoConvolution2L", ugen_rate, inputs, None)
    }

    fn subsample_offset(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "SubsampleOffset", ugen_rate, inputs, None)
    }

    fn sweep(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SweepArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![trig, rate];
        delegate_ugen(def, "Sweep", ugen_rate, inputs, None)
    }

    fn sync_saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: SyncSawArgs) -> WitUgenInput {
        let sync_freq = args.sync_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let saw_freq = args.saw_freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let inputs: Vec<UGenInput> = vec![sync_freq, saw_freq];
        delegate_ugen(def, "SyncSaw", ugen_rate, inputs, None)
    }

    fn t_ball(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TBallArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let g = args.g.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(10.0));
        let damp = args.damp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let friction = args.friction.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let inputs: Vec<UGenInput> = vec![in_, g, damp, friction];
        delegate_ugen(def, "TBall", ugen_rate, inputs, None)
    }

    fn t_delay(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TDelayArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![trig, dur];
        delegate_ugen(def, "TDelay", ugen_rate, inputs, None)
    }

    fn t_duty(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TDutyArgs) -> WitUgenInput {
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let reset = args.reset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let gap_first = args.gap_first.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![dur, reset, action, level, gap_first];
        delegate_ugen(def, "TDuty", ugen_rate, inputs, None)
    }

    fn t_exp_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TExpRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.01));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![lo, hi, trig];
        delegate_ugen(def, "TExpRand", ugen_rate, inputs, None)
    }

    fn t_grains(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TGrainsArgs) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(2);
        let trigger = args.trigger.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let center_pos = args.center_pos.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let amp = args.amp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let interp = args.interp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(4.0));
        let inputs: Vec<UGenInput> = vec![trigger, bufnum, rate, center_pos, dur, pan, amp, interp];
        delegate_ugen(def, "TGrains", ugen_rate, inputs, Some(num_channels))
    }

    fn t_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![lo, hi, trig];
        delegate_ugen(def, "TRand", ugen_rate, inputs, None)
    }

    fn t_windex(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TWindexArgs) -> WitUgenInput {
        let trig = ugen_input_from_wit(args.trig);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let normalize = args.normalize.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(trig);
        inputs.extend(channels_array);
        inputs.push(normalize);
        delegate_ugen(def, "TWindex", ugen_rate, inputs, None)
    }

    fn t2_a(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: T2AArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let offset = args.offset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_, offset];
        delegate_ugen(def, "T2A", ugen_rate, inputs, None)
    }

    fn t2_k(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: T2KArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "T2K", ugen_rate, inputs, None)
    }

    fn ti_rand(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TiRandArgs) -> WitUgenInput {
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(127.0));
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![lo, hi, trig];
        delegate_ugen(def, "TIRand", ugen_rate, inputs, None)
    }

    fn timer(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TimerArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig];
        delegate_ugen(def, "Timer", ugen_rate, inputs, None)
    }

    fn toggle_ff(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ToggleFfArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![trig];
        delegate_ugen(def, "ToggleFF", ugen_rate, inputs, None)
    }

    fn trapezoid(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TrapezoidArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let a = args.a.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.2));
        let b = args.b.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.4));
        let c = args.c.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.6));
        let d = args.d.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.8));
        let inputs: Vec<UGenInput> = vec![in_, a, b, c, d];
        delegate_ugen(def, "Trapezoid", ugen_rate, inputs, None)
    }

    fn trig(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TrigArgs) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![trig, dur];
        delegate_ugen(def, "Trig", ugen_rate, inputs, None)
    }

    fn trig1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Trig1Args) -> WitUgenInput {
        let trig = args.trig.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let inputs: Vec<UGenInput> = vec![trig, dur];
        delegate_ugen(def, "Trig1", ugen_rate, inputs, None)
    }

    fn two_pole(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TwoPoleArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let radius = args.radius.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.8));
        let inputs: Vec<UGenInput> = vec![in_, freq, radius];
        delegate_ugen(def, "TwoPole", ugen_rate, inputs, None)
    }

    fn two_zero(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: TwoZeroArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let radius = args.radius.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.8));
        let inputs: Vec<UGenInput> = vec![in_, freq, radius];
        delegate_ugen(def, "TwoZero", ugen_rate, inputs, None)
    }

    fn v_disk_in(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: VDiskInArgs) -> WitUgenInput {
        let num_channels = args.num_channels;
        let bufnum = ugen_input_from_wit(args.bufnum);
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let loop_ = args.loop_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let send_id = args.send_id.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, rate, loop_, send_id];
        delegate_ugen(def, "VDiskIn", ugen_rate, inputs, Some(num_channels))
    }

    fn v_osc(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: VOscArgs) -> WitUgenInput {
        let bufpos = ugen_input_from_wit(args.bufpos);
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let phase = args.phase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufpos, freq, phase];
        delegate_ugen(def, "VOsc", ugen_rate, inputs, None)
    }

    fn v_osc3(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: VOsc3Args) -> WitUgenInput {
        let bufpos = ugen_input_from_wit(args.bufpos);
        let freq1 = args.freq1.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(110.0));
        let freq2 = args.freq2.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(220.0));
        let freq3 = args.freq3.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let inputs: Vec<UGenInput> = vec![bufpos, freq1, freq2, freq3];
        delegate_ugen(def, "VOsc3", ugen_rate, inputs, None)
    }

    fn var_saw(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: VarSawArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let width = args.width.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.5));
        let inputs: Vec<UGenInput> = vec![freq, iphase, width];
        delegate_ugen(def, "VarSaw", ugen_rate, inputs, None)
    }

    fn vibrato(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: VibratoArgs) -> WitUgenInput {
        let freq = args.freq.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(440.0));
        let rate = args.rate.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(6.0));
        let depth = args.depth.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.02));
        let delay = args.delay.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let onset = args.onset.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let rate_variation = args.rate_variation.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.04));
        let depth_variation = args.depth_variation.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let iphase = args.iphase.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![freq, rate, depth, delay, onset, rate_variation, depth_variation, iphase];
        delegate_ugen(def, "Vibrato", ugen_rate, inputs, None)
    }

    fn warp1(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: Warp1Args) -> WitUgenInput {
        let num_channels = args.num_channels.unwrap_or(1);
        let bufnum = args.bufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let pointer = args.pointer.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let freq_scale = args.freq_scale.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let window_size = args.window_size.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.1));
        let envbufnum = args.envbufnum.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(-1.0));
        let overlaps = args.overlaps.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(8.0));
        let window_rand_ratio = args.window_rand_ratio.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let interp = args.interp.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![bufnum, pointer, freq_scale, window_size, envbufnum, overlaps, window_rand_ratio, interp];
        delegate_ugen(def, "Warp1", ugen_rate, inputs, Some(num_channels))
    }

    fn white_noise(def: SynthDefBorrow<'_>, ugen_rate: WitRate) -> WitUgenInput {
        let inputs: Vec<UGenInput> = Vec::new();
        delegate_ugen(def, "WhiteNoise", ugen_rate, inputs, None)
    }

    fn wrap(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: WrapArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let lo = args.lo.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let hi = args.hi.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_, lo, hi];
        delegate_ugen(def, "Wrap", ugen_rate, inputs, None)
    }

    fn wrap_index(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: WrapIndexArgs) -> WitUgenInput {
        let bufnum = ugen_input_from_wit(args.bufnum);
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![bufnum, in_];
        delegate_ugen(def, "WrapIndex", ugen_rate, inputs, None)
    }

    fn x_fade2(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: XFade2Args) -> WitUgenInput {
        let in_a = ugen_input_from_wit(args.in_a);
        let in_b = ugen_input_from_wit(args.in_b);
        let pan = args.pan.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let level = args.level.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let inputs: Vec<UGenInput> = vec![in_a, in_b, pan, level];
        delegate_ugen(def, "XFade2", ugen_rate, inputs, None)
    }

    fn x_line(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: XLineArgs) -> WitUgenInput {
        let start = args.start.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let end = args.end.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(2.0));
        let dur = args.dur.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(1.0));
        let action = args.action.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![start, end, dur, action];
        delegate_ugen(def, "XLine", ugen_rate, inputs, None)
    }

    fn x_out(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: XOutArgs) -> WitUgenInput {
        let bus = ugen_input_from_wit(args.bus);
        let xfade = ugen_input_from_wit(args.xfade);
        let channels_array: Vec<UGenInput> = args.channels_array.into_iter().map(ugen_input_from_wit).collect();
        let mut inputs: Vec<UGenInput> = Vec::new();
        inputs.push(bus);
        inputs.push(xfade);
        inputs.extend(channels_array);
        delegate_ugen(def, "XOut", ugen_rate, inputs, None)
    }

    fn zero_crossing(def: SynthDefBorrow<'_>, ugen_rate: WitRate, args: ZeroCrossingArgs) -> WitUgenInput {
        let in_ = args.in_.map(ugen_input_from_wit).unwrap_or(UGenInput::Constant(0.0));
        let inputs: Vec<UGenInput> = vec![in_];
        delegate_ugen(def, "ZeroCrossing", ugen_rate, inputs, None)
    }

}
