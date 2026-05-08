import { describe, it, expect } from 'vitest';
import { buildShellHtml } from '../../showcase/ui';

describe('buildShellHtml', () => {
  it('returns a valid HTML document', () => {
    const html = buildShellHtml(3000);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes a <head> with charset meta', () => {
    const html = buildShellHtml(3000);
    expect(html).toContain('<head>');
    expect(html).toContain('charset="utf-8"');
  });

  it('embeds the provided WebSocket port', () => {
    const html = buildShellHtml(4567);
    expect(html).toContain('4567');
  });

  it('uses a different port when changed', () => {
    const html1 = buildShellHtml(3000);
    const html2 = buildShellHtml(9999);
    expect(html1).toContain('3000');
    expect(html2).toContain('9999');
    // The two outputs differ only in port reference areas
    expect(html1).not.toBe(html2);
  });

  it('includes CSS styles', () => {
    const html = buildShellHtml(3000);
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
  });

  it('includes a sidebar element', () => {
    const html = buildShellHtml(3000);
    expect(html).toContain('sidebar');
  });

  it('includes a preview iframe or content area', () => {
    const html = buildShellHtml(3000);
    expect(html).toMatch(/iframe|preview|content/i);
  });

  it('includes framework selector UI', () => {
    const html = buildShellHtml(3000);
    // Should have react/vue/svelte/solid options somewhere
    expect(html).toMatch(/react/i);
    expect(html).toMatch(/svelte/i);
    expect(html).toMatch(/solid/i);
    expect(html).toMatch(/vue/i);
  });

  it('includes JavaScript for WebSocket connection', () => {
    const html = buildShellHtml(3000);
    expect(html).toContain('WebSocket');
  });

  it('includes a <script> tag with client-side logic', () => {
    const html = buildShellHtml(3000);
    expect(html).toContain('<script>');
    expect(html).toContain('</script>');
  });

  it('produces non-empty output', () => {
    const html = buildShellHtml(3000);
    expect(html.length).toBeGreaterThan(500);
  });
});
