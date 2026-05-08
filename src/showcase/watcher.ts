import * as fs from 'node:fs';

type ChangeCallback = (filePath: string) => void;

/**
 * Watch a set of files for changes, debounced.
 * Returns a function to stop watching.
 */
export function watchFiles(files: string[], onChange: ChangeCallback, debounceMs = 50): () => void {
  const watchers: fs.FSWatcher[] = [];
  const timers = new Map<string, NodeJS.Timeout>();

  for (const file of files) {
    try {
      const watcher = fs.watch(file, () => {
        const existing = timers.get(file);
        if (existing) clearTimeout(existing);
        timers.set(file, setTimeout(() => {
          timers.delete(file);
          onChange(file);
        }, debounceMs));
      });
      watchers.push(watcher);
    } catch {
      // file may not exist yet; ignore
    }
  }

  return () => {
    for (const t of timers.values()) clearTimeout(t);
    for (const w of watchers) w.close();
  };
}
