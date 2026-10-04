export function validatedObjectiveIds(
  allowedIds: readonly string[],
  currentMessage: string,
  evidence: ReadonlyArray<{ id: string; quote: string }>,
): string[] {
  const allowed = new Set(allowedIds);
  const message = currentMessage.normalize("NFC").toLocaleLowerCase();
  return [...new Set(evidence.filter(({ id, quote }) => {
    const excerpt = quote.trim().normalize("NFC").toLocaleLowerCase();
    return allowed.has(id) && excerpt.length >= 3 && message.includes(excerpt);
  }).map(({ id }) => id))];
}
