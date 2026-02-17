import {ELEMENTS} from '@/constants/sc-elements.ts';
import {ScDisplay} from './sc-display.ts';
import {ScIf} from './sc-if.ts';
import {ScKnob} from './sc-knob.ts';
import {ScRange} from './sc-range.ts';
import {ScSlider} from './sc-slider.ts';
import {ScSwitch} from './sc-switch.ts';
import {ScGroup} from './sc-group.ts';
import {ScSynth} from './sc-synth.ts';
import {ScToggle} from './sc-toggle.ts';

export default {
  [ELEMENTS.SC_DISPLAY]: ScDisplay,
  [ELEMENTS.SC_IF]: ScIf,
  [ELEMENTS.SC_KNOB]: ScKnob,
  [ELEMENTS.SC_RANGE]: ScRange,
  [ELEMENTS.SC_SLIDER]: ScSlider,
  [ELEMENTS.SC_SWITCH]: ScSwitch,
  [ELEMENTS.SC_GROUP]: ScGroup,
  [ELEMENTS.SC_SYNTH]: ScSynth,
  [ELEMENTS.SC_TOGGLE]: ScToggle,
};
