/**
 * String utilities tests
 */

import {
  extractBlockContent,
  filenameToComponentName,
  generateHash,
  escapeHtml,
  isValidIdentifier
} from '../../utils/string';

describe('String utilities', () => {
  describe('extractBlockContent', () => {
    it('should extract script block content', () => {
      const source = `
<script>
  let count = 0;
</script>
<template>
  <div>Test</div>
</template>
      `.trim();

      const result = extractBlockContent(source, 'script');
      expect(result).toBeDefined();
      expect(result!.content).toContain('let count = 0;');
    });

    it('should extract template block content', () => {
      const source = `
<template>
  <div>Hello World</div>
</template>
      `.trim();

      const result = extractBlockContent(source, 'template');
      expect(result).toBeDefined();
      expect(result!.content).toContain('<div>Hello World</div>');
    });

    it('should extract style block content', () => {
      const source = `
<style>
  .container { padding: 1rem; }
</style>
      `.trim();

      const result = extractBlockContent(source, 'style');
      expect(result).toBeDefined();
      expect(result!.content).toContain('.container');
    });

    it('should return null for missing block', () => {
      const source = '<template><div>Test</div></template>';
      const result = extractBlockContent(source, 'script');
      expect(result).toBeNull();
    });

    it('should handle case-insensitive tags', () => {
      const source = '<SCRIPT>console.log("test")</SCRIPT>';
      const result = extractBlockContent(source, 'script');
      expect(result).toBeDefined();
      expect(result!.content).toContain('console.log');
    });

    it('should handle tags with attributes', () => {
      const source = '<script lang="ts">let x: number = 5;</script>';
      const result = extractBlockContent(source, 'script');
      expect(result).toBeDefined();
      expect(result!.content).toContain('let x: number = 5;');
    });

    it('should return correct start and end positions', () => {
      const source = '<script>test</script>';
      const result = extractBlockContent(source, 'script');
      expect(result).toBeDefined();
      expect(result!.start).toBe(8); // After <script>
      expect(result!.end).toBe(12); // Before </script>
    });

    it('should return null if closing tag is missing', () => {
      const source = '<script>test';
      const result = extractBlockContent(source, 'script');
      expect(result).toBeNull();
    });
  });

  describe('filenameToComponentName', () => {
    it('should convert simple filename to PascalCase', () => {
      expect(filenameToComponentName('counter.dce')).toBe('Counter');
    });

    it('should convert kebab-case to PascalCase', () => {
      expect(filenameToComponentName('user-profile.dce')).toBe('UserProfile');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(filenameToComponentName('user_settings.dce')).toBe('UserSettings');
    });

    it('should handle mixed separators', () => {
      expect(filenameToComponentName('my-cool_component.dce')).toBe('MyCoolComponent');
    });

    it('should handle paths', () => {
      expect(filenameToComponentName('src/components/button.dce')).toBe('Button');
    });

    it('should handle .svelte extension', () => {
      expect(filenameToComponentName('Component.svelte')).toBe('Component');
    });

    it('should handle files without extension', () => {
      expect(filenameToComponentName('component')).toBe('Component');
    });

    it('should handle single letter components', () => {
      expect(filenameToComponentName('a.dce')).toBe('A');
    });

    it('should handle already PascalCase names', () => {
      expect(filenameToComponentName('MyComponent.dce')).toBe('MyComponent');
    });
  });

  describe('generateHash', () => {
    it('should generate a hash for content', () => {
      const hash = generateHash('test content');
      expect(hash).toMatch(/^dce-[a-z0-9]+$/);
    });

    it('should generate consistent hashes for same content', () => {
      const hash1 = generateHash('same content');
      const hash2 = generateHash('same content');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = generateHash('content 1');
      const hash2 = generateHash('content 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = generateHash('');
      expect(hash).toMatch(/^dce-[a-z0-9]+$/);
    });

    it('should handle special characters', () => {
      const hash = generateHash('!@#$%^&*()');
      expect(hash).toMatch(/^dce-[a-z0-9]+$/);
    });

    it('should handle unicode characters', () => {
      const hash = generateHash('Hello 世界 🌍');
      expect(hash).toMatch(/^dce-[a-z0-9]+$/);
    });

    it('should always return positive hash', () => {
      const hash = generateHash('test');
      expect(hash).not.toContain('-dce-'); // Should not have negative sign before dce
    });
  });

  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('2 > 1')).toBe('2 &gt; 1');
    });

    it('should escape double quote', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    });

    it('should escape single quote', () => {
      expect(escapeHtml("It's mine")).toBe('It&#039;s mine');
    });

    it('should escape all special characters together', () => {
      expect(escapeHtml('<div class="test">Tom & Jerry\'s</div>'))
        .toBe('&lt;div class=&quot;test&quot;&gt;Tom &amp; Jerry&#039;s&lt;/div&gt;');
    });

    it('should handle text without special characters', () => {
      expect(escapeHtml('Normal text')).toBe('Normal text');
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle multiple consecutive special characters', () => {
      expect(escapeHtml('&&<<>>')).toBe('&amp;&amp;&lt;&lt;&gt;&gt;');
    });
  });

  describe('isValidIdentifier', () => {
    it('should accept simple identifiers', () => {
      expect(isValidIdentifier('count')).toBe(true);
      expect(isValidIdentifier('myVar')).toBe(true);
      expect(isValidIdentifier('MyComponent')).toBe(true);
    });

    it('should accept identifiers with numbers', () => {
      expect(isValidIdentifier('var1')).toBe(true);
      expect(isValidIdentifier('test123')).toBe(true);
    });

    it('should accept identifiers with underscores', () => {
      expect(isValidIdentifier('_private')).toBe(true);
      expect(isValidIdentifier('my_var')).toBe(true);
      expect(isValidIdentifier('__proto__')).toBe(true);
    });

    it('should accept identifiers with dollar signs', () => {
      expect(isValidIdentifier('$state')).toBe(true);
      expect(isValidIdentifier('$')).toBe(true);
      expect(isValidIdentifier('jQuery$')).toBe(true);
    });

    it('should reject identifiers starting with numbers', () => {
      expect(isValidIdentifier('1var')).toBe(false);
      expect(isValidIdentifier('123')).toBe(false);
    });

    it('should reject identifiers with hyphens', () => {
      expect(isValidIdentifier('my-var')).toBe(false);
      expect(isValidIdentifier('user-name')).toBe(false);
    });

    it('should reject identifiers with spaces', () => {
      expect(isValidIdentifier('my var')).toBe(false);
      expect(isValidIdentifier('hello world')).toBe(false);
    });

    it('should reject identifiers with special characters', () => {
      expect(isValidIdentifier('hello!')).toBe(false);
      expect(isValidIdentifier('test@var')).toBe(false);
      expect(isValidIdentifier('foo.bar')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidIdentifier('')).toBe(false);
    });

    it('should accept single character identifiers', () => {
      expect(isValidIdentifier('a')).toBe(true);
      expect(isValidIdentifier('Z')).toBe(true);
      expect(isValidIdentifier('_')).toBe(true);
      expect(isValidIdentifier('$')).toBe(true);
    });
  });
});
