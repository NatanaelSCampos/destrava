import { randomUUID } from "node:crypto";
import { readExternalPackageDirectory } from "../src/repositories/external-package-directory";
import { CourseInstallationService } from "../src/domain/course-installations/service";
import { InstallationError } from "../src/domain/course-installations/contracts";
import {
  SupabaseCourseArtifactStore,
  SupabaseCourseInstallationCatalog,
} from "../src/repositories/supabase-course-installations";
import { createLocalCourseInstallationContext } from "./course-installation-local-authority";

async function main() {
  const [action, target, revision, operationId] = process.argv.slice(2);
  if (
    !target ||
    !["install", "prepare", "approve", "activate", "rollback", "list"].includes(action)
  )
    throw new Error(
      "Use install <directory>, prepare/approve <installation>, activate/rollback <installation> <revision>, or list <course> through the protected local runner.",
    );
  const context = await createLocalCourseInstallationContext();
  const catalog = new SupabaseCourseInstallationCatalog(context.db);
  const service = new CourseInstallationService({
    catalog,
    store: new SupabaseCourseArtifactStore(context.db),
    authorizer: context.authorizer,
    // This is an explicit condition for the local HTML-media lab, not a production or codec certificate.
    environment: { dependencies: { "client.media_playback": { state: "available" } } },
  });
  if (action === "list") {
    console.log(
      JSON.stringify(
        {
          active: await catalog.getActive(target),
          installations: (await service.listInstallations(target)).map((item) => ({
            reference: item.reference,
            state: item.state,
            preparation: item.preparation,
            approval: item.approval,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  if (action === "install") {
    const snapshot = await readExternalPackageDirectory(target);
    if (snapshot.diagnostics.some((item) => item.severity === "error"))
      throw new InstallationError("INVALID_PACKAGE", "validation");
    const installed = await service.install(snapshot.files, context.authority);
    console.log(
      JSON.stringify({ reference: installed.reference, state: installed.state }, null, 2),
    );
    return;
  }
  if (action === "prepare" || action === "approve") {
    const installed =
      action === "prepare"
        ? await service.prepareForHomologation(target, context.authority)
        : await service.recordLocalApproval(target, context.authority);
    console.log(
      JSON.stringify(
        {
          reference: installed.reference,
          preparation: installed.preparation,
          approval: installed.approval,
        },
        null,
        2,
      ),
    );
    return;
  }
  const current = await service.resolveInstallation(target);
  const expectedRevision = Number(revision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new InstallationError("INVALID_INPUT", "activation");
  const command = {
    courseId: current.installation.reference.courseId,
    installationId: target,
    expectedRevision,
    operationId: operationId ?? randomUUID(),
  };
  // This public operation identity lets a caller retry a lost receipt without reapplying a new decision.
  console.log(JSON.stringify({ requestedOperation: command }));
  const receipt = await (action === "activate"
    ? service.activate(command, context.authority)
    : service.rollback(command, context.authority));
  console.log(JSON.stringify(receipt, null, 2));
}
void main().catch((error) => {
  console.error(
    error instanceof InstallationError
      ? `${error.code} (${error.stage})`
      : "Local course installation command failed.",
  );
  process.exitCode = 1;
});
