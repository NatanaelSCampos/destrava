import "server-only";
import { findCourseBundle, allCourseBundles, defaultCourseId } from "@/content/course-registry";
import { publicCourse, publicRequirements, type PublicCourse } from "@/content/public";
import type { LanguageResources } from "@/content/language-resources";
import type { LanguagePackage } from "@/content/contracts";
import type { CapabilityDiagnostic } from "@/content/capability-contracts";
import { projectCapabilityAvailability } from "@/engine/capabilities/availability-projection";
import {
  installedCourseCompatibility,
  installedCapabilityEnvironment,
} from "@/domain/installed-study/compatibility";
import { serverCapabilityEnvironment } from "@/lib/capability-environment";
import {
  InstalledStudyError,
  type RuntimeSelectionEnvelope,
} from "@/domain/installed-study/contracts";
import {
  InstallationError,
  type ResolvedSession,
  type ResolvedInstallation,
} from "@/domain/course-installations/contracts";
import { installedRuntimeConfigured } from "@/lib/installed-runtime-scope";
import { installedStudyPorts } from "@/lib/installed-study-runtime";
import { resolveRuntimeCourse } from "@/lib/course-installation-runtime";
import type {
  InstalledRuntimeContext,
  RuntimeCourseOption,
  RuntimeUnavailable,
} from "@/lib/installed-runtime-types";

type Bundle = NonNullable<ReturnType<typeof findCourseBundle>>;
type PublicView = { course: PublicCourse; language: LanguagePackage; resources: LanguageResources };
export type ApplicationCourseRuntime = {
  source: "compiled" | "installed" | "unavailable";
  view?: PublicView;
  bundle?: Bundle;
  context?: InstalledRuntimeContext;
  userId: string | null;
  selectionRevision: number;
  courseOptions: RuntimeCourseOption[];
  diagnostics: CapabilityDiagnostic[];
  unavailable?: RuntimeUnavailable;
};

const compiledOptions = (): RuntimeCourseOption[] =>
  allCourseBundles().map(({ course, language }) => ({
    id: course.id,
    title: course.title,
    language: language.identity.nativeName,
    source: "compiled",
    contentVersion: course.contentVersion,
  }));

/** Project resources explicitly; private cloze/canonical image facts and capability data stay server-side. */
function publicLanguage(language: LanguagePackage): LanguagePackage {
  const exposed = structuredClone(language);
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.capabilityRequirements))
      record.capabilityRequirements = publicRequirements(
        record.capabilityRequirements as Parameters<typeof publicRequirements>[0],
      );
    for (const child of Object.values(record)) visit(child);
  };
  visit(exposed);
  return exposed;
}
export function installedPublicView(
  content: ResolvedInstallation,
  sessionId: string,
  variant?: unknown,
): PublicView {
  const { bundle, assets } = content.prepared;
  const environment = installedCapabilityEnvironment(
    serverCapabilityEnvironment(
      bundle.language,
      typeof variant === "string" ? variant : undefined,
      bundle.course,
    ),
  );
  environment.resources = Object.fromEntries(
    [...assets.keys()].map((path) => [path, { state: "available" as const }]),
  );
  const exposed = structuredClone(
    publicCourse(bundle.course, bundle.language, environment, variant),
  );
  const integration = installedCourseCompatibility(bundle.course);
  const diagnostics = [
    ...(exposed.capabilityReport?.diagnostics ?? []),
    ...integration.diagnostics,
  ];
  exposed.capabilityReport = {
    compatible: (exposed.capabilityReport?.compatible ?? true) && integration.compatible,
    readiness: exposed.capabilityReport?.readiness ?? "unknown",
    diagnostics,
    selections: exposed.capabilityReport?.selections ?? [],
  };
  exposed.availability = {
    ...projectCapabilityAvailability(
      exposed,
      diagnostics,
      exposed.availability?.scopeLocations,
      exposed.availability?.interactiveLessonLocations,
    ),
    actionStates: exposed.availability?.actionStates,
    spacedRepetition: false,
  };
  const media = (path: string) => {
    if (!assets.has(path)) throw new InstallationError("ARTIFACT_INTEGRITY", "resolution");
    return `/api/course-installations/media?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`;
  };
  for (const unit of exposed.units)
    for (const lesson of unit.lessons)
      for (const activity of lesson.activities)
        if (activity.type === "listening" && activity.media?.kind === "audio")
          activity.media.url = media(activity.media.url);
  const resources = structuredClone(bundle.resources);
  resources.structures = [];
  resources.reviewClozeForms = {};
  resources.conversationScenarios = [];
  resources.imageScenes = resources.imageScenes.map((scene) => ({
    ...scene,
    image: media(scene.image),
    facts: [],
  }));
  return { course: exposed, resources, language: publicLanguage(bundle.language) };
}

