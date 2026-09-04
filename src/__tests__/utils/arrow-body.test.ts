/**
 * Arrow body utility tests
 */

import { arrowBody } from '../../utils/arrow-body';

describe('arrowBody', () => {
  it('should parenthesize an object literal', () => {
    expect(arrowBody("{ a: 1 }")).toBe("({ a: 1 })");
  });

  it('should parenthesize an object literal with leading whitespace', () => {
    expect(arrowBody("  { a: 1 }  ")).toBe("({ a: 1 })");
  });

  it('should parenthesize a multi-line object literal', () => {
    expect(arrowBody("{\n  a: 1,\n  b: 2\n}")).toBe("({\n  a: 1,\n  b: 2\n})");
  });

  it('should parenthesize an object literal with computed keys', () => {
    expect(arrowBody("{ ['--w']: width }")).toBe("({ ['--w']: width })");
  });

  it('should leave a binary expression unchanged', () => {
    expect(arrowBody('count * 2')).toBe('count * 2');
  });

  it('should leave an array literal unchanged', () => {
    expect(arrowBody('[1, 2, 3]')).toBe('[1, 2, 3]');
  });

  it('should leave a template literal unchanged', () => {
    expect(arrowBody('`width: ${w}px`')).toBe('`width: ${w}px`');
  });

  it('should leave a call expression unchanged', () => {
    expect(arrowBody('items.filter((i) => { return i.done; })')).toBe(
      'items.filter((i) => { return i.done; })'
    );
  });

  it('should leave a string containing a brace unchanged', () => {
    expect(arrowBody("'{ not an object }'")).toBe("'{ not an object }'");
  });

  it('should leave an empty expression unchanged', () => {
    expect(arrowBody('')).toBe('');
  });
});
