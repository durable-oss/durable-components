/**
 * Behavioral tests for the inline runtime helpers.
 *
 * The emitted source is evaluated against a minimal DOM stub so the logic is
 * actually exercised — emitting the right text is not the same as the text
 * doing the right thing.
 */
import { describe, it, expect } from 'vitest';
import { transformSync } from 'esbuild';
import { behaviorHelperSource, BEHAVIOR_HELPERS } from '../generators/behavior-runtime';

interface Listener {
  type: string;
  handler: (event: any) => void;
  capture?: boolean;
}

/** A DOM stub carrying only what the helpers touch. */
function makeDom() {
  const listeners: Listener[] = [];

  const body: any = {
    dataset: {} as Record<string, string>,
    style: { overflow: '', paddingRight: '' }
  };

  const document: any = {
    body,
    activeElement: null,
    documentElement: { clientWidth: 980 },
    addEventListener: (type: string, handler: any, capture?: boolean) =>
      listeners.push({ type, handler, capture }),
    removeEventListener: (type: string, handler: any) => {
      const i = listeners.findIndex((l) => l.type === type && l.handler === handler);
      if (i !== -1) listeners.splice(i, 1);
    }
  };

  const window: any = {
    innerWidth: 1000,
    getComputedStyle: () => ({ paddingRight: '0px' })
  };

  const dispatch = (event: any) => {
    for (const listener of [...listeners]) {
      if (listener.type === event.type) listener.handler(event);
    }
  };

  return { document, window, listeners, dispatch, body };
}

/** Evaluate the requested helpers against a fresh DOM stub. */
function load(names: Array<keyof typeof BEHAVIOR_HELPERS>) {
  const source = behaviorHelperSource(names);
  const js = transformSync(source, { loader: 'ts' }).code;
  const dom = makeDom();

  const exported = names.map((n) => BEHAVIOR_HELPERS[n]).join(', ');
  const factory = new Function(
    'document',
    'window',
    'setTimeout',
    'clearTimeout',
    `${js}; return { ${exported} };`
  );

  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const helpers = factory(
    dom.document,
    dom.window,
    (fn: () => void) => {
      const id = nextTimer++;
      timers.set(id, fn);
      return id;
    },
    (id: number) => timers.delete(id)
  );

  return { ...dom, helpers, timers, runTimer: (id = 1) => timers.get(id)?.() };
}

describe('__dceEscape', () => {
  it('calls the handler on Escape', () => {
    const { helpers, dispatch } = load(['escape']);
    let calls = 0;

    helpers.__dceEscape(() => calls++);
    dispatch({ type: 'keydown', key: 'Escape' });

    expect(calls).toBe(1);
  });

  it('accepts the legacy Esc key name', () => {
    const { helpers, dispatch } = load(['escape']);
    let calls = 0;

    helpers.__dceEscape(() => calls++);
    dispatch({ type: 'keydown', key: 'Esc' });

    expect(calls).toBe(1);
  });

  it('ignores other keys', () => {
    const { helpers, dispatch } = load(['escape']);
    let calls = 0;

    helpers.__dceEscape(() => calls++);
    dispatch({ type: 'keydown', key: 'Enter' });

    expect(calls).toBe(0);
  });

  it('removes its listener on teardown', () => {
    const { helpers, listeners } = load(['escape']);

    const stop = helpers.__dceEscape(() => {});
    expect(listeners).toHaveLength(1);

    stop();
    expect(listeners).toHaveLength(0);
  });

  it('tolerates a missing handler', () => {
    const { helpers, listeners } = load(['escape']);

    expect(() => helpers.__dceEscape(undefined)()).not.toThrow();
    expect(listeners).toHaveLength(0);
  });
});

describe('__dceScrollLock', () => {
  it('hides overflow and compensates for the scrollbar', () => {
    const { helpers, body } = load(['scrollLock']);

    helpers.__dceScrollLock();

    expect(body.style.overflow).toBe('hidden');
    // innerWidth 1000 - clientWidth 980 = a 20px scrollbar.
    expect(body.style.paddingRight).toBe('20px');
  });

  it('restores the original styles on teardown', () => {
    const { helpers, body } = load(['scrollLock']);
    body.style.overflow = 'auto';

    const release = helpers.__dceScrollLock();
    release();

    expect(body.style.overflow).toBe('auto');
    expect(body.style.paddingRight).toBe('');
  });

  it('reference-counts nested locks', () => {
    const { helpers, body } = load(['scrollLock']);

    const first = helpers.__dceScrollLock();
    const second = helpers.__dceScrollLock();

    first();
    // The second lock is still held, so scrolling stays disabled.
    expect(body.style.overflow).toBe('hidden');

    second();
    expect(body.style.overflow).toBe('');
  });

  it('ignores a repeated release', () => {
    const { helpers, body } = load(['scrollLock']);

    const outer = helpers.__dceScrollLock();
    const inner = helpers.__dceScrollLock();

    inner();
    inner();

    // The double release must not drop the outer lock's count.
    expect(body.style.overflow).toBe('hidden');
    outer();
    expect(body.style.overflow).toBe('');
  });
});

