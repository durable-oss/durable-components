import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import { handleHttpRequest } from './handler';
import { createWSServer } from './websocket';
import { watchFiles } from './watcher';
import { findShowcaseFiles } from './files';
import { parseShowcase } from './parser';
import { compileScenario } from './compiler';
import { compile } from '../index';
import { buildPreviewHtml } from './wrappers/index';
import type { CompilerTarget } from '../types/compiler';

export interface ServerOptions {
  rootDir: string;
  port: number;
}

interface FileState {
  source: string;
  parsed: ReturnType<typeof parseShowcase>;
}

export function startShowcaseServer(options: ServerOptions): void {
  const { rootDir, port } = options;
  const fileCache = new Map<string, FileState>();

  const ws = createWSServer((raw) => {
    try {
      const msg = JSON.parse(raw);
      handleClientMessage(msg);
    } catch { /* ignore bad frames */ }
  });

  const server = http.createServer((req, res) => {
    if (req.headers.upgrade?.toLowerCase() === 'websocket') return;
    handleHttpRequest(req, res, port);
  });

  server.on('upgrade', (req, socket: net.Socket, head) => {
    ws.handleUpgrade(req, socket, head);
    // Send init after handshake settles
    setImmediate(() => sendInit(socket));
  });

  server.listen(port, () => {
    console.log(`Showcase running at http://localhost:${port}`);
  });

  // Watch all showcase files; re-scan + notify on change
  let stopWatching = setupWatcher();

  function setupWatcher(): () => void {
    const entries = findShowcaseFiles(rootDir);

    // Map component paths back to their showcase entry for re-render triggering
    const componentToShowcase = new Map<string, typeof entries[0]>();
    for (const entry of entries) {
      if (entry.linkedComponent) componentToShowcase.set(entry.linkedComponent, entry);
    }

    const showcasePaths = entries.map(e => e.abs);
    const componentPaths = entries.flatMap(e => e.linkedComponent ? [e.linkedComponent] : []);

    return watchFiles([...showcasePaths, ...componentPaths], (changedFile) => {
      // If a linked component changed, invalidate its showcase's cache and re-broadcast reload
      const showcaseEntry = componentToShowcase.get(changedFile);
      if (showcaseEntry) {
        fileCache.delete(showcaseEntry.abs);
        const parsed = reloadFile(showcaseEntry.abs);
        ws.broadcast(JSON.stringify({
          type: 'reload',
          file: showcaseEntry.rel,
          params: parsed.params,
          scenarios: parsed.scenarios,
        }));
        return;
      }

      // Otherwise it's a .showcase file itself
      const rel = path.relative(rootDir, changedFile);
      const parsed = reloadFile(changedFile);
      ws.broadcast(JSON.stringify({
        type: 'reload',
        file: rel,
        params: parsed.params,
        scenarios: parsed.scenarios,
      }));
    });
  }

  function reloadFile(absPath: string): ReturnType<typeof parseShowcase> {
    const source = fs.readFileSync(absPath, 'utf-8');
    const parsed = parseShowcase(source);
    fileCache.set(absPath, { source, parsed });
    return parsed;
  }

  function getOrLoad(absPath: string): FileState {
    if (!fileCache.has(absPath)) {
      const source = fs.readFileSync(absPath, 'utf-8');
      const parsed = parseShowcase(source);
      fileCache.set(absPath, { source, parsed });
    }
    return fileCache.get(absPath)!;
  }

  function sendInit(socket: net.Socket) {
    const entries = findShowcaseFiles(rootDir);
    const files = entries.map(e => ({ rel: e.rel, abs: e.abs }));
    const msg = JSON.stringify({ type: 'init', files });
    // Encode and send directly to this socket via ws broadcast workaround:
    // We broadcast to all, but since only one client just connected this is fine.
    ws.broadcast(msg);
  }

  async function handleClientMessage(msg: any) {
    if (msg.type === 'selectFile') {
      const absPath = path.join(rootDir, msg.file);
      const { parsed } = getOrLoad(absPath);
      ws.broadcast(JSON.stringify({
        type: 'reload',
        file: msg.file,
        params: parsed.params,
        scenarios: parsed.scenarios,
      }));
    }

    if (msg.type === 'render') {
      const absPath = path.join(rootDir, msg.file);
      const entries = findShowcaseFiles(rootDir);
      const entry = entries.find(e => e.rel === msg.file);
      const { parsed } = getOrLoad(absPath);
      const scenario = parsed.scenarios.find(s => s.name === msg.scenario);
      if (!scenario) return;

      const target = (msg.target || 'react') as CompilerTarget;
      const paramValues = msg.params || {};

      let componentSource: string | undefined;
      let componentDce: string | undefined;
      let componentCss: string | null = null;
      if (entry?.linkedComponent) {
        const raw = fs.readFileSync(entry.linkedComponent, 'utf-8');
        if (target === 'svelte') {
          // For Svelte, pass the raw DCE->Svelte output; wrapSvelte handles compilation
          const compiled = compile(raw, { filename: path.basename(entry.linkedComponent), target });
          componentDce = compiled.js.code;
          componentCss = compiled.css?.code ?? null;
        } else {
          const compiled = compile(raw, { filename: path.basename(entry.linkedComponent), target, browserSafe: target !== 'react' });
          componentSource = compiled.js.code;
          componentCss = compiled.css?.code ?? null;
        }
      }

      const { code, error } = compileScenario(scenario, parsed.params, paramValues, target);

      let previewHtml: string;
      let sourceCode: string;

      if (error) {
        previewHtml = `<html><body style="font-family:sans-serif;padding:1rem;color:#f38ba8"><strong>Compile error:</strong><pre>${escHtml(error)}</pre></body></html>`;
        sourceCode = '';
      } else {
        previewHtml = await buildPreviewHtml(code, componentCss, target, paramValues, { componentSource, componentDce });
        sourceCode = code;
      }

      ws.broadcast(JSON.stringify({
        type: 'preview',
        html: previewHtml,
        source: sourceCode,
        error: error ?? null,
      }));
    }
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
