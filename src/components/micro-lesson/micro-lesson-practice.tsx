"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { microLessonSchema, type MicroLesson } from "@/domain/ai/schemas";

export function MicroLessonPractice({ activityId }: { activityId: string }) {
  const { course, state, recordMicroLesson } = useStudy();
  const [lesson, setLesson] = useState<MicroLesson | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mistake = state.mistakes[activityId];
  const context = course.units
    .flatMap((unit) =>
      unit.lessons.flatMap((entry) =>
        entry.activities.map((activity) => ({ activity, lesson: entry, unit })),
      ),
    )
    .find((entry) => entry.activity.id === activityId);
  const attempts = (state.microLessonAttempts ?? []).filter(
    (item) => item.activityId === activityId,
  );

  async function generate() {
    if (!mistake || !context || loading) return;
    setLoading(true);
    setError("");
    setLesson(null);
    setSelected(null);
    setChecked(false);
    try {
      const response = await fetch("/api/ai/micro-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    if (!lesson || selected === null || checked) return;
    recordMicroLesson({
      activityId,
      question: lesson.question,
      selectedOption: lesson.options[selected],
      correct: selected === lesson.correctIndex,
    });
    setChecked(true);
  }

  return (
    <div className="micro-lesson-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} /> MICROLIÇÃO PESSOAL
          </span>
          <h1 className="page-title">Entenda o erro. Tente de novo.</h1>
          <p className="page-subtitle">
            Uma explicação curta e uma questão para praticar o ponto que apareceu no seu caderno.
          </p>
        </div>
        <Link href="/mistakes" className="secondary-button">
          Voltar aos erros <ArrowRight size={16} />
        </Link>
      </div>
      {!mistake || !context ? (
        <div className="empty-state panel">
          <strong>Não encontrei este erro no seu curso.</strong>
          <span>Abra um erro do seu caderno para criar uma microlição.</span>
          <Link href="/mistakes" className="secondary-button">
            Abrir meus erros <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="micro-lesson-layout">
          <section className="panel micro-lesson-main">
            <span className="eyebrow">{context.lesson.title.toUpperCase()}</span>
            <h2>{context.activity.title}</h2>
            <div className="mistake-comparison">
              <div>
                <span>SUA RESPOSTA</span>
                <p>{mistake.originalAnswer}</p>
              </div>
              <div>
                <span>FORMA ESPERADA</span>
                <p lang={course.languageCode}>
                  {mistake.correctAnswer}{" "}
                  <SpeakButton text={mistake.correctAnswer} label="Ouvir resposta esperada" />
                </p>
              </div>
            </div>
            <div className="micro-lesson-known">
              <strong>Entenda o ponto</strong>
              <p>{mistake.explanation || "Reveja a atividade e compare as duas respostas."}</p>
              {mistake.category === "speaking" && (
                <p>
                  Esta questão ajuda a lembrar a frase. Para avaliar a pronúncia, grave uma nova
                  tentativa na atividade.
                </p>
              )}
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={loading}
              onClick={() => void generate()}
            >
              <Sparkles size={16} />{" "}
              {loading
                ? "Criando microlição…"
                : lesson
                  ? "Criar outra questão"
                  : "Criar microlição com IA"}
            </button>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {lesson && (
              <div className="micro-lesson-generated">
                <span className="eyebrow">EXPLICAÇÃO E PRÁTICA</span>
                <h3>{lesson.title}</h3>
                <p>{lesson.explanation}</p>
                <div className="text-audio-row">
                  <p lang={course.languageCode}>{lesson.example}</p>
                  <SpeakButton text={lesson.example} label="Ouvir exemplo" />
                </div>
                <fieldset className="micro-lesson-options" disabled={checked}>
                  <legend>{lesson.question}</legend>
                  {lesson.options.map((option, index) => (
                    <label
                      key={`${index}-${option}`}
                      className={selected === index ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="micro-lesson-answer"
                        checked={selected === index}
                        onChange={() => setSelected(index)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
                {!checked ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={selected === null}
                    onClick={checkAnswer}
                  >
                    Conferir resposta
                  </button>
                ) : (
                  <div
                    className={
                      selected === lesson.correctIndex
                        ? "number-result correct"
                        : "number-result wrong"
                    }
                    role="status"
                  >
                    <strong>
                      {selected === lesson.correctIndex ? "Acertou!" : "Vamos reforçar este ponto."}
                    </strong>
                    <p>Resposta: {lesson.options[lesson.correctIndex]}</p>
                    <p>{lesson.answerExplanation}</p>
                    <Link
                      href={`/course/${course.slug}/unit/${context.unit.number}/lesson/${context.lesson.slug}?activity=${encodeURIComponent(activityId)}`}
                      className="text-link"
                    >
                      Refazer atividade <ArrowRight size={15} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>
          <aside className="panel micro-lesson-side">
            <span className="eyebrow">SEU HISTÓRICO</span>
            <h2>
              {attempts.length}{" "}
              {attempts.length === 1 ? "questão respondida" : "questões respondidas"}
            </h2>
            <p>
              {attempts.length
                ? `${attempts.filter((item) => item.correct).length} acertos em microlições deste ponto.`
                : "Sua primeira questão aparecerá aqui depois que você responder."}
            </p>
            <p>
              <Check size={16} /> A microlição ajuda a praticar. A revisão espaçada continua
              disponível na fila de revisão.
            </p>
            <Link href="/review" className="text-link">
              Abrir revisão <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
