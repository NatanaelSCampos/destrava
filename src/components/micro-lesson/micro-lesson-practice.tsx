"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { ConversationVoiceInput } from "@/components/conversation/conversation-voice-input";
import { microLessonSchema, type MicroLesson } from "@/domain/ai/schemas";

const LAST_STEP = 6;

export function MicroLessonPractice({ activityId }: { activityId: string }) {
  const { course, state, recordMicroLesson, recordStudyEvent } = useStudy();
  const [lesson, setLesson] = useState<MicroLesson | null>(null);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [previousRate, setPreviousRate] = useState<number | null>(null);
  const [spoken, setSpoken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mistake = state.mistakes[activityId];
  const context = course.units.flatMap((unit) =>
    unit.lessons.flatMap((entry) =>
      entry.activities.map((activity) => ({ activity, lesson: entry, unit })),
    ),
  ).find((entry) => entry.activity.id === activityId);
  const attempts = (state.microLessonAttempts ?? []).filter((item) => item.activityId === activityId);
  const question = lesson
    ? step >= 1 && step <= 3 ? lesson.exercises[step - 1] : step === 5 ? lesson.finalCheck : null
    : null;
  const score = answers.filter(Boolean).length;
  const currentRate = answers.length ? Math.round((score / answers.length) * 100) : 0;

  async function generate() {
    if (!mistake || !context || loading) return;
    setLoading(true);
    setError("");
    setLesson(null);
    setStep(0);
    setSelected(null);
    setChecked(false);
    setAnswers([]);
    setSpoken("");
    const recent = attempts.slice(0, 4);
    setPreviousRate(recent.length
      ? Math.round((recent.filter((item) => item.correct).length / recent.length) * 100)
      : null);
    try {
      const response = await fetch("/api/ai/micro-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          activityId,
          localMistake: {
            originalAnswer: mistake.originalAnswer,
            correctAnswer: mistake.correctAnswer,
            explanation: mistake.explanation,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar a microlição.");
      const parsed = microLessonSchema.safeParse(data.lesson);
      if (!parsed.success) throw new Error("A microlição veio em um formato inesperado.");
      setLesson(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar a microlição.");
    } finally {
      setLoading(false);
    }
  }

  function checkAnswer() {
    if (!question || selected === null || checked) return;
    const correct = selected === question.correctIndex;
    recordMicroLesson({
      activityId,
      question: question.question,
      selectedOption: question.options[selected],
      correct,
    });
    setAnswers((current) => [...current, correct]);
    setChecked(true);
  }

  function nextStep() {
    setStep((current) => Math.min(current + 1, LAST_STEP));
    setSelected(null);
    setChecked(false);
  }

  return (
    <div className="micro-lesson-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> MICROLIÇÃO PESSOAL</span>
          <h1 className="page-title">Entenda. Pratique. Confira.</h1>
          <p className="page-subtitle">
            Uma explicação, três exercícios, uma fala curta e uma checagem final sobre o mesmo ponto.
          </p>
        </div>
        <Link href="/mistakes" className="secondary-button">Voltar aos erros <ArrowRight size={16} /></Link>
      </div>
      {!mistake || !context ? (
        <div className="empty-state panel">
          <strong>Não encontrei este erro no seu curso.</strong>
          <span>Abra um erro do seu caderno para criar uma microlição.</span>
          <Link href="/mistakes" className="secondary-button">Abrir meus erros <ArrowRight size={16} /></Link>
        </div>
      ) : (
        <div className="micro-lesson-layout">
          <section className="panel micro-lesson-main">
            <span className="eyebrow">{context.lesson.title.toUpperCase()}</span>
            <h2>{context.activity.title}</h2>
            <div className="mistake-comparison">
              <div><span>SUA RESPOSTA</span><p>{mistake.originalAnswer}</p></div>
              <div>
                <span>FORMA ESPERADA</span>
                <p lang={course.languageCode}>
                  {mistake.correctAnswer} <SpeakButton text={mistake.correctAnswer} label="Ouvir resposta esperada" />
                </p>
              </div>
            </div>
            <div className="micro-lesson-known">
              <strong>O ponto a melhorar</strong>
              <p>{mistake.explanation || "Reveja a atividade e compare as duas respostas."}</p>
              {mistake.category === "speaking" && (
                <p>A prática escrita reforça a frase. A atividade original avalia a pronúncia.</p>
              )}
            </div>
            {!lesson && (
              <button type="button" className="primary-button" disabled={loading} onClick={() => void generate()}>
                <Sparkles size={16} /> {loading ? "Criando microlição…" : "Começar microlição com IA"}
              </button>
            )}
            {error && <p className="inline-error" role="alert">{error}</p>}
            {lesson && (
              <div className="micro-lesson-generated">
                <div className="micro-lesson-progress" aria-label={`Etapa ${Math.min(step + 1, LAST_STEP)} de ${LAST_STEP}`}>
                  <span>{step === LAST_STEP ? "Resultado" : `Etapa ${step + 1} de ${LAST_STEP}`}</span>
                  <div className="progress-track"><span style={{ width: `${Math.round((step / LAST_STEP) * 100)}%` }} /></div>
                </div>
                {step === 0 && (
                  <>
                    <span className="eyebrow">ENTENDA O PONTO</span>
                    <h3>{lesson.title}</h3>
                    <p>{lesson.explanation}</p>
                    <div className="micro-lesson-examples">
                      {lesson.examples.map((example, index) => (
                        <div key={index}>
                          <div className="text-audio-row">
                            <strong lang={course.languageCode}>{example.text}</strong>
                            <SpeakButton text={example.text} label={`Ouvir exemplo ${index + 1}`} />
                          </div>
                          <small>{example.translation}</small>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="primary-button" onClick={nextStep}>
                      Praticar <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {question && (
                  <>
                    <span className="eyebrow">{step === 5 ? "CHECAGEM FINAL" : `EXERCÍCIO ${step} DE 3`}</span>
                    <fieldset className="micro-lesson-options" disabled={checked}>
                      <legend>{question.question}</legend>
                      {question.options.map((option, index) => (
                        <label key={`${index}-${option}`} className={selected === index ? "selected" : ""}>
                          <input
                            type="radio"
                            name={`micro-lesson-answer-${step}`}
                            checked={selected === index}
                            onChange={() => setSelected(index)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                    {!checked ? (
                      <button type="button" className="secondary-button" disabled={selected === null} onClick={checkAnswer}>
                        Conferir resposta
                      </button>
                    ) : (
                      <>
                        <div className={`number-result ${selected === question.correctIndex ? "correct" : "wrong"}`} role="status">
                          <strong>{selected === question.correctIndex ? "Acertou!" : "Vamos reforçar este ponto."}</strong>
                          <p>Resposta: {question.options[question.correctIndex]}</p>
                          <p>{question.answerExplanation}</p>
                        </div>
                        <button type="button" className="primary-button micro-lesson-next" onClick={nextStep}>
                          {step === 5 ? "Ver meu resultado" : "Próxima etapa"} <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </>
                )}
                {step === 4 && (
                  <>
                    <span className="eyebrow">AGORA FALE</span>
                    <h3>{lesson.speaking.prompt}</h3>
                    <p>Diga uma frase em voz alta. Se usar o microfone, confira a transcrição antes de seguir.</p>
                    <ConversationVoiceInput
                      disabled={Boolean(spoken)}
                      onTranscript={(text) => {
                        setSpoken(text);
                        recordStudyEvent("micro_lesson_speaking", activityId, { courseId: course.id });
                      }}
                    />
                    {spoken && <p className="micro-lesson-transcript"><strong>Você disse:</strong> {spoken}</p>}
                    <div className="micro-lesson-model">
                      <strong>Um exemplo de resposta</strong>
                      <div className="text-audio-row">
                        <span lang={course.languageCode}>{lesson.speaking.modelAnswer}</span>
                        <SpeakButton text={lesson.speaking.modelAnswer} label="Ouvir exemplo de resposta" />
                      </div>
                      <small>Esta etapa registra a prática, sem nota de pronúncia.</small>
                    </div>
                    <button type="button" className="primary-button micro-lesson-next" onClick={nextStep}>
                      {spoken ? "Continuar" : "Continuar sem gravar"} <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {step === LAST_STEP && (
                  <div className="micro-lesson-summary" role="status">
                    <span className="eyebrow">PRÁTICA CONCLUÍDA</span>
                    <h3>{score} de 4 respostas corretas</h3>
                    <p>{previousRate === null
                      ? "Este é seu primeiro resultado neste ponto. Ele servirá de referência para as próximas tentativas."
                      : `Antes: ${previousRate}% nas últimas questões deste ponto. Agora: ${currentRate}%. ${currentRate > previousRate ? "Houve melhora nesta prática." : "Continue praticando para consolidar este ponto."}`}
                    </p>
                    <small>É uma comparação de exercícios, não uma nota oficial nem avaliação de pronúncia.</small>
                    <div className="micro-lesson-end-actions">
                      <Link
                        href={`/course/${course.slug}/unit/${context.unit.number}/lesson/${context.lesson.slug}?activity=${encodeURIComponent(activityId)}`}
                        className="primary-button"
                      >
                        Refazer atividade <ArrowRight size={15} />
                      </Link>
                      <button type="button" className="secondary-button" onClick={() => void generate()}>
                        Treinar novamente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          <aside className="panel micro-lesson-side">
            <span className="eyebrow">SEU HISTÓRICO</span>
            <h2>{attempts.length} {attempts.length === 1 ? "questão respondida" : "questões respondidas"}</h2>
            <p>{attempts.length
              ? `${attempts.filter((item) => item.correct).length} acertos em microlições deste ponto.`
              : "As respostas aparecerão aqui depois da primeira prática."}</p>
            <p>A revisão espaçada continua disponível para reforçar este ponto.</p>
            <Link href="/review" className="text-link">Abrir revisão <ArrowRight size={15} /></Link>
          </aside>
        </div>
      )}
    </div>
  );
}
