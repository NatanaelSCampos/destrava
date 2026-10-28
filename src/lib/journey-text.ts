/** Present numbered curricular references as narrative copy, without changing source content. */
export function journeyText(text: string) {
  return text
    .replace(/\b(?:unidade|capítulo)\s*\d+\s*[:·—–-]\s*/giu, "")
    .replace(/\bunidade\s*\d+\b/giu, "parte do caminho")
    .replace(/\bcapítulo\s*\d+\b/giu, "trecho do caminho");
}