describe('__dceTimer', () => {
  it('calls the handler after the delay', () => {
    const { helpers, runTimer } = load(['timer']);
    let calls = 0;

    helpers.__dceTimer(5000, () => calls++);
    runTimer();

    expect(calls).toBe(1);
  });

  it('cancels on teardown', () => {
    const { helpers, timers } = load(['timer']);

    const cancel = helpers.__dceTimer(5000, () => {});
    expect(timers.size).toBe(1);

    cancel();
    expect(timers.size).toBe(0);
  });

  it('is disabled by a non-positive delay', () => {
    const { helpers, timers } = load(['timer']);

    helpers.__dceTimer(0, () => {});
    helpers.__dceTimer(-1, () => {});

    expect(timers.size).toBe(0);
  });

  it('is disabled by a non-numeric delay', () => {
    const { helpers, timers } = load(['timer']);

    helpers.__dceTimer(undefined, () => {});
    helpers.__dceTimer('later', () => {});

    expect(timers.size).toBe(0);
  });
});

describe('__dceFocusTrap', () => {
  /** Build a container whose focusable children are the given stubs. */
  function container(items: any[]) {
    return {
      querySelectorAll: () => items,
      querySelector: () => null,
      contains: (el: any) => items.includes(el),
      focus: () => {}
    };
  }

  function focusable(name: string) {
    return { name, offsetWidth: 10, offsetHeight: 10, focus() { this.focused = true; }, focused: false };
  }

  it('returns a no-op for a missing container', () => {
    const { helpers, listeners } = load(['focusTrap']);

    expect(() => helpers.__dceFocusTrap(null)()).not.toThrow();
    expect(listeners).toHaveLength(0);
  });

  it('focuses the first focusable child on setup', () => {
    const { helpers } = load(['focusTrap']);
    const first = focusable('first');

    helpers.__dceFocusTrap(container([first, focusable('last')]));

    expect(first.focused).toBe(true);
  });

  it('wraps Tab from the last element back to the first', () => {
    const { helpers, dispatch, document } = load(['focusTrap']);
    const first = focusable('first');
    const last = focusable('last');

    helpers.__dceFocusTrap(container([first, last]));
    document.activeElement = last;
    first.focused = false;

    let prevented = false;
    dispatch({ type: 'keydown', key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });

    expect(prevented).toBe(true);
    expect(first.focused).toBe(true);
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    const { helpers, dispatch, document } = load(['focusTrap']);
    const first = focusable('first');
    const last = focusable('last');

    helpers.__dceFocusTrap(container([first, last]));
    document.activeElement = first;

    dispatch({ type: 'keydown', key: 'Tab', shiftKey: true, preventDefault: () => {} });

    expect(last.focused).toBe(true);
  });

  it('leaves other keys alone', () => {
    const { helpers, dispatch, document } = load(['focusTrap']);
    const first = focusable('first');
    const last = focusable('last');

    helpers.__dceFocusTrap(container([first, last]));
    document.activeElement = last;
    first.focused = false;

    dispatch({ type: 'keydown', key: 'a', preventDefault: () => {} });

    expect(first.focused).toBe(false);
  });

  it('restores the previously focused element on teardown', () => {
    const { helpers, document } = load(['focusTrap']);
    const outside = focusable('outside');
    document.activeElement = outside;

    const release = helpers.__dceFocusTrap(container([focusable('inside')]));
    outside.focused = false;
    release();

    expect(outside.focused).toBe(true);
  });

  it('removes its listener on teardown', () => {
    const { helpers, listeners } = load(['focusTrap']);

    const release = helpers.__dceFocusTrap(container([focusable('a')]));
    expect(listeners).toHaveLength(1);

    release();
    expect(listeners).toHaveLength(0);
  });
});

describe('behaviorHelperSource', () => {
  it('emits nothing when no helper is used', () => {
    expect(behaviorHelperSource([])).toBe('');
  });

  it('emits helpers in a stable order regardless of request order', () => {
    const a = behaviorHelperSource(['timer', 'escape']);
    const b = behaviorHelperSource(['escape', 'timer']);

    expect(a).toBe(b);
  });
});
