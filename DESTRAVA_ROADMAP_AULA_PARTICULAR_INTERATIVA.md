# Destrava — Roadmap da Aula Particular Interativa

> Documento de visão, produto e implementação para a **Aula Particular Interativa** do Destrava.
>
> Este roadmap descreve a evolução do recurso desde o primeiro MVP até uma experiência de aula adaptativa com vídeo, quadro sincronizado, IA contextual, speaking, checkpoints, personalização e preparação futura para uso corporativo.
>
> **Princípio central:** a aula não é um vídeo com chat. É uma experiência pedagógica controlada por uma timeline interativa.

---

## 1. Visão

A Aula Particular Interativa deve reproduzir a sensação de uma aula particular acontecendo naquele momento.

A experiência combina:

- vídeo ou avatar da professora;
- áudio;
- quadro sincronizado;
- legendas;
- checkpoints;
- atividades;
- speaking;
- perguntas por texto ou voz;
- explicações alternativas;
- adaptação durante a aula;
- retomada contextual;
- registro pedagógico do que o aluno demonstrou aprender.

A interface deve sempre deixar claro:

- o que está acontecendo;
- quem deve agir agora;
- se a professora está falando ou esperando;
- quando o aluno pode interromper;
- como a aula continua depois de uma intervenção.

---

## 2. Regra de produto

```text
VIDEO != AULA
```

O vídeo é apenas uma camada da experiência.

A aula é:

```text
InteractiveLesson
├── Presentation
├── Timeline
├── Board
├── Activities
├── Speaking
├── Checkpoints
├── Interventions
├── TeachingAgent
├── Adaptation
└── LearningEvidence
```

---

## 3. Experiência principal

### 3.1 Professora explicando

Durante a explicação:

- vídeo/avatar em destaque;
- quadro acompanha a fala;
- timeline avança;
- legenda acompanha;
- ações rápidas permanecem disponíveis.

Ações principais:

- Não entendi;
- Outro exemplo;
- Mais devagar;
- Praticar;
- Perguntar.

### 3.2 Interrupção

O aluno pode interromper a qualquer momento.

```text
aula em andamento
↓
aluno interrompe
↓
vídeo pausa
↓
ponto da aula é salvo
↓
TeachingAgent recebe contexto
↓
professora responde
↓
quadro pode mudar
↓
opcionalmente entra prática
↓
retomada
```

A interrupção não é um chat independente. Ela nasce do ponto pedagógico atual.

### 3.3 “Não entendi”

Ao clicar em `Não entendi`, a aula deve mudar de estado.

```text
Tudo bem. Vou tentar de outro jeito.

[ Explicar mais simples ]
[ Mostrar outro exemplo ]
[ Comparar com português ]
[ Fazer comigo ]
```

A resposta pode usar voz, texto, quadro, comparação, exemplo e microatividade.

### 3.4 Pergunta livre

O aluno pode digitar ou falar. A resposta deve considerar curso, nível, lição, segmento, timestamp, frase ativa, conceito, quadro, erros relevantes e preferências.

Depois:

```text
[ Entendi, continuar aula ]
[ Ainda tenho dúvida ]
[ Quero praticar isso ]
```

### 3.5 Speaking

```text
professora pausa
↓
aluno grava
↓
transcrição
↓
avaliação
↓
feedback
↓
repetição opcional
↓
continuação
```

Reutilizar a infraestrutura de speaking existente.

### 3.6 Checkpoint

A aula pode parar propositalmente para verificar entendimento. O checkpoint reutiliza `ActivityContract`.

Se acertar, continua. Se errar, pode haver reexplicação e nova tentativa. Alguns checkpoints podem ser gates obrigatórios.

---

## 4. Timeline pedagógica

A timeline representa a estrutura da aula, não apenas capítulos do vídeo.

```text
Introdução ✓
Explicação ●
Prática ○
Novo tema ○
Revisão ○
```

Ela pode se adaptar:

```text
Explicação
→ Reforço
→ Exemplo extra
→ Prática
```

A aula canônica continua estável; o caminho adaptado pertence à sessão daquele aluno.

---

## 5. Arquitetura conceitual

```text
LanguagePackage
      +
CoursePackage
      +
UserLearningState
      ↓
InteractiveLessonEngine
      ↓
LessonRuntime
├── PresentationController
├── TimelineEngine
├── BoardController
├── ActivityBridge
├── SpeechBridge
├── InterventionSession
├── TeachingAgent
└── AdaptationEngine
```

