const subscriptions = new Map<string, { unsubscribe: () => void }>();

export function useSubscriptionManager() {
  function subscribe(key: string, sub: { unsubscribe: () => void }) {
    const existing = subscriptions.get(key);
    if (existing) {
      existing.unsubscribe();
    }
    subscriptions.set(key, sub);
  }

  function unsubscribe(key: string) {
    const existing = subscriptions.get(key);
    if (existing) {
      existing.unsubscribe();
      subscriptions.delete(key);
    }
  }

  function unsubscribeAll() {
    for (const [, sub] of subscriptions) {
      sub.unsubscribe();
    }
    subscriptions.clear();
  }

  return { subscribe, unsubscribe, unsubscribeAll };
}
