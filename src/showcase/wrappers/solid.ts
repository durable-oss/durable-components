import * as esbuild from 'esbuild';
import * as path from 'node:path';

export async function wrapSolid(
  code: string,
  css: string | null,
  paramValues: Record<string, unknown>,
  componentSource?: string
): Promise<string> {
  const cssTag = css ? `<style>${css}</style>` : '';

  const scenarioCode = code.replace(/^export function (Showcase\w+)/m, 'const __Component = function $1');

  const entrySource = [
    `import { render } from 'solid-js/web';`,
    componentSource ?? '',
    scenarioCode,
    `const __params = ${JSON.stringify(paramValues)};`,
    `render(() => __Component(__params), document.getElementById('root'));`,
  ].join('\n\n');

  const resolveDir = path.dirname(require.resolve('solid-js/package.json'));
  const babel = await import('@babel/core');

  // Pre-transform the entry source (which contains JSX) through Babel with solid preset
  const transformed = await babel.transformAsync(entrySource, {
    filename: '__showcase_entry__.tsx',
    presets: [['babel-preset-solid'], ['@babel/preset-typescript']],
  });
  const transformedEntry = transformed?.code ?? entrySource;

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
        build.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({
          contents: transformedEntry,
          loader: 'js',
          resolveDir,
        }));
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
