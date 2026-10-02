/**
 * One Whitby sheet open at a time.
 *
 * There are two, and on a Work Plan they are both reachable: the plan's own
 * panel, which rewrites the plan, and the dock in the top bar, which is on
 * every screen. Both are fixed to the right and both are full height, so
 * opening the second puts it flat on top of the first, and closing it
 * uncovers a panel somebody had stopped looking at several minutes ago.
 *
 * An event rather than a shared store, because the two know nothing about
 * each other and there is nothing here worth them learning: each says it has
 * opened, and each closes when the other does.
 *
 * `id` is what tells an announcement from an echo. Without it the listener
 * that just opened hears its own event and closes itself, which is a panel
 * that will not open.
 */
const EVENT = "pa-whitby-panel-open";

/** Say that this panel has opened, so any other closes. */
export function announceWhitbyPanel(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/**
 * Close when a different Whitby panel opens.
 *
 * Returns the teardown, so it is used as the body of an effect.
 */
export function onOtherWhitbyPanel(id: string, close: () => void) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<string>).detail !== id) close();
  };

  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
