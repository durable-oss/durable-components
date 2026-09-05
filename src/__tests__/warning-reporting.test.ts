/**
 * Tests for how compiler warnings reach a human.
 *
 * `compile()` returns warnings on its result rather than throwing, so each
 * entry point has to print them itself. Nothing did, which made every
 * diagnostic invisible to anyone running `dcc` or a Vite build.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compile } from '../index';
import { durableComponents } from '../vite-plugin';
import { formatWarning, formatWarnings } from '../utils/format-warning';
import { reportWarnings, resetReportedWarnings } from '../showcase/report-warnings';

const WARNS = `
<script>
  let { rows } = $props();
  let panel = $state(null);
</script>
<template>
  <div>
    {#each rows as row}
      <p bind:this={panel}>{row.a}</p>
    {/each}
  </div>
</template>
`.trim();

const CLEAN = `
<script>
  let { rows } = $props();
</script>
<template>
  <div>{rows.length}</div>
</template>
`.trim();

describe('formatWarning', () => {
  it('leads with the file and the code', () => {
    const line = formatWarning(
      { message: 'something is off', code: 'SOME_CODE' },
      'Panel.dce'
    );

    expect(line).toBe('Panel.dce [SOME_CODE] something is off');
  });

  it('includes a position when the warning carries one', () => {
    const line = formatWarning(
      { message: 'here', code: 'C', start: { line: 4, column: 2 } },
      'Panel.dce'
    );

    expect(line).toBe('Panel.dce:4:2 [C] here');
  });

  it('reads sensibly with no filename and no code', () => {
    expect(formatWarning({ message: 'bare' })).toBe('bare');
  });

  it('returns an empty string for no warnings, so callers can print blind', () => {
    expect(formatWarnings(undefined)).toBe('');
    expect(formatWarnings([])).toBe('');
  });

  it('puts each warning on its own line', () => {
    const out = formatWarnings(
      [{ message: 'one', code: 'A' }, { message: 'two', code: 'B' }],
      'X.dce'
    );

    expect(out.split('\n')).toHaveLength(2);
  });
});

describe('vite plugin warning reporting', () => {
  /** Run the plugin's transform against a stub Rollup context. */
  async function transform(source: string, id = '/proj/Panel.dce') {
    const plugin = durableComponents({ target: 'react' });
    const warnings: any[] = [];
    const ctx = {
      warn: (warning: any) => warnings.push(warning),
      error: (err: any) => {
        throw new Error(err.message);
      }
    };

    const hook: any = plugin.transform;
    const handler = typeof hook === 'function' ? hook : hook.handler;
    const result = await handler.call(ctx, source, id);

    return { warnings, result };
  }

  it('reports each warning through this.warn', async () => {
    const { warnings } = await transform(WARNS);

    expect(warnings).toHaveLength(2);
    const codes = warnings.map((warning) => warning.message).join(' ');
    expect(codes).toContain('REF_SHADOWS_STATE');
    expect(codes).toContain('REF_BOUND_IN_LOOP');
  });

  it('attaches the module id so Vite can point at the file', async () => {
    const { warnings } = await transform(WARNS, '/proj/src/Panel.dce');

    for (const warning of warnings) {
      expect(warning.id).toBe('/proj/src/Panel.dce');
    }
  });

  it('still returns compiled code alongside the warnings', async () => {
    const { result } = await transform(WARNS);

    // A warning is not a failure; the build carries on.
    expect(result?.code).toContain('export function Panel');
  });

  it('stays quiet for a component with nothing wrong', async () => {
    const { warnings } = await transform(CLEAN);

    expect(warnings).toHaveLength(0);
  });
});

