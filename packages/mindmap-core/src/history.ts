export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const HISTORY_LIMIT = 80;

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function historyCommit<T>(
  state: HistoryState<T>,
  present: T,
  coalesce = false,
): HistoryState<T> {
  if (coalesce) return { ...state, present, future: [] };
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
  };
}

export function historyUndo<T>(state: HistoryState<T>): HistoryState<T> {
  const previous = state.past.at(-1);
  if (!previous) return state;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
  };
}

export function historyRedo<T>(state: HistoryState<T>): HistoryState<T> {
  const [next, ...rest] = state.future;
  if (!next) return state;
  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
  };
}
