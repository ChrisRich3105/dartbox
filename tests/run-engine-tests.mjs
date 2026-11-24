// Runs the playroom game-engine tests in Node:  node tests/run-engine-tests.mjs
// (The same tests also run in a browser: import('/test/engine.test.js').then(m => m.run()))
const { run } = await import('../playroom/test/engine.test.js');
const r = run();
for (const f of r.failures) {
  console.error(`FAIL ${f.name}\n     got:  ${JSON.stringify(f.got)}\n     want: ${JSON.stringify(f.want)}`);
}
console.log(`${r.total - r.failed}/${r.total} engine checks passed`);
process.exit(r.failed ? 1 : 0);
