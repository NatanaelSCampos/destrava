"use client";

import { useId, useRef, type ComponentProps, type ReactNode } from "react";
import { useStudy } from "@/components/study-provider";
import { annotatedParts, type ActivityPresentation, type PresentationField } from "@/content/text-presentation";
import {
  resolveTextPresentation,
  inspectBidiControls,
  type TextRole,
} from "@/engine/presentation/text";

type PresentationProps = {
  presentation?: ActivityPresentation;
  field?: PresentationField;
  textRole?: TextRole;
};
export function useTextPresentation(presentation?: ActivityPresentation) {
  const { language, course } = useStudy();
  return (field?: PresentationField, role: TextRole = "target") => ({
    ...resolveTextPresentation(language, course, role, presentation, field),
    "data-learning-text": role,
  });
}
export function BidiTextWarning({ text }: { text: string }) {
  const audit = inspectBidiControls(text);
  if (!audit.controls.length) return null;
  return (
    <small className="bidi-text-warning" dir="ltr" lang="pt-BR" role="status">
      {audit.suspicious
        ? "Atenção: este texto contém controles de direção que podem alterar sua aparência."
        : "Este texto contém marcas de direção."}{" "}
      {[...new Set(audit.controls.map((item) => item.code))].join(", ")}. O texto original foi
      preservado.
    </small>
  );
}
export function LearningText({
  as: Tag = "bdi",
  children,
  text,
  presentation,
  field,
  textRole = "target",
  itemIndex = 0,
  ...props
}: PresentationProps & {
  as?: "bdi" | "span" | "p" | "div" | "strong" | "h2" | "h3" | "li";
  children?: ReactNode;
  text?: string;
  itemIndex?: number;
} & Omit<ComponentProps<"span">, "dir" | "lang" | "ref" | "dangerouslySetInnerHTML">) {
  const resolve = useTextPresentation(presentation);
  const attributes = resolve(field, textRole);
  const parts = text !== undefined && field ? annotatedParts(text, presentation?.annotations?.[field], itemIndex) : undefined;
  return (
    <Tag {...props} {...attributes}>
      {parts ? parts.map((part, index) => part.role ? <bdi key={index} {...resolve(undefined, part.role)} className="learning-inline-term">{part.text}</bdi> : part.text) : text ?? children}
      {text !== undefined && <BidiTextWarning text={text} />}
    </Tag>
  );
}

type CompositionProps = { onCompositionChange?: (composing: boolean) => void };
export function LearningInput({
  presentation,
  field = "input",
  textRole = "user",
  onCompositionChange,
  ...props
}: PresentationProps & CompositionProps & Omit<ComponentProps<"input">, "dir" | "lang">) {
  const attributes = useTextPresentation(presentation)(field, textRole);
  const hintId = useId();
  const separateHint = attributes.dir === "rtl" && Boolean(props.placeholder);
  const composing = useRef(false);
  return (
    <>
      <input
        {...props}
        {...attributes}
        placeholder={separateHint ? undefined : props.placeholder}
        aria-describedby={
          [props["aria-describedby"], separateHint ? hintId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onCompositionStart={(event) => {
          composing.current = true;
          onCompositionChange?.(true);
          props.onCompositionStart?.(event);
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onCompositionChange?.(false);
          props.onCompositionEnd?.(event);
        }}
        onKeyDown={(event) => {
          if (!composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229)
            props.onKeyDown?.(event);
        }}
      />
      {separateHint && (
        <small id={hintId} lang="pt-BR" dir="ltr" data-input-hint>
          {props.placeholder}
        </small>
      )}
      <BidiTextWarning text={typeof props.value === "string" ? props.value : ""} />
    </>
  );
}
export function LearningTextarea({
  presentation,
  field = "input",
  textRole = "user",
  onCompositionChange,
  ...props
}: PresentationProps & CompositionProps & Omit<ComponentProps<"textarea">, "dir" | "lang">) {
  const attributes = useTextPresentation(presentation)(field, textRole);
  const hintId = useId();
  const separateHint = attributes.dir === "rtl" && Boolean(props.placeholder);
  const composing = useRef(false);
  return (
    <>
      <textarea
        {...props}
        {...attributes}
        placeholder={separateHint ? undefined : props.placeholder}
        aria-describedby={
          [props["aria-describedby"], separateHint ? hintId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onCompositionStart={(event) => {
          composing.current = true;
          onCompositionChange?.(true);
          props.onCompositionStart?.(event);
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onCompositionChange?.(false);
          props.onCompositionEnd?.(event);
        }}
        onKeyDown={(event) => {
          if (!composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229)
            props.onKeyDown?.(event);
        }}
      />
      {separateHint && (
        <small id={hintId} lang="pt-BR" dir="ltr" data-input-hint>
          {props.placeholder}
        </small>
      )}
      <BidiTextWarning text={typeof props.value === "string" ? props.value : ""} />
    </>
  );
}
