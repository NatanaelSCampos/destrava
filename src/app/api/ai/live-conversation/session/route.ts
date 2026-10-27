import { NextResponse } from "next/server";
import { liveUser, liveCourseContext, LiveFailure } from "@/lib/live-conversation-store";
import { liveBody, liveError, liveHeaders } from "@/lib/live-conversation-http";
import { liveStartSchema } from "@/domain/conversation/live-contract";
import { selectedLiveTopicContext } from "@/domain/conversation/live-topic-context";
import { startLiveConversation } from "@/lib/live-conversation-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await liveUser(request),
      input = await liveBody(request, liveStartSchema);
    const context = await liveCourseContext(user.id, input.courseId);
    const ids = input.topicIds ?? [input.topicId!];
    if (ids.some((id) => !context.topics.some((topic) => topic.id === id)))
      throw new LiveFailure(
        403,
        "Escolha somente etapas já estudadas e disponíveis para conversar.",
      );
    const topic = selectedLiveTopicContext(context.topics, ids);
    if (!topic)
      throw new LiveFailure(400, "Escolha menos etapas para esta conversa e tente novamente.");
    const result = await startLiveConversation(
      user.id,
      context.client,
      {
        id: input.operationId,
        courseId: input.courseId,
        contentVersion: context.bundle.course.contentVersion,
        topic,
        settings: { level: input.level, correction: input.correction, voice: input.voice },
        language: context.language,
        sourceLanguage: context.sourceLanguage,
        variant: context.variant,
        sdp: input.sdp,
      },
      request.signal,
    );
    return NextResponse.json(result, { headers: liveHeaders });
  } catch (error) {
    return liveError(error);
  }
}
