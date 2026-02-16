import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {store} from '@/lib/stores/store';

export class StoreSubscriber implements ReactiveController {
  private _unsubscribe?: () => void;
  private _prev: unknown;

  constructor(private host: ReactiveControllerHost, private _select: () => unknown) {
    host.addController(this);
  }

  hostConnected() {
    this._prev = this._select();
    this._unsubscribe = store.subscribe(() => {
      const next = this._select();
      if (next !== this._prev) {
        this._prev = next;
        this.host.requestUpdate();
      }
    });
  }

  hostDisconnected() {
    this._unsubscribe?.();
  }
}
