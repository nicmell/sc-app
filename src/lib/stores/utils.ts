export type Action<T extends string = string, P = void> =
  [P] extends [void] ? { type: T } : { type: T; payload: P };

export type ActionCreator<T extends string = string, P = void> =
  [P] extends [void]
    ? { (): Action<T>; type: T; match: (action: Action) => action is Action<T> }
    : { (payload: P): Action<T, P>; type: T; match: (action: Action) => action is Action<T, P> };

export type CaseReducer<S, A extends Action = Action> = (state: S, action: A) => void | S;

export type ReducerWithInitialState<S> = CaseReducer<S> & {
  getInitialState: () => S;
};

export type CaseReducers<S, A = Record<string, any>> = {
  [K in keyof A]: CaseReducer<S, A[K] & Action>
};

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
): ReducerWithInitialState<S> {
  const getInitialState = typeof initialState === "function"
    ? initialState as () => S
    : () => initialState;

  return Object.assign(
    ((state: S, action: Action) => {
      const handler = reducers[action.type];
      if (handler) {
        handler(state, action);
      }
    }) as CaseReducer<S>,
    {getInitialState},
  );
}

export function createSlice<S, Name extends string, R extends CaseReducers<S>>(config: {
  name: Name;
  initialState: S | (() => S);
  reducers: R;
}): Slice<S, Name, R> {
  const {name, initialState, reducers} = config;
  const actions = {} as Record<string, any>;
  const handlerMap = {} as CaseReducers<S>;

  for (const key of Object.keys(reducers)) {
    const type = `${name}/${key}`;
    actions[key] = createAction(type, (payload: any) => payload);
    handlerMap[type] = reducers[key];
  }

  const reducer = createReducer(initialState, handlerMap);

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

export function combineReducers<S extends object>(
  reducers: { [K in keyof S]: CaseReducer<S[K]> },
): CaseReducer<S> {
  const keys = Object.keys(reducers) as (keyof S)[];
  return (state, action) => {
    for (const key of keys) {
      reducers[key](state[key], action);
    }
  };
}
