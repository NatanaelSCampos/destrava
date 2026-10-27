import { NextResponse } from "next/server";
import { liveUser, LiveFailure } from "@/lib/live-conversation-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { liveBody, liveError, liveHeaders } from "@/lib/live-conversation-http";
import { liveIdSchema } from "@/domain/conversation/live-contract";
import { finishLiveConversation } from "@/lib/live-conversation-server";
export const runtime="nodejs";
export async function POST(request:Request) {
  try{
    const user=await liveUser(request),input=await liveBody(request,liveIdSchema,1000),client=await createSupabaseServerClient();
    if(!client)throw new LiveFailure(503,"Não foi possível guardar o resumo.");
    return NextResponse.json(await finishLiveConversation(user.id,input.id,client),{headers:liveHeaders});
  }catch(error){return liveError(error);}
}
