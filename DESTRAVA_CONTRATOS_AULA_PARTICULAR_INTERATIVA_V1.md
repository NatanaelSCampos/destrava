# Destrava — Contratos da Aula Particular Interativa v1

> Especificação arquitetural oficial para o recurso **Aula Particular Interativa**.
>
> Este documento define os contratos entre conteúdo, runtime, mídia, timeline, quadro, atividades, fala, IA, adaptação e estado pedagógico do aluno.
>
> **Status:** arquitetura v1 para auditoria e implementação futura.
>
> **Regra principal:** vídeo não é a aula. Vídeo é apenas uma camada de apresentação dentro de uma aula controlada por um runtime pedagógico.

## 1. Visão geral

```text
CoursePackage
   ↓
InteractiveLessonDefinition
   ↓
LessonRuntime
├─ PresentationController
├─ TimelineEngine → UIAction → Board/UI
├─ LessonSession
├─ ActivityBridge
├─ SpeechBridge
├─ InterventionSession → TeachingAgent
└─ AdaptationEngine
        ↓
UserLearningState
```

A aula canônica permanece estável. O caminho percorrido por cada aluno pode mudar.

## 2. Responsabilidades centrais

### `InteractiveLessonDefinition`
Define o conteúdo canônico da aula: objetivos, conceitos, segmentos, atividades e regras de adaptação. Não contém estado do aluno.

### `LessonRuntime`
Controla o que está acontecendo agora: tocar, pausar, interromper, retomar, abrir atividade, inserir reforço e concluir.

### `TeachingAgent`
Decide **como explicar** dentro de uma intervenção. Não controla o runtime diretamente.

### `AdaptationEngine`
Decide **o que fazer agora**: continuar, repetir, reforçar, inserir exemplo, inserir prática ou pular conteúdo opcional.

### `UserLearningState`
Registra evidências e evolução real. Assistir não é evidência de domínio.

---

## 3. `InteractiveLessonDefinition`

```ts
type InteractiveLessonDefinition = {
  schemaVersion: string;
  contentVersion: string;

  id: string;
  courseId: string;
  unitId: string;

  title: string;
  level: string;

  objectives: string[];
  skills: SkillId[];
  concepts: string[];

  estimatedMinutes: number;

  segments: LessonSegment[];

  adaptationPolicy?: AdaptationPolicy;

  metadata?: {
    goals?: string[];
    contexts?: string[];
    audience?: string[];
  };

  provenance?: Provenance;
};
```

Regras:
- pertence a um `CoursePackage`;
- não contém dados de usuário;
- não conhece provider específico;
- declara objetivos e conceitos;
- pode ser compilado antes do runtime.

---

## 4. `LessonSegment`

```ts
type LessonSegment = {
  id: string;

  type:
    | "presentation"
    | "explanation"
    | "example"
    | "activity"
    | "checkpoint"
    | "speaking"
    | "listening"
    | "summary";

  order: number;

  objectives?: string[];
  concepts?: string[];
  skills?: SkillId[];

  presentation?: PresentationDefinition;
  cues?: TimelineCue[];

  activityRef?: string;

  required?: boolean;
  allowInterruption?: boolean;

  completionPolicy?: SegmentCompletionPolicy;

  resumeAnchorsMs?: number[];
};
```

Um segmento não é um arquivo de vídeo. Ele pode combinar mídia, quadro, atividade, speaking e checkpoint.

---

## 5. `PresentationDefinition`

```ts
type PresentationDefinition = {
  mode:
    | "video"
    | "audio"
    | "avatar"
    | "slides"
    | "board"
    | "mixed";

  media?: MediaReference[];
  transcript?: TranscriptDefinition;
  durationMs?: number;
  captions?: CaptionTrack[];
  presentationProviderHint?: string;
};
```

A aula pode usar MP4, áudio, avatar, slides ou voz + quadro sem mudar o contrato pedagógico.

