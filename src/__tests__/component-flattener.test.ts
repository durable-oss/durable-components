/**
 * Component Reference Flattener Tests
 */

import { compile } from '../index';
import { analyzeComponentReferences, filterDCEComponents } from '../transformer/component-analyzer';
import { resolveComponentPath } from '../utils/path-resolver';
import { createEmptyIR } from '../types/ir';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Component Reference Analyzer', () => {
  describe('analyzeComponentReferences', () => {
    it('should identify component references from imports', () => {
      const ir = createEmptyIR('App');
      ir.imports = [
        {
          source: './Button',
          specifiers: [{ type: 'default', local: 'Button' }]
        },
        {
          source: './Counter',
          specifiers: [{ type: 'default', local: 'Counter' }]
        }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: [
          {
            type: 'element',
            name: 'Button',
            children: []
          },
          {
            type: 'element',
            name: 'Counter',
            children: []
          }
        ]
      };

      const references = analyzeComponentReferences(ir);

      expect(references).toHaveLength(2);
      expect(references[0].name).toBe('Button');
      expect(references[0].source).toBe('./Button');
      expect(references[0].isDefault).toBe(true);
      expect(references[1].name).toBe('Counter');
      expect(references[1].source).toBe('./Counter');
    });

    it('should not duplicate component references', () => {
      const ir = createEmptyIR('App');
      ir.imports = [
        {
          source: './Button',
          specifiers: [{ type: 'default', local: 'Button' }]
        }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: [
          {
            type: 'element',
            name: 'Button',
            children: []
          },
          {
            type: 'element',
            name: 'Button',
            children: []
          }
        ]
      };

      const references = analyzeComponentReferences(ir);

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe('Button');
    });

    it('should handle named imports', () => {
      const ir = createEmptyIR('App');
      ir.imports = [
        {
          source: './components',
          specifiers: [
            { type: 'named', local: 'Button', imported: 'Button' },
            { type: 'named', local: 'Input', imported: 'Input' }
          ]
        }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: [
          {
            type: 'element',
            name: 'Button',
            children: []
          }
        ]
      };

      const references = analyzeComponentReferences(ir);

      expect(references).toHaveLength(1);
      expect(references[0].name).toBe('Button');
      expect(references[0].isDefault).toBe(false);
    });

    it('should ignore HTML elements', () => {
      const ir = createEmptyIR('App');
      ir.imports = [
        {
          source: './Button',
          specifiers: [{ type: 'default', local: 'Button' }]
        }
      ];
      ir.template = {
        type: 'element',
        name: 'div',
        children: [
          {
            type: 'element',
            name: 'button', // lowercase, not a component
            children: []
          },
          {
            type: 'element',
            name: 'Button', // uppercase, matches import
            children: []
          }
        ]
      };

      const references = analyzeComponentReferences(ir);

      // Only Button (uppercase) should be identified
      expect(references).toHaveLength(1);
      expect(references[0].name).toBe('Button');
    });
  });

  describe('filterDCEComponents', () => {
    it('should filter only DCE component imports (relative paths)', () => {
      const references = [
        { name: 'Button', source: './Button', localName: 'Button', isDefault: true },
        { name: 'Icon', source: '@icons/star', localName: 'Icon', isDefault: true },
        { name: 'Counter', source: '../Counter.dce', localName: 'Counter', isDefault: true }
      ];

      const dceRefs = filterDCEComponents(references);

      expect(dceRefs).toHaveLength(2);
      expect(dceRefs[0].source).toBe('./Button');
      expect(dceRefs[1].source).toBe('../Counter.dce');
    });
  });
});

describe('Path Resolver', () => {
  describe('resolveComponentPath', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dce-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should resolve relative paths with .dce extension', () => {
      const buttonPath = path.join(tempDir, 'Button.dce');
      fs.writeFileSync(buttonPath, '<template><button>Click</button></template>');

      const resolved = resolveComponentPath('./Button.dce', {
        baseDir: tempDir,
        checkExists: true
      });

      expect(resolved).toBe(buttonPath);
    });

    it('should resolve paths without extension', () => {
      const buttonPath = path.join(tempDir, 'Button.dce');
      fs.writeFileSync(buttonPath, '<template><button>Click</button></template>');

      const resolved = resolveComponentPath('./Button', {
        baseDir: tempDir,
        extensions: ['.dce'],
        checkExists: true
      });

      expect(resolved).toBe(buttonPath);
    });

    it('should resolve parent directory paths', () => {
      const componentsDir = path.join(tempDir, 'components');
      const appDir = path.join(tempDir, 'app');
      fs.mkdirSync(componentsDir);
      fs.mkdirSync(appDir);

      const buttonPath = path.join(componentsDir, 'Button.dce');
      fs.writeFileSync(buttonPath, '<template><button>Click</button></template>');

      const resolved = resolveComponentPath('../components/Button', {
        baseDir: appDir,
        extensions: ['.dce'],
        checkExists: true
      });

      expect(resolved).toBe(buttonPath);
    });

    it('should return null for non-existent files when checkExists is true', () => {
      const resolved = resolveComponentPath('./NonExistent', {
        baseDir: tempDir,
        extensions: ['.dce'],
        checkExists: true
      });

      expect(resolved).toBeNull();
    });

    it('should resolve index files in directories', () => {
      const componentsDir = path.join(tempDir, 'components');
      fs.mkdirSync(componentsDir);

      const indexPath = path.join(componentsDir, 'index.dce');
      fs.writeFileSync(indexPath, '<template><div>Index</div></template>');

      const resolved = resolveComponentPath('./components', {
        baseDir: tempDir,
        extensions: ['.dce'],
        checkExists: true
      });

      expect(resolved).toBe(indexPath);
    });
  });
});

