export function summarizeFixture(items) {
  if (!Array.isArray(items) || items.length > 100) {
    throw new TypeError('Expected an array with at most 100 items.');
  }

  const ids = [];
  const seenIds = new Set();
  let enabledCount = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('Each item must be an object.');
    }

    const keys = Reflect.ownKeys(item);
    if (keys.length !== 2 || !keys.includes('id') || !keys.includes('enabled')) {
      throw new TypeError('Each item must contain exactly id and enabled.');
    }

    const { id, enabled } = item;
    if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
      throw new TypeError('Each id must be a non-empty string without surrounding whitespace.');
    }
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Each enabled value must be a boolean.');
    }
    if (seenIds.has(id)) {
      throw new TypeError('Each id must be unique.');
    }

    seenIds.add(id);
    ids.push(id);
    if (enabled) enabledCount += 1;
  }

  return { total: items.length, enabled: enabledCount, ids: ids.sort() };
}