---

## 6. `PresentationController`

```ts
interface PresentationController {
  load(segment: LessonSegment): Promise<void>;
  play(): void;
  pause(): void;
  seek(ms: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number | null;
}
```

O runtime conversa apenas com essa interface.

---

## 7. `TimelineCue`

```ts
type TimelineCue = {
  id: string;
  atMs: number;
  action: UIAction;
  once?: boolean;
  persistence?: "transient" | "stateful";
};
```

Exemplo:

```json
{
  "id": "cue-highlight-tengo",
  "atMs": 12000,
  "action": {
    "type": "board.highlight",
    "payload": {
      "target": "tengo"
    }
  },
  "persistence": "stateful"
}
```

---

## 8. `TimelineEngine`

```ts
interface TimelineEngine {
  load(cues: TimelineCue[]): void;
  tick(currentTimeMs: number): void;
  seek(toMs: number): void;
  reset(): void;
  getStateAt(timeMs: number): TimelineState;
}
```

Seek deve ser determinístico. Ao voltar no vídeo, quadro, highlights e demais estados precisam ser reconstruídos.

---

## 9. `UIAction`

A IA e o conteúdo nunca executam JavaScript arbitrário.

```ts
type UIAction =
  | BoardShowAction
  | BoardHighlightAction
  | BoardClearAction
  | BoardShowExampleAction
  | BoardShowComparisonAction
  | ShowTranslationAction
  | ShowImageAction
  | PlayAudioAction
  | ShowCaptionAction
  | OpenActivityAction
  | RequestSpeechAction
  | TeacherStateAction;
```

Toda action precisa ter schema, validação e registry fechado.

---

## 10. `BoardState`

```ts
type BoardState = {
  layoutId?: string;
  elements: BoardElement[];
  highlightedIds: string[];
  translationVisible?: boolean;
};
```

```ts
type BoardElement =
  | TextElement
  | TableElement
  | ExampleElement
  | ComparisonElement
  | ImageElement
  | RuleElement;
```

### `BoardController`

```ts
interface BoardController {
  apply(action: UIAction): void;
  snapshot(): BoardState;
  restore(state: BoardState): void;
  clear(): void;
}
```

O quadro da intervenção pode ser temporário. Ao retomar, o snapshot original pode ser restaurado.

---

## 11. `LessonSession`

```ts
type LessonSession = {
  id: string;

  userId: string;
  courseId: string;
  lessonId: string;

  status:
    | "not_started"
    | "in_progress"
    | "paused"
    | "completed"
    | "abandoned";

  runtimeState: LessonRuntimeState;

  currentSegmentId: string;
  playbackPositionMs: number;

  completedSegments: string[];

  runtimePath: RuntimeNode[];

  checkpointResults: CheckpointResult[];
  interventions: InterventionSummary[];

  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};
```

---

## 12. `LessonRuntimeState`

```ts
type LessonRuntimeState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "intervention"
  | "teacher_responding"
  | "waiting_for_student"
  | "checkpoint"
  | "speaking"
  | "evaluating"
  | "feedback"
  | "resuming"
  | "transition"
  | "completed"
  | "error";
```

A UI reage ao estado do runtime; não inventa estado paralelo.

---

## 13. `LessonRuntime`

```ts
interface LessonRuntime {
  start(): Promise<void>;
  play(): void;
  pause(reason?: PauseReason): void;
  resume(): void;
  goToSegment(segmentId: string): void;
  completeSegment(): Promise<void>;

  startIntervention(
    input: InterventionRequest
  ): Promise<void>;

  completeIntervention(): Promise<void>;

  submitActivity(
    result: ActivityResult
  ): Promise<void>;

  completeLesson(): Promise<void>;
}
```

O runtime é o árbitro central.

---

## 14. Timeline canônica x caminho da sessão

A aula canônica pode ser:

