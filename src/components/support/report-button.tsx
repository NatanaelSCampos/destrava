/* eslint-disable @next/next/no-img-element -- Local reviewed JPEG previews, never remote image optimization. */
"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bug, Camera, Check, Download, ImagePlus, Send, Trash2, X } from "lucide-react";
import { sanitizeReportText, sanitizeReportContext } from "@/lib/support-report";
type Image = { name: string; data: string };
type Context = {
  activityId?: string | null;
  part?: { index: number; count: number } | null;
  path: string;
  courseId: string | null;
  contentVersion: string | null;
  viewport: { width: number; height: number };
  occurredAt: string;
};
const privateSelector =
  'input,textarea,select,video,[contenteditable="true"],[data-report-private],.tutor-drawer,.conversation-messages,.chat-messages,.speaking-transcript,.writing-response,.account-security,.security-enrollment,.auth-card,[data-sensitive],code,.option.selected,.ordering-answer,.activity-feedback,.feedback-card,.writing-feedback,.focused-conversation-turns,.describe-feedback,.describe-history,.live-teaching,.live-teaching-reply,.live-question-history,img[src^="blob:"],img[src^="data:"]';
async function compactImage(src: string): Promise<string> {
  const image = new window.Image();
  image.src = src;
  await image.decode();
  const ratio = Math.min(
    1,
    1600 / image.naturalWidth,
    2200 / image.naturalHeight,
    Math.sqrt(3_000_000 / (image.naturalWidth * image.naturalHeight)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Imagem indisponível.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL("image/jpeg", 0.65);
  if (result.length > 800_000) throw new Error("Esta imagem é grande demais. Escolha uma menor.");
  return result;
}
export function ReportButton() {
  const [open, setOpen] = useState(false),
    [images, setImages] = useState<Image[]>([]),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState("");
  const [frozen, setFrozen] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const update = () => {
      const all = Array.from(
        document.querySelectorAll<HTMLDialogElement>("dialog[open]:not(.report-dialog)"),
      );
      const next = all.at(-1) ?? null;
      setPortalHost((current) => (current === next ? current : next));
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    queueMicrotask(update);
    return () => observer.disconnect();
  }, []);
  const [busy, setBusy] = useState(false),
    [capturing, setCapturing] = useState(false),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState(""),
    [issue, setIssue] = useState<string | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const packet = useRef<Record<string, unknown> | null>(null),
    opener = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  async function start() {
    setOpen(true);
    setTitle("");
    setDescription("");
    setImages([]);
    setConsent(false);
    setMessage("");
    setIssue(null);
    packet.current = null;
    setFrozen(false);
    const requestedActivity = new URL(location.href).searchParams.get("activity");
    const shownActivity = Array.from(document.querySelectorAll<HTMLElement>('[id^="activity-"]'))
      .find((element) => {
        const r = element.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      })
      ?.id.slice(9);
    const activity = requestedActivity ?? shownActivity ?? "";
    const position = (
      document.querySelector(".le-part-position,.live-player-position")?.textContent ?? ""
    )
      .match(/\d+/g)
      ?.map(Number);
    const part =
      position && position[0] >= 1 && position[1] >= position[0] && position[1] <= 1000
        ? { index: position[0], count: position[1] }
        : null;
    setContext({
      path: location.pathname,
      activityId: /^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$/.test(activity) ? activity : null,
      part,
      courseId: document.body.dataset.courseId ?? null,
      contentVersion: document.body.dataset.contentVersion ?? null,
      viewport: { width: innerWidth, height: innerHeight },
      occurredAt: new Date().toISOString(),
    });
    setCapturing(true);
    setTimeout(() => dialog.current?.showModal(), 0);
    try {
      const { toJpeg } = await import("html-to-image");
      const data = await toJpeg(document.body, {
        width: innerWidth,
        height: innerHeight,
        pixelRatio: 1,
        quality: 0.65,
        backgroundColor: "#f7f7f8",
        cacheBust: false,
        style: {
          transform: `translateY(-${scrollY}px)`,
          transformOrigin: "top left",
          width: `${innerWidth}px`,
          height: `${document.body.scrollHeight}px`,
        },
        filter: (node) =>
          !(
            node instanceof Element &&
            (node.matches("[data-report-control]") ||
              Boolean(node.closest(privateSelector)) ||
              node.matches(privateSelector))
          ),
      });
      setImages([{ name: "Tela atual", data: await compactImage(data) }]);
      setConsent(false);
    } catch {
      setMessage("Não consegui capturar esta tela. Você pode anexar um print.");
    } finally {
      setCapturing(false);
    }
  }
  function download() {
    const value = packet.current ?? {
      id: crypto.randomUUID(),
      title: sanitizeReportText(title),
      description: sanitizeReportText(description),
      context: context ? sanitizeReportContext(context) : null,
      images,
      consent,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "destrava-reporte.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function send() {
    if (
      capturing ||
      attachmentBusy ||
      !consent ||
      !context ||
      title.trim().length < 4 ||
      description.trim().length < 4
    )
      return;
    setBusy(true);
    setMessage("");
    packet.current ??= {
      id: crypto.randomUUID(),
      title: sanitizeReportText(title),
      description: sanitizeReportText(description),
      context: sanitizeReportContext(context),
      images,
      consent: true,
    };
    setFrozen(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packet.current),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Não foi possível enviar.");
      setIssue(value.issue_url ?? null);
      setMessage(
        value.issue_url
          ? "Reporte publicado. Obrigado por ajudar a melhorar o Destrava."
          : "Reporte guardado. A integração com GitHub prepara a Issue na próxima sincronização.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha no envio. Baixe sua cópia para guardar.",
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    dialog.current?.close();
    setOpen(false);
    opener.current?.focus();
  }
  const control = (
    <div data-report-control>
      <button
        ref={opener}
        className="report-trigger"
        aria-label="Reportar um problema"
        onClick={() => void start()}
        disabled={capturing}
      >
        <Bug size={19} />
        <span>{capturing ? "Capturando…" : "Reportar"}</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="report-dialog"
          aria-labelledby="report-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={() => setOpen(false)}
        >
          <header>
            <span className="report-heading-icon">
              <Bug />
            </span>
            <div>
              <h2 id="report-title">O que aconteceu?</h2>
              <p>Conte o problema sem sair de onde você está.</p>
            </div>
            <button aria-label="Fechar reporte" onClick={close}>
              <X />
            </button>
          </header>
          <div className="report-fields" data-report-private>
            <label>
              Um título curto
              <input
                autoFocus
                value={title}
                maxLength={140}
                disabled={busy || frozen || capturing || attachmentBusy}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: o áudio parou nesta atividade"
              />
            </label>
            <label>
              Como podemos reproduzir?
              <textarea
                value={description}
                maxLength={5000}
                disabled={busy || frozen || capturing || attachmentBusy}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que você fez, o que esperava e o que aconteceu."
              />
            </label>
            <section className="report-images" aria-label="Imagens do reporte">
              {images.map((image, index) => (
                <figure key={index}>
                  <img src={image.data} alt={image.name} />
                  <figcaption>
                    <Camera size={14} />
                    {image.name}
                    <button
                      aria-label="Remover imagem"
                      disabled={busy || frozen || capturing || attachmentBusy}
                      onClick={() => {
                        setImages(images.filter((_, i) => i !== index));
                        setConsent(false);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </section>
            <label className="report-upload">
              <ImagePlus size={18} />
              Adicionar imagem
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={images.length >= 3 || busy || frozen || capturing || attachmentBusy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10_000_000) {
                    setMessage("Escolha uma imagem menor que 10 MB.");
                    return;
                  }
                  setAttachmentBusy(true);
                  setConsent(false);
                  const url = URL.createObjectURL(file);
                  try {
                    const data = await compactImage(url);
                    setConsent(false);
                    setImages((old) =>
                      old.length < 3 ? [...old, { name: "Imagem anexada", data }] : old,
                    );
                  } catch (err) {
                    setMessage(
                      err instanceof Error ? err.message : "Não consegui ler esta imagem.",
                    );
                  } finally {
                    URL.revokeObjectURL(url);
                    setAttachmentBusy(false);
                  }
                }}
              />
            </label>
            <p className="report-privacy">
              Revise as imagens. Campos de resposta e conversa são ocultados na captura automática,
              mas uma imagem anexada pode conter dados pessoais.
            </p>
            <label className="report-consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy || frozen || capturing || attachmentBusy}
                onChange={(e) => {
                  if (!capturing && !attachmentBusy) setConsent(e.target.checked);
                }}
              />
              <span>
                Revisei o conteúdo e autorizo publicar este reporte e suas imagens no GitHub público
                do projeto.
              </span>
            </label>
            {message && (
              <p className="report-status" role="status">
                <Check size={18} />
                {message}
              </p>
            )}
            {issue && (
              <a href={issue} target="_blank" rel="noopener noreferrer">
                Abrir Issue no GitHub ↗
              </a>
            )}
          </div>
          <footer>
            <button onClick={download}>
              <Download size={17} />
              Baixar cópia
            </button>
            <button
              className="report-send"
              disabled={
                busy ||
                capturing ||
                attachmentBusy ||
                !consent ||
                title.trim().length < 4 ||
                description.trim().length < 4
              }
              onClick={() => void send()}
            >
              <Send size={17} />
              {busy ? "Enviando…" : "Enviar reporte"}
            </button>
          </footer>
        </dialog>
      )}
    </div>
  );
  return portalHost ? createPortal(control, portalHost) : control;
}
