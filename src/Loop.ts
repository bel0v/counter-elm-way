// COPY FROM https://github.com/redux-loop/redux-loop

import * as Redux from 'redux';

export interface Loop<State, Action> {
  state: State;
  effects: Effect<Action>[];
}

export type Reducer<State> = <Action extends Redux.Action>(state: State, action: Action) => Loop<State, Action>;

export interface Store<S> {
  getState: () => S;
  subscribe: (fn: Function) => void;
  replaceReducer: (reducer: Reducer<S>) => void;
  dispatch: (action: Redux.Action) => any;
}

export function createLoopStore<S, A extends Redux.Action>(rootReducer: Reducer<S>, initialModel: Loop<S, A>, enhancer?: Redux.StoreEnhancer<S>): Store<S> {
  return (function() {
    let queue = [] as Effect<A>[];

    function liftReducer(reducer: Reducer<S>): Redux.Reducer<S> {
      return (state: S, action: A): S => {
        const ret = reducer(state, action);

        ret.effects.forEach((effect) => queue.push(effect));

        return ret.state;
      };
    }

    const store = Redux.createStore(
      liftReducer(rootReducer),
      initialModel.state,
      enhancer
    );

    function executeEffects(callback: (action: A) => void, effects: Effect<A>[]): Promise<any>[] {
      return effects.map((effect) =>
        effect
          .toPromise()
          .then(callback)
          .catch((err: Error) => {
            console.error(err);
            throw new Error('Process catch!');
          })
      );
    }

    function enhancedDispatch(action: A): Promise<any> {
      store.dispatch(action);

      const currentQueue = queue;
      queue = [];

      return Promise.all(
        executeEffects(enhancedDispatch, currentQueue)
      );
    }

    executeEffects(enhancedDispatch, initialModel.effects);

    const enhancedReplaceReducer = (reducer: Reducer<S>) => {
      return store.replaceReducer(liftReducer(reducer));
    };

    return {
      getState: store.getState,
      subscribe: store.subscribe,
      dispatch: enhancedDispatch,
      replaceReducer: enhancedReplaceReducer
    };
  })();
}

export interface Effect<A> {
  map<T>(fn: (action: A) => T): Effect<T>;
  catch<E, T>(fn: (error: E) => T): Effect<T>;
  equals(other: Effect<A>): boolean;
  toPromise(): Promise<A>;
}

export function effect<A>(promiseCreator: (...args: any[]) => Promise<A>, ...args: any[]): Effect<A> {
  return new DefaultEffect(promiseCreator, args);
}

class MapEffect<A> implements Effect<A> {
  protected readonly _inner: Effect<any>;
  protected readonly _tagger: (action: any) => A;

  constructor(readonly innerEffect: Effect<any>, tagger: (action: any) => A) {
    this._inner = innerEffect;
    this._tagger = tagger;
  }

  public catch = <E, T>(fn: (error: E) => T): Effect<T> => {
    return new CatchEffect(this, fn);
  }

  public map = <T>(fn: (action: A) => T): Effect<T> => {
    return new MapEffect(this, fn);
  }

  public equals = (other: Effect<A>): boolean => {
    if (other instanceof MapEffect) {
      return this._tagger === other._tagger
        && this._inner.equals(other._inner);
    }

    return false;
  }

  public toPromise = (): Promise<A> => {
    return this._inner.toPromise().then(this._tagger);
  }
}

class CatchEffect<A> extends MapEffect<A> {
  public toPromise = (): Promise<A> => {
    return this._inner
      .toPromise()
      .catch((e) => Promise.resolve(this._tagger(e)));
  }
}

class DefaultEffect<A> implements Effect<A> {
  private readonly _promiseCreator: (...args: any[]) => Promise<A>;
  private readonly _args: any[];
  constructor(readonly promiseCreator: (...args: any[]) => Promise<A>, readonly args: any[]) {
    this._promiseCreator = promiseCreator;
    this._args = args;
  }

  public catch = <E, T>(fn: (error: E) => T): Effect<T> => {
    return new CatchEffect(this, fn);
  }

  public map = <T>(fn: (action: A) => T): Effect<T> => {
    return new MapEffect(this, fn);
  }

  public equals = (other: Effect<A>): boolean => {
    if (other instanceof DefaultEffect) {
      return this._promiseCreator === other._promiseCreator
        && this._args.every((a, i) => a === other._args[i]);
    }

    return false;
  }

  public toPromise = (): Promise<A> => {
    const promise = this._promiseCreator(...this._args);

    if (promise instanceof Promise) {
      return promise;
    }

    throw new Error();
  }
}
