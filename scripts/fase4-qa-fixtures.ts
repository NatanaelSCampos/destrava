import type { InteractiveLessonDefinition } from "../src/content/contracts";
import type { PublicCourse } from "../src/content/public";
import { readCourseState } from "../src/domain/study/course-state-storage";
import { ReviewScheduler } from "../src/domain/review/review-scheduler";

export const QA_NOW = new Date("2026-01-15T12:00:00.000Z");
/** Deliberately generic identities: no Spanish/English curriculum assumptions. */
export function multiSegmentLesson(): InteractiveLessonDefinition {
  return {
    id: "qa-multisegment", courseId: "qa-course", unitId: "qa-unit", lessonId: "qa-lesson",
    title: "Synthetic independent checkpoints", objectives: ["isolation"], concepts: [],
    skills: ["reading", "speaking"], estimatedMinutes: 5, alternativeExamples: [],
    segments: [
      { id: "checkpoint-a", type: "checkpoint", activityRef: "objective-a" },
      { id: "checkpoint-b", type: "checkpoint", activityRef: "objective-b" },
      { id: "speech-a", type: "speaking", activityRef: "speaking-a" },
      { id: "speech-b", type: "speaking", activityRef: "speaking-b" },
      { id: "open-c", type: "checkpoint", activityRef: "writing-c" },
    ].map((entry) => ({
      ...entry, title: entry.id, objectives: [], concepts: [], cues: [],
      required: true, allowInterruption: true, resumeAnchorsMs: [0],
    })) as InteractiveLessonDefinition["segments"],
  };
}
export function stateWithDueMistake(course: PublicCourse) {
  const state = readCourseState(null, course.id, course.languageCode);
  const activity = course.units.flatMap((unit) => unit.lessons)
    .flatMap((lesson) => lesson.activities).find((entry) => entry.type === "multiple_choice");
  if (!activity) throw Error("Independent fixture requires one objective activity");
  state.mistakes[activity.id] = {
    id: "qa-mistake", activityId: activity.id, category: "grammar",
    originalAnswer: "synthetic wrong answer", correctAnswer: "synthetic correct answer",
    explanation: "Synthetic mismatch", timesMissed: 2, timesCorrect: 0,
    lastMissedAt: "2026-01-10T12:00:00.000Z", lastReviewedAt: null,
    schedule: ReviewScheduler.initial(new Date("2026-01-11T12:00:00.000Z"), "50000000-0000-4000-8000-000000000001"),
  };
  return state;
}

export type QaScope = {
  userId: string; courseId: string; lessonId: string; sessionId: string;
  contentVersion: string; definitionHash: string;
};
export type QaEvidence = QaScope & {
  segmentId: string; activityId: string; attemptId: string; sequence: number;
  kind: "objective_correct" | "writing_submitted" | "speaking_submitted"; accepted: boolean;
};
export function qaScope(): QaScope {
  return {
    userId: "10000000-0000-4000-8000-000000000001", courseId: "qa-course",
    lessonId: "qa-lesson", sessionId: "20000000-0000-4000-8000-000000000001",
    contentVersion: "1.0.0", definitionHash: "a".repeat(64),
  };
}
export function qaEvidence(segmentId: string, sequence: number, accepted = true): QaEvidence {
  const segment = multiSegmentLesson().segments.find((entry) => entry.id === segmentId)!;
  return {
    ...qaScope(), segmentId, activityId: segment.activityRef!,
    attemptId: "30000000-0000-4000-8000-" + String(sequence).padStart(12, "0"),
    sequence, kind: segment.type === "speaking" ? "speaking_submitted" :
      segment.activityRef === "writing-c" ? "writing_submitted" : "objective_correct",
    accepted,
  };
}

/** Pure SSR of the real candidate component; device audio and provider context are synthetic. */
export async function renderNumberGuide(root: string, study: unknown) {
  const { build } = await import("esbuild");
  const { runInNewContext } = await import("node:vm");
  const { createRequire } = await import("node:module");
  const { resolve } = await import("node:path");
  const require = createRequire(import.meta.url);
  const result = await build({
    entryPoints: [resolve(root, "src/components/basics/number-guide.tsx")],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    tsconfig: resolve(root, "tsconfig.json"), plugins: [{
      name: "qa-ssr-context",
      setup(builder) {
        builder.onResolve({ filter: /study-provider$/ }, () => ({ path: "study", namespace: "qa" }));
        builder.onResolve({ filter: /audio\/speak-button$/ }, () => ({ path: "audio", namespace: "qa" }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "qa" }));
        builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({ loader: "js", resolveDir: root, contents:
          path === "study" ? "export const useStudy=()=>globalThis.__qaStudy;" :
          path === "audio" ? "export const SpeakButton=()=>null;" :
          "import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{href,...props},children)}"
        }));
      },
    }],
  });
  const vmModule = { exports: {} as { NumberGuide: import("react").ComponentType } };
  runInNewContext(result.outputFiles[0].text, { module: vmModule, exports: vmModule.exports, require, __qaStudy: study, process: { env: {} }, console });
  const { createElement } = require("react") as typeof import("react");
  const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
  return renderToStaticMarkup(createElement(vmModule.exports.NumberGuide));
}

