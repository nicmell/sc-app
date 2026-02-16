import {ScDisplay} from './sc-display.ts';
import {ScIf} from './sc-if.ts';
import {ScKnob} from './sc-knob.ts';
import {ScRange} from './sc-range.ts';
import {ScSlider} from './sc-slider.ts';
import {ScSwitch} from './sc-switch.ts';
import {ScGroup} from './sc-group.ts';
import {ScSynth} from './sc-synth.ts';
import {ScToggle} from './sc-toggle.ts';

customElements.define('sc-display', ScDisplay);
customElements.define('sc-if', ScIf);
customElements.define('sc-knob', ScKnob);
customElements.define('sc-range', ScRange);
customElements.define('sc-slider', ScSlider);
customElements.define('sc-switch', ScSwitch);
customElements.define('sc-group', ScGroup);
customElements.define('sc-synth', ScSynth);
customElements.define('sc-toggle', ScToggle);
