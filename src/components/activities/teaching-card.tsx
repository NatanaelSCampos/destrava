"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Turtle, Ear, Puzzle, MessageCircle, MapPin, Lightbulb } from "lucide-react";
import { useStudy } from "@/components/study-provider";
import type { ActivityScene } from "@/content/activity-scene";
import { SceneCard } from "./scene-card";
import type { Teaching } from "@/content/teaching";
import type { ActivityPresentation } from "@/content/text-presentation";
import { LearningText } from "@/components/learning/text-presentation";
import { PlaceIllustration, ConversationAvatar } from "./lesson-illustrations";

export function RecordedPhrase({ mediaId, label }: { mediaId: string; label: string }) {
  const { course } = useStudy();
  const asset = course.teachingMedia?.find(item => item.id === mediaId);
  const audio = useRef<HTMLAudioElement>(null);
  const instance = useId();
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = audio.current;
    const suspend = () => { if (document.visibilityState !== "visible") element?.pause(); };
    const stop = () => element?.pause();
    const other = (event: Event) => { if ((event as CustomEvent).detail !== instance) stop(); };
    document.addEventListener("visibilitychange", suspend);
    window.addEventListener("pagehide", stop);
    window.addEventListener("destrava-phrase-playing", other);
    return () => { stop(); document.removeEventListener("visibilitychange", suspend);
      window.removeEventListener("pagehide", stop); window.removeEventListener("destrava-phrase-playing", other); };
  }, [mediaId, instance]);
  if (!asset) return <p role="status">Não foi possível carregar este áudio.</p>;
  async function play(restart = false) {
    const element = audio.current;
    if (!element) return;
    setError("");
    if (restart || element.ended) element.currentTime = 0;
    try { await element.play(); } catch { setError("Não foi possível ouvir. Tente novamente."); }
  }
  return <div className="recorded-phrase">
    <audio ref={audio} preload="metadata" src={asset.src} aria-label={label}
      onPlay={() => { setPlaying(true); window.dispatchEvent(new CustomEvent("destrava-phrase-playing", { detail: instance })); }}
      onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError("O áudio não carregou. Tente novamente."); }} />
    <div className="phrase-audio-controls">
      <button type="button" className="phrase-play-button" aria-label={(playing ? "Pausar: " : "") + label} onClick={() => {
        if (audio.current && !audio.current.paused) audio.current.pause(); else void play();
      }}>{playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{playing ? "Pausar" : "Ouvir"}</button>
      <button type="button" className="phrase-repeat-button" title="Ouvir novamente" aria-label={"Ouvir novamente: " + label} onClick={() => void play(true)}><RotateCcw size={14} aria-hidden="true" /></button>
      <button type="button" className="phrase-slow-button" aria-pressed={slow} title="Ouvir mais devagar" onClick={() => {
        if (audio.current) { audio.current.preservesPitch = true; audio.current.playbackRate = slow ? 1 : 0.8; }
        setSlow(!slow);
      }}><Turtle size={15} aria-hidden="true" /><span>Mais devagar</span></button>
    </div>
    {error && <p role="alert">{error}</p>}
    <details className="media-credit"><summary>Sobre este áudio</summary><p>{asset.credit}</p>
      <a href={asset.sourceUrl} target="_blank" rel="noreferrer">Autoria</a>{" · "}
      <a href={asset.licenseUrl} target="_blank" rel="noreferrer">Condições de uso</a>
    </details>
  </div>;
}