```text
Introdução
↓
Explicação
↓
Exemplo
↓
Checkpoint
↓
Prática
↓
Conclusão
```

Um aluno pode percorrer:

```text
Introdução
↓
Explicação
↓
Reforço
↓
Exemplo extra
↓
Exemplo
↓
Checkpoint
↓
Reexplicação
↓
Checkpoint novamente
↓
Prática
↓
Conclusão
```

O `CoursePackage` não é alterado. O caminho adaptado fica no `runtimePath`.

---

## 15. `RuntimeNode`

```ts
type RuntimeNode = {
  id: string;

  origin:
    | "canonical"
    | "adaptive"
    | "user_requested";

  type:
    | "segment"
    | "intervention"
    | "activity"
    | "checkpoint"
    | "reinforcement";

  sourceId?: string;

  status:
    | "pending"
    | "active"
    | "completed"
    | "skipped";

  insertedBy?: {
    reason: string;
  };
};
```

---

## 16. `ResumePoint`

```ts
type ResumePoint = {
  segmentId: string;
  playbackPositionMs: number;
  boardSnapshot: BoardState;
  runtimeNodeId: string;
};
```

Nem toda retomada deve acontecer no milissegundo exato. `resumeAnchorsMs` permite retomar em pontos pedagógicos adequados.

---

## 17. `InterventionSession`

```ts
type InterventionSession = {
  id: string;

  lessonSessionId: string;

  source: {
    segmentId: string;
    playbackPositionMs: number;
    conceptIds: string[];
    activeCueIds?: string[];
  };

  trigger:
    | "did_not_understand"
    | "question"
    | "another_example"
    | "practice"
    | "slower"
    | "system_adaptation";

  status:
    | "active"
    | "resolved"
    | "abandoned";

  turns: InterventionTurn[];

  generatedActivities?: string[];

  result?: InterventionResult;
};
```

Uma intervenção nasce de um ponto concreto da aula. Não é chat genérico.

---

## 18. `LessonContextSnapshot`

```ts
type LessonContextSnapshot = {
  courseId: string;
  languageId: string;

  lessonId: string;
  segmentId: string;

  playbackPositionMs: number;

  activeConcepts: string[];

  currentTranscriptFragment?: string;
  boardState?: BoardState;

  learningProfileSummary?: LearningProfileSummary;
  preferences?: LearningPreferences;
};
```

Capturar somente contexto útil.

---

## 19. `TeachingAgentInput`

```ts
type TeachingAgentInput = {
  trigger: InterventionTrigger;
  question?: string;

  context: LessonContextSnapshot;

  allowedActions: UIActionType[];
  allowedActivityTypes: ActivityType[];
};
```

---

## 20. `TeachingAgentOutput`

```ts
type TeachingAgentOutput = {
  message: string;
  speechText?: string;

  uiActions?: UIAction[];

  suggestedActivity?: GeneratedMicroActivity;

  followUp?: TeachingFollowUp;

  resolution: {
    canResume: boolean;
  };
};
```

O output precisa ser estruturado, validado e limitado às actions permitidas.

---

## 21. TeachingAgent não controla o runtime

Fluxo:

```text
TeachingAgent
     ↓
structured proposal
     ↓
LessonRuntime / Policy
     ↓
validação
     ↓
execução
```

Não permitir acesso direto da IA a `seek`, `goToSegment`, `completeLesson` ou equivalentes.

---

## 22. `AdaptationEngine`

```ts
type AdaptationContext = {
  lessonSession: LessonSession;
  currentSegment: LessonSegment;

  learningProfile: LearningProfile;
  preferences: LearningPreferences;

  recentResults: LearningEvidence[];

  interventionHistory: InterventionSummary[];
};
```

```ts
type AdaptationDecision = {
  action:
    | "continue"
    | "repeat"
    | "insert_reinforcement"
    | "insert_example"
    | "insert_activity"
    | "skip_optional"
    | "increase_difficulty"
    | "decrease_difficulty";

  reason: string;

  payload?: unknown;
};
```

