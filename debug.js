const { parse, transform } = require('./dist/index');
const fs = require('fs');

const source = fs.readFileSync('examples/Counter.dce', 'utf-8');
const ast = parse(source, { filename: 'Counter.dce' });
const ir = transform(ast);

console.log(JSON.stringify(ir, null, 2));
