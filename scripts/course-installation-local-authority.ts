import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { localEnvironment, assertLocalDocker, projectId } from "./local-environment.mjs";
import {
  InstallationError,
  type AuthorizationGuard,
} from "../src/domain/course-installations/contracts";

/** CLI/test-only issuer. Never imported by application routes or exposed to package/request JSON. */
export async function createLocalCourseInstallationContext() {
  if (process.env.NODE_ENV === "production")
    throw new InstallationError("NOT_AUTHORIZED", "authorization");
  const env = localEnvironment();
  assertLocalDocker();
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = `insert into destrava_private.course_installation_local_gate(singleton,enabled,nonce_hash)
    values(true,true,'${tokenHash}') on conflict(singleton)
    do update set enabled=true,nonce_hash=excluded.nonce_hash;`;
  try {
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        `supabase_db_${projectId}`,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
      ],
      { input: sql, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch {
    throw new InstallationError("CATALOG_FAILED", "authorization");
  }
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authority = Object.freeze({});
  const authorizer: AuthorizationGuard = {
    async assert(value) {
      if (value !== authority || process.env.NODE_ENV === "production")
        throw new InstallationError("NOT_AUTHORIZED", "authorization");
      localEnvironment();
      assertLocalDocker();
      return { actorId: "local-test-operator", localToken: token };
    },
  };
  return { db, authorizer, authority };
}
