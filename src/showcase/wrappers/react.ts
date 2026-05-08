import * as esbuild from 'esbuild';

export async function wrapReact(
  code: string,
  css: string | null,
  paramValues: Record<string, unknown>,
  componentSource?: string
): Promise<string> {
  const cssTag = css ? `<style>${css}</style>` : '';

  const scenarioCode = code.replace(/^export function (Showcase\w+)/m, 'const __Component = function $1');

  const entrySource = [
    `import React from 'react';`,
    `import ReactDOM from 'react-dom';`,
    componentSource ?? '',
    scenarioCode,
    `const __params = ${JSON.stringify(paramValues)};`,
    `const __root = ReactDOM.createRoot(document.getElementById('root'));`,
    `__root.render(React.createElement(__Component, __params));`,
  ].join('\n\n');

  const ENTRY = '__showcase_entry__';

  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2017',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    plugins: [{
      name: 'virtual',
      setup(build) {
        // Entry point
        build.onResolve({ filter: /^__showcase_entry__$/ }, args => ({
          path: args.path,
          namespace: 'virtual',
        }));
        build.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({
          contents: entrySource,
          loader: 'tsx',
        }));

        // Map react/react-dom imports to browser globals
        build.onResolve({ filter: /^react-dom(\/client)?$/ }, (args) => ({
          path: args.path,
          namespace: 'browser-global',
        }));
        build.onResolve({ filter: /^react$/ }, () => ({
          path: 'react',
          namespace: 'browser-global',
        }));
        build.onLoad({ filter: /^react$/, namespace: 'browser-global' }, () => ({
          contents: 'module.exports = window.React;',
          loader: 'js',
        }));
        build.onLoad({ filter: /^react-dom(\/client)?$/, namespace: 'browser-global' }, () => ({
          contents: 'module.exports = window.ReactDOM;',
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
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
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
