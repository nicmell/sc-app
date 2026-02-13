export type Action<T extends string = string, P = void> =
  [P] extends [void] ? { type: T } : { type: T; payload: P };

export type ActionCreator<T extends string = string, P = void> =
  [P] extends [void]
    ? { (): Action<T>; type: T }
    : { (payload: P): Action<T, P>; type: T };

export type CaseReducer<S, A extends Action = Action> = (state: S, action: A) => void;

export type CaseReducers<S, A = Record<string, any>> = {
  [K in keyof A]: CaseReducer<S, A[K] & Action>
};

export type Slice<S, Name extends string, R extends CaseReducers<S>> = {
  initialState: S;
  reducer: CaseReducer<S>;
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
    {type},
  );
}

export function createReducer<S, R extends CaseReducers<S>>(
  initialState: S,
  reducers: R,
) {
  const reducer: CaseReducer<S> = (state, action) => {
    const handler = reducers[action.type];
    if (handler) {
      handler(state, action);
    }
  };
  return {initialState, reducer};
}

export function createSlice<S, Name extends string, R extends CaseReducers<S>>(config: {
  name: Name;
  initialState: S;
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

  const {reducer} = createReducer(initialState, handlerMap);

  return {initialState, reducer, actions: actions as any};
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
