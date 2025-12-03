/**
 * Template Flattening Tests
 *
 * Tests for the flatten option that inlines component templates
 */

import { compile } from '../index';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Template Flattening', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dce-flatten-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should flatten a simple component with children', () => {
    // Create Button.dce
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<template>
  <button class="m-2">
    {children}
  </button>
</template>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create OKButton.dce
    const okButtonPath = path.join(tempDir, 'OKButton.dce');
    const okButtonSource = `
<script>
  import Button from './Button';
</script>

<template>
<div class="p-1">
  <Button>OK!</Button>
</div>
</template>
    `.trim();
    fs.writeFileSync(okButtonPath, okButtonSource);

    // Compile with flatten enabled
    const result = compile(okButtonSource, {
      filename: okButtonPath,
      target: 'svelte',
      flatten: true
    });

    // The output should not contain <Button>
    expect(result.js.code).not.toContain('<Button');

    // The output should contain the flattened button element
    expect(result.js.code).toContain('button');
    expect(result.js.code).toContain('OK!');
  });

  it('should flatten nested components', () => {
    // Create Icon.dce
    const iconPath = path.join(tempDir, 'Icon.dce');
    const iconSource = `
<template>
  <span class="icon">{children}</span>
</template>
    `.trim();
    fs.writeFileSync(iconPath, iconSource);

    // Create Button.dce that uses Icon
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<script>
  import Icon from './Icon';
</script>

<template>
  <button>
    <Icon>★</Icon>
    {children}
  </button>
</template>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create App.dce that uses Button
    const appPath = path.join(tempDir, 'App.dce');
    const appSource = `
<script>
  import Button from './Button';
</script>

<template>
  <Button>Click me</Button>
</template>
    `.trim();
    fs.writeFileSync(appPath, appSource);

    // Compile with flatten enabled
    const result = compile(appSource, {
      filename: appPath,
      target: 'svelte',
      flatten: true
    });

    // Should not contain component tags
    expect(result.js.code).not.toContain('<Button');
    expect(result.js.code).not.toContain('<Icon');

    // Should contain all the flattened elements
    expect(result.js.code).toContain('button');
    expect(result.js.code).toContain('span');
    expect(result.js.code).toContain('★');
    expect(result.js.code).toContain('Click me');
  });

  it('should handle components with props', () => {
    // Create Button.dce with props
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<script>
  let { variant = 'primary' } = $props();
</script>

<template>
  <button class="{variant}">
    {children}
  </button>
</template>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create App.dce that passes props
    const appPath = path.join(tempDir, 'App.dce');
    const appSource = `
<script>
  import Button from './Button';
</script>

<template>
  <Button variant="danger">Delete</Button>
</template>
    `.trim();
    fs.writeFileSync(appPath, appSource);

    // Compile with flatten enabled
    const result = compile(appSource, {
      filename: appPath,
      target: 'svelte',
      flatten: true
    });

    // Should not contain Button component
    expect(result.js.code).not.toContain('<Button');

    // Should contain the button with the prop value substituted
    expect(result.js.code).toContain('button');
  });

  it('should work when flatten is disabled', () => {
    // Create Button.dce
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<template>
  <button>{children}</button>
</template>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create App.dce
    const appPath = path.join(tempDir, 'App.dce');
    const appSource = `
<script>
  import Button from './Button';
</script>

<template>
  <Button>Click</Button>
</template>
    `.trim();
    fs.writeFileSync(appPath, appSource);

    // Compile with flatten disabled
    const result = compile(appSource, {
      filename: appPath,
      target: 'react',
      flatten: false
    });

    // Should contain Button component reference
    expect(result.js.code).toContain('Button');
  });

  it('should handle multiple instances of the same component', () => {
    // Create Button.dce
    const buttonPath = path.join(tempDir, 'Button.dce');
    const buttonSource = `
<template>
  <button>{children}</button>
</template>
    `.trim();
    fs.writeFileSync(buttonPath, buttonSource);

    // Create App.dce with multiple Button instances
    const appPath = path.join(tempDir, 'App.dce');
    const appSource = `
<script>
  import Button from './Button';
</script>

<template>
  <div>
    <Button>First</Button>
    <Button>Second</Button>
    <Button>Third</Button>
  </div>
</template>
    `.trim();
    fs.writeFileSync(appPath, appSource);

    // Compile with flatten enabled
    const result = compile(appSource, {
      filename: appPath,
      target: 'svelte',
      flatten: true
    });

    // Should not contain Button component
    expect(result.js.code).not.toContain('<Button');

    // Should contain all three flattened buttons
    expect(result.js.code).toContain('First');
    expect(result.js.code).toContain('Second');
    expect(result.js.code).toContain('Third');
  });
});
