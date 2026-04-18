import {ELEMENTS} from '@/constants/sc-elements.ts';
import {ScDisplay} from './sc-display.ts';
import {ScIf} from './sc-if.ts';
import {ScRange} from './sc-range.ts';
import {ScCheckbox} from './sc-checkbox.ts';
import {ScGroup} from './sc-group.ts';
import {ScSynth} from './sc-synth.ts';
import {ScRun} from './sc-run.ts';
import {ScPlugin} from './sc-plugin.ts';
import {ScSynthDef} from './sc-synthdef.ts';
import {ScUgen} from './sc-ugen.ts';
import {ScControl} from './sc-control.ts';
import {ScVar} from './sc-var.ts';
import {ScBuffer} from './sc-buffer.ts';
import {ScWaveform} from './sc-waveform.ts';
import {ScSelect} from './sc-select.ts';
import {ScOption} from './sc-option.ts';
import {ScRadioGroup} from './sc-radio-group.ts';
import {ScRadio} from './sc-radio.ts';

export default {
  [ELEMENTS.SC_DISPLAY]: ScDisplay,
  [ELEMENTS.SC_IF]: ScIf,
  [ELEMENTS.SC_RANGE]: ScRange,
  [ELEMENTS.SC_CHECKBOX]: ScCheckbox,
  [ELEMENTS.SC_GROUP]: ScGroup,
  [ELEMENTS.SC_SYNTH]: ScSynth,
  [ELEMENTS.SC_RUN]: ScRun,
  [ELEMENTS.SC_PLUGIN]: ScPlugin,
  [ELEMENTS.SC_SYNTHDEF]: ScSynthDef,
  [ELEMENTS.SC_UGEN]: ScUgen,
  [ELEMENTS.SC_CONTROL]: ScControl,
  [ELEMENTS.SC_VAR]: ScVar,
  [ELEMENTS.SC_SELECT]: ScSelect,
  [ELEMENTS.SC_OPTION]: ScOption,
  [ELEMENTS.SC_RADIO_GROUP]: ScRadioGroup,
  [ELEMENTS.SC_RADIO]: ScRadio,
  [ELEMENTS.SC_BUFFER]: ScBuffer,
  [ELEMENTS.SC_WAVEFORM]: ScWaveform,
};
