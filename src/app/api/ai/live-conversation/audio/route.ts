import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { liveUser, liveRow, liveAdmin, LiveFailure } from "@/lib/live-conversation-store";
import { liveError, liveHeaders } from "@/lib/live-conversation-http";
import { inspectConversationWav } from "@/domain/conversation/live-audio-contract";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await liveUser(request),
      id = z.uuid().parse(new URL(request.url).searchParams.get("id")),
      row = await liveRow(user.id, id);
    if (!row.ended_at)
      throw new LiveFailure(409, "Encerre a conversa antes de guardar a gravação.");
    if (Date.now() - Date.parse(row.ended_at) > 15 * 60000)
      throw new LiveFailure(410, "O prazo para guardar esta gravação terminou.");
    const admin = liveAdmin(),
      asset = await admin
        .from("conversation_audio_assets")
        .select("*")
        .eq("session_id", id)
        .eq("owner_id", user.id)
        .maybeSingle();
    if (asset.error) throw new LiveFailure(503, "Não foi possível conferir sua autorização.");
    if (
      !asset.data ||
      asset.data.status !== "awaiting_upload" ||
      Date.parse(asset.data.expires_at) <= Date.now()
    )
      throw new LiveFailure(409, "A gravação não foi autorizada ou já foi recebida.");
    if (request.headers.get("content-type") !== "audio/wav")
      throw new LiveFailure(415, "A gravação não está no formato esperado.");
    const bytes = await readBoundedLessonBody(request, 16000044);
    let metadata;
    try {
      metadata = inspectConversationWav(bytes);
    } catch {
      throw new LiveFailure(422, "Não foi possível confirmar o áudio gravado.");
    }
    const hash = createHash("sha256").update(bytes).digest("hex"),
      path = user.id + "/" + id + ".wav";
    const stored = await admin.storage
      .from("conversation-audio")
      .upload(path, bytes, { contentType: "audio/wav", upsert: false });
    if (stored.error) throw new LiveFailure(503, "Não foi possível guardar esta gravação.");
    const saved = await admin
      .from("conversation_audio_assets")
      .update({ status: "ready", object_path: path, sha256: hash, ...metadata })
      .eq("session_id", id)
      .eq("owner_id", user.id)
      .eq("status", "awaiting_upload")
      .select("session_id")
      .maybeSingle();
    if (saved.error || !saved.data) {
      await admin.storage.from("conversation-audio").remove([path]);
      throw new LiveFailure(503, "Não foi possível confirmar esta gravação.");
    }
    return NextResponse.json({ saved: true, seconds: metadata.seconds }, { headers: liveHeaders });
  } catch (error) {
    return liveError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await liveUser(request),
      id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    await liveRow(user.id, id);
    const admin = liveAdmin(),
      path = user.id + "/" + id + ".wav";
    // Tombstone first: a racing POST cannot publish ready. Keep the deterministic path for retry/audit.
    const tombstone = await admin
      .from("conversation_audio_assets")
      .update({ status: "deleted", object_path: path })
      .eq("session_id", id)
      .eq("owner_id", user.id)
      .select("object_path")
      .maybeSingle();
    if (tombstone.error)
      throw new LiveFailure(503, "Não foi possível bloquear esta gravação para exclusão.");
    if (tombstone.data) {
      const removed = await admin.storage.from("conversation-audio").remove([path]);
      if (removed.error)
        throw new LiveFailure(
          503,
          "A gravação foi bloqueada, mas a exclusão física não foi confirmada. Tente excluir novamente.",
        );
    }
    return NextResponse.json({ deleted: true }, { headers: liveHeaders });
  } catch (error) {
    return liveError(error);
  }
}
