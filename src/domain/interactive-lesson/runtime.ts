import type { BoardElement, InteractiveLessonDefinition, LessonAction } from "@/content/contracts";

export type BoardState = {
  elements: BoardElement[];
  highlightedIds: string[];
  translationVisible: boolean;
  caption: string;
  teacherState: "speaking" | "paused" | "listening";
};
export const emptyBoard: BoardState = {
  elements: [], highlightedIds: [], translationVisible: false, caption: "", teacherState: "paused",
};
export const isStateful = (action: LessonAction) => !["audio.play", "activity.open", "speech.request"].includes(action.type);

export function applyBoardAction(board: BoardState, action: LessonAction): BoardState {
  switch (action.type) {
    case "board.show": return { ...board, elements: [...board.elements.filter((item) => item.id !== action.element.id), action.element] };
    case "board.highlight": return { ...board, highlightedIds: [action.targetId] };
    case "board.clear": return { ...emptyBoard };
    case "translation.show": return { ...board, translationVisible: action.visible };
    case "caption.show": return { ...board, caption: action.text };
    case "teacher.state": return { ...board, teacherState: action.state };
    default: return board;
  }
}

type Cue = InteractiveLessonDefinition["segments"][number]["cues"][number];
export class TimelineEngine {
  private cues: Cue[] = [];
  private previous = -1;
  private fired = new Set<string>();
  load(cues: Cue[]) { this.cues = [...cues].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id)); this.reset(); }
  getStateAt(ms: number): BoardState {
    return this.cues.reduce((state, cue) => cue.atMs <= ms && isStateful(cue.action)
      ? applyBoardAction(state, cue.action) : state, { ...emptyBoard });
  }
  tick(ms: number) {
    if (ms < this.previous) { this.seek(ms); return { board: this.getStateAt(ms), effects: [] as LessonAction[] }; }
    const effects = this.cues.filter((cue) => cue.atMs > this.previous && cue.atMs <= ms &&
      !isStateful(cue.action) && !this.fired.has(cue.id)).map((cue) => {
        this.fired.add(cue.id);
        return cue.action;
      });
    this.previous = ms;
    return { board: this.getStateAt(ms), effects };
  }
  seek(ms: number) { this.previous = ms; return this.getStateAt(ms); }
  reset() { this.previous = -1; this.fired.clear(); }
}

export type ResumePoint = { segmentId: string; playbackPositionMs: number; anchorMs: number; board: BoardState; reason: string };
export type RuntimeNode = { id: string; segmentId: string; kind: "canonical" | "reinforcement"; reason?: string };
export type LessonPhase = "idle" | "presenting" | "paused" | "intervening" | "checkpoint" | "speaking" | "reinforcement" | "completed" | "error";
export type LessonRuntimeState = {
  phase: LessonPhase;
  segmentIndex: number;
  positionMs: number;
  board: BoardState;
  completedSegmentIds: string[];
  checkpointPassed: boolean;
  speakingSaved: boolean;
  checkpointFailures: number;
  slowdownCount: number;
  resumePoint: ResumePoint | null;
  runtimePath: RuntimeNode[];
  message: string;
};
export function initialRuntime(lesson: InteractiveLessonDefinition): LessonRuntimeState {
  return { phase: "idle", segmentIndex: 0, positionMs: 0, board: { ...emptyBoard }, completedSegmentIds: [],
    checkpointPassed: false, speakingSaved: false, checkpointFailures: 0, slowdownCount: 0, resumePoint: null,
    runtimePath: lesson.segments.map((segment) => ({ id: segment.id, segmentId: segment.id, kind: "canonical" })), message: "" };
}
export function resumeAnchor(anchors: number[], positionMs: number) {
  return Math.max(0, ...anchors.filter((anchor) => anchor <= positionMs));
}
export type RuntimeEvent =
  | { type: "START" } | { type: "PLAY" } | { type: "PAUSE" }
  | { type: "TICK" | "SEEK"; positionMs: number; board: BoardState }
  | { type: "INTERVENE"; reason: string; anchorMs: number }
  | { type: "SET_MESSAGE"; message: string }
  | { type: "RESUME"; board: BoardState }
  | { type: "CHECKPOINT_RESULT"; correct: boolean }
  | { type: "SPEAKING_SAVED" }
  | { type: "REINFORCE" }
  | { type: "REINFORCEMENT_DONE" }
  | { type: "SLOWER_REQUESTED" }
  | { type: "NEXT"; nextBoard: BoardState }
  | { type: "RESTORE"; state: LessonRuntimeState }
  | { type: "ERROR"; message: string };

