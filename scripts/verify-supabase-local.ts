import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !secretKey) throw new Error("Local Supabase keys are required.");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("This verification only runs against a local Supabase instance.");
}

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const password = `Test-${randomUUID()}!`;
const createdIds: string[] = [];

async function createStudent() {
  const email = `study-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Could not create local test user: ${error?.message}`);
  createdIds.push(data.user.id);
  const client = createClient(url!, publishableKey!, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Could not sign in local test user: ${signIn.error.message}`);
  return { client, id: data.user.id };
}

async function main() {
  try {
    const first = await createStudent();
    const second = await createStudent();

    const courses = await first.client.from("courses").select("id");
    assert.equal(courses.error, null);
    assert.equal(courses.data?.length, 1);
    const activities = await first.client.from("activities").select("id");
    assert.equal(activities.error, null);
    assert.equal(activities.data?.length, 39);

    const answers = await first.client.from("activity_answers").select("activity_id").limit(1);
    assert.equal(answers.data?.length ?? 0, 0, "Answer key must not be readable by students");

    const ownState = await first.client
      .from("user_study_state")
      .insert({ user_id: first.id, state: { localVerification: true } });
    assert.equal(ownState.error, null);
    const otherState = await second.client
      .from("user_study_state")
      .select("user_id")
      .eq("user_id", first.id);
    assert.equal(otherState.error, null);
    assert.equal(otherState.data?.length, 0, "Student data must be private");
    const forbiddenWrite = await second.client
      .from("user_study_state")
      .insert({ user_id: first.id, state: { changed: true } });
    assert.ok(forbiddenWrite.error, "A student must not write another student's data");

    const path = `${first.id}/verification-${randomUUID()}.txt`;
    const ownUpload = await first.client.storage
      .from("speaking-audio")
      .upload(path, new Blob(["local test"], { type: "text/plain" }));
    assert.equal(ownUpload.error, null);
    const forbiddenUpload = await second.client.storage
      .from("speaking-audio")
      .upload(`${first.id}/forbidden-${randomUUID()}.txt`, new Blob(["forbidden"]));
    assert.ok(forbiddenUpload.error, "A student must not upload into another student's folder");
    await admin.storage.from("speaking-audio").remove([path]);

    console.log("Verified local content, authentication, row security and private storage.");
  } finally {
    for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
