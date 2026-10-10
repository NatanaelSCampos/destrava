import test from 'node:test';
import assert from 'node:assert/strict';

// The suite is derived from the Lead's fixture contract, before implementation access.
// An explicit candidate must be a local file URL; no remote imports are permitted.
const configuredModuleUrl = process.env.SUMMARY_FIXTURE_MODULE_URL;
const candidateUrl = configuredModuleUrl === undefined
  ? new URL('./summary.mjs', import.meta.url)
  : new URL(configuredModuleUrl);
if (candidateUrl.protocol !== 'file:' || !['', 'localhost'].includes(candidateUrl.hostname)) {
  throw new Error('SUMMARY_FIXTURE_MODULE_URL must be a local file: URL');
}
const { summarizeFixture } = await import(candidateUrl.href);

function rejects(input) {
  assert.throws(() => summarizeFixture(input));
}

test('exports summarizeFixture as a function', () => {
  assert.equal(typeof summarizeFixture, 'function');
});

test('empty input returns the exact empty summary', () => {
  assert.deepStrictEqual(summarizeFixture([]), { total: 0, enabled: 0, ids: [] });
});

test('mixed flags and IDs return the exact summary in default JS string order', () => {
  const input = [
    { id: 'b', enabled: true },
    { id: '2', enabled: false },
    { id: 'a', enabled: true },
    { id: '10', enabled: true },
    { id: 'A', enabled: false },
  ];
  assert.deepStrictEqual(summarizeFixture(input), {
    total: 5,
    enabled: 3,
    ids: ['10', '2', 'A', 'a', 'b'],
  });
});

test('all disabled items count as zero enabled', () => {
  assert.deepStrictEqual(summarizeFixture([
    { id: 'z', enabled: false },
    { id: 'a', enabled: false },
  ]), { total: 2, enabled: 0, ids: ['a', 'z'] });
});

test('all enabled items count every item', () => {
  assert.deepStrictEqual(summarizeFixture([
    { id: 'z', enabled: true },
    { id: 'a', enabled: true },
  ]), { total: 2, enabled: 2, ids: ['a', 'z'] });
});

test('accepts exactly 100 unique items and computes the complete summary', () => {
  const expectedIds = Array.from({ length: 100 }, (_, index) => `id-${String(index).padStart(3, '0')}`);
  const input = Array.from({ length: 100 }, (_, index) => {
    const value = 99 - index;
    return { id: `id-${String(value).padStart(3, '0')}`, enabled: value % 3 === 0 };
  });
  assert.deepStrictEqual(summarizeFixture(input), {
    total: 100,
    enabled: 34,
    ids: expectedIds,
  });
});

test('rejects 101 otherwise valid unique items', () => {
  rejects(Array.from({ length: 101 }, (_, index) => ({ id: `id-${index}`, enabled: true })));
});

const invalidRoots = [
  ['undefined', undefined],
  ['null', null],
  ['plain object', {}],
  ['array-like object', { 0: { id: 'x', enabled: true }, length: 1 }],
  ['string', 'x'],
  ['empty string', ''],
  ['number', 1],
  ['NaN', NaN],
  ['boolean', false],
  ['function', () => []],
  ['Set', new Set([{ id: 'x', enabled: true }])],
  ['typed array', new Uint8Array(1)],
];
for (const [label, input] of invalidRoots) {
  test(`rejects non-array input: ${label}`, () => rejects(input));
}

const invalidItems = [
  ['null', null],
  ['undefined', undefined],
  ['false', false],
  ['true', true],
  ['number', 1],
  ['NaN', NaN],
  ['empty string', ''],
  ['string', 'x'],
  ['empty array', []],
  ['array with values', ['x', true]],
  ['function', () => {}],
  ['Set without required properties', new Set()],
];
for (const [label, item] of invalidItems) {
  test(`rejects invalid item format: ${label}`, () => rejects([item]));
}

test('rejects holes in an array instead of silently skipping them', () => {
  rejects(new Array(1));
  const input = [
    { id: 'a', enabled: true },
    { id: 'b', enabled: false },
    { id: 'c', enabled: true },
  ];
  delete input[1];
  rejects(input);
});

const missingFields = [
  ['both fields', {}],
  ['enabled', { id: 'x' }],
  ['id', { enabled: true }],
];
for (const [label, item] of missingFields) {
  test(`rejects missing fields: ${label}`, () => rejects([item]));
}

