import type {ScUgenItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './internal/sc-element.ts';

export class ScUgen extends ScElement<ScUgenItem, undefined> {
  getState(_state: RuntimeState): undefined {
    return undefined;
  }

  createRenderRoot() {
    return this;
  }
}
