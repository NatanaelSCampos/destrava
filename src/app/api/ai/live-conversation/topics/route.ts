import { NextResponse } from "next/server";
import { liveUser, liveCourseContext, livePublicTopic, LiveFailure } from "@/lib/live-conversation-store";
import { liveError, liveHeaders } from "@/lib/live-conversation-http";
export const runtime="nodejs";
export async function GET(request:Request) {
  try{
    const user=await liveUser(request),query=new URL(request.url).searchParams;
    const courseId=query.get("courseId");
    if(!courseId||courseId.length>100||query.getAll("courseId").length!==1)throw new LiveFailure(400,"Escolha um curso.");
    const context=await liveCourseContext(user.id,courseId);
    return NextResponse.json({topics:context.topics.map(livePublicTopic),languageLabel:context.language,sourceLanguage:context.sourceLanguage},{headers:liveHeaders});
  }catch(error){return liveError(error);}
}