test('rejects an extra enumerable string property', () => {
  rejects([{ id: 'x', enabled: true, extra: 0 }]);
});

test('rejects an extra symbol property', () => {
  rejects([{ id: 'x', enabled: true, [Symbol('extra')]: 0 }]);
});

test('rejects an extra non-enumerable property', () => {
  const item = { id: 'x', enabled: true };
  Object.defineProperty(item, 'extra', { value: 0, enumerable: false });
  rejects([item]);
});

test('required fields must be own properties', () => {
  rejects([Object.create({ id: 'x', enabled: true })]);
  const inheritedId = Object.create({ id: 'x' });
  inheritedId.enabled = true;
  rejects([inheritedId]);
  const inheritedEnabled = Object.create({ enabled: true });
  inheritedEnabled.id = 'x';
  rejects([inheritedEnabled]);
});

const invalidIds = [
  ['missing value', undefined],
  ['null', null],
  ['number', 1],
  ['boolean', true],
  ['object', {}],
  ['array', []],
  ['boxed string', new String('x')],
  ['symbol', Symbol('x')],
  ['function', () => 'x'],
  ['empty string', ''],
  ['space only', ' '],
  ['tab only', '\t'],
  ['newline only', '\n'],
  ['leading space', ' x'],
  ['trailing space', 'x '],
  ['leading tab', '\tx'],
  ['trailing newline', 'x\n'],
  ['leading non-breaking space', '\u00a0x'],
  ['trailing non-breaking space', 'x\u00a0'],
  ['leading Unicode BOM whitespace', '\ufeffx'],
  ['trailing Unicode BOM whitespace', 'x\ufeff'],
];
for (const [label, id] of invalidIds) {
  test(`rejects invalid ID: ${label}`, () => rejects([{ id, enabled: true }]));
}

const invalidFlags = [
  ['undefined', undefined],
  ['null', null],
  ['zero', 0],
  ['one', 1],
  ['negative number', -1],
  ['true string', 'true'],
  ['false string', 'false'],
  ['empty string', ''],
  ['object', {}],
  ['array', []],
  ['boxed boolean', new Boolean(false)],
  ['symbol', Symbol('enabled')],
  ['function', () => true],
];
for (const [label, enabled] of invalidFlags) {
  test(`rejects non-boolean enabled: ${label}`, () => rejects([{ id: 'x', enabled }]));
}

test('rejects adjacent duplicate IDs even with different flags', () => {
  rejects([{ id: 'same', enabled: true }, { id: 'same', enabled: false }]);
});

test('rejects duplicate IDs separated by other items', () => {
  rejects([
    { id: 'same', enabled: false },
    { id: 'other', enabled: true },
    { id: 'same', enabled: true },
  ]);
});

test('rejects a duplicate at the 100-item boundary', () => {
  const input = Array.from({ length: 100 }, (_, index) => ({ id: `id-${index}`, enabled: false }));
  input[99].id = input[0].id;
  rejects(input);
});

for (const position of [0, 1, 2]) {
  test(`validates every item including position ${position}`, () => {
    const input = [
      { id: 'a', enabled: true },
      { id: 'b', enabled: false },
      { id: 'c', enabled: true },
    ];
    input[position] = { id: 'bad', enabled: 'true' };
    rejects(input);
  });
}

test('ID equality is exact and does not normalize case or Unicode', () => {
  assert.deepStrictEqual(summarizeFixture([
    { id: '\u00e9', enabled: true },
    { id: 'a', enabled: false },
    { id: 'e\u0301', enabled: true },
    { id: 'A', enabled: false },
  ]), { total: 4, enabled: 2, ids: ['A', 'a', 'e\u0301', '\u00e9'] });
});

test('preserves Unicode and uses UTF-16 default JS sorting', () => {
  const input = [
    { id: '\u{1f600}', enabled: false },
    { id: '\u00e9', enabled: true },
    { id: '\u4e2d', enabled: false },
    { id: 'e\u0301', enabled: true },
    { id: 'a', enabled: false },
    { id: 'Z', enabled: true },
    { id: '\u{1f4a1}', enabled: false },
    { id: 'A', enabled: true },
  ];
  assert.deepStrictEqual(summarizeFixture(input), {
    total: 8,
    enabled: 4,
    ids: ['A', 'Z', 'a', 'e\u0301', '\u00e9', '\u4e2d', '\u{1f4a1}', '\u{1f600}'],
  });
});

