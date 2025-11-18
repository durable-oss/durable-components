/**
 * E2E Component Tests
 *
 * Comprehensive testing of various ShadCN-inspired components
 * to verify they compile correctly to React and produce working code.
 */

import { compile } from '../index';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper to load fixture files
function loadFixture(name: string): string {
  const path = join(__dirname, 'fixtures', `${name}.dce`);
  return readFileSync(path, 'utf-8');
}

// Helper to verify common React patterns
function expectReactComponent(code: string, componentName: string) {
  expect(code).toContain(`export function ${componentName}`);
  expect(code).toContain('import React');
}

describe('E2E Component Tests', () => {
  describe('Button Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Button');
      result = compile(source, {
        filename: 'Button.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Button component', () => {
      expectReactComponent(result.js.code, 'Button');
    });

    it('should generate props interface with all props', () => {
      expect(result.js.code).toContain('interface ButtonProps');
      expect(result.js.code).toContain('variant');
      expect(result.js.code).toContain('size');
      expect(result.js.code).toContain('disabled');
      expect(result.js.code).toContain('loading');
      expect(result.js.code).toContain('onClick');
    });

    it('should generate state hooks', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('isPressed');
      expect(result.js.code).toContain('clickCount');
    });

    it('should generate derived values with useMemo', () => {
      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('variantClass');
      expect(result.js.code).toContain('sizeClass');
      expect(result.js.code).toContain('isDisabled');
    });

    it('should generate effects with useEffect', () => {
      expect(result.js.code).toContain('useEffect');
      expect(result.js.code).toContain('clickCount');
    });

    it('should generate event handler functions', () => {
      expect(result.js.code).toContain('handleClick');
      expect(result.js.code).toContain('handleMouseDown');
      expect(result.js.code).toContain('handleMouseUp');
    });

    it('should generate conditional rendering for loading state', () => {
      expect(result.js.code).toContain('loading');
      expect(result.js.code).toContain('spinner');
    });

    it('should generate scoped CSS with all variants', () => {
      expect(result.css?.code).toContain('[data-dce-');
      expect(result.css?.code).toContain('.btn');
      expect(result.css?.code).toContain('.btn-primary');
      expect(result.css?.code).toContain('.btn-secondary');
      expect(result.css?.code).toContain('.btn-outline');
      expect(result.css?.code).toContain('.btn-ghost');
      expect(result.css?.code).toContain('.btn-destructive');
      expect(result.css?.code).toContain('.btn-sm');
      expect(result.css?.code).toContain('.btn-md');
      expect(result.css?.code).toContain('.btn-lg');
    });

    it('should include animations in CSS', () => {
      expect(result.css?.code).toContain('@keyframes spin');
    });
  });

  describe('Card Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Card');
      result = compile(source, {
        filename: 'Card.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Card component', () => {
      expectReactComponent(result.js.code, 'Card');
    });

    it('should generate props interface', () => {
      expect(result.js.code).toContain('interface CardProps');
      expect(result.js.code).toContain('title');
      expect(result.js.code).toContain('description');
      expect(result.js.code).toContain('footer');
      expect(result.js.code).toContain('hoverable');
      expect(result.js.code).toContain('clickable');
    });

    it('should generate state for hover tracking', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('isHovered');
      expect(result.js.code).toContain('isExpanded');
    });

    it('should generate derived cardClass', () => {
      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('cardClass');
    });

    it('should generate event handlers', () => {
      expect(result.js.code).toContain('handleClick');
      expect(result.js.code).toContain('handleMouseEnter');
      expect(result.js.code).toContain('handleMouseLeave');
      expect(result.js.code).toContain('toggleExpanded');
    });

    it('should generate conditional rendering for optional sections', () => {
      expect(result.js.code).toContain('title');
      expect(result.js.code).toContain('description');
      expect(result.js.code).toContain('footer');
    });

    it('should generate scoped CSS for card structure', () => {
      expect(result.css?.code).toContain('.card');
      expect(result.css?.code).toContain('.card-header');
      expect(result.css?.code).toContain('.card-title');
      expect(result.css?.code).toContain('.card-description');
      expect(result.css?.code).toContain('.card-content');
      expect(result.css?.code).toContain('.card-footer');
    });
  });

  describe('Dialog Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Dialog');
      result = compile(source, {
        filename: 'Dialog.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Dialog component', () => {
      expectReactComponent(result.js.code, 'Dialog');
    });

    it('should generate props interface', () => {
      expect(result.js.code).toContain('interface DialogProps');
      expect(result.js.code).toContain('open');
      expect(result.js.code).toContain('title');
      expect(result.js.code).toContain('description');
      expect(result.js.code).toContain('showClose');
      expect(result.js.code).toContain('onClose');
      expect(result.js.code).toContain('onOpenChange');
    });

    it('should generate state management', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('isOpen');
      expect(result.js.code).toContain('isAnimating');
    });

    it('should generate multiple effects', () => {
      expect(result.js.code).toContain('useEffect');
    });

    it('should generate dialog control functions', () => {
      expect(result.js.code).toContain('close');
      expect(result.js.code).toContain('handleOverlayClick');
      expect(result.js.code).toContain('handleEscape');
    });

    it('should generate scoped CSS with overlay and animations', () => {
      expect(result.css?.code).toContain('.dialog-overlay');
      expect(result.css?.code).toContain('.dialog');
      expect(result.css?.code).toContain('.dialog-header');
      expect(result.css?.code).toContain('.dialog-content');
      expect(result.css?.code).toContain('.dialog-footer');
      expect(result.css?.code).toContain('.dialog-close');
    });

    it('should include animations in CSS', () => {
      expect(result.css?.code).toContain('@keyframes fadeIn');
      expect(result.css?.code).toContain('@keyframes slideIn');
      expect(result.css?.code).toContain('@keyframes slideOut');
    });
  });

  describe('Input Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Input');
      result = compile(source, {
        filename: 'Input.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Input component', () => {
      expectReactComponent(result.js.code, 'Input');
    });

    it('should generate comprehensive props interface', () => {
      expect(result.js.code).toContain('interface InputProps');
      expect(result.js.code).toContain('value');
      expect(result.js.code).toContain('type');
      expect(result.js.code).toContain('placeholder');
      expect(result.js.code).toContain('label');
      expect(result.js.code).toContain('error');
      expect(result.js.code).toContain('disabled');
      expect(result.js.code).toContain('required');
      expect(result.js.code).toContain('maxLength');
    });

    it('should generate state for input tracking', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('inputValue');
      expect(result.js.code).toContain('isFocused');
      expect(result.js.code).toContain('isDirty');
      expect(result.js.code).toContain('characterCount');
    });

    it('should generate derived values', () => {
      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('hasError');
      expect(result.js.code).toContain('showCharCount');
      expect(result.js.code).toContain('inputClass');
      expect(result.js.code).toContain('isValid');
    });

    it('should generate effects for value sync', () => {
      expect(result.js.code).toContain('useEffect');
    });

    it('should generate all input event handlers', () => {
      expect(result.js.code).toContain('handleInput');
      expect(result.js.code).toContain('handleChange');
      expect(result.js.code).toContain('handleFocus');
      expect(result.js.code).toContain('handleBlur');
    });

    it('should generate scoped CSS for input states', () => {
      expect(result.css?.code).toContain('.input-wrapper');
      expect(result.css?.code).toContain('.input-label');
      expect(result.css?.code).toContain('.input');
      expect(result.css?.code).toContain('.required');
      expect(result.css?.code).toContain('.char-count');
      expect(result.css?.code).toContain('.error-message');
      expect(result.css?.code).toContain('.focused');
      expect(result.css?.code).toContain('.error');
      expect(result.css?.code).toContain('.disabled');
    });
  });

  describe('Accordion Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Accordion');
      result = compile(source, {
        filename: 'Accordion.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Accordion component', () => {
      expectReactComponent(result.js.code, 'Accordion');
    });

    it('should generate props interface', () => {
      expect(result.js.code).toContain('interface AccordionProps');
      expect(result.js.code).toContain('items');
      expect(result.js.code).toContain('allowMultiple');
      expect(result.js.code).toContain('defaultOpen');
    });

    it('should generate state for accordion tracking', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('openItems');
    });

    it('should generate derived values for items', () => {
      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('itemsWithState');
    });

    it('should generate accordion control functions', () => {
      expect(result.js.code).toContain('toggleItem');
      expect(result.js.code).toContain('isItemOpen');
    });

    it('should generate list rendering with map', () => {
      expect(result.js.code).toContain('.map');
    });

    it('should generate scoped CSS for accordion structure', () => {
      expect(result.css?.code).toContain('.accordion');
      expect(result.css?.code).toContain('.accordion-item');
      expect(result.css?.code).toContain('.accordion-trigger');
      expect(result.css?.code).toContain('.accordion-title');
      expect(result.css?.code).toContain('.accordion-icon');
      expect(result.css?.code).toContain('.accordion-content');
    });

    it('should include animations', () => {
      expect(result.css?.code).toContain('@keyframes slideDown');
    });
  });

  describe('Tabs Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Tabs');
      result = compile(source, {
        filename: 'Tabs.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Tabs component', () => {
      expectReactComponent(result.js.code, 'Tabs');
    });

    it('should generate props interface', () => {
      expect(result.js.code).toContain('interface TabsProps');
      expect(result.js.code).toContain('tabs');
      expect(result.js.code).toContain('defaultTab');
      expect(result.js.code).toContain('orientation');
      expect(result.js.code).toContain('onTabChange');
    });

    it('should generate state management', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('activeTab');
      expect(result.js.code).toContain('tabHistory');
    });

    it('should generate multiple derived values', () => {
      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('currentTab');
      expect(result.js.code).toContain('isVertical');
      expect(result.js.code).toContain('tabsClass');
      expect(result.js.code).toContain('visitedTabs');
    });

    it('should generate tab navigation functions', () => {
      expect(result.js.code).toContain('selectTab');
      expect(result.js.code).toContain('nextTab');
      expect(result.js.code).toContain('prevTab');
      expect(result.js.code).toContain('handleKeyDown');
    });

    it('should generate scoped CSS for tabs layout', () => {
      expect(result.css?.code).toContain('.tabs');
      expect(result.css?.code).toContain('.tabs-list');
      expect(result.css?.code).toContain('.tab');
      expect(result.css?.code).toContain('.tabs-content');
      expect(result.css?.code).toContain('.tab-panel');
      expect(result.css?.code).toContain('.horizontal');
      expect(result.css?.code).toContain('.vertical');
    });

    it('should include animations', () => {
      expect(result.css?.code).toContain('@keyframes fadeIn');
    });
  });

  describe('Alert Component', () => {
    let source: string;
    let result: any;

    beforeAll(() => {
      source = loadFixture('Alert');
      result = compile(source, {
        filename: 'Alert.dce',
        target: 'react',
        style: 'scoped'
      });
    });

    it('should compile successfully', () => {
      expect(result.js.code).toBeDefined();
      expect(result.css).toBeDefined();
    });

    it('should export Alert component', () => {
      expectReactComponent(result.js.code, 'Alert');
    });

    it('should generate props interface', () => {
      expect(result.js.code).toContain('interface AlertProps');
      expect(result.js.code).toContain('variant');
      expect(result.js.code).toContain('title');
      expect(result.js.code).toContain('message');
      expect(result.js.code).toContain('dismissible');
      expect(result.js.code).toContain('icon');
      expect(result.js.code).toContain('onDismiss');
    });

    it('should generate state management', () => {
      expect(result.js.code).toContain('useState');
      expect(result.js.code).toContain('isVisible');
      expect(result.js.code).toContain('isDismissing');
    });

    it('should generate derived values for variants', () => {
      expect(result.js.code).toContain('useMemo');
      expect(result.js.code).toContain('alertClass');
      expect(result.js.code).toContain('iconSymbol');
    });

    it('should generate dismiss function', () => {
      expect(result.js.code).toContain('dismiss');
    });

    it('should generate scoped CSS for all alert variants', () => {
      expect(result.css?.code).toContain('.alert');
      expect(result.css?.code).toContain('.alert-icon');
      expect(result.css?.code).toContain('.alert-content');
      expect(result.css?.code).toContain('.alert-title');
      expect(result.css?.code).toContain('.alert-message');
      expect(result.css?.code).toContain('.alert-dismiss');
      expect(result.css?.code).toContain('.alert-info');
      expect(result.css?.code).toContain('.alert-success');
      expect(result.css?.code).toContain('.alert-warning');
      expect(result.css?.code).toContain('.alert-error');
    });

    it('should include animations', () => {
      expect(result.css?.code).toContain('@keyframes slideIn');
      expect(result.css?.code).toContain('@keyframes slideOut');
    });
  });

  describe('Cross-Component Patterns', () => {
    it('all components should use TypeScript interfaces', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.js.code).toContain(`interface ${name}Props`);
      });
    });

    it('all components should use React hooks appropriately', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.js.code).toContain('useState');
      });
    });

    it('all components should generate scoped CSS correctly', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react',
          style: 'scoped'
        });

        expect(result.css).toBeDefined();
        expect(result.css?.code).toContain('[data-dce-');
      });
    });

    it('components with effects should use useEffect', () => {
      const componentsWithEffects = ['Button', 'Dialog', 'Input', 'Accordion', 'Tabs'];

      componentsWithEffects.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.js.code).toContain('useEffect');
      });
    });

    it('components with derived state should use useMemo', () => {
      const componentsWithDerived = ['Button', 'Card', 'Input', 'Accordion', 'Tabs', 'Alert'];

      componentsWithDerived.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.js.code).toContain('useMemo');
      });
    });

    it('components with animations should include keyframes', () => {
      const componentsWithAnimations = ['Button', 'Dialog', 'Accordion', 'Tabs', 'Alert'];

      componentsWithAnimations.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react',
          style: 'scoped'
        });

        expect(result.css?.code).toContain('@keyframes');
      });
    });
  });

  describe('Code Quality Checks', () => {
    it('all components should not have syntax errors in generated code', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);

        expect(() => {
          compile(source, {
            filename: `${name}.dce`,
            target: 'react',
            style: 'scoped'
          });
        }).not.toThrow();
      });
    });

    it('all components should have valid React imports', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.js.code).toMatch(/import React.*from ['"]react['"]/);
      });
    });

    it('all components should export their main function', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.js.code).toContain(`export function ${name}`);
      });
    });
  });

  describe('Metadata Generation', () => {
    it('should generate correct metadata for all components', () => {
      const components = ['Button', 'Card', 'Dialog', 'Input', 'Accordion', 'Tabs', 'Alert'];

      components.forEach(name => {
        const source = loadFixture(name);
        const result = compile(source, {
          filename: `${name}.dce`,
          target: 'react'
        });

        expect(result.meta).toBeDefined();
        expect(result.meta?.name).toBe(name);
        expect(result.meta?.props).toBeDefined();
        expect(Array.isArray(result.meta?.props)).toBe(true);
      });
    });
  });
});