A especificação detalhada dos contratos está em:

```text
DESTRAVA_CONTRATOS_AULA_PARTICULAR_INTERATIVA_V1.md
```

---

## 6. Segmentos

Uma aula deve ser dividida em pequenos blocos:

```text
Segmento 1 — Introdução
Segmento 2 — Explicação
Segmento 3 — Exemplo
Segmento 4 — Checkpoint
Segmento 5 — Speaking
Segmento 6 — Resumo
```

Cada segmento pode conter vídeo, áudio, quadro, cues, atividade, speaking ou checkpoint.

---

## 7. Vídeo e mídia

A primeira versão deve preferir mídia pré-gerada:

```text
vídeo curto pré-gerado
+
quadro HTML sincronizado
+
intervenções em tempo real
```

Não depender inicialmente de avatar realtime.

Providers futuros podem incluir vídeo gravado, avatar gerado, avatar realtime, áudio + personagem ou slides + voz. O Core não deve conhecer o provider.

---

## 8. Cues sincronizados

Exemplo:

```text
00:04 → mostrar tabela
00:09 → destacar "yo"
00:12 → destacar "tengo"
00:18 → mostrar exemplo
00:28 → pedir repetição
```

Esses eventos são `TimelineCue`. Quadro e atividades não ficam embutidos no MP4.

---

## 9. Quadro interativo

Tipos iniciais:

```text
Text
Example
Comparison
Table
Rule
Image
```

Ações iniciais:

```text
board.show
board.highlight
board.clear
board.showExample
board.showComparison
showTranslation
playAudio
teacher.state
```

Não construir canvas genérico na primeira versão.

---

## 10. TeachingAgent

Responsabilidade: decidir **como explicar**.

Pode simplificar, dar exemplo, comparar com português, responder pergunta, gerar microprática e explicar com mais calma.

Não pode controlar diretamente o player, mudar segmento arbitrariamente, marcar aula como concluída, alterar CoursePackage ou criar novo objetivo curricular principal.

---

## 11. AdaptationEngine

Responsabilidade: decidir **o que fazer agora**.

Exemplos:

```text
continue
repeat
insert_reinforcement
insert_example
insert_activity
skip_optional
increase_difficulty
decrease_difficulty
```

Usa sinais de erros, checkpoints, mastery, preferências, intervenções e desempenho atual.

Separação obrigatória:

```text
TeachingAgent → COMO explicar
AdaptationEngine → O QUE fazer agora
```

---

## 12. Personalização

A aula pode consumir:

```text
goal
contexts
skillPriorities
skillWeights
preferredSessionMinutes
LearningProfile
Mastery
Mistakes
Review
```

Preferência não substitui necessidade pedagógica.

---

## 13. Retomada

Ao interromper, `ResumePoint` salva segmento, posição, quadro e runtime node. A retomada pode usar `resumeAnchors` para não voltar no meio de uma frase.

---

## 14. LearningEvidence

```text
checkpoint correto → evidência forte
pronúncia avaliada → evidência forte
"não entendi" → sinal comportamental
pediu outro exemplo → sinal comportamental
assistiu vídeo → não significa domínio
```

Regra:

```text
WATCHED != LEARNED
```

---

## 15. Eventos

Eventos importantes:

```text
lesson.started
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
lesson.completed
```

Separar analytics, adaptação e evidência.

---

## 16. Fallbacks

```text
TeachingAgent falhou → aula continua
TTS falhou → texto
Speech assessment falhou → tentativa pode continuar sem score
avatar falhou → vídeo/áudio/texto
mídia secundária falhou → quadro/texto
```

---

## 17. Acessibilidade

Incluir legendas, navegação por teclado, contraste, velocidade de reprodução, transcript, estados visuais claros, alternativas textuais e suporte mobile.

---

## 18. Custos

Telemetria futura por aula:

```text
tokens de IA
TTS
STT
speech assessment
avatar
vídeo
storage
bandwidth
```

Precisamos conseguir responder: **quanto custa uma aula por aluno?**

---

## 19. Pipeline de criação

```text
Fontes aprovadas
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
Board
↓
Activities
↓
Validation
↓
Compile
↓
Publish
```

---

## 20. Course Factory

A direção futura é permitir que a própria IA crie os cursos.

```text
CourseRequest
↓
CurriculumArchitect
↓
CoursePlan
↓
ConceptGraph
↓
UnitPlanner
↓
LessonAuthor
↓
InteractiveLessonAuthor
↓
ActivityAuthor
↓
MediaDirector
↓
Alignment
↓
PedagogicalQA
↓
Compiler
↓
Publisher
```

