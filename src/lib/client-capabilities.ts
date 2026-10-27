import { azureLocale } from "./azure-voices";
import type { PublicCourse } from "@/content/public";
import { negotiateCapabilities } from "@/engine/capabilities/compatibility";
import { capabilityRegistry } from "@/engine/capabilities/registry";
import { projectCapabilityAvailability } from "@/engine/capabilities/availability-projection";
import { textMeasureAvailability } from "@/engine/text/representation";
import type { LanguagePackage } from "@/content/contracts";
import { resolveLearningVariant } from "@/engine/variants/resolution";
import { textToSpeechLocale } from "@/content/language-variant";
import { type VoiceDescriptor } from "@/engine/variants/speech";

// Stable primitive snapshots for React hydration. Detect APIs; do not request microphone permission.
export const serverDeviceSnapshot = () => -1;
export function deviceCapabilitySnapshot() {
  if (typeof window === "undefined") return -1;
  return (
    (window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.MediaRecorder === "function"
      ? 1
      : 0) |
    ("HTMLAudioElement" in window ? 2 : 0) |
    ("HTMLMediaElement" in window ? 4 : 0) |
    (typeof Intl.Segmenter === "function" ? 8 : 0)
  );
}
export function subscribeDeviceCapabilities(changed: () => void) {
  window.addEventListener("focus", changed);
  return () => {
    window.removeEventListener("focus", changed);
  };
}
export function courseWithDeviceAvailability(
  course: PublicCourse,
  snapshot: number,
  language?: LanguagePackage,
  preference?: unknown,
  _voices: VoiceDescriptor[] = [],
): PublicCourse {
  void _voices;
  if (snapshot < 0 || !course.capabilityReport) return course;
  const condition = (bit: number, reason: string) => ({
    state: snapshot & bit ? ("available" as const) : ("unavailable" as const),
    reason,
  });
  const client = negotiateCapabilities(
    course.capabilityReport.selections.map((selection) => ({
      location: selection.location,
      requirement: { id: selection.selectedId, version: selection.selectedVersion, required: true },
    })),
    {
      dependencies: {
        "client.recording": condition(
          1,
          "Este navegador não oferece gravação de áudio em uma conexão segura.",
        ),
        "client.audio_output": condition(2, "Este navegador não oferece reprodução de áudio."),
        "client.media_playback": condition(
          4,
          "Este navegador não oferece reprodução de áudio/vídeo.",
        ),
      },
    },
    capabilityRegistry,
    { validateData: false },
  );
  const diagnostics = [
    ...course.capabilityReport.diagnostics.filter(
      (item) =>
        !item.condition?.startsWith("client.") && !(language && item.condition === "speech.tts"),
    ),
    ...client.diagnostics.filter((item) => item.condition?.startsWith("client.")),
  ];
  const textDiagnostics: typeof diagnostics = [];
  for (const unit of course.units)
    for (const lesson of unit.lessons)
      for (const activity of [...lesson.activities, ...(lesson.deferredRecovery?.rules.map(rule => rule.activity) ?? [])]) {
        if (language) {
          const variant = resolveLearningVariant(language, course, preference, activity.variant);
          const locale =
            variant.status === "resolved"
              ? textToSpeechLocale(language, variant.variantId, course, activity.variant)
              : null;
          const needsVoice = activity.type === "listening" && activity.media?.kind !== "audio";
          if (
            variant.status === "invalid" ||
            (needsVoice &&
              (!locale ||
                !azureLocale(locale)))
          )
            textDiagnostics.push({
              code: "CAPABILITY_UNAVAILABLE",
              severity: "error",
              capabilityId: needsVoice ? "speech.tts" : "linguistic.variant",
              requiredVersion: "1.0.0",
              supportedVersions: ["1.0.0"],
              condition: "client.variant_voice",
              location: `${course.availability?.scopeLocations?.[`activity:${activity.id}`]}.variantVoice`,
              message:
                "A variante ou a voz exigida por esta atividade está indisponível. Nenhuma resposta será avaliada.",
              resolution: "Choose a declared locale with a compatible audio recording.",
            });
        }
        if (activity.type !== "writing" || !activity.textRequirement) continue;
        const measure = activity.textRequirement.measure;
        const support =
          ["graphemes", "intl_words"].includes(measure.strategy) && !(snapshot & 8)
            ? { available: false }
            : textMeasureAvailability(measure);
        if (!support.available)
          textDiagnostics.push({
            code: "CAPABILITY_UNAVAILABLE",
            severity: "error",
            capabilityId: "text.measurement",
            requiredVersion: "1.0.0",
            supportedVersions: ["1.0.0"],
            condition: "client.text_measurement",
            location: `${course.availability?.scopeLocations?.[`activity:${activity.id}`]}.textMeasure`,
            message: "A estratégia de medida textual não está disponível neste navegador/locale.",
            resolution: "Use a runtime supporting the declared measure and locale.",
          });
      }
  diagnostics.push(...textDiagnostics);
  const serverAvailability = language
    ? projectCapabilityAvailability(
        course,
        diagnostics.filter((item) => !item.condition?.startsWith("client.")),
        course.availability?.scopeLocations,
        course.availability?.interactiveLessonLocations,
        course.availability?.interactiveLessonScopes,
      )
    : course.availability;
  const device = projectCapabilityAvailability(
    course,
    [
      ...client.diagnostics.filter((item) => item.condition?.startsWith("client.")),
      ...textDiagnostics,
    ],
    course.availability?.scopeLocations,
    course.availability?.interactiveLessonLocations,
    course.availability?.interactiveLessonScopes,
  );
  return {
    ...course,
    capabilityReport: {
      ...course.capabilityReport,
      diagnostics,
      readiness: diagnostics.some(
        (item) => item.code === "CAPABILITY_UNAVAILABLE" && item.severity === "error",
      )
        ? "unavailable"
        : diagnostics.some((item) => item.code === "CAPABILITY_AVAILABILITY_UNKNOWN")
          ? "unknown"
          : "ready",
    },
    availability: {
      ...course.availability,
      spacedRepetition: course.availability?.spacedRepetition ?? true,
      unavailableActivityIds: [
        ...new Set([
          ...(serverAvailability?.unavailableActivityIds ?? []),
          ...device.unavailableActivityIds,
        ]),
      ],
      unavailableUnitIds: [
        ...new Set([
          ...(serverAvailability?.unavailableUnitIds ?? []),
          ...device.unavailableUnitIds,
        ]),
      ],
      unavailableAssessmentIds: [
        ...new Set([
          ...(serverAvailability?.unavailableAssessmentIds ?? []),
          ...device.unavailableAssessmentIds,
        ]),
      ],
      unavailableInteractiveLessonIds: [
        ...new Set([
          ...(serverAvailability?.unavailableInteractiveLessonIds ?? []),
          ...device.unavailableInteractiveLessonIds,
        ]),
      ],
      reasons: { ...serverAvailability?.reasons, ...device.reasons },
    },
  };
}
