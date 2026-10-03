"use client";

import { useEffect, useState } from "react";
import { SpeakButton } from "./speak-button";
import { useStudy } from "@/components/study-provider";

function selectedText() {
  const active = document.activeElement;
  if (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && ["text", "search"].includes(active.type))
  ) {
    const start = active.selectionStart;
    const end = active.selectionEnd;
    if (start !== null && end !== null && end > start) return active.value.slice(start, end).trim();
  }
  return window.getSelection()?.toString().trim() ?? "";
}

export function SelectionAudio() {
  const { language } = useStudy();
  const [text, setText] = useState("");

  useEffect(() => {
    const update = () => setText(selectedText());
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  if (!text || !language.capabilities.textToSpeech) return null;

  return (
    <div className="selection-audio" onPointerDown={(event) => event.preventDefault()}>
      <SpeakButton text={text} label={`Ouvir texto selecionado em ${language.identity.nativeName}`} withLabel />
    </div>
  );
}