describe('showcase warning reporting', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resetReportedWarnings('Panel.dce');
  });

  afterEach(() => {
    warn.mockRestore();
    resetReportedWarnings('Panel.dce');
  });

  it('prints a warning the first time it is seen', () => {
    reportWarnings([{ message: 'first', code: 'A' }], 'Panel.dce');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Panel.dce [A] first');
  });

  it('does not repeat itself when the same compile happens again', () => {
    const warnings = [{ message: 'first', code: 'A' }];

    // The server recompiles on every preview request, so an undeduped warning
    // would bury the terminal.
    reportWarnings(warnings, 'Panel.dce');
    reportWarnings(warnings, 'Panel.dce');
    reportWarnings(warnings, 'Panel.dce');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('prints a newly appearing warning for a component already seen', () => {
    reportWarnings([{ message: 'first', code: 'A' }], 'Panel.dce');
    reportWarnings(
      [{ message: 'first', code: 'A' }, { message: 'second', code: 'B' }],
      'Panel.dce'
    );

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('second');
  });

  it('prints again after the file changes', () => {
    reportWarnings([{ message: 'first', code: 'A' }], 'Panel.dce');
    resetReportedWarnings('Panel.dce');
    reportWarnings([{ message: 'first', code: 'A' }], 'Panel.dce');

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('tracks components separately', () => {
    reportWarnings([{ message: 'first', code: 'A' }], 'Panel.dce');
    reportWarnings([{ message: 'first', code: 'A' }], 'Other.dce');

    expect(warn).toHaveBeenCalledTimes(2);
    resetReportedWarnings('Other.dce');
  });

  it('does nothing when there are no warnings', () => {
    reportWarnings(undefined, 'Panel.dce');
    reportWarnings([], 'Panel.dce');

    expect(warn).not.toHaveBeenCalled();
  });
});


describe('warnings from referenced components', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dce-warn-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('surfaces a child component\'s warnings on the parent compile', () => {
    fs.writeFileSync(
      path.join(dir, 'Child.dce'),
      `
<script>
  let { rows } = $props();
  let panel = $state(null);
</script>
<template>
  <div>
    {#each rows as row}
      <p bind:this={panel}>{row.a}</p>
    {/each}
  </div>
</template>
      `.trim()
    );

    const parentPath = path.join(dir, 'Parent.dce');
    const parent = `
<script>
  import Child from './Child.dce';
  let { rows } = $props();
</script>
<template>
  <div><Child rows={rows} /></div>
</template>
    `.trim();
    fs.writeFileSync(parentPath, parent);

    const { warnings } = compile(parent, {
      filename: parentPath,
      target: 'react',
      includeReferences: true
    });

    // Compiling one entry point is the only chance to hear about a diagnostic
    // in a file it pulls in.
    expect(warnings).toBeDefined();
    const codes = (warnings ?? []).map((warning) => warning.code);
    expect(codes).toContain('REF_SHADOWS_STATE');
    expect(codes).toContain('REF_BOUND_IN_LOOP');
  });

  it('names the file each warning came from', () => {
    fs.writeFileSync(
      path.join(dir, 'Child.dce'),
      `
<script>
  let { rows } = $props();
  let panel = $state(null);
</script>
<template>
  <div bind:this={panel}>{rows.length}</div>
</template>
      `.trim()
    );

    const parentPath = path.join(dir, 'Parent.dce');
    const parent = `
<script>
  import Child from './Child.dce';
</script>
<template>
  <div><Child /></div>
</template>
    `.trim();
    fs.writeFileSync(parentPath, parent);

    const { warnings } = compile(parent, {
      filename: parentPath,
      target: 'react',
      includeReferences: true
    });

    expect(warnings?.[0].message).toContain('Child.dce:');
  });

  it('reports nothing when every referenced component is clean', () => {
    fs.writeFileSync(
      path.join(dir, 'Child.dce'),
      `
<script>
  let { label } = $props();
</script>
<template>
  <span>{label}</span>
</template>
      `.trim()
    );

    const parentPath = path.join(dir, 'Parent.dce');
    const parent = `
<script>
  import Child from './Child.dce';
</script>
<template>
  <div><Child label="hi" /></div>
</template>
    `.trim();
    fs.writeFileSync(parentPath, parent);

    const { warnings } = compile(parent, {
      filename: parentPath,
      target: 'react',
      includeReferences: true
    });

    expect(warnings).toBeUndefined();
  });
});
