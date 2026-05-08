/**
 * .showcase file parser
 *
 * Parses the HTML-like showcase format:
 *
 *   <params>
 *     <param name="count" type="number" default={0} />
 *   </params>
 *
 *   <scenario name="Default">
 *     <Counter initialCount={count} />
 *   </scenario>
 */

export type ParamType = 'string' | 'number' | 'boolean';

export interface ShowcaseParam {
  name: string;
  type: ParamType;
  default: string | number | boolean;
}

export interface ShowcaseScenario {
  name: string;
  body: string; // raw DCE template content inside the scenario tag
}

export interface ShowcaseFile {
  params: ShowcaseParam[];
  scenarios: ShowcaseScenario[];
  /** explicit import paths declared at top of file */
  imports: string[];
}

export function parseShowcase(source: string): ShowcaseFile {
  const params: ShowcaseParam[] = [];
  const scenarios: ShowcaseScenario[] = [];
  const imports: string[] = [];

  // Extract import lines: import Foo from './Foo.dce'
  const importRe = /^import\s+\w+\s+from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    imports.push(m[1]);
  }

  // Extract <params> block
  const paramsBlockRe = /<params>([\s\S]*?)<\/params>/;
  const paramsMatch = paramsBlockRe.exec(source);
  if (paramsMatch) {
    const paramsContent = paramsMatch[1];
    const paramRe = /<param\s([^>]*?)\/>/g;
    let pm: RegExpExecArray | null;
    while ((pm = paramRe.exec(paramsContent)) !== null) {
      const attrs = pm[1];
      const name = extractAttr(attrs, 'name');
      const type = (extractAttr(attrs, 'type') || 'string') as ParamType;
      const defaultRaw = extractAttrRaw(attrs, 'default');
      const defaultVal = coerceDefault(defaultRaw, type);
      if (name) {
        params.push({ name, type, default: defaultVal });
      }
    }
  }

  // Extract <scenario name="..."> blocks
  const scenarioRe = /<scenario\s([^>]*)>([\s\S]*?)<\/scenario>/g;
  while ((m = scenarioRe.exec(source)) !== null) {
    const attrs = m[1];
    const body = m[2].trim();
    const name = extractAttr(attrs, 'name') || 'Unnamed';
    scenarios.push({ name, body });
  }

  return { params, scenarios, imports };
}

function extractAttr(attrs: string, name: string): string {
  // name="value" or name='value'
  const re = new RegExp(`${name}=["']([^"']*)["']`);
  const m = re.exec(attrs);
  return m ? m[1] : '';
}

function extractAttrRaw(attrs: string, name: string): string {
  // name={expr} or name="value"
  const braceRe = new RegExp(`${name}=\\{([^}]*)\\}`);
  const m = braceRe.exec(attrs);
  if (m) return m[1].trim();
  return extractAttr(attrs, name);
}

function coerceDefault(raw: string, type: ParamType): string | number | boolean {
  if (type === 'number') return raw === '' ? 0 : Number(raw);
  if (type === 'boolean') return raw === 'true' || raw === '';
  return raw;
}
