export type Debounced<T extends (...args: any[]) => void> = ((
  ...args: Parameters<T>
) => void) & { cancel: () => void };

// `maxWait` caps how long a steady stream of calls can keep postponing the
// call: without it, anything arriving faster than `delay` never fires at all.
export default function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  options: { maxWait?: number } = {},
): Debounced<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let maxTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T>;
  let lastThis: unknown;

  function cancel() {
    clearTimeout(timeoutId);
    clearTimeout(maxTimeoutId);
    timeoutId = undefined;
    maxTimeoutId = undefined;
  }

  function invoke() {
    cancel();
    func.apply(lastThis, lastArgs);
  }

  const debounced = function (this: unknown, ...args: Parameters<T>): void {
    lastArgs = args;
    lastThis = this;

    clearTimeout(timeoutId);
    timeoutId = setTimeout(invoke, delay);

    if (options.maxWait !== undefined && maxTimeoutId === undefined) {
      maxTimeoutId = setTimeout(invoke, options.maxWait);
    }
  } as Debounced<T>;

  debounced.cancel = cancel;

  return debounced;
}
