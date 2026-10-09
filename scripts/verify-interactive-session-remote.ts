import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadContent } from "./content-loader";
import { initialRuntime } from "../src/domain/interactive-lesson/runtime";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishable || !secret) throw new Error("Supabase remote configuration is incomplete.");
const admin = createClient(url, secret, { auth: { persistSession: false } });
const learner = createClient(url, publishable, { auth: { persistSession: false } });
const course = loadContent().find((entry) => entry.course.id === "frecuencias-a1")!.course;
const definition = course.interactiveLessons[0];
const email = `destrava-interactive-test-${randomUUID()}@example.com`;
async function main() {
let userId: string | undefined;
try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`Test account creation failed: ${createError?.message}`);
  userId = created.user.id;
  // Admin generates this one-time test link without sending an email. The test
  // user is deleted in finally; regular sign-in remains protected by CAPTCHA.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties) throw new Error(`Test link generation failed: ${linkError?.message}`);
  const { error: loginError } = await learner.auth.verifyOtp({
    token_hash: link.properties.hashed_token, type: "magiclink",
  });
  if (loginError) throw new Error(`Test sign-in failed: ${loginError.message}`);
  const runtime = { ...initialRuntime(definition), phase: "presenting" };
  const { data: inserted, error: insertError } = await learner.from("interactive_lesson_sessions").insert({
    user_id: userId, course_id: course.id, lesson_id: definition.lessonId,
    content_version: course.contentVersion, status: "in_progress", runtime_phase: runtime.phase,
    current_segment_id: definition.segments[0].id, runtime_path: runtime.runtimePath,
    board_snapshot: runtime.board, runtime_state: runtime,
  }).select("id,revision").single();
  if (insertError || !inserted) throw new Error(`Session insert failed: ${insertError?.message}`);
  assert.equal(inserted.revision, 1);
  const { data: resumed, error: readError } = await learner.from("interactive_lesson_sessions")
    .select("id,revision,runtime_state").eq("id", inserted.id).single();
  if (readError || !resumed) throw new Error(`Session reload failed: ${readError?.message}`);
  assert.equal(resumed.runtime_state.runtimePath.length, definition.segments.length);
  const { data: updated, error: updateError } = await learner.from("interactive_lesson_sessions")
    .update({ revision: 2, playback_position_ms: 5000 }).eq("id", inserted.id).eq("revision", 1)
    .select("revision").single();
  if (updateError || !updated) throw new Error(`Session update failed: ${updateError?.message}`);
  assert.equal(updated.revision, 2);
  const { data: stale, error: staleError } = await learner.from("interactive_lesson_sessions")
    .update({ revision: 2, playback_position_ms: 1000 }).eq("id", inserted.id).eq("revision", 1)
    .select("revision");
  if (staleError) throw new Error(`Stale update test failed: ${staleError.message}`);
  assert.equal(stale?.length, 0);
  const { data: final } = await learner.from("interactive_lesson_sessions")
    .select("playback_position_ms,revision").eq("id", inserted.id).single();
  assert.equal(final?.playback_position_ms, 5000);
  assert.equal(final?.revision, 2);
  const anonymous = createClient(url!, publishable!, { auth: { persistSession: false } });
  const { data: exposed } = await anonymous.from("interactive_lesson_sessions").select("id").eq("id", inserted.id);
  assert.equal(exposed?.length, 0);
  console.log("Authenticated session insert, reload, CAS conflict, anonymous RLS verified.");
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Test account cleanup failed: ${error.message}`);
  }
}
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
