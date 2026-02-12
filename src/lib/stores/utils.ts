import type {StateCreator, StoreApi} from "zustand";

type SliceCreator<TSlice> = StateCreator<
  TSlice,
  [],
  [],
  TSlice
>;

type SliceFactory<TRoot extends object, TKey extends keyof TRoot> = (
  creator: SliceCreator<TRoot[TKey]>
) => Pick<TRoot, TKey>;

/**
 * Creates a slice factory for a nested portion of a Zustand store.
 *
 * This allows you to define slices independently while maintaining a single root store,
 * enabling better code organization and type safety.
 *
 * @param api - The root store API
 * @param key - The key in the root state where this slice will be stored
 * @returns A function that takes a slice creator and returns the slice
 */
export function createSlice<TRoot extends object, TKey extends keyof TRoot>(
  api: StoreApi<TRoot>,
  key: TKey
): SliceFactory<TRoot, TKey> {
  return (creator: SliceCreator<TRoot[TKey]>): Pick<TRoot, TKey> => {
    type TSlice = TRoot[TKey];

    const getSliceState: StoreApi<TSlice>["getState"] = () => api.getState()[key];

    const setSliceState: StoreApi<TSlice>["setState"] = (partial, replace) => {
      const currentSlice = getSliceState();
      const nextSlice =
        typeof partial === "function"
          ? (partial as (state: TSlice) => TSlice | Partial<TSlice>)(currentSlice)
          : partial;
      const updatedSlice: TSlice = replace
        ? (nextSlice as TSlice)
        : ({...currentSlice, ...(nextSlice as Partial<TSlice>)} as TSlice);

      api.setState({...api.getState(), [key]: updatedSlice} as Partial<TRoot>);
    };

    const subscribeToSlice: StoreApi<TSlice>["subscribe"] = (listener) =>
      api.subscribe((state, prevState) => {
        const currentSlice = state[key];
        const previousSlice = prevState[key];
        if (currentSlice !== previousSlice) {
          listener(currentSlice, previousSlice);
        }
      });

    const sliceApi: StoreApi<TSlice> = {
      setState: setSliceState,
      getState: getSliceState,
      subscribe: subscribeToSlice,
      getInitialState: () => api.getInitialState()[key],
    };

    const sliceState = creator(
      sliceApi.setState,
      sliceApi.getState,
      sliceApi
    );

    return {[key]: sliceState} as Pick<TRoot, TKey>;
  };
}
