import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { readBoundedLessonBody } from "@/domain/interactive-lesson/request-body";
import { LiveFailure } from "./live-conversation-store";
export const liveHeaders = { "Cache-Control":"private, no-store" };
export async function liveBody<T>(request:Request,schema:z.ZodType<T>,limit=72_000):Promise<T> {
  try{return schema.parse(JSON.parse(new TextDecoder().decode(await readBoundedLessonBody(request,limit))));}
  catch{throw new LiveFailure(400,"Revise o pedido e tente novamente.");}
}
export function liveError(error:unknown) {
  return NextResponse.json({error:error instanceof LiveFailure?error.message:"Não foi possível continuar agora. Tente novamente."},
    {status:error instanceof LiveFailure?error.status:503,headers:liveHeaders});
}
