import React, { useEffect, useMemo, useState } from 'react';

interface CounterProps {
  initialCount?: any;
}

export function Counter(props: CounterProps) {
  const { initialCount = 0 } = props;

  const [count, setCount] = useState(initialCount);

  const doubled = useMemo(() => count * 2, [count]);

  useEffect(() => {
      console.log('Count changed to:', count);
    }, [count]);

  const increment = () => {
      setCount(count + 1);
    };

  const decrement = () => {
      setCount(count - 1);
    };

  return (
    <div className="counter" data-dce-nxg3l5="">
      <h2 data-dce-nxg3l5="">
        Counter Component
      </h2>
      <div className="display" data-dce-nxg3l5="">
        <p data-dce-nxg3l5="">
          Count: 
          {count}
        </p>
        <p data-dce-nxg3l5="">
          Doubled: 
          {doubled}
        </p>
      </div>
      <div className="buttons" data-dce-nxg3l5="">
        <button data-dce-nxg3l5="" onClick={decrement}>
          -
        </button>
        <button data-dce-nxg3l5="" onClick={increment}>
          +
        </button>
      </div>
    </div>
  );
}