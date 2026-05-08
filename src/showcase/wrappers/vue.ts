import * as esbuild from 'esbuild';

export async function wrapVue(
  code: string,
  css: string | null,
  paramValues: Record<string, unknown>,
  componentSource?: string
): Promise<string> {
  const cssTag = css ? `<style>${css}</style>` : '';

  const scenarioCode = code
    .replace(/^export function (Showcase\w+)/m, 'const __Component = function $1')
    .replace(/^export default \{/m, 'const __Component = {');

  const entrySource = [
    `import { createApp } from 'vue';`,
    componentSource ?? '',
    scenarioCode,
    `const __params = ${JSON.stringify(paramValues)};`,
    `createApp(__Component, __params).mount('#app');`,
  ].join('\n\n');

  const ENTRY = '__showcase_entry__';

  const result = await esbuild.build({
    entryPoints: [ENTRY],
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
          contents: entrySource,
          loader: 'ts',
        }));

        build.onResolve({ filter: /^vue$/ }, () => ({
          path: 'vue',
          namespace: 'browser-global',
        }));
        build.onLoad({ filter: /^vue$/, namespace: 'browser-global' }, () => ({
          contents: 'module.exports = window.Vue;',
          loader: 'js',
        }));
      },
    }],
  });

  const bundledCode = result.outputFiles[0].text;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
${cssTag}
<style>body{margin:0;padding:1rem;font-family:sans-serif;}</style>
</head>
<body>
<div id="app"></div>
<script>
${bundledCode}
</script>
</body>
</html>`;
}
