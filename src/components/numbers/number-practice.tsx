"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Hash, Headphones, Mic2 } from "lucide-react";
import type { PublicActivity } from "@/content/public";
import { useStudy } from "@/components/study-provider";
import { SpeakButton } from "@/components/audio/speak-button";
import { SpeakingRecorder } from "@/components/activities/speaking-recorder";
import {
  findNumberPrompt,
  gradeNumberDictation,
  numberCategoryLabels,
  numberPrompts,
  numberSpeechScore,
  type NumberCategory,
  type NumberMode,
} from "@/domain/numbers/number-practice";

type Speaking = Extract<PublicActivity, { type: "speaking" }>;
const categories = Object.keys(numberCategoryLabels) as NumberCategory[];
const modes: { id: NumberMode; title: string; detail: string }[] = [
  { id: "dictation", title: "Ouvir e digitar", detail: "Escute e escreva os algarismos." },
  { id: "speaking", title: "Ver e falar", detail: "Leia os algarismos e fale em espanhol." },
  { id: "repetition", title: "Ouvir e repetir", detail: "Escute, repita e compare sua fala." },
];

export function NumberPractice({ initialPromptId }: { initialPromptId?: string }) {
  const { course, state, recordNumberPractice } = useStudy();
  const initial = findNumberPrompt(initialPromptId ?? "") ?? numberPrompts[0];
  const [category, setCategory] = useState<NumberCategory>(initial.category);
  const [promptId, setPromptId] = useState(initial.id);
  const [mode, setMode] = useState<NumberMode>("dictation");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [speechRevealed, setSpeechRevealed] = useState(false);
  const [speechOutcome, setSpeechOutcome] = useState<null | { correct: boolean; score: number }>(
    null,
  );
  const available = numberPrompts.filter((item) => item.category === category);
  const prompt = findNumberPrompt(promptId) ?? available[0];
  const attempts = (state.numberAttempts ?? []).filter((item) => findNumberPrompt(item.promptId));
  const currentAttempts = attempts.filter((item) => item.promptId === prompt.id);
  const mistakes = numberPrompts
    .map((item) => ({
      prompt: item,
      misses: attempts.filter((attempt) => attempt.promptId === item.id && !attempt.correct).length,
    }))
    .filter((item) => item.misses > 0)
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 5);
  const speakingActivity: Speaking = {
    id: `number-${prompt.id}`,
    type: "speaking",
    title: `${numberCategoryLabels[prompt.category]}: ${prompt.display}`,
    prompt: `Fale ${prompt.display} em espanhol.`,
    skill: "speaking",
    conceptIds: ["numbers"],
    minutes: 2,
    guidance: [
      mode === "speaking"
        ? `Leia ${prompt.display} e diga o número por extenso em espanhol.`
        : "Escute o modelo e tente repetir com clareza.",
    ],
    referenceText: prompt.spoken,
  };

  function reset(nextPromptId: string, nextMode = mode) {
    setPromptId(nextPromptId);
    setMode(nextMode);
    setAnswer("");
    setResult(null);
    setSpeechRevealed(false);
    setSpeechOutcome(null);
  }

  function submitDictation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || result !== null) return;
    const correct = gradeNumberDictation(prompt, answer);
    recordNumberPractice({
      promptId: prompt.id,
      mode,
      answer: answer.trim(),
      correct,
      score: correct ? 100 : 0,
    });
    setResult(correct);
  }

  if (!course.languageCode.startsWith("es"))
    return (
      <div className="empty-state panel">
        <Hash size={28} />
        <strong>A prática de números ainda não tem conteúdo para este idioma.</strong>
        <span>
          As atividades de números em espanhol continuam disponíveis no curso correspondente.
        </span>
        <Link href="/dashboard" className="secondary-button">
          Voltar à visão geral
        </Link>
      </div>
    );

  return (
    <div className="numbers-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <Hash size={13} /> NÚMEROS EM USO
          </span>
          <h1 className="page-title">Escute, escreva e fale números.</h1>
          <p className="page-subtitle">
            Pratique valores, datas, horários e números do dia a dia. Suas dificuldades entram no
            perfil de aprendizado.
          </p>
        </div>
        <Link href="/progress" className="secondary-button">
          Ver meu progresso <ArrowRight size={16} />
        </Link>
      </div>
      <div className="number-controls panel">
        <label>
          Tipo de número
          <select
            value={category}
            onChange={(event) => {
              const next = event.target.value as NumberCategory;
              setCategory(next);
              reset(numberPrompts.find((item) => item.category === next)!.id);
            }}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {numberCategoryLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exemplo
          <select value={prompt.id} onChange={(event) => reset(event.target.value)}>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.display}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="number-mode-list" role="group" aria-label="Modo de prática">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={mode === item.id ? "active" : ""}
            onClick={() => reset(prompt.id, item.id)}
          >
            {item.id === "dictation" ? <Headphones size={17} /> : <Mic2 size={17} />}
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>
      <div className="number-layout">
        <section className="panel number-work">
          <span className="eyebrow">
            {numberCategoryLabels[prompt.category].toUpperCase()} ·{" "}
            {modes.find((item) => item.id === mode)?.title.toUpperCase()}
          </span>
          {mode === "dictation" ? (
            <>
              <h2>Que número você ouviu?</h2>
              <p>Ouça quantas vezes precisar e digite usando algarismos.</p>
              <SpeakButton text={prompt.spoken} label="Ouvir número em espanhol" withLabel />
              <form onSubmit={submitDictation} className="number-answer-form">
                <label htmlFor="number-answer">Sua resposta</label>
                <input
                  id="number-answer"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={result !== null}
                  placeholder="Digite o número"
                />
                <button className="primary-button" disabled={!answer.trim() || result !== null}>
                  Conferir resposta
                </button>
              </form>
              {result !== null && (
                <div
                  className={result ? "number-result correct" : "number-result wrong"}
                  role="status"
                >
                  <strong>{result ? "Acertou!" : "Vale repetir este número."}</strong>
                  <p>
                    Resposta: {prompt.display} ·{" "}
                    <span lang={course.languageCode}>{prompt.spoken}</span>
                  </p>
                  <SpeakButton text={prompt.spoken} label="Ouvir a resposta" withLabel />
                </div>
              )}
            </>
          ) : (
            <>
              <h2>
                {mode === "speaking" ? `Fale ${prompt.display} em espanhol` : "Escute e repita"}
              </h2>
              {mode === "speaking" && <p className="number-display">{prompt.display}</p>}
              <SpeakingRecorder
                key={`${prompt.id}-${mode}`}
                activity={speakingActivity}
                numberPromptId={prompt.id}
                showReference={false}
                showReferenceAudio={mode === "repetition"}
                referenceHint={
                  mode === "speaking"
                    ? `Leia ${prompt.display} e fale sem ouvir o modelo.`
                    : "Escute o modelo e repita sem ler."
                }
                onNumberAssessed={(feedback) => {
                  const grade = numberSpeechScore(feedback);
                  recordNumberPractice({
                    promptId: prompt.id,
                    mode,
                    answer: feedback.recognizedText,
                    ...grade,
                  });
                  setSpeechRevealed(true);
                  setSpeechOutcome(grade);
                }}
              />
              {speechOutcome && (
                <div
                  className={
                    speechOutcome.correct ? "number-result correct" : "number-result wrong"
                  }
                  role="status"
                >
                  <strong>
                    {speechOutcome.correct
                      ? "Alvo de treino alcançado"
                      : "Vale repetir este número"}
                  </strong>
                  <p>
                    Indicador de clareza e completude: {speechOutcome.score}/100. Compare com o
                    modelo e tente novamente quando quiser.
                  </p>
                </div>
              )}
              {mode === "speaking" && speechRevealed && (
                <div className="number-reference">
                  <span>Compare com o modelo:</span>
                  <SpeakButton text={prompt.spoken} label="Ouvir modelo" withLabel />
                </div>
              )}
            </>
          )}
          <button
            type="button"
            className="secondary-button number-next"
            onClick={() =>
              reset(
                available[
                  (available.findIndex((item) => item.id === prompt.id) + 1) % available.length
                ].id,
              )
            }
          >
            Próximo exemplo <ArrowRight size={15} />
          </button>
        </section>
        <aside className="panel number-history">
          <span className="eyebrow">SEU HISTÓRICO</span>
          <h2>
            {currentAttempts.length} {currentAttempts.length === 1 ? "tentativa" : "tentativas"} de{" "}
            {prompt.display}
          </h2>
          <p>
            {currentAttempts.length
              ? `${currentAttempts.filter((item) => item.correct).length} acertos até agora.`
              : "Faça a primeira tentativa para acompanhar sua evolução."}
          </p>
          <h3>Para treinar de novo</h3>
          {mistakes.length ? (
            <ul>
              {mistakes.map(({ prompt: item, misses }) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory(item.category);
                      reset(item.id);
                    }}
                  >
                    {item.display}{" "}
                    <span>
                      {misses} {misses === 1 ? "erro" : "erros"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Os números que você errar aparecerão aqui.</p>
          )}
          <small>
            Os indicadores da fala servem para orientar sua prática. Não são uma nota de aprovação.
          </small>
        </aside>
      </div>
    </div>
  );
}