export async function applicationCatalogue(userId: string) {
  const { study, catalog, installations } = installedStudyPorts();
  const selection = await study.getSelection(userId);
  const active = await catalog.listActive();
  const installedIds = new Set(active.map((row) => row.courseId));
  const options = compiledOptions().filter((option) => !installedIds.has(option.id));
  const verified = new Map<string, ResolvedInstallation>();
  const diagnostics: CapabilityDiagnostic[] = [];
  for (const entry of active) {
    if (!entry.installationId) continue;
    try {
      const content = await installations.resolveInstallation(entry.installationId);
      if (
        content.installation.approval !== "local_test_approved" ||
        content.installation.preparation !== "prepared"
      )
        continue;
      const integration = installedCourseCompatibility(content.prepared.bundle.course);
      diagnostics.push(...integration.diagnostics);
      if (!integration.compatible) continue;
      verified.set(entry.courseId, content);
      options.push({
        id: entry.courseId,
        title: content.prepared.bundle.course.title,
        language: content.prepared.bundle.language.identity.nativeName,
        source: "installed",
        contentVersion: content.installation.reference.contentVersion,
      });
    } catch {
      diagnostics.push({
        code: "CAPABILITY_UNAVAILABLE",
        severity: "error",
        capabilityId: "installed.artifact",
        requiredVersion: "1.0.0",
        supportedVersions: [],
        location: `installed.course.${entry.courseId}`,
        condition: "installed.integrity",
        message: "A versão instalada não pôde ser verificada.",
        resolution: "Restore the complete immutable artifact; no compiled fallback is used.",
      });
    }
  }
  return { selection, active, options, verified, diagnostics };
}

export async function resolveApplicationRuntime(
  userId: string | null,
  legacyCourseId?: string,
): Promise<ApplicationCourseRuntime> {
  const bootstrapId = findCourseBundle(legacyCourseId ?? "") ? legacyCourseId! : defaultCourseId;
  const initial: ApplicationCourseRuntime = {
    source: "compiled",
    userId,
    selectionRevision: 0,
    courseOptions: compiledOptions(),
    diagnostics: [],
  };
  let selected: RuntimeSelectionEnvelope | undefined;
  try {
    if (userId && installedRuntimeConfigured()) {
      const available = await applicationCatalogue(userId);
      selected = available.selection;
      initial.selectionRevision = selected.revision;
      initial.courseOptions = available.options;
      initial.diagnostics = available.diagnostics;
      if (selected.selection?.source === "installed") {
        const { study } = installedStudyPorts();
        const resolved = await study.resolveContext(userId, selected.selection.versionSessionId);
        if (resolved.session.reference.courseId !== selected.selection.courseId)
          throw new InstalledStudyError("SESSION_CONFLICT");
        const progress = await study.load(userId, resolved.session.id);
        const view = installedPublicView(
          resolved.content,
          resolved.session.id,
          progress.state?.profile.variantId,
        );
        initial.courseOptions = initial.courseOptions.map((option) =>
          option.id === view.course.id ? { ...option, title: view.course.title } : option,
        );
        return {
          ...initial,
          source: "installed",
          view,
          context: {
            userId,
            versionSessionId: resolved.session.id,
            reference: resolved.session.reference,
            selectionRevision: selected.revision,
          },
        };
      }
      const id = selected.selection?.courseId ?? bootstrapId;
      if (!selected.selection && available.active.some((item) => item.courseId === id))
        throw new InstalledStudyError("SESSION_CONFLICT");
    }
    const id = selected?.selection?.courseId ?? bootstrapId;
    const bundle = findCourseBundle(id);
    if (!bundle) throw new InstalledStudyError("INVALID_INPUT");
    return {
      ...initial,
      bundle,
      view: {
        course: publicCourse(bundle.course, bundle.language),
        language: publicLanguage(bundle.language),
        resources: bundle.resources,
      },
    };
  } catch (error) {
    const diagnostics = error instanceof InstalledStudyError ? error.diagnostics : [];
    return {
      ...initial,
      source: "unavailable",
      unavailable: {
        error:
          error instanceof InstalledStudyError && error.code === "INTEGRATION_UNAVAILABLE"
            ? "Este curso depende de um recurso que ainda não está integrado. Escolha outro curso disponível; seu progresso foi preservado."
            : "Não foi possível carregar a seleção atual. Escolha um curso disponível ou tente novamente; seu progresso foi preservado.",
        diagnostics,
      },
    };
  }
}

/** APIs must not silently compile a homonymous installed selection when the marker is omitted. */
export async function resolveApplicationOperation(
  courseId: string,
  userId?: string | null,
  sessionId?: string,
) {
  if (sessionId !== undefined) {
    if (!userId) throw new InstallationError("NOT_AUTHORIZED", "session");
    const resolved: ResolvedSession = await installedStudyPorts().study.resolveContext(
      userId,
      sessionId,
    );
    if (resolved.session.reference.courseId !== courseId)
      throw new InstallationError("SESSION_CONFLICT", "session");
    return { ...resolved.content.prepared.bundle, versionSession: resolved.session };
  }
  if (userId && installedRuntimeConfigured()) {
    const { study, catalog } = installedStudyPorts();
    const selected = (await study.getSelection(userId)).selection;
    if (
      (selected?.source === "installed" && selected.courseId === courseId) ||
      ((await catalog.listActive()).some((row) => row.courseId === courseId) &&
        !(selected?.source === "compiled" && selected.courseId === courseId))
    )
      throw new InstalledStudyError("INVALID_INPUT");
  }
  const compiled = await resolveRuntimeCourse(courseId, userId, undefined);
  return compiled ? { ...compiled, versionSession: undefined } : undefined;
}

export async function isSelectedInstalled(userId: string) {
  return (
    installedRuntimeConfigured() &&
    (await installedStudyPorts().study.getSelection(userId)).selection?.source === "installed"
  );
}
