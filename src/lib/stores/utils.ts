export type Action<T extends string = string, P = void> =
  [P] extends [void] ? { type: T } : { type: T; payload: P };

export type ActionCreator<T extends string = string, P = void> =
  [P] extends [void]
    ? { (): Action<T>; type: T }
    : { (payload: P): Action<T, P>; type: T };

type SliceReducer<S> = (state: S, action: Action) => void;

type CaseReducers<S> = Record<string, (state: S, ...args: any[]) => void>;

type InferActionCreators<Name extends string, R> = {
  [K in keyof R & string]: R[K] extends (...args: infer A) => any
    ? A extends [any, { payload: infer P }]
      ? ActionCreator<`${Name}/${K}`, P>
      : ActionCreator<`${Name}/${K}`>
    : never;
};

export type InferAction<T extends { actions: Record<string, (...args: any[]) => any> }> =
  ReturnType<T["actions"][keyof T["actions"]]>;

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

export function createReducer<S, A extends Action>(
  initialState: S,
  handlers: { [T in A["type"]]?: (state: S, action: Extract<A, { type: T }>) => void },
) {
  const reducer: SliceReducer<S> = (state, action) => {
    const handler = handlers[action.type as A["type"]];
    if (handler) {
      (handler as SliceReducer<S>)(state, action);
    }
  };
  return {initialState, reducer};
}

export function createSlice<S, Name extends string, R extends CaseReducers<S>>(config: {
  name: Name;
  initialState: S;
  reducers: R;
}): {
  initialState: S;
  reducer: SliceReducer<S>;
  actions: InferActionCreators<Name, R>;
} {
  const {name, initialState, reducers} = config;
  const actions = {} as Record<string, any>;
  const handlerMap = {} as Record<string, (state: S, action: Action) => void>;

  for (const key of Object.keys(reducers)) {
    const type = `${name}/${key}`;
    actions[key] = createAction(type, (payload: any) => payload);
    handlerMap[type] = reducers[key] as (state: S, action: Action) => void;
  }

  const {reducer} = createReducer<S, Action>(initialState, handlerMap);

  return {initialState, reducer, actions: actions as any};
}

export function combineReducers<S extends object>(
  reducers: { [K in keyof S]: SliceReducer<S[K]> },
): SliceReducer<S> {
  const keys = Object.keys(reducers) as (keyof S)[];
  return (state, action) => {
    for (const key of keys) {
      reducers[key](state[key], action);
    }
  };
}
