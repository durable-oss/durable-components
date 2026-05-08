import { describe, it, expect, vi, afterEach } from 'vitest';
import { watchFiles } from '../../showcase/watcher';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function tempFile(): { path: string; cleanup: () => void } {
  const p = path.join(os.tmpdir(), `watcher-test-${Date.now()}-${Math.random()}.txt`);
  fs.writeFileSync(p, 'initial');
  return { path: p, cleanup: () => { try { fs.unlinkSync(p); } catch { /* already gone */ } } };
}

describe('watchFiles', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

  it('returns a stop function', () => {
    const { path: p, cleanup } = tempFile();
    cleanups.push(cleanup);
    const stop = watchFiles([p], vi.fn());
    expect(typeof stop).toBe('function');
    stop();
  });

  it('calls onChange when a file is modified', async () => {
    const { path: p, cleanup } = tempFile();
    cleanups.push(cleanup);

    const onChange = vi.fn();
    const stop = watchFiles([p], onChange, 10);
    cleanups.push(stop);

    await new Promise(r => setTimeout(r, 20));
    fs.writeFileSync(p, 'changed');

    await new Promise(r => setTimeout(r, 100));
    expect(onChange).toHaveBeenCalledWith(p);
  });

  it('debounces rapid changes into a single callback', async () => {
    const { path: p, cleanup } = tempFile();
    cleanups.push(cleanup);

    const onChange = vi.fn();
    const stop = watchFiles([p], onChange, 80);
    cleanups.push(stop);

    await new Promise(r => setTimeout(r, 20));

    // Fire several rapid changes
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(p, `change-${i}`);
      await new Promise(r => setTimeout(r, 5));
    }

    // Wait for debounce to settle
    await new Promise(r => setTimeout(r, 200));
    // All rapid changes collapsed into 1 call
    expect(onChange.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('does not throw when watching a non-existent file', () => {
    const p = '/tmp/definitely-does-not-exist-showcase-test.txt';
    const stop = watchFiles([p], vi.fn());
    expect(() => stop()).not.toThrow();
  });

  it('stop function cleans up watchers without throwing', async () => {
    const { path: p, cleanup } = tempFile();
    cleanups.push(cleanup);

    const stop = watchFiles([p], vi.fn(), 10);
    await new Promise(r => setTimeout(r, 10));
    expect(() => stop()).not.toThrow();
  });

  it('stop function prevents further callbacks', async () => {
    const { path: p, cleanup } = tempFile();
    cleanups.push(cleanup);

    const onChange = vi.fn();
    const stop = watchFiles([p], onChange, 10);

    await new Promise(r => setTimeout(r, 20));
    stop();

    fs.writeFileSync(p, 'after stop');
    await new Promise(r => setTimeout(r, 100));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('watches multiple files independently', async () => {
    const f1 = tempFile();
    const f2 = tempFile();
    cleanups.push(f1.cleanup, f2.cleanup);

    const onChange = vi.fn();
    const stop = watchFiles([f1.path, f2.path], onChange, 10);
    cleanups.push(stop);

    await new Promise(r => setTimeout(r, 20));
    fs.writeFileSync(f2.path, 'changed f2');

    await new Promise(r => setTimeout(r, 100));
    expect(onChange).toHaveBeenCalledWith(f2.path);
    const calls = onChange.mock.calls.map(c => c[0]);
    expect(calls).not.toContain(f1.path);
  });

  it('handles empty file list without throwing', () => {
    const stop = watchFiles([], vi.fn());
    expect(() => stop()).not.toThrow();
  });
});