export function TeachingCard({ teaching, presentation, scene }: { teaching: Teaching; presentation?: ActivityPresentation; scene?: ActivityScene }) {
  const explanation = teaching.support && <section className="teaching-explanation"><h3><Lightbulb aria-hidden="true" /> Entenda a mensagem</h3><div>{teaching.support.split("\n\n").map((paragraph, index) => <LearningText key={index} as="p" presentation={presentation} field="support" itemIndex={index} textRole="source" text={paragraph} />)}</div></section>;
  const speakers = [...new Set(teaching.lines.flatMap(line => line.speaker ? [line.speaker] : []))];
  if (scene && teaching.kind === "concept") {
    const lead = scene.cue ?? teaching.lines[0];
    const other = teaching.lines.filter(line => line.text !== lead.text);
    return <div className="teaching-content teaching-scene">
      <SceneCard scene={scene} presentation={presentation}>
        <div className="scene-teaching-lead">
          <LearningText as="p" className="teaching-phrase" presentation={presentation} textRole="target" text={lead.text} />
          {lead.translation && <LearningText as="p" className="teaching-translation" presentation={presentation} textRole="source" text={lead.translation} />}
          {lead.audioMediaId && <RecordedPhrase mediaId={lead.audioMediaId} label={"Ouvir: " + lead.text} />}
        </div>
      </SceneCard>
      {!!other.length && <div className="lesson-other-places">{other.map((line, index) => <section className="lesson-place-card" key={index}>
        <span className="lesson-place-symbol"><MessageCircle aria-hidden="true" /></span>
        <div><LearningText as="strong" presentation={presentation} textRole="target" text={line.text} />
          {line.translation && <LearningText as="p" className="teaching-translation" presentation={presentation} textRole="source" text={line.translation} />}</div>
        {line.audioMediaId && <RecordedPhrase mediaId={line.audioMediaId} label={"Ouvir: " + line.text} />}
      </section>)}</div>}
      {explanation}
    </div>;
  }
  if (teaching.diagram && teaching.kind === "concept") {
    const place = teaching.diagram.nodes.find(node => node.id === teaching.diagram!.links[0]?.to);
    const first = teaching.lines[0];
    return <div className="teaching-content teaching-scene">
      <div className="lesson-scene-hero">
        <div className="lesson-scene-copy">
          <span className="le-eyebrow"><MapPin size={13} aria-hidden="true" /> {place?.label ?? "O lugar do encontro"}</span>
          <LearningText as="h3" presentation={presentation} textRole="target" text={first.text} />
          {first.translation && <p lang="pt-BR" className="teaching-translation">{first.translation}</p>}
          {first.audioMediaId && <RecordedPhrase mediaId={first.audioMediaId} label={"Ouvir: " + first.text} />}
        </div>
        <PlaceIllustration label={place?.label ?? "O lugar do encontro"} />
      </div>
      {explanation}
      {teaching.lines.length > 1 && <div className="lesson-other-places">{teaching.lines.slice(1).map(line => <div className="lesson-place-card" key={line.text}>
        <span className="lesson-place-symbol"><MapPin aria-hidden="true" /></span><div><LearningText as="strong" presentation={presentation} textRole="target" text={line.text} />{line.translation && <small lang="pt-BR">{line.translation}</small>}</div>
        {line.audioMediaId && <RecordedPhrase mediaId={line.audioMediaId} label={"Ouvir: " + line.text} />}
      </div>)}</div>}
      <div className="lesson-learning-tiles">
        <div><Ear aria-hidden="true" /><b>Primeiro ouvir</b><small>Uma mensagem curta.</small></div>
        <div><Puzzle aria-hidden="true" /><b>Depois entender</b><small>Uma ideia de cada vez.</small></div>
        <div><MessageCircle aria-hidden="true" /><b>Por fim, conversar</b><small>Com suas palavras.</small></div>
      </div>

    </div>;
  }
  return <div className={"teaching-content teaching-" + teaching.kind}>
    {scene && <SceneCard scene={scene} presentation={presentation} />}
    <div className="teaching-lines">
      {teaching.lines.map((line, index) => <div className="teaching-turn" key={index} data-speaker-position={line.speaker ? speakers.indexOf(line.speaker) % 2 : undefined}>
        {line.speaker && <span className="teaching-avatar"><ConversationAvatar alternate={speakers.indexOf(line.speaker) % 2 === 1} /></span>}
        <section className="teaching-line">
          <div className="teaching-bubble-head">
            {line.speaker && <h3 className="teaching-speaker">{line.speaker}</h3>}
            {line.audioMediaId && <RecordedPhrase mediaId={line.audioMediaId} label={"Ouvir: " + line.text} />}
          </div>
          <LearningText as="p" className="teaching-phrase" presentation={presentation} textRole="target" text={line.text} />
          {line.translation && <p className="teaching-translation" lang="pt-BR">{line.translation}</p>}
        </section>
      </div>)}
    </div>
    {explanation}
  </div>;
}
