// The utility page's Escape handlers all sit on window and tell each other
// the key has been dealt with by cancelling the event.
//
// The phone sheet is a drawer that cannot be dismissed, and such a drawer
// (vaul) cancels every Escape it hears -- ahead of all of them, since it
// listens on window first. So the sheet marks the key as still free before
// the drawer gets to it, and who took it is recorded here rather than read
// off the event.
const free = new WeakSet<KeyboardEvent>();
const taken = new WeakSet<KeyboardEvent>();

export function escapeReachedPage(event: KeyboardEvent) {
  if (!event.defaultPrevented) {
    free.add(event);
  }
}

export function escapeTaken(event: KeyboardEvent) {
  return taken.has(event) || (event.defaultPrevented && !free.has(event));
}

export function takeEscape(event: KeyboardEvent) {
  taken.add(event);
  event.preventDefault();
}
