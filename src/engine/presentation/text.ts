import {
  activityPresentationSchema,
  type ActivityPresentation,
  type PresentationField,
} from "@/content/text-presentation";

import { presentationLanguage } from "./language";

export type TextRole = "target" | "source" | "user" | "interface" | "fragment";
export const interfacePresentation = { language: "pt-BR", direction: "ltr" as const };
type Language = {
  id: string;
  identity?: { iso639_1?: string; iso639_3?: string };
  writingSystem: { direction: "ltr" | "rtl" };
};
/** Presentation never mutates content, derives direction from a language name, or changes grading. */
export function resolveTextPresentation(
  language: Language,
  course: { sourceLanguage?: string },
  role: TextRole = "target",
  declaration?: ActivityPresentation,
  field?: PresentationField,
) {
  const parsed = activityPresentationSchema.parse(declaration ?? {});
  const base =
    role === "interface"
      ? interfacePresentation
      : role === "source"
        ? {
            language: course.sourceLanguage ?? interfacePresentation.language,
            direction: "auto" as const,
          }
        : {
            language: presentationLanguage(language),
            direction:
              role === "user" || role === "fragment"
                ? ("auto" as const)
                : language.writingSystem.direction,
          };
  if (role === "interface") return { lang: base.language, dir: base.direction };
  const override =
    (field && parsed.fields?.[field]) ?? (role === "target" ? parsed.content : undefined);
  return { lang: override?.language ?? base.language, dir: override?.direction ?? base.direction };
}

/** Report directional controls without stripping legitimate marks or altering stored text. */
export function inspectBidiControls(text: string) {
  const controls: Array<{
    code: string;
    index: number;
    kind: "mark" | "isolate" | "embedding" | "override";
  }> = [];
  let isolates = 0,
    unbalanced = false;
  Array.from(text).forEach((character, index) => {
    const code = character.codePointAt(0)!;
    if (
      ![
        0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
        0x2069,
      ].includes(code)
    )
      return;
    const kind =
      code === 0x202d || code === 0x202e
        ? "override"
        : code >= 0x2066
          ? "isolate"
          : code >= 0x202a
            ? "embedding"
            : "mark";
    if (code >= 0x2066 && code <= 0x2068) isolates++;
    if (code === 0x2069) {
      if (isolates === 0) unbalanced = true;
      else isolates--;
    }
    controls.push({ code: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`, index, kind });
  });
  return {
    controls,
    suspicious:
      unbalanced ||
      isolates > 0 ||
      controls.some((item) => item.kind === "override" || item.kind === "embedding"),
  };
}
