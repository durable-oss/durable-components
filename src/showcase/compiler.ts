import { compile } from '../index';
import type { CompilerTarget } from '../types/compiler';
import type { ShowcaseParam, ShowcaseScenario } from './parser';

export interface CompileScenarioResult {
  code: string;
  css: string | null;
  error?: string;
}

function buildDceSource(
  scenario: ShowcaseScenario,
  params: ShowcaseParam[],
  paramValues: Record<string, unknown>
): string {
  const varDecls = params
    .map(p => {
      const val = paramValues[p.name] ?? p.default;
      return `  let ${p.name} = $state(${JSON.stringify(val)});`;
    })
    .join('\n');

  const script = varDecls ? `<script>\n${varDecls}\n</script>\n\n` : '';
  return `${script}<template>\n${scenario.body}\n</template>`;
}

export function compileScenario(
  scenario: ShowcaseScenario,
  params: ShowcaseParam[],
  paramValues: Record<string, unknown>,
  target: CompilerTarget
): CompileScenarioResult {
  try {
    const source = buildDceSource(scenario, params, paramValues);
    const result = compile(source, {
      filename: `__showcase_${scenario.name.replace(/\s+/g, '_')}.dce`,
      target,
      browserSafe: target !== 'react',
    });
    return {
      code: result.js.code,
      css: result.css?.code ?? null,
    };
  } catch (e) {
    return { code: '', css: null, error: (e as Error).message };
  }
}
