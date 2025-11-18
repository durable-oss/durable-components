/**
 * Comprehensive tests for Svelte 5 Generator
 */

import { compile } from '../index';

describe('Svelte 5 Generator', () => {
  describe('Basic compilation', () => {
    it('should compile a simple counter component', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<template>
  <button on:click={increment}>
    Count: {count}
  </button>
</template>

<style>
  button {
    padding: 1rem;
  }
</style>
      `.trim();

      const result = compile(source, {
        filename: 'Counter.dce',
        target: 'svelte'
      });

      expect(result.js.code).toBeDefined();
      expect(result.js.code).toContain('<script>');
      expect(result.js.code).toContain('let count = $state(0);');
      expect(result.js.code).toContain('function increment()');
      expect(result.js.code).toContain('count++;');
      expect(result.js.code).toContain('on:click={increment}');
      expect(result.js.code).toContain('{count}');
    });

    it('should compile a component with only a template', () => {
      const source = `
<template>
  <div>Static content</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Static.dce',
        target: 'svelte'
      });

      expect(result.js.code).toBeDefined();
      expect(result.js.code).toContain('<div>Static content</div>');
      expect(result.js.code).not.toContain('<script>');
    });

    it('should compile a component with nested elements', () => {
      const source = `
<template>
  <div class="container">
    <header>
      <h1>Title</h1>
    </header>
    <main>
      <p>Content</p>
    </main>
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Layout.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('class="container"');
      expect(result.js.code).toContain('<header>');
      expect(result.js.code).toContain('<h1>Title</h1>');
      expect(result.js.code).toContain('<main>');
      expect(result.js.code).toContain('<p>Content</p>');
    });
  });

  describe('Props', () => {
    it('should compile a component with simple props', () => {
      const source = `
<script>
  let { name } = $props();
</script>

<template>
  <h1>Hello, {name}!</h1>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Greeting.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let { name } = $props();');
      expect(result.js.code).toContain('{name}');
    });

    it('should compile a component with props with default values', () => {
      const source = `
<script>
  let { name = 'World', count = 0 } = $props();
</script>

<template>
  <p>Hello, {name}! Count: {count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'GreetingWithDefaults.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let { name = \'World\', count = 0 } = $props();');
      expect(result.js.code).toContain('{name}');
      expect(result.js.code).toContain('{count}');
    });

    it('should compile a component with typed props', () => {
      const source = `
<script>
  let { items = [] } = $props();
</script>

<template>
  <div>Items: {items.length}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ItemList.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let { items = [] } = $props();');
      expect(result.js.code).toContain('{items.length}');
    });

    it('should compile a component using props in state initialization', () => {
      const source = `
<script>
  let { initialCount = 0 } = $props();
  let count = $state(initialCount);
</script>

<template>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'PropsInState.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let { initialCount = 0 } = $props();');
      expect(result.js.code).toContain('let count = $state(initialCount);');
    });
  });

  describe('State', () => {
    it('should compile a component with primitive state', () => {
      const source = `
<script>
  let count = $state(0);
  let name = $state('Alice');
  let active = $state(true);
</script>

<template>
  <div>{count} - {name} - {active}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'PrimitiveState.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let count = $state(0);');
      expect(result.js.code).toContain('let name = $state(\'Alice\');');
      expect(result.js.code).toContain('let active = $state(true);');
    });

    it('should compile a component with object state', () => {
      const source = `
<script>
  let user = $state({ name: 'Alice', age: 30 });
</script>

<template>
  <p>{user.name} is {user.age} years old</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ObjectState.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let user = $state({ name: \'Alice\', age: 30 });');
      expect(result.js.code).toContain('{user.name}');
      expect(result.js.code).toContain('{user.age}');
    });

    it('should compile a component with array state', () => {
      const source = `
<script>
  let items = $state(['a', 'b', 'c']);
</script>

<template>
  <p>Items: {items.length}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ArrayState.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let items = $state([\'a\', \'b\', \'c\']);');
      expect(result.js.code).toContain('{items.length}');
    });
  });

  describe('Derived state', () => {
    it('should compile a component with simple derived state', () => {
      const source = `
<script>
  let count = $state(5);
  let doubled = $derived(count * 2);
</script>

<template>
  <p>Count: {count}, Doubled: {doubled}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SimpleDerived.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let count = $state(5);');
      expect(result.js.code).toContain('let doubled = $derived(count * 2);');
      expect(result.js.code).toContain('{count}');
      expect(result.js.code).toContain('{doubled}');
    });

    it('should compile a component with complex derived expressions', () => {
      const source = `
<script>
  let firstName = $state('John');
  let lastName = $state('Doe');
  let fullName = $derived(firstName + ' ' + lastName);
</script>

<template>
  <p>{fullName}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ComplexDerived.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let firstName = $state(\'John\');');
      expect(result.js.code).toContain('let lastName = $state(\'Doe\');');
      expect(result.js.code).toContain('let fullName = $derived(firstName + \' \' + lastName);');
    });

    it('should compile a component with multiple derived values', () => {
      const source = `
<script>
  let count = $state(10);
  let doubled = $derived(count * 2);
  let tripled = $derived(count * 3);
  let quadrupled = $derived(count * 4);
</script>

<template>
  <div>{doubled} - {tripled} - {quadrupled}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'MultipleDerived.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let doubled = $derived(count * 2);');
      expect(result.js.code).toContain('let tripled = $derived(count * 3);');
      expect(result.js.code).toContain('let quadrupled = $derived(count * 4);');
    });
  });

  describe('Effects', () => {
    it('should compile a component with simple effects', () => {
      const source = `
<script>
  let count = $state(0);

  $effect(() => {
    console.log('Count changed:', count);
  });
</script>

<template>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SimpleEffect.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('$effect(() => {');
      expect(result.js.code).toContain('console.log(\'Count changed:\', count);');
      expect(result.js.code).toContain('});');
    });

    it('should compile a component with multiple effects', () => {
      const source = `
<script>
  let count = $state(0);
  let name = $state('Alice');

  $effect(() => {
    console.log('Count:', count);
  });

  $effect(() => {
    console.log('Name:', name);
  });
</script>

<template>
  <p>{count} - {name}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'MultipleEffects.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('console.log(\'Count:\', count);');
      expect(result.js.code).toContain('console.log(\'Name:\', name);');
    });

    it('should compile a component with complex effect logic', () => {
      const source = `
<script>
  let count = $state(0);

  $effect(() => {
    if (count > 10) {
      console.log('Count is high');
    } else {
      console.log('Count is low');
    }
  });
</script>

<template>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ComplexEffect.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('$effect(() => {');
      expect(result.js.code).toContain('if (count > 10)');
    });
  });

  describe('Functions', () => {
    it('should compile a component with simple functions', () => {
      const source = `
<script>
  let count = $state(0);

  function increment() {
    count++;
  }

  function decrement() {
    count--;
  }
</script>

<template>
  <button on:click={increment}>+</button>
  <button on:click={decrement}>-</button>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SimpleFunctions.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('function increment()');
      expect(result.js.code).toContain('count++;');
      expect(result.js.code).toContain('function decrement()');
      expect(result.js.code).toContain('count--;');
    });

    it('should compile a component with functions with parameters', () => {
      const source = `
<script>
  let count = $state(0);

  function add(amount) {
    count = count + amount;
  }
</script>

<template>
  <button on:click={() => add(5)}>Add 5</button>
  <p>{count}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'FunctionWithParams.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('function add(amount)');
      expect(result.js.code).toContain('count = count + amount;');
    });

    it('should compile a component with complex function logic', () => {
      const source = `
<script>
  let items = $state([]);

  function addItem(item) {
    items = [...items, item];
  }

  function removeItem(index) {
    items = items.filter((_, i) => i !== index);
  }
</script>

<template>
  <div>Items: {items.length}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ComplexFunctions.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('function addItem(item)');
      expect(result.js.code).toContain('items = [...items, item];');
      expect(result.js.code).toContain('function removeItem(index)');
      expect(result.js.code).toContain('items = items.filter((_, i) => i !== index);');
    });
  });

  describe('Event handlers', () => {
    it('should compile a component with click events', () => {
      const source = `
<script>
  function handleClick() {
    console.log('Clicked!');
  }
</script>

<template>
  <button on:click={handleClick}>Click me</button>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ClickEvent.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('<button on:click={handleClick}>Click me</button>');
    });

    it('should compile a component with multiple event types', () => {
      const source = `
<script>
  function handleClick() {}
  function handleMouseOver() {}
  function handleFocus() {}
</script>

<template>
  <button on:click={handleClick} on:mouseover={handleMouseOver} on:focus={handleFocus}>
    Hover me
  </button>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'MultipleEvents.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('on:click={handleClick}');
      expect(result.js.code).toContain('on:mouseover={handleMouseOver}');
      expect(result.js.code).toContain('on:focus={handleFocus}');
    });

    it('should compile a component with inline event handlers', () => {
      const source = `
<script>
  let count = $state(0);
</script>

<template>
  <button on:click={count++}>Increment</button>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'InlineEvent.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('on:click={count++}');
    });
  });

  describe('Conditional rendering', () => {
    it('should compile a component with if blocks', () => {
      const source = `
<script>
  let show = $state(true);
</script>

<template>
  {#if show}
    <p>Visible</p>
  {/if}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SimpleIf.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#if show}');
      expect(result.js.code).toContain('<p>Visible</p>');
      expect(result.js.code).toContain('{/if}');
    });

    it('should compile a component with if-else blocks', () => {
      const source = `
<script>
  let show = $state(true);
</script>

<template>
  {#if show}
    <p>Visible</p>
  {:else}
    <p>Hidden</p>
  {/if}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'IfElse.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#if show}');
      expect(result.js.code).toContain('<p>Visible</p>');
      expect(result.js.code).toContain('{:else}');
      expect(result.js.code).toContain('<p>Hidden</p>');
      expect(result.js.code).toContain('{/if}');
    });

    it('should compile a component with nested if blocks', () => {
      const source = `
<script>
  let outer = $state(true);
  let inner = $state(true);
</script>

<template>
  {#if outer}
    <div>
      {#if inner}
        <p>Both true</p>
      {/if}
    </div>
  {/if}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'NestedIf.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#if outer}');
      expect(result.js.code).toContain('{#if inner}');
      expect(result.js.code).toContain('Both true');
    });

    it('should compile a component with complex conditions', () => {
      const source = `
<script>
  let count = $state(5);
</script>

<template>
  {#if count > 10}
    <p>High</p>
  {:else}
    <p>Low</p>
  {/if}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'ComplexCondition.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#if count > 10}');
    });
  });

  describe('List rendering', () => {
    it('should compile a component with simple each blocks', () => {
      const source = `
<script>
  let items = $state(['a', 'b', 'c']);
</script>

<template>
  {#each items as item}
    <li>{item}</li>
  {/each}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SimpleEach.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#each items as item}');
      expect(result.js.code).toContain('<li>{item}</li>');
      expect(result.js.code).toContain('{/each}');
    });

    it('should compile a component with each blocks with index', () => {
      const source = `
<script>
  let items = $state(['a', 'b', 'c']);
</script>

<template>
  {#each items as item, i}
    <li>{i}: {item}</li>
  {/each}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'EachWithIndex.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#each items as item, i}');
      expect(result.js.code).toContain('{i}');
      expect(result.js.code).toContain('{item}');
    });

    it('should compile a component with each blocks with complex items', () => {
      const source = `
<script>
  let items = $state([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
</script>

<template>
  {#each items as item}
    <li>{item.name}</li>
  {/each}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'EachWithComplexItems.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#each items as item}');
      expect(result.js.code).toContain('{item.name}');
    });

    it('should compile a component with nested each blocks', () => {
      const source = `
<script>
  let matrix = $state([[1, 2], [3, 4]]);
</script>

<template>
  {#each matrix as row}
    <div>
      {#each row as cell}
        <span>{cell}</span>
      {/each}
    </div>
  {/each}
</template>
      `.trim();

      const result = compile(source, {
        filename: 'NestedEach.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('{#each matrix as row}');
      expect(result.js.code).toContain('{#each row as cell}');
    });
  });

  describe('Two-way binding', () => {
    it('should compile a component with input binding', () => {
      const source = `
<script>
  let name = $state('');
</script>

<template>
  <input bind:value={name} />
  <p>Hello, {name}!</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'InputBinding.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('bind:value={name}');
      expect(result.js.code).toContain('{name}');
    });

    it('should compile a component with checkbox binding', () => {
      const source = `
<script>
  let checked = $state(false);
</script>

<template>
  <input type="checkbox" bind:checked={checked} />
  <p>Checked: {checked}</p>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'CheckboxBinding.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('bind:checked={checked}');
    });
  });

  describe('Slots', () => {
    it('should compile a component with default slot', () => {
      const source = `
<template>
  <div class="wrapper">
    <slot />
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SlotComponent.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('<slot />');
    });

    it('should compile a component with named slots', () => {
      const source = `
<template>
  <div>
    <header>
      <slot name="header" />
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'NamedSlots.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('<slot name="header" />');
      expect(result.js.code).toContain('<slot />');
    });
  });

  describe('Complex scenarios', () => {
    it('should compile a full-featured todo list component', () => {
      const source = `
<script>
  let { initialTodos = [] } = $props();
  let todos = $state(initialTodos);
  let newTodo = $state('');
  let filter = $state('all');

  let filteredTodos = $derived(
    filter === 'all' ? todos : todos.filter(t => t.completed === (filter === 'completed'))
  );

  function addTodo() {
    if (newTodo.trim()) {
      todos = [...todos, { id: Date.now(), text: newTodo, completed: false }];
      newTodo = '';
    }
  }

  function toggleTodo(id) {
    todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  }

  function removeTodo(id) {
    todos = todos.filter(t => t.id !== id);
  }

  $effect(() => {
    console.log('Todos updated:', todos.length);
  });
</script>

<template>
  <div class="todo-app">
    <input bind:value={newTodo} />
    <button on:click={addTodo}>Add</button>

    <div>
      <button on:click={filter = 'all'}>All</button>
      <button on:click={filter = 'active'}>Active</button>
      <button on:click={filter = 'completed'}>Completed</button>
    </div>

    {#each filteredTodos as todo}
      <div>
        <input type="checkbox" bind:checked={todo.completed} on:change={toggleTodo(todo.id)} />
        <span>{todo.text}</span>
        <button on:click={removeTodo(todo.id)}>Delete</button>
      </div>
    {/each}

    {#if todos.length === 0}
      <p>No todos yet!</p>
    {/if}
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'TodoList.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let { initialTodos = [] } = $props();');
      expect(result.js.code).toContain('let todos = $state(initialTodos);');
      expect(result.js.code).toContain('let filteredTodos = $derived(');
      expect(result.js.code).toContain('function addTodo()');
      expect(result.js.code).toContain('function toggleTodo(id)');
      expect(result.js.code).toContain('function removeTodo(id)');
      expect(result.js.code).toContain('$effect(() => {');
      expect(result.js.code).toContain('{#each filteredTodos as todo}');
      expect(result.js.code).toContain('{#if todos.length === 0}');
    });

    it('should compile a counter with multiple features', () => {
      const source = `
<script>
  let { initialCount = 0, step = 1 } = $props();
  let count = $state(initialCount);
  let doubled = $derived(count * 2);
  let history = $state([]);

  function increment() {
    count = count + step;
    history = [...history, count];
  }

  function decrement() {
    count = count - step;
    history = [...history, count];
  }

  function reset() {
    count = initialCount;
    history = [];
  }

  $effect(() => {
    if (count > 100) {
      console.warn('Count is very high!');
    }
  });
</script>

<template>
  <div>
    <button on:click={decrement}>-</button>
    <span>{count}</span>
    <button on:click={increment}>+</button>
    <button on:click={reset}>Reset</button>

    <p>Doubled: {doubled}</p>

    {#if history.length > 0}
      <div>
        <h3>History:</h3>
        {#each history as value, i}
          <span>{i + 1}: {value}</span>
        {/each}
      </div>
    {/if}
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'AdvancedCounter.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let { initialCount = 0, step = 1 } = $props();');
      expect(result.js.code).toContain('let count = $state(initialCount);');
      expect(result.js.code).toContain('let doubled = $derived(count * 2);');
      expect(result.js.code).toContain('let history = $state([]);');
      expect(result.js.code).toContain('function increment()');
      expect(result.js.code).toContain('function decrement()');
      expect(result.js.code).toContain('function reset()');
      expect(result.js.code).toContain('$effect(() => {');
      expect(result.js.code).toContain('{#if history.length > 0}');
      expect(result.js.code).toContain('{#each history as value, i}');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty state values', () => {
      const source = `
<script>
  let text = $state('');
  let items = $state([]);
  let obj = $state({});
</script>

<template>
  <div>{text || 'Empty'}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'EmptyState.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('let text = $state(\'\');');
      expect(result.js.code).toContain('let items = $state([]);');
      expect(result.js.code).toContain('let obj = $state({});');
    });

    it('should handle components with only functions', () => {
      const source = `
<script>
  function helper() {
    return 'Hello';
  }
</script>

<template>
  <div>{helper()}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'OnlyFunctions.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('function helper()');
      expect(result.js.code).toContain('{helper()}');
    });

    it('should handle self-closing elements', () => {
      const source = `
<template>
  <div>
    <img src="test.jpg" />
    <br />
    <input />
  </div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'SelfClosing.dce',
        target: 'svelte'
      });

      expect(result.js.code).toContain('<img');
      expect(result.js.code).toContain('<br />');
      expect(result.js.code).toContain('<input />');
    });
  });

  describe('Metadata', () => {
    it('should include component metadata', () => {
      const source = `
<script>
  let { name, age, email } = $props();
</script>

<template>
  <div>{name} - {age} - {email}</div>
</template>
      `.trim();

      const result = compile(source, {
        filename: 'Metadata.dce',
        target: 'svelte'
      });

      expect(result.meta).toBeDefined();
      expect(result.meta?.name).toBe('Metadata');
      expect(result.meta?.props).toContain('name');
      expect(result.meta?.props).toContain('age');
      expect(result.meta?.props).toContain('email');
    });
  });
});
