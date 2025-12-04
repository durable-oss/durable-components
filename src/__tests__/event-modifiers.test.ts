import { compile } from '../index';

describe('Event Modifiers', () => {
  describe('preventDefault modifier', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click|preventDefault={handleClick}>Click</button>
</template>
    `.trim();

    it('should convert in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={(e) => { e.preventDefault(); handleClick(e); }}');
    });

    it('should convert in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={(e) => { e.preventDefault(); handleClick(e); }}');
    });

    it('should convert in Vue', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      expect(result.js.code).toContain('@click.prevent');
    });

    it('should convert in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={(e) => { e.preventDefault(); handleClick(e); }}');
    });
  });

  describe('stopPropagation modifier', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click|stopPropagation={handleClick}>Click</button>
</template>
    `.trim();

    it('should convert in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={(e) => { e.stopPropagation(); handleClick(e); }}');
    });

    it('should convert in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={(e) => { e.stopPropagation(); handleClick(e); }}');
    });

    it('should convert in Vue', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      expect(result.js.code).toContain('@click.stop');
    });

    it('should convert in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={(e) => { e.stopPropagation(); handleClick(e); }}');
    });
  });

  describe('multiple modifiers', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click|preventDefault|stopPropagation={handleClick}>Click</button>
</template>
    `.trim();

    it('should chain modifiers in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(e); }}');
    });

    it('should chain modifiers in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(e); }}');
    });

    it('should chain modifiers in Vue', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      expect(result.js.code).toContain('@click.prevent.stop');
    });

    it('should chain modifiers in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(e); }}');
    });
  });

  describe('self modifier', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click|self={handleClick}>Click</button>
</template>
    `.trim();

    it('should convert in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={(e) => { if (e.target !== e.currentTarget) return; handleClick(e); }}');
    });

    it('should convert in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={(e) => { if (e.target !== e.currentTarget) return; handleClick(e); }}');
    });

    it('should convert in Vue', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      expect(result.js.code).toContain('@click.self');
    });

    it('should convert in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={(e) => { if (e.target !== e.currentTarget) return; handleClick(e); }}');
    });
  });

  describe('trusted modifier', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click|trusted={handleClick}>Click</button>
</template>
    `.trim();

    it('should convert in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={(e) => { if (!e.isTrusted) return; handleClick(e); }}');
    });

    it('should convert in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={(e) => { if (!e.isTrusted) return; handleClick(e); }}');
    });

    it('should convert in Vue', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      expect(result.js.code).toContain('@click.trusted');
    });

    it('should convert in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={(e) => { if (!e.isTrusted) return; handleClick(e); }}');
    });
  });

  describe('stopImmediatePropagation modifier', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click|stopImmediatePropagation={handleClick}>Click</button>
</template>
    `.trim();

    it('should convert in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={(e) => { e.stopImmediatePropagation(); handleClick(e); }}');
    });

    it('should convert in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={(e) => { e.stopImmediatePropagation(); handleClick(e); }}');
    });

    it('should convert in Vue (maps to stop)', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      // Vue doesn't have stopImmediate, so we map it to stop
      expect(result.js.code).toContain('@click.stop');
    });

    it('should convert in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={(e) => { e.stopImmediatePropagation(); handleClick(e); }}');
    });
  });

  describe('no modifiers', () => {
    const source = `
<script>
  function handleClick() {}
</script>
<template>
  <button on:click={handleClick}>Click</button>
</template>
    `.trim();

    it('should not wrap handler in Svelte', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'svelte' });
      expect(result.js.code).toContain('onclick={handleClick}');
      expect(result.js.code).not.toContain('(e) =>');
    });

    it('should not wrap handler in React', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'react' });
      expect(result.js.code).toContain('onClick={handleClick}');
      expect(result.js.code).not.toContain('(e) =>');
    });

    it('should not add modifiers in Vue', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'vue' });
      expect(result.js.code).toContain('@click="handleClick"');
      expect(result.js.code).not.toContain('@click.');
    });

    it('should not wrap handler in Solid', () => {
      const result = compile(source, { filename: 'Test.dce', target: 'solid' });
      expect(result.js.code).toContain('onClick={handleClick}');
      expect(result.js.code).not.toContain('(e) =>');
    });
  });
});
