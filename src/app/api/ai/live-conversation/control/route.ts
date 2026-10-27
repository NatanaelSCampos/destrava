import { NextResponse } from "next/server";
import { liveUser } from "@/lib/live-conversation-store";
import { liveBody, liveError, liveHeaders } from "@/lib/live-conversation-http";
import { liveControlSchema } from "@/domain/conversation/live-contract";
import { controlLiveConversation } from "@/lib/live-conversation-server";
export const runtime="nodejs";
export async function POST(request:Request) {
  try{
    const user=await liveUser(request),input=await liveBody(request,liveControlSchema,3000);
    return NextResponse.json(await controlLiveConversation(user.id,input.id,input.action,input.text),{headers:liveHeaders});
  }catch(error){return liveError(error);}
}
