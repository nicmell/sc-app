import {ELEMENTS} from "@/constants/sc-elements";
import type {ElementHandler} from "./types";
import {PluginHandler} from "./plugin";
import {GroupHandler} from "./group";
import {SynthHandler} from "./synth";
import {SynthDefHandler} from "./synthdef";
import {RangeHandler} from "./range";
import {CheckboxHandler} from "./checkbox";
import {RunHandler} from "./run";
import {MidiHandler} from "./midi";
import {DisplayHandler} from "./display";
import {IfHandler} from "./if";
import {DefaultHandler} from "./default";

export type {ElementHandler} from "./types";

const handlers: Record<string, ElementHandler> = {
    [ELEMENTS.SC_PLUGIN]: new PluginHandler(),
    [ELEMENTS.SC_GROUP]: new GroupHandler(),
    [ELEMENTS.SC_SYNTH]: new SynthHandler(),
    [ELEMENTS.SC_SYNTHDEF]: new SynthDefHandler(),
    [ELEMENTS.SC_RANGE]: new RangeHandler(),
    [ELEMENTS.SC_CHECKBOX]: new CheckboxHandler(),
    [ELEMENTS.SC_RUN]: new RunHandler(),
    [ELEMENTS.SC_MIDI]: new MidiHandler(),
    [ELEMENTS.SC_DISPLAY]: new DisplayHandler(),
    [ELEMENTS.SC_IF]: new IfHandler(),
};

export const defaultHandler = new DefaultHandler();

export function getHandler(tag: string): ElementHandler {
    return handlers[tag] ?? defaultHandler;
}
