"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Globe2 } from "lucide-react";
import { SpeakButton } from "@/components/audio/speak-button";
import { useStudy } from "@/components/study-provider";
import { resolveVariant, textToSpeechLocale, variantLabel } from "@/content/language-variant";

export function RegionalGuide() {
  const { state, language, resources, recordRegionalCheck } = useStudy();
  const region = resolveVariant(language, state.profile.variantId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const regionalTopics = resources.regionalTopics;
  const categoryLabels: Record<string, string> = {
    vocabulary: "Palavras do cotidiano",
    address: "Formas de tratamento",
    pronunciation: "Pronúncia",
    expression: "Expressões e construções",
    false_friend: "Falsos amigos",
    formality: "Formalidade",
    portuguese_trap: "Atenção para quem fala português",
  };

  return (
    <section className="regional-guide panel" aria-labelledby="regional-title">
      <span className="eyebrow">
        <Globe2 size={14} /> PARTICULARIDADES
      </span>
      <h2 id="regional-title">Um idioma, várias formas de falar.</h2>
      <p>
        Compare frases do cotidiano. Sua preferência atual é{" "}
        <strong>{variantLabel(language, region)}</strong>. A escolha muda
        exemplos e orienta o professor, sem substituir o conteúdo do curso.
      </p>
      <Link href="/settings" className="secondary-button">
        Alterar minha região
      </Link>
      <div className="regional-topic-list">
        {regionalTopics.map((topic) => {
          const selected = answers[topic.id];
          const correct = selected === (topic.checkAnswer ?? topic.checkRegion);
          const options = topic.checkOptions ?? topic.variants.map((variant) => variant.region);
          return (
            <article key={topic.id} className="regional-topic">
              {topic.category && <span className="pill">{categoryLabels[topic.category] ?? topic.category}</span>}
              <span className="eyebrow">{topic.meaning}</span>
              <h3>{topic.title}</h3>
              <p>{topic.note}</p>
              <div className="regional-variants">
                {topic.variants.map((variant) => (
                  <div
                    className={`regional-variant ${region === variant.region ? "preferred" : ""}`}
                    key={variant.region}
                  >
                    <small>
                      {variantLabel(language, variant.region)}
                    </small>
                    <strong lang={language.id}>{variant.term}</strong>
                    <div className="text-audio-row">
                      <span lang={language.id}>{variant.example}</span>
                      <SpeakButton
                        text={variant.example}
                        locale={textToSpeechLocale(language, variant.region) ?? undefined}
                        label={`Ouvir exemplo da ${variantLabel(language, variant.region)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="regional-check">
                <strong>{topic.checkPrompt}</strong>
                <div>
                  {options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected === option}
                      className={`secondary-button ${selected === option ? "selected" : ""}`}
                      onClick={() => {
                        if (selected !== option) {
                          recordRegionalCheck({
                            topicId: topic.id,
                            selectedAnswer: option,
                            correct: option === (topic.checkAnswer ?? topic.checkRegion),
                          });
                        }
                        setAnswers((current) => ({ ...current, [topic.id]: option }));
                      }}
                    >
                      {topic.checkOptions ? option : variantLabel(language, option)}
                    </button>
                  ))}
                </div>
                {selected && (
                  <p role="status" className={correct ? "inline-success" : "inline-error"}>
                    {correct ? <CheckCircle2 size={16} /> : null}
                    {correct ? "Isso!" : "Compare as frases acima e tente outra região."}
                  </p>
                )}
              </div>
              <div className="regional-sources">
                {topic.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="regional-source"
                  >
                    {source.label} ↗
                  </a>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <p className="basics-future-note">
        Os usos variam dentro de cada país e conforme a situação. Estes exemplos são introdutórios.
      </p>
    </section>
  );
}
