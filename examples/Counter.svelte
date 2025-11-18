<script>
  let { initialCount = 0 } = $props();

  let count = $state(initialCount);

  let doubled = $derived(count * 2);

  $effect(() => {
      console.log('Count changed to:', count);
    });

  function increment() {
      count++;
    }

  function decrement() {
      count--;
    }
</script>

<div class="counter" data-dce-nxg3l5="">
  <h2 data-dce-nxg3l5="">Counter Component</h2>
  <div class="display" data-dce-nxg3l5="">
    <p data-dce-nxg3l5="">
      Count: 
      {count}
    </p>
    <p data-dce-nxg3l5="">
      Doubled: 
      {doubled}
    </p>
  </div>
  <div class="buttons" data-dce-nxg3l5="">
    <button data-dce-nxg3l5="" on:click={decrement}>-</button>
    <button data-dce-nxg3l5="" on:click={increment}>+</button>
  </div>
</div>