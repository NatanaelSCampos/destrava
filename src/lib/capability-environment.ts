import type { LanguagePackage } from "@/content/contracts";
import { speechLocale, textToSpeechLocale } from "@/content/language-variant";
import { speechEndpoint } from "./azure-speech";
import { featureFlags } from "./feature-flags";
import type { CapabilityEnvironment, AvailabilityState } from "@/engine/capabilities/compatibility";
import type { VariantCourse } from "@/engine/variants/resolution";

const condition = (available: boolean, reason: string): AvailabilityState =>
  available ? { state: "available" } : { state: "unavailable", reason };
const configuredService = (configured: boolean, reason: string): AvailabilityState =>
  configured
    ? {
        state: "unknown",
        reason:
          "Configuração presente; serviço, permissão, modelo e cota serão verificados na execução.",
      }
    : { state: "unavailable", reason };
/** Server boundary: return conditions only. No key, endpoint, model ID or provider configuration escapes. */
export function serverCapabilityEnvironment(
  language: LanguagePackage,
  variant?: string,
  course: VariantCourse = {},
): CapabilityEnvironment {
  const speechConfigured = Boolean(process.env.AZURE_SPEECH_KEY && speechEndpoint());
  return {
    dependencies: {
      "ai.text_service": configuredService(
        Boolean(process.env.OPENAI_API_KEY),
        "O serviço de IA não está configurado neste ambiente.",
      ),
      "learning.session_store": configuredService(
        Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        ),
        "O armazenamento autenticado de sessões não está configurado.",
      ),
      "speech.recognition_service": configuredService(
        speechConfigured &&
          language.speech.support.speechRecognition &&
          Boolean(speechLocale(language, variant, "recognitionLocale", "azure", course)),
        "O reconhecimento de fala está indisponível neste ambiente ou variante.",
      ),
      "speech.pronunciation_service": configuredService(
        speechConfigured &&
          language.speech.support.pronunciationAssessment &&
          Boolean(speechLocale(language, variant, "assessmentLocale", "azure", course)),
        "A avaliação de pronúncia está indisponível neste ambiente ou variante.",
      ),
    },
    capabilities: {
      "activity.speaking": condition(
        featureFlags.SPEAKING,
        "A prática oral está temporariamente desativada.",
      ),
      "activity.listening": condition(
        featureFlags.LISTENING,
        "A prática de escuta está temporariamente desativada.",
      ),
      "speech.tts": condition(
        language.speech.support.textToSpeech &&
          Boolean(textToSpeechLocale(language, variant, course)),
        "Não há configuração de voz para este idioma ou variante.",
      ),
      "review.spaced": condition(
        featureFlags.SPACED_REPETITION,
        "A revisão espaçada está temporariamente desativada.",
      ),
      "ai.writing_feedback": condition(
        featureFlags.AI_WRITING,
        "A correção por IA está temporariamente desativada.",
      ),
      "ai.conversation": condition(
        featureFlags.AI_TUTOR,
        "A conversa com IA está temporariamente desativada.",
      ),
      "ai.conversation_mission": condition(
        featureFlags.AI_TUTOR,
        "A conversa com IA está temporariamente desativada.",
      ),
      "ai.micro_lesson": condition(
        featureFlags.AI_TUTOR,
        "As microlições estão temporariamente desativadas.",
      ),
      "ai.tutor": condition(featureFlags.AI_TUTOR, "O tutor está temporariamente desativado."),
      "ai.image_description": condition(
        featureFlags.AI_TUTOR,
        "A descrição com IA está temporariamente desativada.",
      ),
      "ai.interactive_support": condition(
        featureFlags.AI_TUTOR,
        "O apoio por IA está temporariamente desativado.",
      ),
    },
  };
}
