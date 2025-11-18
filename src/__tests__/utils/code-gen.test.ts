/**
 * Code generation utilities tests
 */

import {
  indent,
  dedent,
  joinStatements,
  block,
  arrayLiteral,
  objectLiteral
} from '../../utils/code-gen';

describe('Code generation utilities', () => {
  describe('indent', () => {
    it('should indent single line with default settings', () => {
      expect(indent('const x = 1;')).toBe('  const x = 1;');
    });

    it('should indent multiple lines', () => {
      const code = 'const x = 1;\nconst y = 2;';
      expect(indent(code)).toBe('  const x = 1;\n  const y = 2;');
    });

    it('should handle custom indentation level', () => {
      expect(indent('test', 2)).toBe('    test');
      expect(indent('test', 3)).toBe('      test');
    });

    it('should handle custom indentation character', () => {
      expect(indent('test', 1, '\t')).toBe('\ttest');
      expect(indent('test', 2, '\t')).toBe('\t\ttest');
    });

    it('should not indent empty lines', () => {
      const code = 'line1\n\nline2';
      expect(indent(code)).toBe('  line1\n\n  line2');
    });

    it('should handle already indented code', () => {
      const code = '  already indented';
      expect(indent(code)).toBe('    already indented');
    });

    it('should handle zero indentation level', () => {
      expect(indent('test', 0)).toBe('test');
    });

    it('should handle lines with only whitespace', () => {
      const code = 'line1\n   \nline2';
      expect(indent(code)).toBe('  line1\n   \n  line2');
    });
  });

  describe('dedent', () => {
    it('should remove common leading whitespace', () => {
      const code = '  line1\n  line2\n  line3';
      expect(dedent(code)).toBe('line1\nline2\nline3');
    });

    it('should handle mixed indentation levels', () => {
      const code = '    level2\n  level1\n    level2';
      expect(dedent(code)).toBe('  level2\nlevel1\n  level2');
    });

    it('should preserve relative indentation', () => {
      const code = '  parent\n    child\n  parent';
      expect(dedent(code)).toBe('parent\n  child\nparent');
    });

    it('should handle empty lines', () => {
      const code = '  line1\n\n  line2';
      expect(dedent(code)).toBe('line1\n\nline2');
    });

    it('should handle code with no indentation', () => {
      const code = 'line1\nline2';
      expect(dedent(code)).toBe('line1\nline2');
    });

    it('should return empty string for empty input', () => {
      expect(dedent('')).toBe('');
    });

    it('should handle code with only whitespace lines', () => {
      const code = '  line1\n    \n  line2';
      expect(dedent(code)).toBe('line1\n  \nline2');
    });

    it('should handle single line', () => {
      expect(dedent('  single line')).toBe('single line');
    });
  });

  describe('joinStatements', () => {
    it('should join multiple statements with double newline', () => {
      expect(joinStatements('stmt1', 'stmt2', 'stmt3'))
        .toBe('stmt1\n\nstmt2\n\nstmt3');
    });

    it('should filter out null values', () => {
      expect(joinStatements('stmt1', null, 'stmt2'))
        .toBe('stmt1\n\nstmt2');
    });

    it('should filter out undefined values', () => {
      expect(joinStatements('stmt1', undefined, 'stmt2'))
        .toBe('stmt1\n\nstmt2');
    });

    it('should filter out empty strings', () => {
      expect(joinStatements('stmt1', '', 'stmt2'))
        .toBe('stmt1\n\nstmt2');
    });

    it('should handle single statement', () => {
      expect(joinStatements('stmt1')).toBe('stmt1');
    });

    it('should handle all null/undefined values', () => {
      expect(joinStatements(null, undefined, '')).toBe('');
    });

    it('should handle no arguments', () => {
      expect(joinStatements()).toBe('');
    });

    it('should preserve multiline statements', () => {
      expect(joinStatements('line1\nline2', 'line3\nline4'))
        .toBe('line1\nline2\n\nline3\nline4');
    });
  });

  describe('block', () => {
    it('should wrap single line in braces', () => {
      expect(block('return 1;')).toBe('{\n  return 1;\n}');
    });

    it('should wrap multiple lines in braces', () => {
      const code = 'const x = 1;\nreturn x;';
      expect(block(code)).toBe('{\n  const x = 1;\n  return x;\n}');
    });

    it('should handle empty code', () => {
      expect(block('')).toBe('{\n\n}');
    });

    it('should handle already indented code', () => {
      const code = '  inner code';
      expect(block(code)).toBe('{\n    inner code\n}');
    });

    it('should handle code with empty lines', () => {
      const code = 'line1\n\nline2';
      expect(block(code)).toBe('{\n  line1\n\n  line2\n}');
    });
  });

  describe('arrayLiteral', () => {
    it('should create empty array for empty input', () => {
      expect(arrayLiteral([])).toBe('[]');
    });

    it('should create single-line array for one item', () => {
      expect(arrayLiteral(['item1'])).toBe('[item1]');
    });

    it('should create multi-line array for multiple items', () => {
      const result = arrayLiteral(['item1', 'item2', 'item3']);
      expect(result).toBe('[\n  item1,\n  item2,\n  item3\n]');
    });

    it('should handle numeric items', () => {
      expect(arrayLiteral(['1', '2', '3']))
        .toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('should handle string literals', () => {
      expect(arrayLiteral(['"hello"', '"world"']))
        .toBe('[\n  "hello",\n  "world"\n]');
    });

    it('should handle complex expressions', () => {
      expect(arrayLiteral(['a + b', 'c * d']))
        .toBe('[\n  a + b,\n  c * d\n]');
    });
  });

  describe('objectLiteral', () => {
    it('should create empty object for empty input', () => {
      expect(objectLiteral({})).toBe('{}');
    });

    it('should create single-line object for one property', () => {
      expect(objectLiteral({ key: 'value' })).toBe('{ key: value }');
    });

    it('should create multi-line object for multiple properties', () => {
      const result = objectLiteral({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      });
      expect(result).toBe('{\n  key1: value1,\n  key2: value2,\n  key3: value3\n}');
    });

    it('should handle numeric values', () => {
      const result = objectLiteral({ x: '1', y: '2' });
      expect(result).toBe('{\n  x: 1,\n  y: 2\n}');
    });

    it('should handle string literal values', () => {
      const result = objectLiteral({ name: '"John"', age: '30' });
      expect(result).toBe('{\n  name: "John",\n  age: 30\n}');
    });

    it('should handle expression values', () => {
      const result = objectLiteral({
        sum: 'a + b',
        product: 'c * d'
      });
      expect(result).toBe('{\n  sum: a + b,\n  product: c * d\n}');
    });

    it('should handle special property names', () => {
      const result = objectLiteral({ 'prop-name': 'value' });
      expect(result).toBe('{ prop-name: value }');
    });
  });
});
