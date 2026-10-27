import { NextResponse } from "next/server";
import { liveUser, liveCourseContext, liveAdmin, liveHistoryRow, LiveFailure, type LiveRow } from "@/lib/live-conversation-store";
import { liveError, liveHeaders } from "@/lib/live-conversation-http";
export const runtime="nodejs";
export async function GET(request:Request) {
  try{
    const user=await liveUser(request),q=new URL(request.url).searchParams,courseId=q.get("courseId");
    if(!courseId||courseId.length>100||q.getAll("courseId").length!==1)throw new LiveFailure(400,"Escolha um curso.");
    await liveCourseContext(user.id,courseId);
    const r=await liveAdmin().from("live_conversation_sessions").select("*").eq("owner_id",user.id).eq("course_id",courseId).order("started_at",{ascending:false}).limit(20);
    if(r.error)throw new LiveFailure(503,"Não foi possível abrir seu histórico.");
    return NextResponse.json({sessions:(r.data as LiveRow[]).map(liveHistoryRow)},{headers:liveHeaders});
  }catch(error){return liveError(error);}
}
