/** Deterministic lifecycle regression tests for the real trail positioning hook. No DOM/browser service. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { build } from "esbuild";

type Effect = () => void | (() => void);
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type HookResult = { direction: "up" | "down" | null; returnToCurrent: () => void };
type Hook = (
  trail: unknown,
  current: string | undefined,
  enabled: boolean,
  scope: string,
) => HookResult;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const runtimeKey = "__trailPositionQaRuntime";
class Runtime {
  private slots: Slot[] = [];
  private cursor = 0;
  private effects: (() => void)[] = [];
  private frames = new Map<number, () => void>();
  private frameId = 0;
  private listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly scrolls: string[] = [];
  readonly focused: string[] = [];
  readonly location = { hash: "" };
  readonly trail = {
    chapters: [
      {
        moments: ["a", "b", "c"].map((id) => ({
          id,
          originMomentId: "legacy-" + id,
          status: "available",
        })),
      },
    ],
  };
  private originals = new Map<string, PropertyDescriptor | undefined>();
  useRef(value: unknown) {
    const index = this.cursor++;
    const slot = (this.slots[index] ??= {});
    if (!Object.hasOwn(slot, "value")) slot.value = { current: value };
    return slot.value;
  }
  useState(value: unknown) {
    const index = this.cursor++;
    const slot = (this.slots[index] ??= {});
    if (!Object.hasOwn(slot, "value")) slot.value = value;
    return [
      slot.value,
      (next: unknown) => {
        slot.value =
          typeof next === "function" ? (next as (old: unknown) => unknown)(slot.value) : next;
      },
    ];
  }
  useCallback(callback: unknown) {
    this.slots[this.cursor++] ??= {};
    return callback;
  }
  useEffect(effect: Effect, deps: readonly unknown[]) {
    const index = this.cursor++,
      slot = (this.slots[index] ??= {});
    if (
      !slot.deps ||
      deps.length !== slot.deps.length ||
      deps.some((value, i) => !Object.is(value, slot.deps![i]))
    ) {
      slot.deps = deps.slice();
      this.effects.push(() => {
        slot.cleanup?.();
        const cleanup = effect();
        slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      });
    }
  }
  private on = (name: string, listener: (event: Record<string, unknown>) => void) => {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener);
    this.listeners.set(name, set);
  };
  private off = (name: string, listener: (event: Record<string, unknown>) => void) => {
    this.listeners.get(name)?.delete(listener);
  };
  emit(name: string, event: Record<string, unknown> = {}) {
    for (const callback of [...(this.listeners.get(name) ?? [])])
      callback({
        isTrusted: true,
        type: name,
        key: name === "keydown" ? "ArrowDown" : undefined,
        ...event,
      });
  }
  private element = (id: string) => ({
    scrollIntoView: () => this.scrolls.push(id),
    querySelector: () => ({
      focus: () => this.focused.push(id),
      getBoundingClientRect: () => ({ top: 300, bottom: 360 }),
    }),
    getBoundingClientRect: () => ({ top: 300, bottom: 360 }),
  });
  mountGlobals() {
    const values: Record<string, unknown> = {
      [runtimeKey]: this,
      window: { location: this.location, addEventListener: this.on, removeEventListener: this.off },
      document: {
        getElementById: (id: string) =>
          ["moment-a", "moment-b", "moment-c"].includes(id) ? this.element(id.slice(7)) : null,
        querySelector: (selector: string) =>
          selector === ".topbar" ? { getBoundingClientRect: () => ({ top: 0, bottom: 60 }) } : {},
      },
      requestAnimationFrame: (callback: () => void) => {
        const id = ++this.frameId;
        this.frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id: number) => {
        this.frames.delete(id);
      },
      ResizeObserver: class {
        observe() {}
        disconnect() {}
      },
      matchMedia: () => ({ matches: true }),
      innerHeight: 900,
    };
    for (const [key, value] of Object.entries(values)) {
      this.originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
  }
  render(hook: Hook, current: string | undefined, enabled = true, scope = "owner:es:v1") {
    this.cursor = 0;
    this.effects = [];
    const result = hook(this.trail, current, enabled, scope);
    for (const effect of this.effects) effect();
    return result;
  }
  flushFrame() {
    const callbacks = [...this.frames.values()];
    this.frames.clear();
    for (const callback of callbacks) callback();
  }
  flushAll() {
    let limit = 12;
    while (this.frames.size && limit--) this.flushFrame();
    assert.equal(this.frames.size, 0, "RAF mock must settle");
  }
  unmount() {
    for (const slot of this.slots) slot.cleanup?.();
  }
  restore() {
    this.unmount();
    for (const [key, original] of this.originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete (globalThis as unknown as Record<string, unknown>)[key];
    }
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0);
  }
}
async function main() {
  const root = resolve(process.env.VISIBLE_STAGES_CANDIDATE ?? process.cwd());
  assert.ok(isAbsolute(root) && !/^[\\/]{2}/.test(realpathSync(root)));
  const files = ["src/components/trail/use-trail-position.ts", "src/lib/trail-scroll.ts"].map(
    (path) => ({ path, sha256: sha(resolve(root, path)) }),
  );
  console.log(
    "QA_TRAIL_POSITION_CANDIDATE " +
      JSON.stringify({
        baseline: "8ce285251bbc3e8109d27ab2bdac3a94d0e4691d",
        root,
        files,
        node: process.version,
        environment:
          "actual hook bundled in memory; explicit React/RAF/document/events mocks; no browser/env files/services",
      }),
  );
  const built = await build({
    entryPoints: [resolve(root, files[0].path)],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    tsconfig: resolve(root, "tsconfig.json"),
    plugins: [
      {
        name: "deterministic-hook-runtime",
        setup(builder) {
          builder.onResolve({ filter: /^react$/ }, () => ({
            path: "react",
            namespace: "position-qa",
          }));
          builder.onLoad({ filter: /.*/, namespace: "position-qa" }, () => ({
            contents:
              "const runtime=()=>globalThis.__trailPositionQaRuntime;export const useRef=(...args)=>runtime().useRef(...args);export const useState=(...args)=>runtime().useState(...args);export const useCallback=(...args)=>runtime().useCallback(...args);export const useEffect=(...args)=>runtime().useEffect(...args);",
            loader: "js",
          }));
        },
      },
    ],
  });
  const compiled = { exports: {} };
  const require = createRequire(resolve(process.cwd(), "package.json"));
  new Function("require", "module", "exports", built.outputFiles[0].text)(
    require,
    compiled,
    compiled.exports,
  );
  const { useTrailPosition } = compiled.exports as { useTrailPosition: Hook };
  const scenario = (action: (runtime: Runtime) => void) => {
    const runtime = new Runtime();
    runtime.mountGlobals();
    try {
      action(runtime);
    } finally {
      runtime.restore();
    }
  };
  test("late definitive continuation recenters before any real user intent", () =>
    scenario((r) => {
      r.render(useTrailPosition, "a");
      r.flushAll();
      assert.equal(r.scrolls.at(-1), "a");
      r.render(useTrailPosition, "b");
      r.flushAll();
      assert.equal(r.scrolls.at(-1), "b");
    }));
  test("wheel touch keyboard and pointer intent each prevent a delayed continuation from dragging exploration", () => {
    for (const gesture of ["wheel", "touchstart", "keydown", "pointerdown"])
      scenario((r) => {
        r.render(useTrailPosition, "a");
        r.flushAll();
        const previous = r.scrolls.length;
        r.emit(gesture);
        r.render(useTrailPosition, "b");
        r.flushAll();
        assert.equal(r.scrolls.length, previous, gesture);
      });
  });
  test("an explicit hash change wins after user intent and focuses its exact point", () =>
    scenario((r) => {
      r.render(useTrailPosition, "a");
      r.flushAll();
      r.emit("wheel");
      r.location.hash = "#moment-b";
      r.emit("hashchange");
      r.flushAll();
      assert.equal(r.scrolls.at(-1), "b");
      assert.equal(r.focused.at(-1), "b");
    }));
  test("completed course with no continuation still honors an exact return hash", () =>
    scenario((r) => {
      for (const moment of r.trail.chapters[0].moments) moment.status = "completed";
      r.location.hash = "#moment-b";
      r.render(useTrailPosition, undefined);
      r.flushAll();
      assert.equal(r.scrolls.at(-1), "b");
      assert.equal(r.focused.at(-1), "b");
    }));
  test("inert background never scrolls or installs active position listeners", () =>
    scenario((r) => {
      r.location.hash = "#moment-b";
      r.render(useTrailPosition, "a", false);
      r.flushAll();
      assert.deepEqual(r.scrolls, []);
      assert.deepEqual(r.focused, []);
      assert.equal(r.listenerCount(), 0);
    }));
  test("unmount between RAFs cancels pending entry scroll and event listeners", () =>
    scenario((r) => {
      r.render(useTrailPosition, "a");
      r.flushFrame();
      r.unmount();
      r.flushAll();
      assert.deepEqual(r.scrolls, []);
      assert.equal(r.listenerCount(), 0);
    }));
  test("lifecycle verification preserves the observed source bytes", () => {
    for (const file of files) assert.equal(sha(resolve(root, file.path)), file.sha256, file.path);
  });
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
