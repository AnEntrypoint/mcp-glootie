import astGrep from '@ast-grep/napi';

console.log('Testing AST-grep on Windows...');

const code = `
function hello() {
  const x = 42;
  return x;
}
`;

const root = astGrep.js.parse(code);
console.log('✓ Parsed code successfully');
console.log('Root type:', root.root().kind());

const funcs = root.root().findAll({ rule: { pattern: 'function $NAME() { $$$ }' } });
console.log('✓ Found', funcs.length, 'functions');

const vars = root.root().findAll({ rule: { pattern: 'const $VAR = $VAL' } });
console.log('✓ Found', vars.length, 'const declarations');

console.log('\n✓ AST-grep is fully functional on Windows!');