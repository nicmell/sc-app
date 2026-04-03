import type {ScUgenNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './internal/sc-element.ts';

export class ScUgen extends ScElement<ScUgenNode, undefined> {
  getState(_state: RuntimeState): undefined {
    return undefined;
  }

  createRenderRoot() {
    return this;
  }
}