export async function renderAssessmentShell(root: string, study: unknown, query = "") {
  const { build } = await import("esbuild"), { runInNewContext } = await import("node:vm");
  const { createRequire } = await import("node:module"), { resolve } = await import("node:path");
  const require = createRequire(import.meta.url);
  const built = await build({ entryPoints: [resolve(root, "src/components/layout/app-shell.tsx")],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    tsconfig: resolve(root, "tsconfig.json"), plugins: [{
      name: "qa-shell-context", setup(builder) {
        builder.onResolve({ filter: /study-provider$/ }, () => ({ path: "study", namespace: "qa" }));
        builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "qa" }));
        builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "qa" }));
        builder.onResolve({ filter: /(page-tour|whats-new-dialog|tutor-drawer|selection-audio)$/ }, () => ({ path: "decorations", namespace: "qa" }));
        builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({ loader: "js", resolveDir: root, contents:
          path === "study" ? "export const useStudy=()=>globalThis.__qaStudy;" :
          path === "navigation" ? "export const usePathname=()=>'/assessment';export const useSearchParams=()=>new URLSearchParams(globalThis.__qaQuery);export const useRouter=()=>({replace(){},push(){}});" :
          path === "link" ? "import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{href,...props},children)}" :
          "export const PageTour=()=>null;export const WhatsNewDialog=()=>null;export const TutorDrawer=()=>null;export const SelectionAudio=()=>null;"
        }));
      },
    }] });
  const vmModule = { exports: {} as { AppShell: import("react").ComponentType<Record<string, unknown>> } };
  runInNewContext(built.outputFiles[0].text, { module: vmModule, exports: vmModule.exports, require, console, URLSearchParams,
    process: { env: {} }, __qaStudy: study, __qaQuery: query });
  const { createElement } = require("react") as typeof import("react");
  const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
  return renderToStaticMarkup(createElement(vmModule.exports.AppShell, { courseOptions: [], children: createElement("h1", null, "QA assessment route allowed") }));
}

/** Invoke the real provider callbacks with deterministic hooks; effects/auth/DOM are not run. */
export async function providerCallbackFixture(root: string, props: unknown) {
  const { build } = await import("esbuild"), { runInNewContext } = await import("node:vm");
  const { createRequire } = await import("node:module"), { resolve } = await import("node:path");
  const require = createRequire(import.meta.url), hooks = { states: [] as unknown[], index: 0 };
  const output = await build({ entryPoints: [resolve(root, "src/components/study-provider.tsx")],
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", tsconfig: resolve(root, "tsconfig.json"),
    plugins: [{ name: "qa-provider-hooks", setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, () => ({ loader: "js", resolveDir: root, contents:
        "export const createContext=()=>({Provider:()=>null});export const useContext=()=>null;export const useCallback=fn=>fn;export const useMemo=fn=>fn();export const useEffect=()=>{};export const useSyncExternalStore=(subscribe,get)=>get();export const useState=initial=>{const h=globalThis.__qaHooks,i=h.index++;if(!(i in h.states))h.states[i]=typeof initial==='function'?initial():initial;return[h.states[i],next=>{h.states[i]=typeof next==='function'?next(h.states[i]):next}]};"
      }));
    } }],
  });
  const vmModule = { exports: {} as { StudyProvider: (props: unknown) => { props: { value: {
    captureInteractiveLessonOwner: () => { generation: number; userId: string };
    applyInteractiveLessonReceipt: (receipt: unknown, owner: { generation: number; userId: string }) => void;
  } } } } };
  runInNewContext(output.outputFiles[0].text, { module: vmModule, exports: vmModule.exports, require, __qaHooks: hooks,
    process: { env: {} }, console, crypto: globalThis.crypto, URL, setTimeout, clearTimeout });
  const render = () => { hooks.index = 0; return vmModule.exports.StudyProvider(props).props.value; };
  const initial = render();
  const sync = hooks.states[0] as import("../src/domain/study/study-progress-sync").StudyProgressSync;
  return { render, initial, sync };
}