Os agentes produzem contratos; não código arbitrário.

---

## 21. Fontes e proveniência

Preferir materiais autorizados, OER, Creative Commons compatível, domínio público, referências linguísticas e materiais próprios/licenciados.

Armazenar provenance:

```text
source
license
generator
model
promptVersion
reviewStatus
createdAt
```

---

## 22. Estados de publicação

```text
DRAFT
↓
GENERATED
↓
VALIDATED
↓
PEDAGOGICAL_REVIEW
↓
MEDIA_READY
↓
COMPILED
↓
APPROVED
↓
PUBLISHED
```

Nada gerado pela IA deve ir direto para produção sem quality gates.

---

# Fases de implementação

## Fase 0 — Descoberta e auditoria

Objetivo:
- mapear recursos existentes;
- identificar reuso;
- verificar Activity, Speech, Tutor, RecommendationEngine e LearningState;
- identificar gaps;
- validar contratos;
- reduzir duplicação.

Entregável:

```text
DESTRAVA_AUDITORIA_AULA_PARTICULAR_INTERATIVA.md
```

## Fase 1 — InteractiveLesson Core

Implementar contratos, `InteractiveLessonDefinition`, `LessonSegment`, `LessonSession`, state machine, runtime básico e persistência mínima.

Sem IA avançada.

## Fase 2 — Presentation + Timeline + Board

Implementar player, pause, seek, playback rate, `TimelineEngine`, `TimelineCue`, registry de `UIAction`, `BoardState`, `BoardController` e reconstrução após seek.

MVP:

```text
vídeo + quadro sincronizado
```

## Fase 3 — Checkpoints e Activities

Reutilizar `ActivityContract`, `ActivityRenderer`, grader, attempts e evidence.

Implementar checkpoint opcional, obrigatório, retries e transição de runtime.

## Fase 4 — Intervenções determinísticas

Antes da IA, suportar pause, resume, outro exemplo curado, playback mais lento, repetir trecho e abrir prática existente.

Objetivo: provar `InterventionSession` e `ResumePoint`.

## Fase 5 — TeachingAgent em texto

Adicionar context builder, structured output, perguntas, “não entendi”, explicação mais simples, comparação e geração limitada de exemplo.

## Fase 6 — Board controlado pelo TeachingAgent

Permitir propostas de highlight, example, comparison, translation e rule via `UIAction` validada.

## Fase 7 — Perguntas por voz

```text
mic
↓
STT
↓
TeachingAgent
↓
resposta
↓
TTS/texto
```

## Fase 8 — Speaking guiado

Adicionar repeat-after-me, gravação, transcription, pronunciation, feedback, retry e evidence.

## Fase 9 — Adaptação pedagógica

Adicionar `AdaptationEngine` com sinais de checkpoint, erros, interventions, learning profile, preferences e mastery.

## Fase 10 — Personalização por objetivo

Consumir goal, contexts, skill weights e duração preferida da sessão.

## Fase 11 — Pipeline de autoria

Criar processo para:

```text
Blueprint
→ Script
→ Segments
→ Board
→ Activities
→ Checkpoints
→ Speaking
```

Primeiro com arquivos/configuração estruturada.

## Fase 12 — Transcript e alignment

Adicionar transcript, timestamps, word timings quando disponível, semantic anchors e resolução para timestamps reais.

Preferir:

```text
semantic cue → alignment → compiled timestamp
```

em vez de IA inventando timestamps.

## Fase 13 — Media generation

Criar camada de provider para gerar/registrar vídeo e áudio, associar media asset e permitir preview.

Não acoplar Core a fornecedor.

## Fase 14 — Avatar

Depois do MVP estável, testar avatar realista, estilizado e voz + personagem. Medir impacto pedagógico e custo.

## Fase 15 — Avatar / voz realtime

Evolução opcional:

```text
TeachingAgent
↓
TTS / realtime avatar
↓
professora responde visualmente
```

Manter fallback em texto/áudio.

## Fase 16 — Autoria assistida por IA

A IA passa a ajudar a produzir blueprint, script, board, activities, cues semânticos, checkpoints, speaking, exemplos e QA.

A geração deve produzir contratos válidos.

## Fase 17 — Course Factory

Automatizar criação de cursos completos.

Agentes:

