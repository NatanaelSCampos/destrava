"use client";
import { journeyText } from "@/lib/journey-text";
import Link from "@/components/navigation-link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Clock3,
  Headphones,
  History,
  Map,
  MessageCircle,
  Route,
  Settings2,
  Trophy,
} from "lucide-react";
import { useStudy } from "@/components/study-provider";
import { useLivingTrail } from "@/components/trail/use-living-trail";
import { TrailArtwork } from "@/components/trail/trail-artwork";
import { TrailMemory } from "@/components/trail/trail-memory";
import { trailReturnHref } from "@/lib/trail-location";
import { learningActionAvailability } from "@/domain/study/learning-action-availability";
import "@/components/trail/living-trail.css";
export default function DashboardPage() {
  const { course, state, ready, runtime } = useStudy();
  const { trail, continuation } = useLivingTrail();
  const chapter =
    continuation?.chapter ??
    trail.chapters.find((c) => c.id === trail.currentChapterId) ??
    trail.chapters[0];
  const activeSession = state.sessions.find(
    (s) => s.id === state.activeSessionId && !s.finishedAt && s.plan.length > 0,
  );
  const next = continuation?.moment,
    planItem = activeSession?.plan[activeSession.cursor ?? 0];
  const primaryHref = activeSession ? "/study" : (continuation?.href ?? "/course/" + course.slug);
  const milestone = chapter?.moments.find((m) => m.isExam) ?? chapter?.moments.at(-1);
  const conversation = learningActionAvailability(
    course,
    { kind: "conversation" },
    { source: runtime ? "installed" : "compiled", permitted: true },
  );
  const guided = trail.chapters
    .flatMap((c) => c.moments)
    .find(
      (m) => m.kind === "guided" && ["available", "in_progress", "completed"].includes(m.status),
    );
  if (!ready) return <div className="page-loading">Encontrando seu próximo momento…</div>;
  return (
    <div className="tv-home">
      <header className="tv-home-heading">
        <div>
          <span className="tv-kicker">
            <Route size={15} /> SEU CAMINHO DE APRENDIZAGEM
          </span>
          <h1>Vamos continuar de onde você está.</h1>
          <p>Um próximo passo claro. O resto pode esperar.</p>
        </div>
        <Link className="tv-quiet-link" href="/settings">
          <Settings2 size={15} /> Preferências de estudo
        </Link>
      </header>
      <div className="tv-home-layout">
        <div className="tv-home-primary">
          <section className="tv-home-hero" aria-labelledby="tv-next-title">
            <div>
              <span className="tv-kicker">
                {activeSession ? "SUA PRÁTICA EM ANDAMENTO" : "SEU PRÓXIMO MOMENTO"}
              </span>
              <h2 id="tv-next-title">
                {activeSession
                  ? (planItem?.title ?? "Sua sessão continua aqui")
                  : (next?.title ?? "Seu percurso continua aberto")}
              </h2>
              <p>
                {activeSession
                  ? "Seu roteiro e seu tempo de prática continuam guardados. Retome a sessão que já começou."
                  : (next?.objective ??
                    next?.description ??
                    "Explore o caminho e revisite as situações que você já estudou.")}
              </p>
              <Link className="primary-button" href={primaryHref}>
                {activeSession
                  ? "Retomar minha prática"
                  : next
                    ? next.status === "in_progress"
                      ? "Continuar aprendendo"
                      : "Começar este momento"
                    : "Abrir minha trilha"}
                <ArrowRight size={17} />
              </Link>
            </div>
            <TrailArtwork />
          </section>
          {chapter && (
            <section className="tv-home-chapter">
              <header>
                <div>
                  <span className="tv-kicker">SUA HISTÓRIA · {course.title}</span>
                  <h3>{journeyText(chapter.title)}</h3>
                </div>
                <div className="tv-mini-map" aria-hidden="true">
                  <span>
                    <MessageCircle size={18} />
                  </span>
                  <i />
                  <span>
                    <Brain size={18} />
                  </span>
                  <i />
                  <span>
                    <Trophy size={18} />
                  </span>
                </div>
              </header>
              <div
                className="tv-progress"
                role="progressbar"
                aria-label="Conteúdo estudado nesta parte do caminho"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={chapter.progress.participationPercentage}
              >
                <span style={{ width: chapter.progress.participationPercentage + "%" }} />
              </div>
              <small>
                {chapter.progress.participationPercentage.toLocaleString("pt-BR")}% do conteúdo
                estudado · {chapter.progress.completed} de {chapter.progress.total} atividades
              </small>
              <p>{journeyText(chapter.description)}</p>
              <Link
                className="tv-quiet-link"
                href={trailReturnHref(course.slug, chapter.number, next?.id)}
              >
                Ver meu lugar na trilha <ArrowRight size={15} />
              </Link>
            </section>
          )}
          <nav className="tv-home-secondary" aria-label="Outras formas de praticar">
            <Link className="tv-home-tool" href="/study">
              <Clock3 size={22} />
              <strong>Uma prática sob medida</strong>
              <small>Escolha o tempo para uma sessão com começo e fim.</small>
            </Link>
            {guided ? (
              <Link className="tv-home-tool" href="/live-classes">
                <Headphones size={22} />
                <strong>Aprender com uma aula guiada</strong>
                <small>Ouça, acompanhe o quadro e faça uma pausa.</small>
              </Link>
            ) : (
              <Link className="tv-home-tool" href={"/course/" + course.slug}>
                <BookOpen size={22} />
                <strong>Explorar as situações</strong>
                <small>Veja o que você já pode estudar no curso.</small>
              </Link>
            )}
            {conversation.eligible ? (
              <Link className="tv-home-tool" href="/conversation">
                <MessageCircle size={22} />
                <strong>Levar para uma conversa</strong>
                <small>Escolha um assunto e pratique com o professor.</small>
              </Link>
            ) : (
              <Link className="tv-home-tool" href="/vocabulary">
                <BookOpen size={22} />
                <strong>Reencontrar as palavras</strong>
                <small>Explore o vocabulário disponível no curso.</small>
              </Link>
            )}
          </nav>
        </div>
        <aside className="tv-home-support">
          <TrailMemory />
          {milestone && (
            <section className="tv-home-milestone">
              <Trophy size={27} />
              <span className="tv-kicker">PARA ONDE VOCÊ VAI</span>
              <h2>{milestone.title}</h2>
              <p>
                {milestone.result?.passed
                  ? "Este marco já faz parte do seu caminho. Seu resultado continua no histórico."
                  : milestone.isExam
                    ? "Um desafio para reunir o que você praticou e abrir o próximo trecho do caminho."
                    : milestone.description}
              </p>
              {milestone.access.total !== undefined && (
                <p>
                  {milestone.access.completed} de {milestone.access.total} práticas consideradas ·
                  abre com {milestone.access.required}.
                </p>
              )}
              <Link
                className="tv-quiet-link"
                href={trailReturnHref(course.slug, chapter!.number, milestone.id)}
              >
                Ver este marco no caminho <ArrowRight size={15} />
              </Link>
            </section>
          )}
        </aside>
      </div>
      <footer className="tv-home-foot">
        <span>
          {trail.summary.completed} atividades estudadas ·{" "}
          {trail.summary.percentage.toLocaleString("pt-BR")}% do curso
        </span>
        <div>
          <Link href="/progress">
            <Map size={15} /> Meu progresso
          </Link>
          <Link href="/history">
            <History size={15} /> Meu histórico
          </Link>
        </div>
      </footer>
    </div>
  );
}
