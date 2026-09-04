/**
 * Inline runtime helpers for the `dce:*` behavior primitives.
 *
 * Generated components are standalone — these helpers are emitted into the
 * output alongside the component rather than imported, the same way the style
 * helper works. Each returns a teardown function, so every generator can wire
 * them into its own lifecycle with one uniform shape.
 *
 * The source is written in plain DOM JavaScript so a single implementation
 * serves all four targets; only the lifecycle wiring around it differs.
 */

/** Helper identifiers, keyed by the primitive that needs them. */
export const BEHAVIOR_HELPERS = {
  focusTrap: '__dceFocusTrap',
  escape: '__dceEscape',
  scrollLock: '__dceScrollLock',
  timer: '__dceTimer'
} as const;

export type BehaviorHelper = keyof typeof BEHAVIOR_HELPERS;

/**
 * Elements that can hold focus. Excludes negative tabindex, which is
 * programmatically focusable but skipped by sequential Tab navigation.
 */
const FOCUSABLE_SOURCE = `const __dceFocusable = [
  'a[href]', 'button', 'input', 'select', 'textarea',
  '[tabindex]', 'audio[controls]', 'video[controls]', '[contenteditable]'
].map((s) => s + ':not([disabled]):not([tabindex="-1"])').join(',');`;

const FOCUS_TRAP_SOURCE = `${FOCUSABLE_SOURCE}

/**
 * Confine Tab navigation to \`container\`, restoring focus on teardown.
 */
function ${BEHAVIOR_HELPERS.focusTrap}(container) {
  if (!container) return () => {};

  const previous = document.activeElement;

  const items = () => Array.from(container.querySelectorAll(__dceFocusable))
    .filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

  const onKeyDown = (event) => {
    if (event.key !== 'Tab') return;

    const focusable = items();
    if (focusable.length === 0) {
      // Nothing to move to; keep focus inside rather than letting it escape.
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeyDown, true);

  // Move focus in, preferring an explicitly marked element.
  const initial = container.querySelector('[autofocus]') || items()[0] || container;
  if (initial && typeof initial.focus === 'function') {
    initial.focus();
  }

  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    if (previous && typeof previous.focus === 'function') {
      previous.focus();
    }
  };
}`;

const ESCAPE_SOURCE = `/**
 * Call \`handler\` when Escape is pressed.
 */
function ${BEHAVIOR_HELPERS.escape}(handler) {
  if (typeof handler !== 'function') return () => {};

  const onKeyDown = (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      handler(event);
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}`;

const SCROLL_LOCK_SOURCE = `/**
 * Prevent document scrolling, compensating for the scrollbar so the page
 * behind does not shift. Nested locks are reference-counted.
 */
function ${BEHAVIOR_HELPERS.scrollLock}() {
  const body = document.body;
  const depth = Number(body.dataset.dceScrollLocks || 0);
  body.dataset.dceScrollLocks = String(depth + 1);

  if (depth === 0) {
    const width = window.innerWidth - document.documentElement.clientWidth;
    body.dataset.dceScrollOverflow = body.style.overflow;
    body.dataset.dceScrollPadding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (width > 0) {
      const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = current + width + 'px';
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const remaining = Number(body.dataset.dceScrollLocks || 1) - 1;
    body.dataset.dceScrollLocks = String(remaining);
    if (remaining > 0) return;

    body.style.overflow = body.dataset.dceScrollOverflow || '';
    body.style.paddingRight = body.dataset.dceScrollPadding || '';
    delete body.dataset.dceScrollLocks;
    delete body.dataset.dceScrollOverflow;
    delete body.dataset.dceScrollPadding;
  };
}`;

const TIMER_SOURCE = `/**
 * Call \`handler\` once after \`delay\` ms. A non-positive or non-finite delay
 * disables the timer, which is how an auto-dismiss is turned off at runtime.
 */
function ${BEHAVIOR_HELPERS.timer}(delay, handler) {
  if (typeof handler !== 'function') return () => {};

  const ms = Number(delay);
  if (!isFinite(ms) || ms <= 0) return () => {};

  const id = setTimeout(handler, ms);
  return () => clearTimeout(id);
}`;

const SOURCES: Record<BehaviorHelper, string> = {
  focusTrap: FOCUS_TRAP_SOURCE,
  escape: ESCAPE_SOURCE,
  scrollLock: SCROLL_LOCK_SOURCE,
  timer: TIMER_SOURCE
};

/**
 * Emit the source of every requested helper, in a stable order so output is
 * deterministic regardless of the order primitives appear in the template.
 */
export function behaviorHelperSource(used: Iterable<BehaviorHelper>): string {
  const wanted = new Set(used);
  const order: BehaviorHelper[] = ['focusTrap', 'escape', 'scrollLock', 'timer'];

  return order
    .filter((name) => wanted.has(name))
    .map((name) => SOURCES[name])
    .join('\n\n');
}

/**
 * Which helpers a set of lifecycle effects calls.
 *
 * Generators use this to emit only the helper sources actually needed, so a
 * component using just `<dce:escape>` does not carry the focus-trap code.
 */
export function behaviorsUsedBy(
  lifecycle: ReadonlyArray<{ setup: string; teardown?: string }>
): Set<BehaviorHelper> {
  const used = new Set<BehaviorHelper>();

  for (const effect of lifecycle) {
    const code = `${effect.setup} ${effect.teardown ?? ''}`;
    for (const [name, identifier] of Object.entries(BEHAVIOR_HELPERS)) {
      if (code.includes(identifier)) {
        used.add(name as BehaviorHelper);
      }
    }
  }

  return used;
}
