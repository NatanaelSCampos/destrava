import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const summaryTestUrl = new URL('./summary.test.mjs', import.meta.url);
const source = readFileSync(summaryTestUrl, 'utf8');
const importBoundary = source.indexOf('const { summarizeFixture } = await import(candidateUrl.href);');
assert.ok(importBoundary > 0, 'the candidate import boundary must be present');

// Only evaluate the real URL guard. The candidate import and all fixture tests are excluded.
const guardSource = source.slice(0, importBoundary)
  .replace(/^import .*;\r?$/gm, '')
  .replaceAll('import.meta.url', JSON.stringify(summaryTestUrl.href));
assert.doesNotMatch(guardSource, /\bimport\s*\(/, 'the isolated guard must contain no dynamic imports');

const cases = [
  ['default local candidate', undefined, true],
  ['local drive file URL', 'file:///D:/fixture/summary.mjs', true],
  ['localhost file URL', 'file://localhost/D:/fixture/summary.mjs', true],
  ['uppercase localhost URL', 'file://LOCALHOST/D:/fixture/summary.mjs', true],
  ['UNC hostname', 'file://qa.invalid/share/summary.mjs', false],
  ['loopback UNC share', 'file://127.0.0.1/share/summary.mjs', false],
  ['IPv6 loopback UNC share', 'file://[::1]/share/summary.mjs', false],
  ['encoded UNC hostname', 'file://%71%61.invalid/share/summary.mjs', false],
  ['https scheme', 'https://qa.invalid/summary.mjs', false],
  ['http scheme', 'http://qa.invalid/summary.mjs', false],
  ['data scheme', 'data:text/javascript,export default 1', false],
  ['relative explicit path', './summary.mjs', false],
];

for (const [label, configuredUrl, accepted] of cases) {
  test(`local module URL guard: ${label}`, () => {
    const env = configuredUrl === undefined ? {} : { SUMMARY_FIXTURE_MODULE_URL: configuredUrl };
    // No import callback is supplied, and only the prefix preceding import is present.
    const evaluate = () => runInNewContext(guardSource, { process: { env }, URL }, { timeout: 1000 });
    if (accepted) assert.doesNotThrow(evaluate, label);
    else assert.throws(evaluate, label);
  });
}