Separação:

```text
TeachingAgent
→ como explicar

AdaptationEngine
→ o que fazer agora
```

---

## 23. `ActivityBridge`

A aula reutiliza o `ActivityContract` existente.

```ts
interface ActivityBridge {
  open(activity: ActivityDefinition): void;

  submit(
    activityId: string,
    response: UserResponse
  ): Promise<ActivityResult>;
}
```

Os resultados continuam alimentando `UserLearningState`, mastery, erros e revisão.

---

## 24. Checkpoint é Activity

```ts
type CheckpointDefinition = {
  activityRef: string;

  gate:
    | "required"
    | "optional";

  retryPolicy?: {
    maxAttempts?: number;

    onFailure?:
      | "retry"
      | "reinforce"
      | "continue";
  };
};
```

Não criar um segundo sistema de exercícios.

---

## 25. `SpeechBridge`

```ts
interface SpeechBridge {
  record(): Promise<AudioReference>;

  transcribe(
    audio: AudioReference
  ): Promise<TranscriptResult>;

  assessPronunciation(
    audio: AudioReference,
    referenceText: string
  ): Promise<PronunciationResult>;
}
```

Configuração vem do `LanguagePackage`.

---

## 26. `LearningEvidenceBridge`

Eventos de aula não devem virar mastery automaticamente.

```ts
interface LearningEvidenceBridge {
  ingest(
    event: LessonEvent
  ): Promise<void>;
}
```

Exemplos:

```text
checkpoint correto
→ evidência forte

pronúncia avaliada
→ evidência forte

"não entendi"
→ sinal comportamental

pediu outro exemplo
→ sinal comportamental

assistiu vídeo
→ não prova domínio
```

---

## 27. `LessonEvent`

Eventos mínimos:

```text
lesson.started
lesson.completed
lesson.abandoned

lesson.segment.started
lesson.segment.completed

lesson.interrupted
lesson.resumed

lesson.did_not_understand
lesson.example_requested
lesson.slower_requested

lesson.checkpoint.attempted
lesson.checkpoint.failed
lesson.checkpoint.passed

lesson.speaking.attempted

lesson.reinforcement.inserted
```

Cada evento pode alimentar telemetria, adaptação e/ou evidência.

---

## 28. `ExamplePool`

```ts
type ExamplePool = {
  conceptId: string;

  examples: {
    id: string;
    text: string;

    contexts?: string[];
    difficulty?: number;
  }[];
};
```

Prioridade:

```text
1. exemplo canônico
2. exemplo alternativo curado
3. IA gera novo exemplo
```

---

## 29. `LessonContextBuilder`

```ts
type TeachingContext = {
  targetLanguage: string;
  level: string;

  activeConcepts: ConceptSummary[];

  transcriptFragment: string;

  boardState: BoardState;

  knownWeaknesses: WeaknessSummary[];

  recentRelevantErrors: ErrorSummary[];

  learningGoal?: string;

  contexts?: string[];
};
```

Não enviar curso inteiro ou histórico completo.

---

## 30. Fluxo “Não entendi”

```text
Usuário clica "Não entendi"
       ↓
LessonRuntime.pause()
       ↓
ResumePoint
       ↓
InterventionSession
       ↓
LessonContextBuilder
       ↓
TeachingAgent
       ↓
structured output
       ↓
UI Actions + TTS
       ↓
opcional: ActivityBridge
       ↓
LearningEvidenceBridge
       ↓
AdaptationEngine
       ↓
Intervention resolvida
       ↓
restore ResumePoint
       ↓
LessonRuntime.resume()
```

---

## 31. Fluxo de checkpoint

```text
runtime chega ao checkpoint
       ↓
Presentation pausa
       ↓
ActivityRenderer
       ↓
Grader
       ↓
LearningEvidence
       ↓
AdaptationEngine

passou
→ continuar

falhou
→ retry

falhou novamente
→ reinforcement
→ retry / continuar
```

