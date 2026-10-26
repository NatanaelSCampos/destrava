"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ClipboardList,
  Compass,
  Flag,
  History,
  Lightbulb,
  ListChecks,
  Sparkles,
  Target,
} from "lucide-react";
import type { AssessmentDefinition } from "@/content/contracts";
import "./assessment-experience.css";

export const assessmentMoments = {
  diagnostic: {
    label: "Para começar",
    description: "Descubra o que você já reconhece.",
    Icon: Compass,
  },
  formative: {
    label: "Para praticar",
    description: "Veja o que ficou e o que vale retomar.",
    Icon: Sparkles,
  },
  summative: {
    label: "Para concluir",
    description: "Reúna o que você praticou até aqui.",
    Icon: Flag,
  },
} as const;

export function assessmentSize(assessment: AssessmentDefinition) {
  return assessment.method === "adaptive"
    ? assessment.skillPlan.length
    : assessment.activityIds.length;
}

function AssessmentIllustration() {
  return (
    <svg viewBox="0 0 300 230" fill="none" aria-hidden="true" className="assessment-illustration">
      <ellipse cx="158" cy="208" rx="121" ry="12" fill="#EACBAD" />
      <path
        d="M38 194c-9-41 6-80 36-98M49 169l-22-14M54 152l23-8"
        stroke="#83AA89"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <rect
        x="78"
        y="28"
        width="157"
        height="171"
        rx="16"
        fill="#315C55"
        transform="rotate(6 78 28)"
      />
      <rect
        x="89"
        y="42"
        width="132"
        height="145"
        rx="9"
        fill="#FFFCF6"
        transform="rotate(6 89 42)"
      />
      <rect
        x="124"
        y="22"
        width="62"
        height="24"
        rx="8"
        fill="#D9A67F"
        transform="rotate(6 124 22)"
      />
      <g transform="rotate(6 130 100)">
        <rect x="103" y="71" width="23" height="23" rx="7" fill="#DCEEE5" />
        <path
          d="m109 82 5 5 8-10"
          stroke="#317F69"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M138 78h55M138 89h39" stroke="#A8BDB3" strokeWidth="4" strokeLinecap="round" />
        <rect x="103" y="108" width="23" height="23" rx="7" fill="#DCEEE5" />
        <path
          d="m109 119 5 5 8-10"
          stroke="#317F69"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M138 115h55M138 126h29" stroke="#A8BDB3" strokeWidth="4" strokeLinecap="round" />
        <rect x="103" y="145" width="23" height="23" rx="7" fill="#F7E4D0" />
        <path d="M138 152h55M138 163h44" stroke="#CBB49D" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path d="m208 178 44-81 12 7-44 81-15 10 3-17Z" fill="#BE2346" />
      <path d="m208 178 12 7-15 10 3-17Z" fill="#D9A67F" />
      <path d="m254 91 5-9a7 7 0 0 1 12 7l-5 9" fill="#E7A1AD" />
      <path
        d="m249 41 4-11M263 47l10-5M59 65l-7-7"
        stroke="#C58D61"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="253" cy="166" r="5" fill="#9DC4B0" />
    </svg>
  );
}

