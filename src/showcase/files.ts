import * as fs from 'node:fs';
import * as path from 'node:path';

const IGNORED = new Set(['node_modules', '.git', 'dist']);
const COMPONENT_EXTS = new Set(['.dce', '.vue', '.svelte']);

export interface ShowcaseEntry {
  rel: string;
  abs: string;
  linkedComponent: string | null;
}

export function findShowcaseFiles(rootDir: string): ShowcaseEntry[] {
  const showcaseFiles: string[] = [];
  const componentFiles = new Set<string>();

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.showcase')) showcaseFiles.push(full);
        else if (COMPONENT_EXTS.has(path.extname(entry.name))) componentFiles.add(full);
      }
    }
  }

  walk(rootDir);
  showcaseFiles.sort();

  return showcaseFiles.map(abs => {
    const base = path.basename(abs, '.showcase');
    const dir = path.dirname(abs);
    const match = [...COMPONENT_EXTS].find(ext => componentFiles.has(path.join(dir, base + ext)));
    return {
      rel: path.relative(rootDir, abs),
      abs,
      linkedComponent: match ? path.join(dir, base + match) : null,
    };
  });
}