---

## 32. Fluxo speaking

```text
Cue / Segment
   ↓
Runtime = SPEAKING
   ↓
Presentation pausa
   ↓
SpeakingRecorder
   ↓
SpeechBridge
   ↓
SpeechProvider
   ↓
transcrição / avaliação
   ↓
feedback
   ↓
LearningEvidence
   ↓
AdaptationEngine
   ↓
resume
```

---

## 33. “Mais devagar”

```text
Mais devagar
├── reproduzir trecho em 0.75x
├── repetir frase
└── explicar com mais calma
         ↓
   InterventionSession
```

“Explicar com mais calma” não é apenas playback rate.

---

## 34. Adaptação iniciada pelo sistema

Nem toda intervenção precisa ser solicitada pelo aluno.

Exemplo:

```text
checkpoint falhou duas vezes
       ↓
AdaptationEngine
       ↓
insert_reinforcement
       ↓
TeachingAgent
       ↓
explicação
       ↓
nova tentativa
```

---

## 35. Persistência

Sugestão inicial:

```text
interactive_lesson_sessions
```

Campos conceituais:

```text
id
user_id
course_id
lesson_id

status
runtime_state

current_segment_id
playback_position_ms

runtime_path
board_snapshot

started_at
updated_at
completed_at
```

Intervenções podem inicialmente viver no estado/eventos. Criar tabela própria só quando analytics ou volume justificarem.

---

## 36. Auto-save

Persistir em eventos significativos:

```text
segment completed
intervention started
intervention completed
checkpoint result
speaking result
pause manual
exit
lesson completed
```

Pode haver checkpoint periódico de posição de mídia. Não persistir a cada `timeupdate`.

---

## 37. Fallbacks

```text
TeachingAgent indisponível
→ aula principal continua

TTS indisponível
→ texto

Azure indisponível
→ tentativa pode ser salva sem score técnico

avatar indisponível
→ vídeo/áudio/texto
```

A aula principal não pode depender de uma camada opcional.

---

## 38. Independência de provider

Não acoplar contratos a:

```text
OpenAI
Azure
Synthesia
HeyGen
ElevenLabs
```

Usar adapters/providers.

---

## 39. Pipeline de autoria

```text
Fontes / currículo
       ↓
Lesson Blueprint
       ↓
Pedagogical Script
       ↓
Segmentação
       ↓
Media
       ↓
Transcript
       ↓
Cues
       ↓
Board definitions
       ↓
Activities
       ↓
Validation
       ↓
Compile
       ↓
CompiledInteractiveLesson
```

---

## 40. `CompiledInteractiveLesson`

O runtime deve preferir conteúdo compilado e validado contendo:

- segmentos normalizados;
- refs resolvidas;
- cues ordenados;
- transcript indexado;
- media refs;
- board definitions;
- activities;
- resume anchors;
- adaptation policy.

---

## 41. Validação

Comando futuro:

```bash
npm run lessons:validate
```

Verificar:

- IDs duplicados;
- cue fora da duração;
- UIAction desconhecida;
- board target inexistente;
- activityRef inexistente;
- media inexistente;
- resume anchor inválido;
- checkpoint sem activity;
- concept inexistente;
- objective inexistente;
- skill incompatível;
- segmento sem conteúdo executável.

---

## 42. Validação pedagógica

Comando futuro:

```bash
npm run lessons:pedagogy
```

Verificar:

- progressão;
- nível;
- checkpoint compatível com objetivo;
- vocabulário não apresentado;
- conceito não introduzido;
- atividade incompatível com skill;
- explicação contraditória;
- dificuldade inadequada.

---

## 43. Estrutura sugerida

