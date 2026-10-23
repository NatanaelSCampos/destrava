import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { parseReleaseJson, validateProductionProfile } from "./deployment-plan.mjs";

const project = "abcdefghijklmnopqrst";
function fixture() {
  const profile = {
    schemaVersion: 1, environment: "production", workspace: resolve("."), commit: "a".repeat(40),
    app: "release-example", supabaseProjectRef: project, origin: "https://release-example.fly.dev",
    files: { Dockerfile: "b".repeat(64), "fly.toml": "c".repeat(64), "package-lock.json": "d".repeat(64) },
    buildArgs: {
      NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_not_a_real_key",
      NEXT_PUBLIC_FEATURE_AI_TUTOR: "false", NEXT_PUBLIC_FEATURE_AI_WRITING: "false",
      NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED: "false", NEXT_PUBLIC_PASSKEYS_ENABLED: "false",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    },
  };
  return { profile, context: {
    workspace: profile.workspace, expectedApp: profile.app, expectedSupabaseProject: project,
    expectedOrigin: profile.origin, expectedSha: profile.commit, actualSha: profile.commit,
    gitStatus: "", hashes: { ...profile.files }, ambient: {},
    dockerfileText: Object.keys(profile.buildArgs).map((key) => `ARG ${key}`).join("\n"),
    flyConfig: `app = "${profile.app}"\n[env]\nNODE_ENV = "production"\nAPP_ORIGIN = "${profile.origin}"\n[build.args]\nNEXT_PUBLIC_PASSKEYS_ENABLED = "false"\n`,
  } };
}

test("explicit complete production identity produces a plan without mutating input", () => {
  const data = fixture(); const before = JSON.stringify(data);
  const plan = validateProductionProfile(data.profile, data.context);
  assert.equal(plan.app, "release-example"); assert.equal(JSON.stringify(data), before);
  assert.ok(Object.isFrozen(plan)); assert.ok(Object.isFrozen(plan.buildArgs));
});

const invalid = {
  "local-only profile": (p) => { p.environment = "local"; },
  "missing field": (p) => { delete p.app; },
  "unexpected private configuration": (p) => { p.SUPABASE_SECRET_KEY = "synthetic-private"; },
  "workspace": (p) => { p.workspace = resolve("other-workspace"); },
  "SHA": (p) => { p.commit = "e".repeat(40); },
  "abbreviated SHA": (p) => { p.commit = "aaaaaaa"; },
  "Fly app": (p) => { p.app = "other-app"; },
  "Supabase project": (p) => { p.supabaseProjectRef = "z".repeat(20); },
  "origin": (p) => { p.origin = "https://other-app.fly.dev"; },
  "origin loopback": (p) => { p.origin = "https://127.0.0.1"; },
  "origin private IP": (p) => { p.origin = "https://192.168.1.1"; },
  "origin credentials": (p) => { p.origin = "https://user:password@release-example.fly.dev"; },
  "origin query": (p) => { p.origin += "?x=1"; },
  "origin local hostname": (p) => { p.origin = "https://release.local"; },
  "Supabase HTTP": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_URL = `http://${project}.supabase.co`; },
  "Supabase loopback": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"; },
  "Supabase suffix": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_URL += ".evil.example"; },
  "Supabase path": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_URL += "/rest/v1"; },
  "Supabase credentials": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_URL = `https://user:pass@${project}.supabase.co`; },
  "private public key": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_synthetic_private_never_log"; },
  "missing key": (p) => { p.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ""; },
  "private extra build argument": (p) => { p.buildArgs.NEXT_PUBLIC_SECRET = "synthetic-private"; },
  "missing flag": (p) => { delete p.buildArgs.NEXT_PUBLIC_FEATURE_AI_TUTOR; },
  "implicit flag": (p) => { p.buildArgs.NEXT_PUBLIC_FEATURE_AI_TUTOR = true; },
  "invalid public site key": (p) => { p.buildArgs.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "sk-synthetic-private"; },
  "Dockerfile digest": (p) => { p.files.Dockerfile = "e".repeat(64); },
  "lockfile omitted": (p) => { delete p.files["package-lock.json"]; },
  "dirty Git": (_p, c) => { c.gitStatus = " M scripts/deploy-fly.ps1"; },
  "different Git HEAD": (_p, c) => { c.actualSha = "f".repeat(40); },
  "ambient local profile": (_p, c) => { c.ambient.DESTRAVA_LOCAL_ONLY = "1"; },
  "ambient public URL": (_p, c) => { c.ambient.NEXT_PUBLIC_SUPABASE_URL = "synthetic-override"; },
  "ambient private credential": (_p, c) => { c.ambient.SUPABASE_SECRET_KEY = "synthetic-private"; },
  "ambient Fly config": (_p, c) => { c.ambient.FLY_CONFIG = "other.toml"; },
  "ambient Fly API host": (_p, c) => { c.ambient.FLY_API_HOSTNAME = "other.example"; },
  "ambient Node preload": (_p, c) => { c.ambient.NODE_OPTIONS = "--import other.mjs"; },
  "ambient proxy": (_p, c) => { c.ambient.https_proxy = "http://proxy.example"; },
  "runtime origin mismatch": (_p, c) => { c.flyConfig = c.flyConfig.replace("APP_ORIGIN =", "OTHER_ORIGIN ="); },
  "build config mismatch": (_p, c) => { c.flyConfig = c.flyConfig.replace('ENABLED = "false"', 'ENABLED = "true"'); },
  "duplicate Fly field": (_p, c) => { c.flyConfig += 'NEXT_PUBLIC_PASSKEYS_ENABLED = "false"\n'; },
  "duplicate Fly table": (_p, c) => { c.flyConfig += '[env]\nOTHER = "value"\n'; },
  "alternative build image": (_p, c) => { c.flyConfig += '[build]\nimage = "unreviewed:latest"\n'; },
  "release command": (_p, c) => { c.flyConfig += '[deploy]\nrelease_command = "migration"\n'; },
  "undeclared build argument": (_p, c) => { c.dockerfileText = "FROM node:22\n"; },
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`reject ${name} without reflecting supplied values`, () => {
    const { profile, context } = fixture(); mutate(profile, context);
    assert.throws(() => validateProductionProfile(profile, context), (error) => {
      assert.match(error.message, /Release guard:/);
      assert.doesNotMatch(error.message, /synthetic|user:pass|127\.0\.0\.1/); return true;
    });
  });
}

test("legacy public-role JWT accepted, service role/project mismatch denied", () => {
  const jwt = (claims) => `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.c3ludGhldGlj`;
  const { profile, context } = fixture();
  profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = jwt({ role: "anon", ref: project });
  assert.equal(validateProductionProfile(profile, context).supabaseProject, project);
  for (const claims of [{ role: "service_role", ref: project }, { role: "anon", ref: "other" }]) {
    profile.buildArgs.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = jwt(claims);
    assert.throws(() => validateProductionProfile(profile, context));
  }
});

test("reject ambiguous JSON, escapes of duplicate keys, unsafe keys and trailing input", () => {
  for (const text of ['{"app":1,"app":2}', '{"app":1,"\\u0061pp":2}', '{"__proto__":{}}', '{"buildArgs":{"x":1,"x":2}}', '{} false', '{"app":}']) {
    assert.throws(() => parseReleaseJson(text));
  }
  assert.deepEqual(parseReleaseJson('{"a":[{"b":"x\\\"y"},true,null,2]}'), { a: [{ b: 'x"y' }, true, null, 2] });
});
