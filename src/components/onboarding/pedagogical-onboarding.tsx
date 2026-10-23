"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { CourseTransitionNotice } from "@/components/layout/course-transition-notice";
import { buildStudyPlan } from "@/domain/study/study-planner";
import {
  createLearningPreferences,
  diagnosticAdvice,
  goalLabels,
  learningSkills,
  levelLabels,
  skillLabels,
  type LearningGoal,
  type LearningSkill,
  type SelfReportedLevel,
} from "@/domain/study/learning-preferences";

type CourseOption = {
  id: string;
  title: string;
  language: string;
  source?: "compiled" | "installed";
};
const steps = [
  "Idioma",
  "Experiência",
  "Objetivo",
  "Contextos",
  "Prioridades",
  "Tempo",
  "Seu plano",
  "Diagnóstico",
];

export function PedagogicalOnboarding({
  courseOptions,
  selectionRevision = 0,
  onSavingChange,
}: {
  courseOptions: CourseOption[];
  selectionRevision?: number;
  onSavingChange?: (saving: boolean) => void;
}) {
  const router = useRouter();
  const {
    course,
    resources,
    state,
    updateProfile,
    recordStudyEvent,
    flushStudyState,
    vocabularyItems,
  } = useStudy();
  const [step, setStep] = useState(Math.min(7, Math.max(0, state.profile.onboardingStep)));
  const [switching, setSwitching] = useState(false);
  const [pendingCourseId, setPendingCourseId] = useState("");
  const [finishing, setFinishing] = useState(false);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const preferences = state.profile.learningPreferences;
  const contexts = resources.learningOptions.contexts.filter(
    (item) => item.goal === preferences.goal,
  );
  const hasContextStep = contexts.length > 0;
  const contextLabels = resources.learningOptions.contexts
    .filter((item) => preferences.contexts.includes(item.id))
    .map((item) => item.label);
  const plan =
    step >= 6
      ? buildStudyPlan(
          course,
          state,
          preferences.preferredSessionMinutes,
          vocabularyItems,
          resources,
        )
      : [];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onSavingChange?.(false);
    };
  }, [onSavingChange]);

  useEffect(() => {
    if (
      !state.events.some(
        (event) => event.type === "onboarding_started" && event.metadata?.courseId === course.id,
      )
    )
      recordStudyEvent("onboarding_started", undefined, { courseId: course.id });
  }, [course.id, recordStudyEvent, state.events]);

  function savePreferences(changes: Partial<Omit<typeof preferences, "skillWeights">>) {
    updateProfile({
      learningPreferences: createLearningPreferences({
        goal: changes.goal ?? preferences.goal,
        contexts: changes.contexts ?? preferences.contexts,
        skillPriorities: changes.skillPriorities ?? preferences.skillPriorities,
        preferredSessionMinutes:
          changes.preferredSessionMinutes ?? preferences.preferredSessionMinutes,
      }),
    });
  }

  async function chooseCourse(courseId: string) {
    if (courseId === course.id || switching) return;
    setSwitching(true);
    setPendingCourseId(courseId);
    setError("");
    try {
      await flushStudyState();
      const response = await fetch("/api/course/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          source: courseOptions.find((option) => option.id === courseId)?.source,
          expectedRevision: selectionRevision,
          operationId: crypto.randomUUID(),
        }),
      });
      if (!response.ok) throw new Error("Não foi possível selecionar esse curso.");
      // The root server layout resolves the active course from the cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao trocar de curso.");
      setSwitching(false);
    }
  }

  function go(next: number) {
    setStep(next);
    updateProfile({ onboardingStep: next });
    if (next > step)
      recordStudyEvent("onboarding_step_completed", undefined, {
        courseId: course.id,
        step: steps[step],
      });
  }

  async function finish(startDiagnostic: boolean) {
    if (finishing || switching) return;
    setFinishing(true);
    onSavingChange?.(true);
    setError("");
    updateProfile({
      onboarded: true,
      onboardingStep: 7,
      dailyMinutes: preferences.preferredSessionMinutes,
      goal: goalLabels[preferences.goal],
    });
    if (!state.events.some((event) => event.type === "onboarding_completed" && event.metadata?.courseId === course.id))
      recordStudyEvent("onboarding_completed", undefined, { courseId: course.id });
    if (!startDiagnostic && !state.events.some((event) => event.type === "diagnostic_skipped" && event.metadata?.courseId === course.id))
      recordStudyEvent("diagnostic_skipped", undefined, { courseId: course.id });
    try {
      await flushStudyState();
      if (!mounted.current) return;
      router.replace(startDiagnostic ? "/assessment" : "/dashboard");
    } catch (caught) {
      if (!mounted.current) return;
      updateProfile({ onboarded: false });
      setError(
        caught instanceof Error
          ? `Não foi possível concluir a configuração: ${caught.message} Tente novamente.`
          : "Não foi possível salvar sua configuração. Tente novamente.",
      );
    } finally {
      if (mounted.current) {
        setFinishing(false);
        onSavingChange?.(false);
      }
    }
  }

  function togglePriority(skill: LearningSkill) {
    const current = preferences.skillPriorities;
    savePreferences({
      skillPriorities: current.includes(skill)
        ? current.filter((item) => item !== skill)
        : current.length < 2
          ? [...current, skill]
          : current,
    });
  }

  const canContinue = step !== 1 || state.profile.selfReportedLevel !== null;
  return (
    <main className="pedagogical-onboarding" aria-busy={switching || finishing}>
      {switching && (
        <CourseTransitionNotice
          title={courseOptions.find((option) => option.id === pendingCourseId)?.title ?? "seu curso"}
        />
      )}
      <div className="onboarding-card">
        <span className="eyebrow">SEU PRIMEIRO PASSO · {resources.languageLabel}</span>
        <div
          className="onboarding-progress"
          aria-label={`Etapa ${step + 1} de ${hasContextStep ? 8 : 7}`}
        >
          <span
            style={{
              width: `${((step + 1 - (!hasContextStep && step > 3 ? 1 : 0)) / (hasContextStep ? 8 : 7)) * 100}%`,
            }}
          />
        </div>
        {step === 0 && (
          <>
            <h1>Qual idioma você quer aprender?</h1>
            <p>Escolha um curso para começar. Seu progresso ficará separado em cada idioma.</p>
            <div className="onboarding-choices">
              {courseOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={switching}
                  className={option.id === course.id ? "selected" : ""}
                  aria-pressed={option.id === course.id}
                  onClick={() => void chooseCourse(option.id)}
                >
                  <strong>{option.language}</strong>
                  <small>{option.title}</small>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Quanto você já sabe?</h1>
            <p>
              Isso orienta a recomendação do diagnóstico. Sua resposta não vira um nível oficial.
            </p>
            <div className="onboarding-choices">
              {(Object.entries(levelLabels) as Array<[SelfReportedLevel, string]>).map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={state.profile.selfReportedLevel === value ? "selected" : ""}
                    aria-pressed={state.profile.selfReportedLevel === value}
                    onClick={() => updateProfile({ selfReportedLevel: value })}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Onde você mais quer usar {resources.languageLabel}?</h1>
            <p>Isso aproxima as missões e atividades do que é útil para você.</p>
            <div className="onboarding-choices">
              {resources.learningOptions.supportedGoals.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  className={preferences.goal === goal ? "selected" : ""}
                  aria-pressed={preferences.goal === goal}
                  onClick={() => savePreferences({ goal: goal as LearningGoal, contexts: [] })}
                >
                  {goalLabels[goal]}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h1>Em quais situações?</h1>
            <p>Escolha até três. Você continuará vendo também as atividades gerais do curso.</p>
            <div className="onboarding-choices">
              {contexts.map((context) => (
                <button
                  key={context.id}
                  type="button"
                  className={preferences.contexts.includes(context.id) ? "selected" : ""}
                  aria-pressed={preferences.contexts.includes(context.id)}
                  onClick={() =>
                    savePreferences({
                      contexts: preferences.contexts.includes(context.id)
                        ? preferences.contexts.filter((id) => id !== context.id)
                        : preferences.contexts.length < 3
                          ? [...preferences.contexts, context.id]
                          : preferences.contexts,
                    })
                  }
                >
                  {context.label}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h1>O que mais importa para você?</h1>
            <p>
              Escolha uma ou duas habilidades. A ordem define a prioridade; fundamentos e revisões
              continuam no plano.
            </p>
            <div className="onboarding-choices">
              {learningSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className={preferences.skillPriorities.includes(skill) ? "selected" : ""}
                  aria-pressed={preferences.skillPriorities.includes(skill)}
                  onClick={() => togglePriority(skill)}
                >
                  {skillLabels[skill]}{" "}
                  {preferences.skillPriorities.includes(skill) && (
                    <small>Prioridade {preferences.skillPriorities.indexOf(skill) + 1}</small>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <h1>Quanto tempo você costuma ter?</h1>
            <p>Esse tempo define o tamanho da aula sugerida. Você pode mudar depois.</p>
            <div className="onboarding-choices compact">
              {([5, 15, 30, 45] as const).map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={preferences.preferredSessionMinutes === minutes ? "selected" : ""}
                  aria-pressed={preferences.preferredSessionMinutes === minutes}
                  onClick={() => savePreferences({ preferredSessionMinutes: minutes })}
                >
                  {minutes === 45 ? "45 min ou mais" : `${minutes} min`}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 6 && (
          <>
            <h1>Seu plano começa assim</h1>
            <p>
              {course.title} · {goalLabels[preferences.goal]} ·{" "}
              {preferences.preferredSessionMinutes} minutos por sessão
            </p>
            {contextLabels.length > 0 && <p>Contextos: {contextLabels.join(", ")}.</p>}
            <p>
              Foco:{" "}
              {preferences.skillPriorities.length
                ? preferences.skillPriorities.map((skill) => skillLabels[skill]).join(" → ")
                : "equilíbrio entre as habilidades"}
              .
            </p>
            <div className="onboarding-plan">
              <strong>Sua primeira sessão sugerida</strong>
              {plan.length ? (
                <ol>
                  {plan.slice(0, 4).map((item) => (
                    <li key={`${item.kind}:${item.id}`}>
                      {item.title} <small>{item.minutes} min</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Comece pela primeira aula do curso. O plano se ajustará às suas respostas.</p>
              )}
            </div>
          </>
        )}
        {step === 7 && (
          <>
            <h1>Quer descobrir seu ponto de partida?</h1>
            <p>
              {diagnosticAdvice(state.profile.selfReportedLevel ?? "unknown") === "optional"
                ? "Como você está começando do zero, o diagnóstico é opcional. Pode ir direto para a primeira aula."
                : diagnosticAdvice(state.profile.selfReportedLevel ?? "unknown") === "recommended"
                  ? "Recomendamos o diagnóstico curto do curso para ajustar melhor as próximas atividades."
                  : "Recomendamos muito fazer o diagnóstico: ele ajuda a diferenciar o que você já sabe do que precisa praticar."}
            </p>
            <p>
              São perguntas do curso, sem nota oficial. Seu nível percebido não substitui esse
              resultado.
            </p>
            <div className="onboarding-actions final">
              <button type="button" className="primary-button" disabled={finishing || switching} onClick={() => void finish(true)}>
                Fazer diagnóstico <ArrowRight size={16} />
              </button>
              <button type="button" className="secondary-button" disabled={finishing || switching} onClick={() => void finish(false)}>
                Ir para meu curso
              </button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {finishing && <p role="status">Salvando sua configuração…</p>}
        {step < 7 && (
          <div className="onboarding-actions">
            {step > 0 && (
              <button
                type="button"
                className="secondary-button"
                disabled={switching || finishing}
                onClick={() => go(step === 4 && !hasContextStep ? 2 : step - 1)}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
            )}
            <button
              type="button"
              className="primary-button"
              disabled={!canContinue || switching}
              onClick={() => go(step === 2 && !hasContextStep ? 4 : step + 1)}
            >
              {step === 6 ? "Ver diagnóstico" : "Continuar"}{" "}
              {step === 6 ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