test('preserves valid internal whitespace rather than trimming or rewriting IDs', () => {
  assert.deepStrictEqual(summarizeFixture([
    { id: 'a b', enabled: false },
    { id: 'a\tb', enabled: true },
    { id: 'a\nb', enabled: false },
  ]), { total: 3, enabled: 1, ids: ['a\tb', 'a\nb', 'a b'] });
});

test('accepts reserved-looking IDs without treating them as object keys', () => {
  assert.deepStrictEqual(summarizeFixture([
    { id: 'toString', enabled: false },
    { id: '__proto__', enabled: true },
    { id: 'constructor', enabled: true },
  ]), { total: 3, enabled: 2, ids: ['__proto__', 'constructor', 'toString'] });
});

test('accepts a null-prototype object with exactly the required own fields', () => {
  const item = Object.create(null);
  item.id = 'x';
  item.enabled = true;
  assert.deepStrictEqual(summarizeFixture([item]), { total: 1, enabled: 1, ids: ['x'] });
});

test('does not add an undeclared ordinary-prototype restriction', () => {
  class FixtureItem {
    constructor() {
      this.id = 'x';
      this.enabled = false;
    }
  }
  assert.deepStrictEqual(summarizeFixture([new FixtureItem()]), { total: 1, enabled: 0, ids: ['x'] });
});

test('accepts required own fields even when they are non-enumerable', () => {
  const item = Object.defineProperties({}, {
    id: { value: 'x', enumerable: false },
    enabled: { value: true, enumerable: false },
  });
  assert.deepStrictEqual(summarizeFixture([item]), { total: 1, enabled: 1, ids: ['x'] });
});

test('preserves input array order, item references, values, and own fields', () => {
  const input = [{ id: 'z', enabled: false }, { id: 'a', enabled: true }];
  const first = input[0];
  const second = input[1];
  const before = structuredClone(input);
  assert.deepStrictEqual(summarizeFixture(input), { total: 2, enabled: 1, ids: ['a', 'z'] });
  assert.deepStrictEqual(input, before);
  assert.strictEqual(input[0], first);
  assert.strictEqual(input[1], second);
  assert.deepStrictEqual(Reflect.ownKeys(first), ['id', 'enabled']);
  assert.deepStrictEqual(Reflect.ownKeys(second), ['id', 'enabled']);
});

test('accepts deeply frozen valid input without any writes', () => {
  const input = Object.freeze([
    Object.freeze({ id: 'z', enabled: false }),
    Object.freeze({ id: 'a', enabled: true }),
  ]);
  assert.deepStrictEqual(summarizeFixture(input), { total: 2, enabled: 1, ids: ['a', 'z'] });
});

test('preserves input when rejecting a duplicate', () => {
  const input = [
    { id: 'z', enabled: false },
    { id: 'a', enabled: true },
    { id: 'z', enabled: true },
  ];
  const before = structuredClone(input);
  rejects(input);
  assert.deepStrictEqual(input, before);
});

test('preserves input when rejecting an extra field', () => {
  const input = [{ id: 'z', enabled: true, extra: 'x' }, { id: 'a', enabled: false }];
  const before = structuredClone(input);
  rejects(input);
  assert.deepStrictEqual(input, before);
});

test('repeated calls remain deterministic across other valid and invalid calls', () => {
  const input = [{ id: 'z', enabled: false }, { id: 'a', enabled: true }];
  const expected = { total: 2, enabled: 1, ids: ['a', 'z'] };
  for (let iteration = 0; iteration < 5; iteration += 1) {
    assert.deepStrictEqual(summarizeFixture(input), expected);
    assert.deepStrictEqual(summarizeFixture([]), { total: 0, enabled: 0, ids: [] });
    rejects([{ id: 'bad', enabled: 'true' }]);
  }
});

test('editing an earlier result cannot alter input or later summaries', () => {
  const input = [{ id: 'z', enabled: false }, { id: 'a', enabled: true }];
  const result = summarizeFixture(input);
  // Frozen output is also allowed: failed writes must not affect later calls.
  Reflect.set(result.ids, '0', 'changed');
  Reflect.set(result.ids, String(result.ids.length), 'extra');
  Reflect.set(result, 'total', -1);
  Reflect.set(result, 'enabled', -1);
  assert.deepStrictEqual(input, [{ id: 'z', enabled: false }, { id: 'a', enabled: true }]);
  assert.deepStrictEqual(summarizeFixture(input), { total: 2, enabled: 1, ids: ['a', 'z'] });
});