export function AssessmentChoiceIntro({
  invalidReference = false,
}: {
  invalidReference?: boolean;
}) {
  return (
    <section className="assessment-experience assessment-choice-intro">
      <div className="assessment-scene">
        <div className="assessment-scene-copy">
          <span className="eyebrow">
            <Compass size={15} aria-hidden="true" /> Um momento para você
          </span>
          <h1>
            {invalidReference ? "Escolha uma avaliação deste curso" : "Por onde vamos começar?"}
          </h1>
          <p>
            Escolha uma prática nos cards. Cada uma ajuda a perceber o que você já sabe e o que
            merece mais atenção.
          </p>
          <span className="assessment-count">
            <ListChecks size={17} aria-hidden="true" /> Um passo de cada vez
          </span>
        </div>
        <AssessmentIllustration />
      </div>
      <div className="assessment-choice-guide">
        {Object.entries(assessmentMoments).map(([key, moment]) => (
          <div key={key}>
            <span className="assessment-icon">
              <moment.Icon size={21} aria-hidden="true" />
            </span>
            <h2>{moment.label}</h2>
            <p>{moment.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AssessmentHeader({ assessment }: { assessment: AssessmentDefinition }) {
  const { label, Icon } = assessmentMoments[assessment.purpose];
  return (
    <header className="page-heading assessment-heading">
      <div>
        <span className="eyebrow">
          <Icon size={15} aria-hidden="true" /> {label}
        </span>
        <h1 className="page-title">{assessment.title}</h1>
        <p className="page-subtitle">
          Um momento para perceber o que você aprendeu e escolher o próximo passo.
        </p>
      </div>
    </header>
  );
}

export function AssessmentIntro({
  assessment,
  skills,
  onStart,
  disabled = false,
  openWriting = false,
}: {
  assessment: AssessmentDefinition;
  skills: readonly string[];
  onStart: () => void;
  disabled?: boolean;
  openWriting?: boolean;
}) {
  const count = assessmentSize(assessment);
  const exam = assessment.method === "fixed" && assessment.exam;
  return (
    <section className="assessment-welcome adaptive-intro" aria-label="Antes de começar">
      <div className="assessment-scene">
        <div className="assessment-scene-copy">
          <span className="eyebrow">
            <ClipboardList size={15} aria-hidden="true" /> Seu próximo passo
          </span>
          <h2>{exam ? "Hora de reunir o que aprendeu" : "Vamos descobrir juntos?"}</h2>
          <p>
            {exam
              ? "Responda sem consultar os exemplos. Todas as respostas serão conferidas juntas, ao terminar."
              : "Responda com o que você sabe hoje. O resultado ajuda a encontrar o que vale praticar de novo."}
          </p>
          <span className="assessment-count">
            <ListChecks size={17} aria-hidden="true" /> {count}{" "}
            {count === 1 ? "atividade" : "atividades"} · uma por vez
          </span>
          <button type="button" className="primary-button" disabled={disabled} onClick={onStart}>
            {exam ? "Começar prova" : "Começar avaliação"}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </div>
        <AssessmentIllustration />
      </div>
      <ol className="assessment-how" aria-label="Como funciona">
        <li>
          <span className="assessment-icon">
            <BookOpen size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>Leia com calma</strong>
            <p>Veja a situação antes de responder.</p>
          </div>
        </li>
        <li>
          <span className="assessment-icon">
            <CheckCheck size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>Uma de cada vez</strong>
            <p>
              {assessment.method === "adaptive"
                ? "A próxima pergunta considera sua resposta."
                : "Responda e siga para a próxima atividade."}
            </p>
          </div>
        </li>
        <li>
          <span className="assessment-icon">
            <Compass size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>Encontre seu caminho</strong>
            <p>No final, veja seu resultado e o que retomar.</p>
          </div>
        </li>
      </ol>
      {exam && (
        <p className="assessment-observe">
          <Target size={18} aria-hidden="true" /> A meta é acertar pelo menos{" "}
          {Math.round(assessment.passingPolicy.overall * 100)}%. Você pode refazer a prova; cada
          tentativa fica no seu histórico.
        </p>
      )}
      <aside className="assessment-observe">
        <div>
          <span className="assessment-icon">
            <Target size={22} aria-hidden="true" />
          </span>
          <div>
            <h3>O que vamos observar</h3>
            <ul>
              {skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
        </div>
        {openWriting && (
          <p>
            Textos livres ficam salvos como prática. A qualidade linguística dessas respostas não
            recebe nota automática.
          </p>
        )}
        <p>
          <Lightbulb size={17} aria-hidden="true" /> O resultado descreve esta prática. Ele não
          comprova, sozinho, o domínio de um nível do idioma.
        </p>
      </aside>
    </section>
  );
}

export function AssessmentProgress({
  current,
  total,
  skill,
}: {
  current: number;
  total: number;
  skill?: string;
}) {
  return (
    <div className="assessment-progress">
      <div>
        <span className="eyebrow">
          <ListChecks size={15} aria-hidden="true" /> Sua vez
        </span>
        <span className="assessment-count">
          {current} de {total}
        </span>
      </div>
      <div
        className="assessment-progress-track"
        role="progressbar"
        aria-label="Atividade atual"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={"Atividade " + current + " de " + total}
      >
        <span style={{ width: (total ? (current / total) * 100 : 0) + "%" }} />
      </div>
      {skill && <span className="assessment-skill-label">{skill}</span>}
    </div>
  );
}

type HistoricalResult = {
  passed?: boolean | null;
  id: string;
  finishedAt: string;
  objectiveScore?: number | null;
  label?: string;
  edition?: string;
  answers?: readonly { correct: boolean | null }[];
};
export function assessmentScoreLabel(result: Pick<HistoricalResult, "objectiveScore" | "answers">) {
  if (result.objectiveScore == null) return "Sem nota";
  const objective = result.answers?.filter((a) => a.correct !== null);
  const score = objective?.length
    ? (100 * objective.filter((a) => a.correct).length) / objective.length
    : result.objectiveScore;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(score) + "%";
}
export function AssessmentHistory({
  results,
  title = "Resultados anteriores",
}: {
  results: readonly HistoricalResult[];
  title?: string;
}) {
  if (!results.length) return null;
  return (
    <section className="assessment-history" aria-label={title}>
      <h3>
        <History size={18} aria-hidden="true" /> {title} <span>({results.length})</span>
      </h3>
      <p>Guardados como foram registrados. Eles não substituem o resultado da edição atual.</p>
      <ul>
        {results.map((item, index) => (
          <li key={item.id}>
            <span className="assessment-history-entry">
              <b>{item.label ?? "Tentativa " + (results.length - index)}</b>
              {typeof item.passed === "boolean" && (
                <small>{item.passed ? "Meta atingida" : "Meta não atingida"}</small>
              )}
              {item.edition && <small>Edição {item.edition}</small>}
              <span>
                <Check size={15} aria-hidden="true" />{" "}
                {new Date(item.finishedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </span>
            <strong>{assessmentScoreLabel(item)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
