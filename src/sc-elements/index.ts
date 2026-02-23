import {ELEMENTS} from '@/constants/sc-elements.ts';
import {ScDisplay} from './sc-display.ts';
import {ScIf} from './sc-if.ts';
import {ScRange} from './sc-range.ts';
import {ScCheckbox} from './sc-checkbox.ts';
import {ScGroup} from './sc-group.ts';
import {ScSynth} from './sc-synth.ts';
import {ScRun} from './sc-run.ts';
import {ScPlugin} from './sc-plugin.ts';

export default {
  [ELEMENTS.SC_DISPLAY]: ScDisplay,
  [ELEMENTS.SC_IF]: ScIf,
  [ELEMENTS.SC_RANGE]: ScRange,
  [ELEMENTS.SC_CHECKBOX]: ScCheckbox,
  [ELEMENTS.SC_GROUP]: ScGroup,
  [ELEMENTS.SC_SYNTH]: ScSynth,
  [ELEMENTS.SC_RUN]: ScRun,
  [ELEMENTS.SC_PLUGIN]: ScPlugin,
};