describe('Component Flattening Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dce-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should compile component with flatten enabled', () => {
    // Create a Button component
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<script>
  let { label = 'Click' } = $props();
</script>

<template>
  <button>{label}</button>
</template>

<style>
  button {
    padding: 0.5rem;
  }
</style>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create an App component that uses Button
    const appPath = path.join(tempDir, 'App.dce');
    const appSource = `
<script>
  import Button from './Button';
</script>

<template>
  <div>
    <h1>My App</h1>
    <Button label="Submit" />
  </div>
</template>
    `.trim();
    fs.writeFileSync(appPath, appSource);

    // Compile with reference inclusion enabled
    const result = compile(appSource, {
      filename: appPath,
      target: 'react',
      includeReferences: true
    });

    // Check main component
    expect(result.js.code).toBeDefined();
    expect(result.js.code).toContain('export function App');

    // Check included components
    expect(result.components).toBeDefined();
    expect(result.components?.length).toBeGreaterThan(0);

    // Find Button in included components
    const buttonComponent = result.components?.find(c => c.name === 'Button');
    expect(buttonComponent).toBeDefined();
    expect(buttonComponent?.js.code).toContain('export function Button');
    expect(buttonComponent?.css).toBeDefined();
    expect(buttonComponent?.css?.code).toContain('button');
  });

  it('should handle nested component dependencies', () => {
    // Create an Icon component
    const iconPath = path.join(tempDir, 'Icon.dce');
    const iconSource = `
<script>
  let { name } = $props();
</script>

<template>
  <span class="icon">{name}</span>
</template>
    `.trim();
    fs.writeFileSync(iconPath, iconSource);

    // Create a Button component that uses Icon
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<script>
  import Icon from './Icon';
  let { label, icon } = $props();
</script>

<template>
  <button>
    <Icon name={icon} />
    {label}
  </button>
</template>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create an App component that uses Button
    const appPath = path.join(tempDir, 'App.dce');
    const appSource = `
<script>
  import Button from './Button';
</script>

<template>
  <Button label="Save" icon="save" />
</template>
    `.trim();
    fs.writeFileSync(appPath, appSource);

    // Compile with reference inclusion
    const result = compile(appSource, {
      filename: appPath,
      target: 'react',
      includeReferences: true
    });

    // Should have App, Button, and Icon
    expect(result.components?.length).toBeGreaterThanOrEqual(2);

    const componentNames = result.components?.map(c => c.name) || [];
    expect(componentNames).toContain('Button');
    expect(componentNames).toContain('Icon');

    // Icon should come before Button in dependency order
    const iconIndex = componentNames.indexOf('Icon');
    const buttonIndex = componentNames.indexOf('Button');
    expect(iconIndex).toBeLessThan(buttonIndex);
  });

  it('should work when includeReferences is disabled (default)', () => {
    const appSource = `
<script>
  let count = $state(0);
</script>

<template>
  <div>Count: {count}</div>
</template>
    `.trim();

    const result = compile(appSource, {
      filename: 'App.dce',
      target: 'react',
      includeReferences: false
    });

    expect(result.js.code).toBeDefined();
    expect(result.components).toBeUndefined();
  });

  it('should handle components with no dependencies', () => {
    const simpleSource = `
<script>
  let message = $state('Hello');
</script>

<template>
  <p>{message}</p>
</template>
    `.trim();

    const simplePath = path.join(tempDir, 'Simple.dce');
    fs.writeFileSync(simplePath, simpleSource);

    const result = compile(simpleSource, {
      filename: simplePath,
      target: 'react',
      includeReferences: true
    });

    expect(result.js.code).toBeDefined();
    // Should have the root component only
    expect(result.components?.length).toBe(1);
    expect(result.components?.[0].name).toBe('Simple');
  });
});
