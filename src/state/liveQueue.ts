export interface QueuedRound {
  id: string;
  trackId: string;
  createdAt: number;
}
export interface LiveQueueState {
  items: QueuedRound[];
  armedRoundId?: string;
}
export function enqueue(
  state: LiveQueueState,
  item: QueuedRound,
): LiveQueueState {
  return { ...state, items: [...state.items, item] };
}
export function removeQueued(
  state: LiveQueueState,
  id: string,
): LiveQueueState {
  return { ...state, items: state.items.filter((x) => x.id !== id) };
}
export function reorderQueued(
  state: LiveQueueState,
  id: string,
  index: number,
): LiveQueueState {
  const old = state.items.findIndex((x) => x.id === id);
  if (old < 0) return state;
  const items = [...state.items],
    [item] = items.splice(old, 1);
  items.splice(Math.max(0, Math.min(index, items.length)), 0, item);
  return { ...state, items };
}
export function promoteHead(
  state: LiveQueueState,
  expectedId: string,
): LiveQueueState {
  if (state.items[0]?.id !== expectedId) return state;
  return { items: state.items.slice(1), armedRoundId: expectedId };
}
export function pruneQueue(
  state: LiveQueueState,
  preparedIds: ReadonlySet<string>,
): LiveQueueState {
  const items = state.items.filter((x) => preparedIds.has(x.trackId));
  return items.length === state.items.length ? state : { ...state, items };
}
