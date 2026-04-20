// @generated — DO NOT EDIT.
// Regenerate with `node scripts/generate_ugens_rust.mjs`.

use crate::registry::UGenRegistryEntry;
use crate::Rate;

pub(crate) const UGENS: &[UGenRegistryEntry] = &[
    UGenRegistryEntry {
        name: r"Amplitude",
        rates: &[Rate::Audio, Rate::Control],
        defaults: &[(r"in", Some(0.0)), (r"attackTime", Some(0.01)), (r"releaseTime", Some(0.01))],
        num_outputs: None,
        extends: None,
        summary: Some(r"Amplitude follower"),
        doc: Some(r"Tracks the peak amplitude of a signal."),
        signal_range: None,
        arg_docs: &[(r"attackTime", r"60dB convergence time for following attacks"), (r"in", r"input signal"), (r"releaseTime", r"60dB convergence time for following decays")],
    },
    UGenRegistryEntry {
        name: r"Compander",
        rates: &[Rate::Audio],
        defaults: &[(r"in", Some(0.0)), (r"control", Some(0.0)), (r"thresh", Some(0.5)), (r"slopeBelow", Some(1.0)), (r"slopeAbove", Some(1.0)), (r"clampTime", Some(0.01)), (r"relaxTime", Some(0.1))],
        num_outputs: None,
        extends: None,
        summary: Some(r"General purpose hard-knee dynamic range processor."),
        doc: Some(r"The compander will modify the amplitude of the in signal based on an analysis of the control signal. Typically the in and control signals are the same. The amplitude of the control signal is calcuated using RMS (Root Mean Square) and the final amplitude of the in signal is calculated as a function of the amplitude threshold, and slopes either side (below and above) with some temporal modifications in terms of attack and release phases. It is a hard-knee processor which means that the response curve is a sharp angle rather than a rounded edge. If the control amplitude is less than the threshold, the slope below is used to calculate the amplitude modification. If this is steep (greater than 1) this will reduce the amplitude of quiet signals (the quieter the control amplitude the greater the reduction affect). Values < 1.0 are possible, but it means that a very low-level control signal will cause the input signal to be amplified, which would raise the noise floor. If the control amplitude is greater than the threshold, the slope above is used to calculate the amplitude modification. If this is steep (greater than 1) this will create expansion - loud signals will be made louder). Less than 1 will achieve compressions (louder signals are attenuated). The clamp and relax times modify when the amplitude modification takes place and ends. May be used to define: compressers, expanders, limiters, gates and duckers. For more information see: http://en.wikipedia.org/wiki/Audio_level_compression"),
        signal_range: None,
        arg_docs: &[(r"clampTime", r"Time taken for the amplitude adjustment to kick in fully (in seconds). This is usually pretty small, not much more than 10 milliseconds (the default value). Also known as the time of the attack phase."), (r"control", r"The signal whose amplitude determines the gain applied to the input signal. Often the same as in (for standard gating or compression) but should be different for ducking."), (r"in", r"The signal to be compressed / expanded / gated"), (r"relaxTime", r"The amount of time for the amplitude adjustment to be released. Usually a bit longer than clamp-time; if both times are too short, you can get some (possibly unwanted) artifacts. Also known as the time of the release phase."), (r"slopeAbove", r"Slope of the amplitude curve above the threshold. A value of 1 means the output amplitude will match the control signal amplitude."), (r"slopeBelow", r"Slope of the amplitude curve below the threshold. A value of 1 means the output amplitude will match the control signal amplitude."), (r"thresh", r"Control signal amplitude threshold, which determines the break point between slope-below and slope-above. Typically a value between 0 and 1.")],
    },
    UGenRegistryEntry {
        name: r"Limiter",
        rates: &[Rate::Audio],
        defaults: &[(r"in", None), (r"level", Some(1.0)), (r"dur", Some(0.01))],
        num_outputs: None,
        extends: Some(r"Normalizer"),
        summary: None,
        doc: Some(r"Limits the input amplitude to the given level. Limiter will not overshoot like Compander will, but it needs to look ahead in the audio. Thus there is a delay equal to twice the lookAheadTime. Limiter, unlike Compander, is completely transparent for an in range signal."),
        signal_range: None,
        arg_docs: &[(r"dur", r"The buffer delay time. Shorter times will produce smaller delays and quicker transient response times, but may introduce amplitude modulation artifacts. (AKA lookAheadTime)"), (r"in", r"The input signal"), (r"level", r"The peak output amplitude level to which to normalize the input")],
    },
    UGenRegistryEntry {
        name: r"Normalizer",
        rates: &[Rate::Audio],
        defaults: &[(r"in", None), (r"level", Some(1.0)), (r"dur", Some(0.01))],
        num_outputs: None,
        extends: None,
        summary: None,
        doc: Some(r"flattens dynamics. Normalizes the input amplitude to the given level. Normalize will not overshoot like Compander will, but it needs to look ahead in the audio. Thus there is a delay equal to twice the lookAheadTime."),
        signal_range: None,
        arg_docs: &[(r"dur", r"The buffer delay time. Shorter times will produce smaller delays and quicker transient response times, but may introduce amplitude modulation artifacts. (AKA lookAheadTime)"), (r"in", r"The input signal"), (r"level", r"The peak output amplitude level to which to normalize the input")],
    },
];
