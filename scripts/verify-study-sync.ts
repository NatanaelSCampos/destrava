import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readCourseState,
  readPersistedCourseState,
  LEGACY_COURSE_ID,
} from "../src/domain/study/course-state-storage";
import {
  StudyProgressSync,
  type StudySyncCache,
  type StudySyncCacheEntry,
  type StudySyncRepository,
} from "../src/domain/study/study-progress-sync";
import type { StudyState } from "../src/domain/study/study-state";
import { SupabaseStudyRepository } from "../src/repositories/supabase-study-repository";
import { browserStudySyncCache } from "../src/lib/study-sync-cache";

const courseId = "test-course";
const fresh = () => readCourseState(null, courseId, "test-language");
const progress = (id: string): StudyState => ({ ...fresh(), completedActivityIds: [id] });
const readFailure = new Error("read failed");
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture(cached: StudyState | null = null, pending: StudyState | null = null) {
  const entries = new Map<string | null, StudySyncCacheEntry>();
  entries.set("user-a", { state: cached, pending, recovery: [] });
  const cache: StudySyncCache = {
    read: (owner) =>
      structuredClone(entries.get(owner) ?? { state: null, pending: null, recovery: [] }),
    write: (owner, entry) => {
      entries.set(owner, structuredClone(entry));
    },
  };
  const writes: StudyState[] = [];
  const repository: StudySyncRepository = {
    load: async () => null,
    save: async (state) => {
      writes.push(structuredClone(state));
    },
  };
  return { sync: new StudyProgressSync(fresh, cache), cache, entries, writes, repository };
}
const start = (f: ReturnType<typeof fixture>, user = "user-a") =>
  f.sync.load(f.sync.beginLoading(), user, f.repository);
const checked: string[] = [];
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  checked.push(name);
  console.log(`OK ${name}`);
}

