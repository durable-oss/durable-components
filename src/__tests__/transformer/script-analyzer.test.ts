/**
 * Script analyzer tests
 */

import { parse as acornParse } from 'acorn';
import { extractRunesFromScript } from '../../transformer/script-analyzer';
import type { ScriptBlock } from '../../types/ast';

function createScriptBlock(code: string): ScriptBlock {
  const ast = acornParse(code, {
    ecmaVersion: 2022,
    sourceType: 'module',
    locations: true
  });

  return {
    type: 'ScriptBlock',
    content: code,
    ast,
    start: 0,
    end: code.length
  };
}

describe('Script Analyzer', () => {
  describe('Props extraction', () => {
    it('should extract simple props', () => {
      const script = createScriptBlock('let { name } = $props();');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(1);
      expect(analysis.props[0].name).toBe('name');
      expect(analysis.props[0].defaultValue).toBeUndefined();
    });

    it('should extract props with default values', () => {
      const script = createScriptBlock('let { name = "Guest" } = $props();');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(1);
      expect(analysis.props[0].name).toBe('name');
      expect(analysis.props[0].defaultValue).toBe('"Guest"');
    });

    it('should extract multiple props', () => {
      const script = createScriptBlock('let { firstName, lastName, age = 0 } = $props();');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(3);
      expect(analysis.props[0].name).toBe('firstName');
      expect(analysis.props[1].name).toBe('lastName');
      expect(analysis.props[2].name).toBe('age');
      expect(analysis.props[2].defaultValue).toBe('0');
    });

    it('should handle props with complex default values', () => {
      const script = createScriptBlock('let { config = { theme: "dark" } } = $props();');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(1);
      expect(analysis.props[0].name).toBe('config');
      expect(analysis.props[0].defaultValue).toBeDefined();
    });

    it('should handle no props', () => {
      const script = createScriptBlock('let count = 0;');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(0);
    });
  });

  describe('State extraction', () => {
    it('should extract simple state', () => {
      const script = createScriptBlock('let count = $state(0);');
      const analysis = extractRunesFromScript(script);

      expect(analysis.state).toHaveLength(1);
      expect(analysis.state[0].name).toBe('count');
      expect(analysis.state[0].initialValue).toBe('0');
    });

    it('should extract state with complex initial value', () => {
      const script = createScriptBlock('let items = $state([1, 2, 3]);');
      const analysis = extractRunesFromScript(script);

      expect(analysis.state).toHaveLength(1);
      expect(analysis.state[0].name).toBe('items');
      expect(analysis.state[0].initialValue).toBe('[1, 2, 3]');
    });

    it('should extract multiple state variables', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        let name = $state("John");
        let active = $state(true);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.state).toHaveLength(3);
      expect(analysis.state[0].name).toBe('count');
      expect(analysis.state[1].name).toBe('name');
      expect(analysis.state[2].name).toBe('active');
    });

    it('should handle state with no initial value', () => {
      const script = createScriptBlock('let value = $state();');
      const analysis = extractRunesFromScript(script);

      expect(analysis.state).toHaveLength(1);
      expect(analysis.state[0].initialValue).toBe('undefined');
    });

    it('should extract state with object initial value', () => {
      const script = createScriptBlock('let user = $state({ name: "John", age: 30 });');
      const analysis = extractRunesFromScript(script);

      expect(analysis.state).toHaveLength(1);
      expect(analysis.state[0].name).toBe('user');
      expect(analysis.state[0].initialValue).toContain('name');
    });
  });

  describe('Derived extraction', () => {
    it('should extract simple derived', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        let doubled = $derived(count * 2);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived).toHaveLength(1);
      expect(analysis.derived[0].name).toBe('doubled');
      expect(analysis.derived[0].expression).toBe('count * 2');
    });

    it('should extract derived dependencies', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        let multiplier = $state(2);
        let result = $derived(count * multiplier);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived).toHaveLength(1);
      expect(analysis.derived[0].dependencies).toContain('count');
      expect(analysis.derived[0].dependencies).toContain('multiplier');
    });

    it('should extract multiple derived values', () => {
      const script = createScriptBlock(`
        let x = $state(5);
        let y = $state(10);
        let sum = $derived(x + y);
        let product = $derived(x * y);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived).toHaveLength(2);
      expect(analysis.derived[0].name).toBe('sum');
      expect(analysis.derived[1].name).toBe('product');
    });

    it('should handle derived with prop dependencies', () => {
      const script = createScriptBlock(`
        let { initialCount } = $props();
        let doubled = $derived(initialCount * 2);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived).toHaveLength(1);
      expect(analysis.derived[0].dependencies).toContain('initialCount');
    });

    it('should handle complex derived expressions', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        let isEven = $derived(count % 2 === 0);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived).toHaveLength(1);
      expect(analysis.derived[0].expression).toContain('count % 2 === 0');
    });
  });

  describe('Effect extraction', () => {
    it('should extract simple effect', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        $effect(() => {
          console.log('Count changed:', count);
        });
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.effects).toHaveLength(1);
      expect(analysis.effects[0].expression).toBeDefined();
    });

    it('should extract effect dependencies', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        let name = $state("John");
        $effect(() => {
          console.log(count, name);
        });
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.effects).toHaveLength(1);
      expect(analysis.effects[0].dependencies).toContain('count');
      expect(analysis.effects[0].dependencies).toContain('name');
    });

    it('should extract multiple effects', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        $effect(() => {
          console.log('Effect 1');
        });
        $effect(() => {
          console.log('Effect 2');
        });
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.effects).toHaveLength(2);
    });

    it('should handle effects with arrow function expressions', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        $effect(() => console.log(count));
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.effects).toHaveLength(1);
    });
  });

  describe('Function extraction', () => {
    it('should extract simple function', () => {
      const script = createScriptBlock(`
        function greet() {
          console.log('Hello');
        }
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0].name).toBe('greet');
      expect(analysis.functions[0].params).toHaveLength(0);
    });

    it('should extract function with parameters', () => {
      const script = createScriptBlock(`
        function add(a, b) {
          return a + b;
        }
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0].name).toBe('add');
      expect(analysis.functions[0].params).toEqual(['a', 'b']);
    });

    it('should extract function body', () => {
      const script = createScriptBlock(`
        function increment() {
          count++;
        }
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0].body).toContain('count++');
    });

    it('should extract multiple functions', () => {
      const script = createScriptBlock(`
        function increment() {
          count++;
        }
        function decrement() {
          count--;
        }
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.functions).toHaveLength(2);
      expect(analysis.functions[0].name).toBe('increment');
      expect(analysis.functions[1].name).toBe('decrement');
    });

    it('should handle functions with complex bodies', () => {
      const script = createScriptBlock(`
        function processData(data) {
          const result = data.map(x => x * 2);
          return result.filter(x => x > 10);
        }
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.functions).toHaveLength(1);
      expect(analysis.functions[0].body).toContain('map');
      expect(analysis.functions[0].body).toContain('filter');
    });
  });

  describe('Complex scripts', () => {
    it('should analyze script with all rune types', () => {
      const script = createScriptBlock(`
        let { initialValue = 0 } = $props();
        let count = $state(initialValue);
        let doubled = $derived(count * 2);

        $effect(() => {
          console.log('Count changed:', count);
        });

        function increment() {
          count++;
        }

        function decrement() {
          count--;
        }
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(1);
      expect(analysis.state).toHaveLength(1);
      expect(analysis.derived).toHaveLength(1);
      expect(analysis.effects).toHaveLength(1);
      expect(analysis.functions).toHaveLength(2);
    });

    it('should handle empty script', () => {
      const script = createScriptBlock('');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(0);
      expect(analysis.state).toHaveLength(0);
      expect(analysis.derived).toHaveLength(0);
      expect(analysis.effects).toHaveLength(0);
      expect(analysis.functions).toHaveLength(0);
    });

    it('should handle script with only comments', () => {
      const script = createScriptBlock('// This is a comment\n/* Multi-line comment */');
      const analysis = extractRunesFromScript(script);

      expect(analysis.props).toHaveLength(0);
      expect(analysis.state).toHaveLength(0);
    });

    it('should handle script with imports and exports', () => {
      const script = createScriptBlock(`
        import { helper } from './utils';
        let count = $state(0);
        export { count };
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.state).toHaveLength(1);
    });
  });

  describe('Dependency tracking', () => {
    it('should track nested dependencies in derived', () => {
      const script = createScriptBlock(`
        let a = $state(1);
        let b = $state(2);
        let c = $derived(a + b);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived[0].dependencies).toEqual(['a', 'b']);
    });

    it('should not track non-state/prop identifiers', () => {
      const script = createScriptBlock(`
        let count = $state(0);
        let result = $derived(Math.max(count, 10));
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived[0].dependencies).toContain('count');
      expect(analysis.derived[0].dependencies).not.toContain('Math');
    });

    it('should track dependencies in complex expressions', () => {
      const script = createScriptBlock(`
        let x = $state(5);
        let y = $state(10);
        let z = $state(15);
        let sum = $derived(x + y + z);
      `);
      const analysis = extractRunesFromScript(script);

      expect(analysis.derived[0].dependencies).toEqual(['x', 'y', 'z']);
    });
  });
});
