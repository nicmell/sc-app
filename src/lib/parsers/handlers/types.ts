import type {ParseContext} from "../index";

export interface ElementHandler {
    /** Extract matchable props from HTML attributes (used by resolveId for rehydration) */
    extractProps(el: Element): Record<string, unknown>;

    /** Validate bindings against scope. Throw on invalid bind. No-op for elements without binds. */
    validateBindings(ctx: ParseContext): void;

    /** Prepare a child ParseContext (e.g., fresh elements[], saved children). Return undefined for leaf elements. */
    childContext(ctx: ParseContext): ParseContext | undefined;

    /** Build the ScElementNode and push it + any RuntimeEntries onto ctx. Called after ID resolution and validation. */
    process(ctx: ParseContext): ParseContext;
}

export abstract class BaseHandler implements ElementHandler {
    abstract extractProps(el: Element): Record<string, unknown>;

    validateBindings(_ctx: ParseContext): void {}

    childContext(_ctx: ParseContext): ParseContext | undefined {
        return undefined;
    }

    process(ctx: ParseContext): ParseContext {
        return ctx;
    }
}