```text
src/domain/interactive-lessons/

  contracts/
    interactive-lesson.ts
    lesson-segment.ts
    presentation.ts
    timeline-cue.ts
    ui-action.ts
    lesson-session.ts
    runtime-node.ts
    resume-point.ts
    intervention-session.ts

  runtime/
    lesson-runtime.ts
    lesson-state-machine.ts
    timeline-engine.ts
    adaptation-engine.ts

  teaching/
    teaching-agent.ts
    teaching-context-builder.ts

  presentation/
    presentation-controller.ts
    board-controller.ts

  bridges/
    activity-bridge.ts
    speech-bridge.ts
    learning-evidence-bridge.ts

  repositories/
    lesson-session-repository.ts
```

Conteúdo:

```text
content/courses/<course>/

  interactive-lessons/
    <lesson>.json

  lesson-media/
    ...
```

---

## 44. Contratos oficiais v1

```text
InteractiveLessonDefinition
LessonSegment
PresentationDefinition
TimelineCue
UIAction

LessonSession
LessonRuntimeState
RuntimeNode
ResumePoint

InterventionSession
LessonContextSnapshot

TeachingAgentInput
TeachingAgentOutput

AdaptationContext
AdaptationDecision

BoardState
CheckpointDefinition

LessonEvent
LearningEvidence
```

---

## 45. Invariantes arquiteturais

### 1. Vídeo não é aula

```text
VIDEO != AULA
```

### 2. Aula canônica não é caminho do usuário

```text
CANONICAL LESSON != USER RUNTIME PATH
```

### 3. IA não é autoridade do runtime

```text
AI != RUNTIME AUTHORITY
```

### 4. Assistiu não significa aprendeu

```text
WATCHED != LEARNED
```

### 5. Intervenção não é chat genérico

```text
INTERVENTION != GENERIC CHAT
```

### 6. Reutilizar motores existentes

```text
CHECKPOINT = ACTIVITY
SPEAKING = EXISTING SPEECH INFRASTRUCTURE
```

### 7. Particularidade de idioma pertence ao LanguagePackage

```text
LANGUAGE-SPECIFIC BEHAVIOR
→ LanguagePackage
```

---

## 46. Definition of Done arquitetural

- [ ] aula é segmentada;
- [ ] `PresentationController` é independente do runtime;
- [ ] vídeo não contém quadro/atividade de forma inseparável;
- [ ] `TimelineCue` sincroniza apresentação e UI;
- [ ] seek reconstrói estado corretamente;
- [ ] `UIAction` usa registry fechado;
- [ ] `BoardState` pode ser salvo/restaurado;
- [ ] `LessonSession` persiste progresso;
- [ ] runtime usa state machine explícita;
- [ ] `runtimePath` é separado da timeline canônica;
- [ ] intervenção cria `ResumePoint`;
- [ ] `TeachingAgent` recebe contexto do ponto exato;
- [ ] `TeachingAgent` retorna structured output;
- [ ] IA não controla runtime diretamente;
- [ ] `AdaptationEngine` é separado do `TeachingAgent`;
- [ ] checkpoints reutilizam `ActivityContract`;
- [ ] speaking reutiliza infraestrutura existente;
- [ ] eventos não viram mastery automaticamente;
- [ ] `LearningEvidenceBridge` decide evidência;
- [ ] falha de IA não impede aula principal;
- [ ] falha de speech não impede continuação;
- [ ] nova língua não exige alteração no InteractiveLesson Core;
- [ ] conteúdo da aula pode ser validado/compilado;
- [ ] conteúdo adaptativo não altera o CoursePackage canônico.

---

## 47. Regra final

> **InteractiveLesson define o que a aula pode fazer.**
>
> **LessonRuntime decide o que está acontecendo agora.**
>
> **TeachingAgent decide como explicar.**
>
> **AdaptationEngine decide qual deve ser o próximo passo.**
>
> **UserLearningState registra o que o aluno realmente demonstrou aprender.**
