import {compileSynthDef} from "./SynthDefCompiler";
import type {UGenSpec} from "@/types/parsers";

class SynthDefManager {
    private defs = new Map<string, {boxId: string; bytes: number[]}>();

    compile(boxId: string, nodeId: string, name: string, controls: Record<string, number>, specs: Map<string, UGenSpec>): void {
        const bytes = compileSynthDef(name, controls, specs);
        this.defs.set(nodeId, {boxId, bytes});
    }

    get(nodeId: string): number[] | undefined {
        return this.defs.get(nodeId)?.bytes;
    }

    clearBox(boxId: string): void {
        for (const [id, entry] of this.defs) {
            if (entry.boxId === boxId) this.defs.delete(id);
        }
    }
}

export const synthDefManager = new SynthDefManager();