async function main() {
  for (const cached of [progress("old-cache"), null]) {
    await check(
      cached
        ? "read failure with old cache: zero writes"
        : "read failure without cache: zero writes",
      async () => {
        const f = fixture(cached);
        f.repository.load = async () => {
          throw readFailure;
        };
        await start(f);
        assert.equal(f.sync.getSnapshot().loadStatus, "failed");
        assert.equal(f.sync.canSaveRemote(), false);
        assert.deepEqual(
          f.sync.getSnapshot().state.completedActivityIds,
          cached?.completedActivityIds ?? [],
        );
        f.sync.update(progress("local-pending"));
        await assert.rejects(f.sync.flush(), /não foi confirmado/);
        assert.equal(f.writes.length, 0);
        assert.deepEqual(f.entries.get("user-a")?.pending?.completedActivityIds, ["local-pending"]);
      },
    );
  }

  await check("confirmed absence: valid new account and local migration", async () => {
    for (const cached of [null, progress("local-only")]) {
      const f = fixture(cached);
      await start(f);
      assert.equal(f.sync.getSnapshot().loadStatus, "absent");
      assert.equal(f.sync.canSaveRemote(), true);
      await f.sync.flush();
      assert.deepEqual(f.writes[0].completedActivityIds, cached?.completedActivityIds ?? []);
      assert.equal(f.sync.getSnapshot().dirty, false);
    }
  });

  await check("successful read: remote wins and normal changes synchronize", async () => {
    const f = fixture(progress("stale"));
    f.repository.load = async () => progress("remote");
    await start(f);
    assert.equal(f.sync.getSnapshot().loadStatus, "loaded");
    assert.deepEqual(f.sync.getSnapshot().state.completedActivityIds, ["remote"]);
    await f.sync.flush();
    assert.equal(f.writes.length, 0, "restoring remote state needs no redundant write");
    f.sync.update((state) => ({
      ...state,
      completedActivityIds: [...state.completedActivityIds, "new"],
    }));
    await f.sync.flush();
    assert.deepEqual(f.writes[0].completedActivityIds, ["remote", "new"]);
  });

  await check(
    "recovery: remote restored atomically and pending draft kept separately",
    async () => {
      const f = fixture(progress("stale"));
      f.repository.load = async () => {
        throw readFailure;
      };
      await start(f);
      f.sync.update(progress("offline-edit"));
      const remote = deferred<StudyState | null>();
      f.repository.load = () => remote.promise;
      const retry = start(f);
      assert.equal(f.sync.getSnapshot().loadStatus, "loading");
      await assert.rejects(f.sync.flush());
      const observed: string[][] = [];
      const unsubscribe = f.sync.subscribe(() => {
        if (f.sync.canSaveRemote())
          observed.push([...f.sync.getSnapshot().state.completedActivityIds]);
      });
      remote.resolve(progress("authoritative"));
      await retry;
      unsubscribe();
      assert(observed.length > 0);
      assert(observed.every((ids) => ids.join() === "authoritative"));
      assert.deepEqual(f.sync.getSnapshot().recovery[0].completedActivityIds, ["offline-edit"]);
      assert.deepEqual(f.entries.get("user-a")?.recovery[0].completedActivityIds, ["offline-edit"]);
      await f.sync.flush();
      assert.equal(f.writes.length, 0, "draft was not applied to the remote snapshot");
      const reopened = new StudyProgressSync(fresh, f.cache);
      await reopened.load(reopened.beginLoading(), "user-a", f.repository);
      assert.deepEqual(reopened.getSnapshot().recovery[0].completedActivityIds, ["offline-edit"]);
    },
  );

  await check("write failure: changes stay pending and explicit retry saves them", async () => {
    const f = fixture();
    f.repository.load = async () => progress("remote");
    await start(f);
    f.sync.update(progress("edited"));
    f.repository.save = async () => {
      throw new Error("write failed");
    };
    await assert.rejects(f.sync.flush(), /write failed/);
    assert.equal(f.sync.getSnapshot().dirty, true);
    assert.match(f.sync.getSnapshot().saveError, /write failed/);
    assert.deepEqual(f.sync.getSnapshot().state.completedActivityIds, ["edited"]);
    assert.deepEqual(f.entries.get("user-a")?.pending?.completedActivityIds, ["edited"]);
    f.repository.save = async (state) => {
      f.writes.push(structuredClone(state));
    };
    await f.sync.flush();
    assert.deepEqual(f.writes[0].completedActivityIds, ["edited"]);
    assert.equal(f.sync.getSnapshot().dirty, false);
    assert.equal(f.sync.getSnapshot().saveError, "");
    assert.equal(f.entries.get("user-a")?.pending, null);
  });

  await check("obsolete reads: success and failure cannot affect a later account", async () => {
    for (const reject of [false, true]) {
      const f = fixture();
      const old = deferred<StudyState | null>();
      f.repository.load = () => old.promise;
      const first = start(f);
      await Promise.resolve();
      await Promise.resolve();
      f.repository.load = async () => progress("user-b-remote");
      await start(f, "user-b");
      if (reject) old.reject(readFailure);
      else old.resolve(progress("user-a-old-response"));
      await first;
      assert.equal(f.sync.getSnapshot().userId, "user-b");
      assert.equal(f.sync.getSnapshot().loadError, "");
      assert.deepEqual(f.sync.getSnapshot().state.completedActivityIds, ["user-b-remote"]);
      assert.equal(f.writes.length, 0);
    }
  });

  await check("obsolete attempt: same-user retry revokes earlier permission", async () => {
    const f = fixture();
    const old = deferred<StudyState | null>();
    f.repository.load = () => old.promise;
    const first = start(f);
    await Promise.resolve();
    f.repository.load = async () => {
      throw readFailure;
    };
    await start(f);
    old.resolve(progress("late-success"));
    await first;
    assert.equal(f.sync.getSnapshot().loadStatus, "failed");
    await assert.rejects(f.sync.flush());
    assert.equal(f.writes.length, 0);
  });

  await check(
    "queued writes: session change skips unsent writes and ignores late completion",
    async () => {
      const f = fixture();
      f.repository.load = async () => progress("remote");
      await start(f);
      const sent = deferred<void>();
      const began = deferred<void>();
      f.repository.save = async (state) => {
        f.writes.push(structuredClone(state));
        began.resolve();
        await sent.promise;
      };
      f.sync.update(progress("first-write"));
      const first = f.sync.flush();
      const firstRejected = assert.rejects(first, /sessão mudou/);
      await began.promise;
      f.sync.update(progress("queued-write"));
      const secondRejected = assert.rejects(f.sync.flush(), /sessão mudou/);
      const retry = start(f, "user-b");
      sent.resolve();
      await Promise.all([firstRejected, secondRejected, retry]);
      assert.equal(
        f.writes.length,
        1,
        "a request already sent cannot be unsent; the queued request must not start",
      );
      assert.equal(f.sync.getSnapshot().userId, "user-b");
      assert.equal(f.sync.getSnapshot().saveError, "");
      assert.equal(f.sync.getSnapshot().dirty, false);
    },
  );

  await check("edits during a write remain pending until a subsequent write", async () => {
    const f = fixture();
    f.repository.load = async () => progress("remote");
    await start(f);
    const sent = deferred<void>();
    const began = deferred<void>();
    f.repository.save = async (state) => {
      f.writes.push(structuredClone(state));
      began.resolve();
      await sent.promise;
    };
    f.sync.update(progress("first"));
    const saving = f.sync.flush();
    await began.promise;
    f.sync.update(progress("second"));
    sent.resolve();
    await saving;
    assert.equal(f.sync.getSnapshot().dirty, true);
    assert.deepEqual(f.entries.get("user-a")?.pending?.completedActivityIds, ["second"]);
    await f.sync.flush();
    assert.deepEqual(
      f.writes.map((state) => state.completedActivityIds),
      [["first"], ["second"]],
    );
    assert.equal(f.sync.getSnapshot().dirty, false);
  });

  await check(
    "cache failure is visible; local mode still works without remote access",
    async () => {
      const f = fixture();
      f.repository.load = async () => progress("remote");
      await start(f);
      f.cache.write = () => {
        throw new Error("quota");
      };
      f.sync.update(progress("in-memory"));
      assert.equal(f.sync.getSnapshot().dirty, true);
      assert.notEqual(f.sync.getSnapshot().cacheError, "");
      assert.deepEqual(f.sync.getSnapshot().state.completedActivityIds, ["in-memory"]);
      const local = fixture();
      await local.sync.load(local.sync.beginLoading(), null, null);
      local.sync.update(progress("local"));
      await local.sync.flush();
      assert.equal(local.writes.length, 0);
      assert.deepEqual(local.entries.get(null)?.state?.completedActivityIds, ["local"]);
    },
  );

  await check("repository distinguishes missing rows, malformed rows and legacy data", async () => {
    const queryResults: Array<{
      data: { state: unknown } | null;
      error: { message: string } | null;
    }> = [];
    const tables: string[] = [];
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => queryResults.shift()!,
    };
    const db = {
      from: (table: string) => {
        tables.push(table);
        return query;
      },
    } as unknown as SupabaseClient;
    const repository = new SupabaseStudyRepository(db, "user-a");
    queryResults.push({ data: null, error: null }, { data: null, error: null });
    assert.equal(await repository.load(courseId, "test-language"), null);
    queryResults.push({ data: null, error: { message: "unavailable" } });
    await assert.rejects(repository.load(courseId, "test-language"), /unavailable/);
    for (const raw of [
      null,
      false,
      [],
      { attempts: "broken" },
      { courseId: "other" },
      { courseId: null },
      { schemaVersion: 2, courses: [] },
    ]) {
      const before = tables.length;
      queryResults.push({ data: { state: raw }, error: null });
      await assert.rejects(repository.load(courseId, "test-language"));
      assert.equal(
        tables.length,
        before + 1,
        "an unreadable course row cannot trigger an absence fallback",
      );
    }
    queryResults.push(
      { data: null, error: null },
      { data: null, error: { message: "legacy unavailable" } },
    );
    await assert.rejects(repository.load(courseId, "test-language"), /legacy unavailable/);
    queryResults.push(
      { data: null, error: null },
      { data: { state: { schemaVersion: 2, courses: [] } }, error: null },
    );
    await assert.rejects(repository.load(courseId, "test-language"), /não reconhecido/);
    const legacy = { completedActivityIds: ["legacy-progress"], profile: { dailyMinutes: 15 } };
    queryResults.push({ data: null, error: null }, { data: { state: legacy }, error: null });
    const migrated = await repository.load(LEGACY_COURSE_ID, "es");
    assert.deepEqual(migrated?.completedActivityIds, ["legacy-progress"]);
    assert.equal(migrated?.profile.onboarded, true);
    assert.equal(readPersistedCourseState(legacy, courseId, "test-language", true), null);
    queryResults.push(
      { data: null, error: null },
      {
        data: { state: { schemaVersion: 2, courses: { [courseId]: progress("envelope") } } },
        error: null,
      },
    );
    assert.deepEqual((await repository.load(courseId, "test-language"))?.completedActivityIds, [
      "envelope",
    ]);
    queryResults.push({ data: { state: {} }, error: null });
    assert.deepEqual((await repository.load(courseId, "test-language"))?.completedActivityIds, []);
  });

  await check("browser cache uses account/course keys and preserves recovery copies", async () => {
    const values = new Map<string, string>();
    const oldWindow = globalThis.window;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    globalThis.window = { localStorage: storage } as unknown as Window & typeof globalThis;
    try {
      const cache = browserStudySyncCache(courseId, "test-language");
      cache.write("user-a", {
        state: progress("remote"),
        pending: progress("pending"),
        recovery: [progress("backup")],
      });
      assert.deepEqual((await cache.read("user-a")).pending?.completedActivityIds, ["pending"]);
      assert.equal((await cache.read("user-b")).state, null);
      assert.equal(
        (await browserStudySyncCache("other-course", "test-language").read("user-a")).state,
        null,
      );
      cache.write("user-a", {
        state: progress("restored"),
        pending: null,
        recovery: [progress("backup")],
      });
      assert.equal((await cache.read("user-a")).pending, null);
      assert.deepEqual((await cache.read("user-a")).recovery[0].completedActivityIds, ["backup"]);
      values.set(
        `frecuencias-study:v1:demo:user-b`,
        JSON.stringify({ completedActivityIds: ["old"] }),
      );
      assert.deepEqual(
        (await browserStudySyncCache(LEGACY_COURSE_ID, "es").read("user-b")).state?.completedActivityIds,
        ["old"],
      );
      assert.equal((await cache.read("user-b")).state, null);
    } finally {
      globalThis.window = oldWindow;
    }
  });
  console.log(
    `Study progress integrity: ${checked.length} isolated scenarios passed; no network or real data.`,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
