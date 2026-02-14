export type Action<T extends string = string, P = void> =
  [P] extends [void] ? { type: T } : { type: T; payload: P };

export type AnyAction = Action & { [key: string]: any };

export type ActionCreator<T extends string = string, P = void> =
  [P] extends [void]
    ? { (): Action<T>; type: T; match: (action: Action) => action is Action<T> }
    : { (payload: P): Action<T, P>; type: T; match: (action: Action) => action is Action<T, P> };

export type Reducer<S = any, A extends Action = AnyAction> = (
    state: S | undefined,
    action: A,
) => S;

export type CaseReducer<S, A extends Action = Action> = (state: S, action: A) => void | S;

export type ReducerWithInitialState<S> = Reducer<S> & {
  getInitialState: () => S;
};

export type CaseReducers<S, A = Record<string, any>> = {
  [K in keyof A]: CaseReducer<S, A[K] & Action>
};

export type SliceActions<A extends Record<string, (...args: any[]) => any>> =
  ReturnType<A[keyof A]>;

export type Slice<S, Name extends string, R extends CaseReducers<S>> = {
  getInitialState: () => S;
  reducer: ReducerWithInitialState<S>;
  actions: {
    [K in keyof R & string]: R[K] extends (...args: infer A) => any
      ? A extends [any, { payload: infer P }]
        ? ActionCreator<`${Name}/${K}`, P>
        : ActionCreator<`${Name}/${K}`>
      : never;
  };
};

export function createAction<T extends string>(
  type: T,
): ActionCreator<T>;
export function createAction<T extends string, Args extends unknown[], R>(
  type: T,
  prepare: (...args: Args) => R,
): { (...args: Args): Action<T, R>; type: T };

export function createAction(type: string, prepare?: (...args: any[]) => any) {
  return Object.assign(
    (...args: any[]) => prepare ? {type, payload: prepare(...args)} : {type},
    {type, match: (action: Action): action is any => action.type === type},
  );
}

export function createReducer<S, R extends CaseReducers<S>>(
  initialState: S | (() => S),
  reducers: R,
  defaultReducer?: CaseReducer<S>,
): ReducerWithInitialState<S> {
  const getInitialState = typeof initialState === "function"
    ? initialState as () => S
    : () => initialState;

  return Object.assign(
      ((state: S | undefined, action: Action) => {
        const s = state ?? getInitialState();
      const handler = reducers[action.type];
      if (handler) {
        handler(s, action);
      } else {
        defaultReducer?.(s, action);
      }
        return s;
      }) as Reducer<S>,
    {getInitialState},
  );
}

export function createSlice<S, Name extends string, R extends CaseReducers<S>>(config: {
  name: Name;
  initialState: S | (() => S);
  reducers: R;
  defaultReducer?: CaseReducer<S>;
}): Slice<S, Name, R> {
  const {name, initialState, reducers, defaultReducer} = config;
  const actions = {} as Record<string, any>;
  const handlerMap = {} as CaseReducers<S>;

  for (const key of Object.keys(reducers)) {
    const type = `${name}/${key}`;
    actions[key] = createAction(type, (payload: any) => payload);
    handlerMap[type] = reducers[key];
  }

  const reducer = createReducer(initialState, handlerMap, defaultReducer);

  return {getInitialState: reducer.getInitialState, reducer, actions: actions as any};
}

export interface Store<S = any> {
  getState: () => S;
  dispatch: (action: any) => void;
}

export function createApi<
  State,
  Selectors extends Record<string, (state: State) => any>,
  Actions extends Record<string, (...args: any[]) => Action>,
>(
  store: Store<State>,
  config: { selectors: Selectors; actions: Actions },
): { readonly [K in keyof Selectors]: ReturnType<Selectors[K]> }
   & { [K in keyof Actions]: (...args: Parameters<Actions[K]>) => void } {
  const api = {} as any;

  for (const [key, selector] of Object.entries(config.selectors)) {
    Object.defineProperty(api, key, {
      get: () => selector(store.getState()),
      enumerable: true,
    });
  }

  for (const [key, actionCreator] of Object.entries(config.actions)) {
    api[key] = (...args: any[]) => store.dispatch(actionCreator(...args));
  }

  return api;
}

type Selector<S = any, R = any> = (state: S) => R;

export type SliceSelector<Root extends Selector> =
  <R>(fn: (slice: ReturnType<Root>) => R) => Selector<Parameters<Root>[0], R>;

export function createSelector<S, R1, Result>(
    s1: Selector<S, R1>,
    combiner: (r1: R1) => Result,
): Selector<S, Result>;
export function createSelector<S, R1, R2, Result>(
    s1: Selector<S, R1>,
    s2: Selector<S, R2>,
    combiner: (r1: R1, r2: R2) => Result,
): Selector<S, Result>;
export function createSelector<S, R1, R2, R3, Result>(
    s1: Selector<S, R1>,
    s2: Selector<S, R2>,
    s3: Selector<S, R3>,
    combiner: (r1: R1, r2: R2, r3: R3) => Result,
): Selector<S, Result>;
export function createSelector<S, R1, R2, R3, R4, Result>(
    s1: Selector<S, R1>,
    s2: Selector<S, R2>,
    s3: Selector<S, R3>,
    s4: Selector<S, R4>,
    combiner: (r1: R1, r2: R2, r3: R3, r4: R4) => Result,
): Selector<S, Result>;
export function createSelector(...args: ((...a: any[]) => any)[]) {
  const combiner = args.pop()!;
  const selectors = args;
  let lastInputs: unknown[] | undefined;
  let lastResult: unknown;

  return (state: unknown) => {
    const inputs = selectors.map(s => s(state));
    if (lastInputs && inputs.every((v, i) => v === lastInputs![i])) {
      return lastResult;
    }
    lastInputs = inputs;
    lastResult = combiner(...inputs);
    return lastResult;
  };
}

export function combineReducers<S extends object>(
    reducers: { [K in keyof S]: Reducer<S[K]> },
): Reducer<S> {
  const keys = Object.keys(reducers) as (keyof S)[];
  return ((state, action) => {
    const s = state ?? {} as S;
    for (const key of keys) {
      s[key] = reducers[key](s[key], action);
    }
    return s;
  }) as Reducer<S>;
}