export function reduceRuntime(lesson: InteractiveLessonDefinition, state: LessonRuntimeState, event: RuntimeEvent): LessonRuntimeState {
  const segment = lesson.segments[state.segmentIndex];
  switch (event.type) {
    case "START": return state.phase === "idle" ? { ...state, phase: segment.presentation ? "presenting" : segment.type === "checkpoint" ? "checkpoint" : segment.type === "speaking" ? "speaking" : "paused" } : state;
    case "PLAY": return ["paused", "presenting"].includes(state.phase) && segment.presentation ? { ...state, phase: "presenting" } : state;
    case "PAUSE": return state.phase === "presenting" ? { ...state, phase: "paused" } : state;
    case "TICK": case "SEEK": return ["presenting", "paused"].includes(state.phase)
      ? { ...state, positionMs: Math.max(0, Math.min(event.positionMs, segment.presentation?.durationMs ?? 0)), board: event.board } : state;
    case "INTERVENE": {
      if (!["presenting", "paused"].includes(state.phase) || !segment.allowInterruption) return state;
      return { ...state, phase: "intervening", resumePoint: { segmentId: segment.id, playbackPositionMs: state.positionMs,
        anchorMs: event.anchorMs, board: state.board, reason: event.reason }, message: "" };
    }
    case "SET_MESSAGE": return state.phase === "intervening" ? { ...state, message: event.message } : state;
    case "RESUME": return state.phase === "intervening" && state.resumePoint ? {
      ...state, phase: "paused", positionMs: state.resumePoint.anchorMs, board: event.board, resumePoint: null, message: "",
    } : state;
    case "CHECKPOINT_RESULT": {
      if (state.phase !== "checkpoint") return state;
      return { ...state, checkpointPassed: state.checkpointPassed || event.correct,
        checkpointFailures: state.checkpointFailures + Number(!event.correct) };
    }
    case "SPEAKING_SAVED": return state.phase === "speaking" ? { ...state, speakingSaved: true } : state;
    case "SLOWER_REQUESTED": return { ...state, slowdownCount: state.slowdownCount + 1 };
    case "REINFORCE": {
      if (state.phase !== "checkpoint" || state.runtimePath.some((node) => node.kind === "reinforcement")) return state;
      const nodes = [...state.runtimePath];
      nodes.splice(state.segmentIndex + 1, 0, { id: `${segment.id}:reinforcement`, segmentId: segment.id, kind: "reinforcement", reason: "checkpoint_failed_twice" });
      return { ...state, phase: "reinforcement", runtimePath: nodes };
    }
    case "REINFORCEMENT_DONE": return state.phase === "reinforcement" ? { ...state, phase: "checkpoint" } : state;
    case "NEXT": {
      if (segment.type === "checkpoint" && segment.required && !state.checkpointPassed) return state;
      if (segment.type === "speaking" && segment.required && !state.speakingSaved) return state;
      if (segment.presentation && state.positionMs < segment.presentation.durationMs) return state;
      const completedSegmentIds = [...new Set([...state.completedSegmentIds, segment.id])];
      if (state.segmentIndex === lesson.segments.length - 1) return { ...state, phase: "completed", completedSegmentIds };
      const next = lesson.segments[state.segmentIndex + 1];
      return { ...state, phase: next.presentation ? "paused" : next.type === "checkpoint" ? "checkpoint" : next.type === "speaking" ? "speaking" : "paused",
        segmentIndex: state.segmentIndex + 1, positionMs: 0, board: event.nextBoard, completedSegmentIds, message: "" };
    }
    case "RESTORE": return event.state;
    case "ERROR": return { ...state, phase: "error", message: event.message };
  }
}
