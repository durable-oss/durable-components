import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findShowcaseFiles } from '../../showcase/files';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Creates a temp directory tree, returns the root path and a cleanup fn.
function makeTempTree(files: Record<string, string>): { root: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-files-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

describe('findShowcaseFiles', () => {
  let cleanup: () => void;
  let root: string;

  afterEach(() => cleanup?.());

  it('returns empty array when no showcase files exist', () => {
    ({ root, cleanup } = makeTempTree({ 'README.md': '' }));
    expect(findShowcaseFiles(root)).toEqual([]);
  });

  it('finds a single showcase file at root level', () => {
    ({ root, cleanup } = makeTempTree({
      'Button.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(1);
    expect(entries[0].rel).toBe('Button.showcase');
    expect(entries[0].abs).toBe(path.join(root, 'Button.showcase'));
  });

  it('finds showcase files in subdirectories', () => {
    ({ root, cleanup } = makeTempTree({
      'components/Button.showcase': '',
      'components/Card.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(2);
    const rels = entries.map(e => e.rel);
    expect(rels).toContain(path.join('components', 'Button.showcase'));
    expect(rels).toContain(path.join('components', 'Card.showcase'));
  });

  it('links a showcase file to a matching .dce component', () => {
    ({ root, cleanup } = makeTempTree({
      'Button.showcase': '',
      'Button.dce': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(1);
    expect(entries[0].linkedComponent).toBe(path.join(root, 'Button.dce'));
  });

  it('links a showcase file to a matching .svelte component', () => {
    ({ root, cleanup } = makeTempTree({
      'Counter.showcase': '',
      'Counter.svelte': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries[0].linkedComponent).toBe(path.join(root, 'Counter.svelte'));
  });

  it('links a showcase file to a matching .vue component', () => {
    ({ root, cleanup } = makeTempTree({
      'Card.showcase': '',
      'Card.vue': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries[0].linkedComponent).toBe(path.join(root, 'Card.vue'));
  });

  it('sets linkedComponent to null when no matching component exists', () => {
    ({ root, cleanup } = makeTempTree({
      'Button.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries[0].linkedComponent).toBeNull();
  });

  it('does not link mismatched component names', () => {
    ({ root, cleanup } = makeTempTree({
      'Button.showcase': '',
      'ButtonVariant.dce': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries[0].linkedComponent).toBeNull();
  });

  it('ignores node_modules directory', () => {
    ({ root, cleanup } = makeTempTree({
      'node_modules/lib/Component.showcase': '',
      'MyComponent.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(1);
    expect(entries[0].rel).toBe('MyComponent.showcase');
  });

  it('ignores .git directory', () => {
    ({ root, cleanup } = makeTempTree({
      '.git/hooks/Component.showcase': '',
      'MyComponent.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(1);
  });

  it('ignores dist directory', () => {
    ({ root, cleanup } = makeTempTree({
      'dist/Component.showcase': '',
      'MyComponent.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(1);
  });

  it('returns entries sorted by path', () => {
    ({ root, cleanup } = makeTempTree({
      'z/Zebra.showcase': '',
      'a/Alpha.showcase': '',
      'Button.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(3);
    // Sorted absolute paths → relative should be in order
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].abs <= entries[i].abs).toBe(true);
    }
  });

  it('links components in subdirectories correctly', () => {
    ({ root, cleanup } = makeTempTree({
      'components/Button.showcase': '',
      'components/Button.dce': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries[0].linkedComponent).toBe(path.join(root, 'components', 'Button.dce'));
  });

  it('does not link component in different directory', () => {
    ({ root, cleanup } = makeTempTree({
      'showcase/Button.showcase': '',
      'components/Button.dce': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries[0].linkedComponent).toBeNull();
  });

  it('handles deeply nested showcase files', () => {
    ({ root, cleanup } = makeTempTree({
      'a/b/c/d/Deep.showcase': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(1);
    expect(entries[0].rel).toContain('Deep.showcase');
  });

  it('gracefully handles empty root directory', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-empty-'));
    cleanup = () => fs.rmSync(root, { recursive: true, force: true });
    expect(findShowcaseFiles(root)).toEqual([]);
  });

  it('finds multiple showcase files with mixed component links', () => {
    ({ root, cleanup } = makeTempTree({
      'Button.showcase': '',
      'Button.dce': '',
      'Card.showcase': '',
      'Input.showcase': '',
      'Input.vue': '',
    }));
    const entries = findShowcaseFiles(root);
    expect(entries).toHaveLength(3);
    const byName = Object.fromEntries(entries.map(e => [path.basename(e.rel, '.showcase'), e]));
    expect(byName['Button'].linkedComponent).toBeTruthy();
    expect(byName['Card'].linkedComponent).toBeNull();
    expect(byName['Input'].linkedComponent).toBeTruthy();
  });
});