```text
CurriculumArchitect
UnitPlanner
LessonAuthor
InteractiveLessonAuthor
ActivityAuthor
AssessmentAuthor
MediaDirector
PedagogicalQA
RepairAgent
```

Pipeline com validação e reparo automático.

## Fase 18 — Lesson Studio interno

Criar editor visual para preview da aula, timeline, vídeo, board, cues, transcript, checkpoint, speaking, resume anchors, QA e publicação.

Não é requisito para MVP.

## Fase 19 — Memória da aula

Permitir procurar onde um conceito foi explicado, reabrir trecho, rever exemplo, acessar vocabulário, consultar transcript e perguntar depois da aula.

## Fase 20 — Relatório pós-aula

Ao concluir: conceitos estudados, skills praticadas, pontos fortes, dificuldades, erros relevantes, próxima recomendação e revisão futura.

## Fase 21 — Integração longitudinal

A aula passa a alimentar Mastery, Mistakes, Review, Recommendations, MicroLessons, Conversation e Tutor — e também consumir esses dados.

## Fase 22 — Corporativo

Preparar metadados:

```text
audience
organizationId
industry
role
context
skills
visibility
```

Mesmo runtime; conteúdo diferente.

---

## 23. Métricas

Medir:

- conclusão da aula;
- taxa de interrupção;
- “não entendi”;
- exemplos extras;
- tempo de reforço;
- checkpoint success;
- speaking attempts;
- repetitions;
- abandonment;
- resume success;
- custo por aula;
- mastery depois da aula.

---

## 24. Experimentos

Testar:

- vídeo vs voz + quadro;
- avatar realista vs estilizado;
- mais ou menos checkpoints;
- explicações curtas vs longas;
- prompting de speaking;
- posição dos quick actions;
- feedback imediato vs agrupado.

---

## 25. Feature flags

```text
interactiveLesson
interactiveLessonVoiceQuestions
interactiveLessonRealtimeAvatar
interactiveLessonAdaptiveTimeline
interactiveLessonAIGeneratedExamples
```

---

## 26. MVP recomendado

A primeira versão deve ter:

- 1 aula real;
- 2–3 segmentos;
- vídeo ou mídia simples;
- quadro sincronizado;
- cues;
- 1 checkpoint;
- 1 speaking;
- `Não entendi`;
- outro exemplo;
- TeachingAgent;
- resume;
- persistência;
- learning evidence;
- adaptação simples.

Sem avatar realtime.

---

## 27. Critérios de sucesso do MVP

O MVP é válido quando:

- a aula parece uma experiência conduzida, não um player;
- o quadro reage ao conteúdo;
- o usuário pode interromper;
- a IA sabe onde a interrupção ocorreu;
- o aluno consegue retomar;
- checkpoint usa Activity existente;
- speaking usa Speech existente;
- a aula gera evidência;
- a falha da IA não impede a aula;
- o mesmo Core pode funcionar em mais de um idioma.

---

## 28. Invariantes

```text
VIDEO != AULA
CANONICAL LESSON != USER RUNTIME PATH
AI != RUNTIME AUTHORITY
WATCHED != LEARNED
INTERVENTION != GENERIC CHAT
CHECKPOINT = ACTIVITY
SPEAKING = EXISTING SPEECH INFRASTRUCTURE
LANGUAGE-SPECIFIC BEHAVIOR → LanguagePackage
```

---

## 29. Ordem recomendada

```text
Auditoria
↓
Core
↓
Presentation
↓
Timeline
↓
Board
↓
Activities
↓
Interventions
↓
TeachingAgent
↓
Speech
↓
Adaptation
↓
Authoring Pipeline
↓
Media
↓
Course Factory
↓
Avatar realtime
```

Essa ordem prioriza arquitetura e valor pedagógico antes de complexidade visual.

---

## 30. Resultado esperado

Ao final, a Aula Particular Interativa do Destrava deve funcionar como uma aula particular conduzida por conteúdo estruturado e mídia pré-produzida, capaz de ser interrompida, explicada de outra forma, adaptada em tempo real e conectada ao perfil pedagógico do aluno.

A experiência não depende de o professor ser humano, avatar, vídeo ou áudio. O motor pedagógico continua sendo o centro.

---

## 31. Regra final

> **A professora apresenta.**
>
> **O quadro acompanha.**
>
> **O aluno pode interromper.**
>
> **O TeachingAgent explica.**
>
> **O AdaptationEngine decide o próximo passo.**
>
> **O LessonRuntime mantém tudo consistente.**
>
> **O UserLearningState registra o que realmente foi aprendido.**
