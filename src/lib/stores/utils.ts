import type {StateCreator, StoreApi} from "zustand";

export function createSlice<TRoot extends object, TKey extends keyof TRoot>(api: StoreApi<TRoot>, key: TKey) {
  return (creator: StateCreator<TRoot[TKey]>): Pick<TRoot, TKey> => {
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
          (nestedApi as unknown as StoreApi<TRoot[TKey]>).setState,
          (nestedApi as unknown as StoreApi<TRoot[TKey]>).getState,
          nestedApi as unknown as StoreApi<TRoot[TKey]>,
      )} as Pick<TRoot, TKey>;
  }
}
