"use client";
import { useId } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Coffee,
  Compass,
  MessageCircle,
  Plane,
  Sparkles,
  Trophy,
} from "lucide-react";
import { MessageIllustration } from "@/components/activities/lesson-illustrations";
const ideas = [
  { label: "Meu dia", icon: Coffee },
  { label: "Viagens", icon: Plane },
  { label: "Trabalho", icon: BriefcaseBusiness },
  { label: "Esportes", icon: Trophy },
];
export function LiveFreeSetup({
  topic,
  onChange,
  onContinue,
}: {
  topic: string;
  onChange: (topic: string) => void;
  onContinue: () => void;
}) {
  const inputId = useId();
  return (
    <div className="live-free-setup">
      <div className="live-free-scene">
        <div>
          <span className="live-voice-kicker">
            <Sparkles size={14} aria-hidden="true" /> CONVERSA LIVRE
          </span>
          <h2>
            Você traz o assunto.
            <br />A conversa segue com você.
          </h2>
          <p>Conte sobre seu dia, fale de um interesse ou deixe a IA puxar o papo.</p>
        </div>
        <div className="live-free-art">
          <MessageIllustration />
        </div>
      </div>
      <div className="live-free-topic-input">
        <label htmlFor={inputId}>
          Quer começar por algum assunto? <span>Opcional</span>
        </label>
        <input
          id={inputId}
          maxLength={120}
          value={topic}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ex.: futebol, uma viagem, seu dia…"
          autoComplete="off"
        />
        <div className="live-free-ideas">
          {ideas.map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              aria-pressed={topic === label}
              onClick={() => onChange(topic === label ? "" : label)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <p>Você também pode escolher ou mudar o assunto enquanto conversa.</p>
      </div>
      <div className="live-free-how">
        <article>
          <span>
            <MessageCircle size={19} aria-hidden="true" />
          </span>
          <div>
            <h3>Uma troca de verdade</h3>
            <p>A IA acompanha suas respostas e abre espaço para você falar.</p>
          </div>
        </article>
        <article>
          <span>
            <Compass size={19} aria-hidden="true" />
          </span>
          <div>
            <h3>No seu ritmo</h3>
            <p>Mais apoio quando precisar, perguntas mais abertas quando se sentir à vontade.</p>
          </div>
        </article>
      </div>
      <button
        type="button"
        className="live-voice-secondary live-free-continue"
        onClick={onContinue}
      >
        Ajustar minha conversa <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
