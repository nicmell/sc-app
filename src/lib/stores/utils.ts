import type {StateCreator, StoreApi} from "zustand";

export function combineSlice<TSlice, TRoot, TKey extends keyof TRoot>(
  creator: StateCreator<TSlice>,
  api: StoreApi<TRoot>,
  key: TKey,
): Pick<TRoot, TKey> {
  type Inner = TRoot[TKey];

  const nestedGetState = (): Inner => api.getState()[key];

  const nestedSetState: StoreApi<Inner>["setState"] = (partial, replace) => {
    const prev = nestedGetState();
    const next = partial instanceof Function ? partial(prev) : partial;
    const merged: Inner = replace ? (next as Inner) : {...prev, ...next};
    api.setState({...api.getState(), [key]: merged});
  };

  const nestedApi: StoreApi<Inner> = {
    setState: nestedSetState,
    getState: nestedGetState,
    subscribe: (listener) =>
      api.subscribe((state, prevState) => listener(state[key], prevState[key])),
    getInitialState: () => api.getInitialState()[key],
  };

  return {[key]: creator(
    (nestedApi as unknown as StoreApi<TSlice>).setState,
    (nestedApi as unknown as StoreApi<TSlice>).getState,
    nestedApi as unknown as StoreApi<TSlice>,
  )} as Pick<TRoot, TKey>;
}

