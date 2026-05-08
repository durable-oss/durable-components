import * as esbuild from 'esbuild';
import * as path from 'node:path';
import { compile as compileSvelte } from 'svelte/compiler';

export async function wrapSvelte(
  scenarioDce: string,
  componentDce: string | null,
  css: string | null,
  paramValues: Record<string, unknown>
): Promise<string> {
  const cssTag = css ? `<style>${css}</style>` : '';

  // Detect the component name from the componentDce (exported default function name)
  // so we can inject the import into the scenario source before Svelte-compiling it.
  let componentName: string | null = null;
  let componentJs = '';

  if (componentDce) {
    // Extract the export default function name from the componentDce Svelte output.
    // The DCE->Svelte generator produces e.g. `export default function Counter`.
    // We use the filename from the Svelte compile step below.
    const nameMatch = componentDce.match(/export\s+default\s+function\s+(\w+)/);
    componentName = nameMatch?.[1] ?? null;
  }

  // If there's a linked component, inject its import into the scenario before compilation.
  let scenarioSource = scenarioDce;
  if (componentName) {
    const importLine = `import ${componentName} from '__svelte_component__';`;
    if (/<script[\s>]/.test(scenarioDce)) {
      scenarioSource = scenarioDce.replace(/(<script[^>]*>)/, `$1\n  ${importLine}`);
    } else {
      scenarioSource = `<script>\n  ${importLine}\n</script>\n\n${scenarioDce}`;
    }
  }

  // Compile scenario (with component import if needed) through the Svelte compiler.
  const scenarioResult = compileSvelte(scenarioSource, {
    filename: '__showcase_scenario__.svelte',
    generate: 'client',
    dev: false,
  });

  if (componentDce) {
    const componentResult = compileSvelte(componentDce, {
      filename: '__component__.svelte',
      generate: 'client',
      dev: false,
    });
    componentJs = componentResult.js.code;
  }

  const scenarioJs = scenarioResult.js.code
    .replace(/^export default function (\w+)/m, 'const __Component = function $1');

  const resolveDir = path.dirname(require.resolve('svelte/package.json'));

  const entrySource = [
    `import { mount } from 'svelte';`,
    scenarioJs,
    `const __params = ${JSON.stringify(paramValues)};`,
    `mount(__Component, { target: document.getElementById('root'), props: __params });`,
  ].join('\n\n');

  const result = await esbuild.build({
    entryPoints: ['__showcase_entry__'],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2017',
    plugins: [{
      name: 'virtual',
      setup(build) {
        build.onResolve({ filter: /^__showcase_entry__$/ }, args => ({
          path: args.path,
          namespace: 'virtual',
        }));
        build.onLoad({ filter: /^__showcase_entry__$/, namespace: 'virtual' }, () => ({
          contents: entrySource,
          loader: 'js',
          resolveDir,
        }));

        if (componentJs) {
          build.onResolve({ filter: /^__svelte_component__$/ }, () => ({
            path: '__svelte_component__',
            namespace: 'virtual',
          }));
          build.onLoad({ filter: /^__svelte_component__$/, namespace: 'virtual' }, () => ({
            contents: componentJs,
            loader: 'js',
            resolveDir,
          }));
        }
      },
    }],
  });

  const bundledCode = result.outputFiles[0].text;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${cssTag}
<style>body{margin:0;padding:1rem;font-family:sans-serif;}</style>
</head>
<body>
<div id="root"></div>
<script>
${bundledCode}
</script>
</body>
</html>`;
}
