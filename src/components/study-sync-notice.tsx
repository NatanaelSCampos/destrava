"use client";

import { useStudy } from "./study-provider";

export function StudySyncNotice() {
  const {
    course,
    syncError,
    pendingProgress,
    hasRecoveredProgress,
    progressLoadStatus,
    retryProgressSync,
  } = useStudy();
  const recovering = hasRecoveredProgress && progressLoadStatus === "loaded";
  if (!syncError && !recovering) return null;
  const exportCopy = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ courseId: course.id, drafts: pendingProgress }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `destrava-progresso-pendente-${course.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="study-sync-notice" role={syncError ? "alert" : "status"}>
      <p>
        {(syncError ? (progressLoadStatus === "failed" ? "Não foi possível carregar seu progresso. Tente novamente." : "Seu progresso ainda não terminou de sincronizar. Mantenha esta página aberta e tente novamente.") : "") ||
          "O progresso remoto foi carregado. Há uma cópia local pendente; ela não foi aplicada sobre seus dados."}
      </p>
      <div>
        {syncError && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void retryProgressSync()}
          >
            {progressLoadStatus === "failed" ? "Tentar carregar novamente" : "Tentar sincronizar"}
          </button>
        )}
        {pendingProgress.length > 0 && (
          <button type="button" className="secondary-button" onClick={exportCopy}>
            Baixar cópia local
          </button>
        )}
      </div>
    </div>
  );
}
