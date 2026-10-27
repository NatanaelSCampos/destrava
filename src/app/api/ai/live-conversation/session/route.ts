import { NextResponse } from "next/server";
import { liveUser, liveCourseContext, LiveFailure } from "@/lib/live-conversation-store";
import { liveBody, liveError, liveHeaders } from "@/lib/live-conversation-http";
import { liveStartSchema } from "@/domain/conversation/live-contract";
import { startLiveConversation } from "@/lib/live-conversation-server";
export const runtime="nodejs";
export async function POST(request:Request) {
  try{
    const user=await liveUser(request),input=await liveBody(request,liveStartSchema);
    const context=await liveCourseContext(user.id,input.courseId);
    const topic=context.topics.find(t=>t.id===input.topicId);
    if(!topic)throw new LiveFailure(403,"Estude uma atividade desse assunto antes de conversar sobre ele.");
    const result=await startLiveConversation(user.id,context.client,{id:input.operationId,courseId:input.courseId,
      contentVersion:context.bundle.course.contentVersion,topic,settings:{level:input.level,correction:input.correction,voice:input.voice},
      language:context.language,sourceLanguage:context.sourceLanguage,variant:context.variant,sdp:input.sdp},request.signal);
    return NextResponse.json(result,{headers:liveHeaders});
  }catch(error){return liveError(error);}
}
