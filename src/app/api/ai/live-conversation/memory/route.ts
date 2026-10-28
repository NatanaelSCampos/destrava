import { NextResponse } from "next/server";
import { z } from "zod";
import { liveBody } from "@/lib/live-conversation-http";
import { liveRow, LiveFailure } from "@/lib/live-conversation-store";
import { analyseStoredConversation } from "@/lib/conversation-memory-server";
import { liveUser, liveCourseContext } from "@/lib/live-conversation-store";
import { liveError, liveHeaders } from "@/lib/live-conversation-http";
import { conversationProfile } from "@/lib/conversation-memory-server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await liveUser(request),
      courseId = new URL(request.url).searchParams.get("courseId") ?? "";
    const context = await liveCourseContext(user.id, courseId, "free");
    return NextResponse.json(
      { profile: await conversationProfile(user.id, context.bundle.course.languageCode) },
      { headers: liveHeaders },
    );
  } catch (error) {
    return liveError(error);
  }
}

const schema = z.object({ courseId: z.string().min(1).max(100), sessionId: z.uuid() }).strict();
export async function POST(request: Request) {
  try {
    const user = await liveUser(request),
      input = await liveBody(request, schema, 1000),
      context = await liveCourseContext(user.id, input.courseId, "free");
    const row = await liveRow(user.id, input.sessionId);
    if (row.course_id !== input.courseId)
      throw new LiveFailure(404, "Conversa não encontrada neste curso.");
    const result = await analyseStoredConversation(user.id, input.sessionId, context.client);
    return NextResponse.json(
      {
        ...result,
        profile: await conversationProfile(user.id, context.bundle.course.languageCode),
      },
      { headers: liveHeaders },
    );
  } catch (error) {
    return liveError(error);
  }
}
