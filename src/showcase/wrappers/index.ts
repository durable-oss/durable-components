import type { CompilerTarget } from '../../types/compiler';
import { wrapReact } from './react';
import { wrapVue } from './vue';
import { wrapSvelte } from './svelte';
import { wrapSolid } from './solid';

export interface PreviewOptions {
  componentDce?: string;  // raw DCE svelte output for Svelte target
  componentSource?: string;  // compiled JS for React/Vue/Solid
  componentCss?: string | null;
}

export async function buildPreviewHtml(
  code: string,
  css: string | null,
  target: CompilerTarget,
  paramValues: Record<string, unknown>,
  options: PreviewOptions = {}
): Promise<string> {
  switch (target) {
    case 'react':
      return wrapReact(code, css, paramValues, options.componentSource);
    case 'vue':
      return wrapVue(code, css, paramValues, options.componentSource);
    case 'svelte':
      return wrapSvelte(code, options.componentDce ?? null, css, paramValues);
    case 'solid':
      return wrapSolid(code, css, paramValues, options.componentSource);
    default:
      return `<html><body><pre>Unsupported target: ${target}</pre></body></html>`;
  }
}
