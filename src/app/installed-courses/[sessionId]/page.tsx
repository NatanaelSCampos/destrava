import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { courseInstallationRuntime, publicVersionSession } from "@/lib/course-installation-runtime";
import { AudioPlayer } from "@/components/activities/audio-player";

/** Read-only runtime inspection, using the application's existing media player. No admin operations. */
export default async function InstalledCoursePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) notFound();
  const { sessionId } = await params;
  let resolved;
  try {
    resolved = await courseInstallationRuntime().resolveSession(user.id, sessionId);
  } catch {
    notFound();
  }
  const exposed = publicVersionSession(resolved);
  const audio = exposed.course.units
    .flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.activities))
    .find((activity) => activity.type === "listening");
  return (
    <section className="page-container">
      <p className="eyebrow">Conteúdo instalado · homologação local</p>
      <h1>{exposed.course.title}</h1>
      <p>
        Versão {exposed.session.reference.contentVersion}. Esta sessão mantém a versão com que foi
        iniciada.
      </p>
      {audio?.type === "listening" && (
        <div className="card">
          <AudioPlayer text={audio.transcript} media={audio.media} />
        </div>
      )}
      <p>Instalação {exposed.session.reference.installationId}</p>
    </section>
  );
}
