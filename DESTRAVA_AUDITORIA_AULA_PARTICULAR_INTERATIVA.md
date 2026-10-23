# Destrava — auditoria arquitetural da Aula Particular Interativa

**Data:** 2026-10-04
**Escopo:** análise estática dos contratos e do código atual. Nenhum recurso, schema, migração, conteúdo ou dependência foi implementado.

## 1. Resumo executivo e alcance

O Destrava já tem uma base forte para **conteúdo multilíngua, atividades corrigidas, fala, professor por IA, perfil de aprendizagem e telemetria**. A nova aula pode reutilizar esses motores. O que não existe é a camada que orquestra, em uma mesma aula, apresentação sincronizada, quadro, intervenções, checkpoints e retomada. Criar essa camada é trabalho real; renomear o código existente para coincidir com o contrato não acrescentaria valor.

Recomendação principal: **uma definição interativa vinculada à `Lesson` existente**, compilada no mesmo pacote do curso; um runtime pequeno que coordena apresentação, quadro, atividades e fala; e uma sessão operacional persistida separadamente. Resultados pedagógicos continuam no `StudyState` e nas projeções existentes. Assistir ou concluir segmentos de apresentação não aumenta domínio.

Foram confrontados [Contratos da Aula Particular Interativa v1](DESTRAVA_CONTRATOS_AULA_PARTICULAR_INTERATIVA_V1.md), [Roadmap da Aula Particular Interativa](DESTRAVA_ROADMAP_AULA_PARTICULAR_INTERATIVA.md), [Contratos Multilíngua v1](DESTRAVA_CONTRATOS_MULTILINGUA_V1.md), [Arquitetura Multilíngua](DESTRAVA_ARQUITETURA_MULTILINGUA.md), [Roadmap de Recursos](DESTRAVA_ROADMAP_RECURSOS_APRENDIZADO.md), [README](README.md), schemas, rotas, componentes, scripts e migrações. O roadmap específico foi adicionado ao workspace durante esta auditoria e lido antes de concluí-la. Não foi encontrado código de protótipo visual da Aula Particular Interativa. Os estados visuais abaixo foram mapeados a partir do contrato/roadmap, não de um protótipo executável. Esta auditoria não valida o banco remoto, serviços externos nem experiência em navegador.

## 2. Mapa da arquitetura atual relevante

```text
content/languages + content/courses
  → contracts.ts / content-loader.ts / content-pedagogy.ts
  → compile-content.ts → generated/packs → CourseRegistry
  → runtime-package.ts → PublicCourse + LanguageResources
  → StudyProvider → StudyState por usuário/curso
       ├─ ActivityRenderer → /api/grade → recordAttempt → perfil/revisão
       ├─ SpeakingRecorder → /api/pronunciation → saveSpeaking
       ├─ Tutor/Conversation/MicroLesson → AIProvider + guardAIRequest
       └─ SupabaseStudyRepository → user_course_state + projeções + study_events
```

O pacote do curso modela unidades e lições, com atividades **embutidas** em cada lição; `MediaAsset` já aceita `image`, `audio` e `video`, mas os `media.json` atuais contêm apenas imagens. O loader valida referências e IDs; o compilador gera pacotes consumidos pelo registry. A projeção `runtime-package.ts` transforma a autoria em tipos da UI e atualmente **descarta qualquer campo novo não mapeado**. Ver [contracts.ts](src/content/contracts.ts), [content-loader.ts](scripts/content-loader.ts), [compile-content.ts](scripts/compile-content.ts), [runtime-package.ts](src/content/runtime-package.ts) e [course-registry.ts](src/content/course-registry.ts).

A página [study/page.tsx](src/app/study/page.tsx) monta uma sequência de prática por tempo/preferências e usa índice local para avançar. Isso é uma sessão de estudo, **não** uma aula com timeline. O [StudyProvider](src/components/study-provider.tsx) organiza resultados e sincronização; o [SupabaseStudyRepository](src/repositories/supabase-study-repository.ts) salva um JSON por `user_id + course_id` e projeta tentativas, sessões, erros, fala e eventos. O [LearningRecommendationEngine](src/domain/study/learning-recommendation-engine.ts) escolhe **o que estudar** entre atividades; ainda não decide **o próximo nó dentro** de uma aula.

## 3. Decisão sobre `CoursePackage` e `Lesson`

**Escolha C: entidade de autoria paralela, referenciada por `Lesson` existente.** A definição interativa pertence ao `CoursePackage` e aponta para `courseId`, `unitId` e `lessonId`; a lição declara opcionalmente `interactiveLessonRef`. Isso conserva IDs, ordem, progresso e atividades da trilha e evita duplicar a árvore `Unit → Lesson`. A opção A (embutir toda a timeline na lição) faria o JSON das unidades crescer muito; B (novo tipo de lição) duplicaria navegação e progresso. A estrutura pode ocupar `content/courses/<id>/interactive-lessons/*.json`, mas esse diretório é apenas sugestão de autoria, não um pipeline novo.

Antes de codificar, definir se cada `Lesson` terá **uma** definição interativa ou várias variantes. Para v1, uma referência opcional por lição basta. Os `activityRef` dos checkpoints devem apontar para atividades **já declaradas na mesma lição/curso**; referências a `concept`, `media`, `board target`, `cue`, `resume anchor` e `example` precisam de validação no loader. A coleção deve ser incluída em `CoursePackage`, no pacote compilado e em `runtimeBundle`; só alterar o schema sem propagar o campo faria o runtime perder a aula.

`schemaVersion` e `contentVersion` têm funções diferentes. O loader aceita **somente `1.0`** hoje ([content-loader.ts](scripts/content-loader.ts)). Adicionar campo opcional pode preservar leitura de pacotes 1.0, mas a publicação de um formato de aula novo pede evolução explícita do schema do **CoursePackage** (por exemplo, 1.1) com leitura compatível de 1.0; não obriga mudar `LanguagePackage`. Toda alteração em segmentos, cues ou referências deve incrementar `contentVersion`; a sessão deve fixar a versão iniciada e ter regra de retomada quando o pacote publicado mudar.

## 4. Matriz contrato → código atual

“Criar” significa código novo quando a implementação começar, não uma obrigação de criar arquivo com o nome do contrato. Risco é risco **de integração**.

| Contrato | Implementação atual mais próxima | Reutilizar? | Adaptar? | Criar? | Risco | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `InteractiveLessonDefinition` | `CoursePackage`/`Lesson` em `content/contracts.ts` | Estrutura de curso | Sim | Definição e refs | Alto | Escolha C; versão e projeção compilada. |
| `LessonSegment` | `Lesson.activities` e `PlannedItem` | IDs/skills | Sim | Segmentos | Alto | Não transformar cada segmento em `Activity`. |
| `PresentationDefinition` | `MediaAsset`; `AudioPlayer` | Mídia | Sim | Modos/transcript | Médio | Catálogo declara vídeo, mas não há vídeo publicado. |
| `PresentationController` | `<audio controls>` em `AudioPlayer` | Elemento nativo | Sim | Controle mínimo | Alto | Não existe adapter nem player de vídeo. |
| `TimelineCue` | Nenhum; `StudyEvent` é histórico | Não | Não | Sim | Alto | Cue de autoria não é evento do aluno. |
| `TimelineEngine` | Nenhum | Não | Não | Sim | Crítico | `seek` precisa reconstruir estado. |
| `UIAction` | Zod em contratos/AI schemas | Padrão de validação | Sim | Union/registry | Crítico | Allowlist; IA nunca envia JS ou comando livre. |
| `BoardState` | Componentes textuais de atividade | UI pontual | Sim | Estado de quadro | Alto | Dados serializáveis, renderização acessível. |
| `BoardController` | `ActivityRenderer`/React state | Padrão React | Sim | Reducer/renderer | Alto | Sem canvas genérico. |
| `LessonSession` | `StudySession`, `user_course_state` | IDs/status/datas | Sim | Sessão operacional | Crítico | `StudySession` atual mede plano de estudo por unidade. |
| `LessonRuntime` | `StudyProvider`, `study/page.tsx` | Integrações | Sim | Orquestrador | Crítico | Única autoridade para transições; não duplicar `StudyProvider`. |
| `RuntimeNode` | `PlannedItem` | Ideia de item | Sim | Caminho compacto | Médio | Plano canônico separado do caminho adaptado. |
| `ResumePoint` | Posição local da sessão de estudo | Convenção de save | Sim | Âncora/contexto | Alto | Retomar em âncora estável, não em milissegundo exato. |
| `InterventionSession` | Tutor e microlição sob demanda | Provider/contexto | Sim | Episódio contextual | Alto | Distinto de chat genérico e de evidência. |
| `TeachingAgent` | `AIProvider.tutor`, `TutorContextBuilder` | Provider/quotas | Sim | Operação estruturada | Alto | Proposta validada pelo runtime; sem controle direto. |
| `AdaptationEngine` | `LearningRecommendationEngine` + `LearningProfile` | Sinais/regras | Sim | Política intra-aula | Alto | Recomendador global não é runtime. |
| `ActivityBridge` | `ActivityRenderer` → `/api/grade` → `submitAttempt` | Fluxo principal | Sim | Callback fino | Médio | Reutilizar `ActivityContract`; checkpoint é activity. |
| `SpeechBridge` | `SpeakingRecorder`, `transcribeWav`, `/api/pronunciation` | Captura/Azure | Sim | Resultado para runtime | Alto | Avaliação atual exige `activityId` ou `numberPromptId`. |
| `LearningEvidenceBridge` | `recordAttempt`, `recordEvaluatedSpeaking`, `buildLearningProfile` | Evidência real | Sim | Classificador de sinais | Alto | Playback não produz score/mastery. |
| `ExamplePool` | `Concept.examples`, `LexiconEntry.examples`, revisão | Conteúdo curado | Sim | Índice/seleção | Médio | Derivar do pacote antes de criar entidade própria. |

## 5. Matriz de reuso e fronteiras

| Recurso atual | Uso futuro na aula | Estado |
| --- | --- | --- |
| `CoursePackage`, `LanguagePackage`, `CourseRegistry` | Resolver aula, idioma, variante, mídia, capacidades | Reuso com extensão de conteúdo |
| `ActivityContract`, `ActivityRenderer`, `ExerciseCard`, `/api/grade` | Prática e checkpoint com correção atual | Reuso; callback de resultado a ampliar |
| `recordAttempt`, erros, `ReviewScheduler`, `buildLearningProfile` | Evidência, revisão e adaptação | Reuso; sem evento duplicado de domínio |
| `SpeakingRecorder`, `transcribeWav`, `/api/pronunciation` | Repetição e fala avaliada | Reuso; resultado estruturado para runtime |
| `SpeakButton`, `speakText`, `LanguagePackage.speech` | Escuta de exemplos e fallback de áudio | Reuso; TTS depende do dispositivo |
| `AIProvider`, schemas Zod, `guardAIRequest`, `TutorContextBuilder` | Explicação contextual limitada | Reuso; nova operação/entrada estruturada |
| `LearningRecommendationEngine`, `buildStudyPlan` | Encontrar aula sugerida e fornecer prioridades | Reuso; não comandam a timeline |
| `LearningPreferences`, onboarding, `LearningMemory` | Contexto de adaptação e explicação | Reuso; ler o estado por curso |
| `StudyState`, `SupabaseStudyRepository`, `study_events` | Resultados e telemetria | Reuso; sessão interativa operacional separada |
| `content:validate`, `content:pedagogy`, `content:compile` | Verificação/compilação da aula | Estender fluxo existente |

**Totalmente reutilizáveis para sua função atual:** identificação de curso/idioma, normalização de respostas, correção objetiva, agenda de revisão, cálculo de perfil e guarda de IA, desde que as novas entradas usem os contratos atuais. **Precisam de adaptação:** UI de atividade/fala para entregar resultados ao runtime; loader, compilação, `runtimeBundle`, contexto do tutor, projeção de eventos e navegação. **Realmente novos:** definição interativa, runtime/transições, controle de apresentação, timeline/cues, quadro, sessão/retomada e política local de adaptação.

## 6. Atividades, checkpoints e progresso

[ActivityRenderer](src/components/activities/activity-renderer.tsx) já escolhe os componentes por tipo. [ExerciseCard](src/components/activities/exercise-card.tsx) chama `/api/grade` e possui `onAssessed`; se não recebe callback, chama `submitAttempt` no `StudyProvider`. O runtime futuro deve abrir uma `activityRef` **resolvida no servidor/pacote**, receber `{activityId, answer, result}` e registrar a tentativa **uma única vez** pelo mesmo `recordAttempt`; depois decide avançar, repetir ou reforçar. Um callback de checkpoint não pode desviar a tentativa da persistência.

O contrato público [public.ts](src/content/public.ts) remove respostas e explicações privadas da atividade; a rota [grade/route.ts](src/app/api/grade/route.ts) busca o gabarito no pacote do servidor. A aula compilada enviada ao cliente não deve vazar `answer`, `accepted`, `fullAnswers` nem explicações privadas. A avaliação oral tem restrição semelhante: a referência de pronúncia pode ser pública, mas o resultado vem do servidor.

Hoje `recordAttempt` cria erros, tentativas e eventos; `buildLearningProfile` usa tentativas corrigidas e fala avaliada ([study-state.ts](src/domain/study/study-state.ts), [learning-profile.ts](src/domain/study/learning-profile.ts)). `markActivityComplete` marca leitura/revisão sem prova de domínio. A conclusão de um vídeo deve atualizar a **sessão interativa**, sem chamar `markActivityComplete` por engano. A projeção `lesson_progress` atualmente calcula porcentagem **apenas pelas atividades da lição** ([supabase-study-repository.ts](src/repositories/supabase-study-repository.ts)); uma aula interativa concluída não aparecerá ali sem política explícita de progresso. Definir se o produto quer mostrar “aula vista/concluída” separado de “atividades dominadas”.

## 7. Fala, áudio e IA

[SpeakingRecorder](src/components/activities/speaking-recorder.tsx) grava até 20 s, converte para WAV, obtém transcrição e avaliação pelo [endpoint Azure](src/app/api/pronunciation/route.ts), e salva via `saveSpeaking`; há modos de shadowing, memória, aula e produção própria. A [transcrição genérica](src/lib/transcribe-speech.ts) já serve conversa e descrição de imagem. O armazenamento de gravações usa bucket privado `speaking-audio`; o repositório substitui data URL por caminho e fornece URL temporária. `LanguagePackage` define capacidades e locales por variante; `xx-Test` declara fala/TTS indisponíveis. O caminho **áudio → transcrição → pronúncia → feedback → evidência** existe para uma *atividade speaking cadastrada*, mas não como comando de fala arbitrário na timeline.

Para o MVP, `requestSpeech` deve referenciar uma atividade speaking existente. Adaptar o componente para emitir ao runtime resultado com `submissionId`, transcrição e feedback; hoje `onSaved` não entrega esse resultado. Pronúncia Azure **não avalia produção livre sem texto de referência**; voz livre pode gerar transcrição e feedback qualitativo, sem nota técnica inventada. Se Azure cair, permitir texto ou gravação sem score quando a regra da atividade permitir; um checkpoint oral obrigatório deve apresentar rota alternativa explícita.

[SpeakButton](src/components/audio/speak-button.tsx) usa `speechSynthesis` do navegador via [speak-text.ts](src/lib/speak-text.ts); voz e temporização variam por dispositivo. Esse TTS é útil para exemplos e fallback, mas não serve como relógio confiável da timeline. Áudio/vídeo pré-gravado terá relógio próprio. A página atual de [AudioPlayer](src/components/activities/audio-player.tsx) usa `<audio controls>` apenas para escuta; não expõe `currentTime`, `seek`, rate ou cues.

A IA está centralizada em [AIProvider](src/domain/ai/ai-provider.ts) com Responses estruturadas e [schemas Zod](src/domain/ai/schemas.ts). Tutor, conversa, escrita, imagem e microlição já usam essa infraestrutura; [guardAIRequest](src/domain/ai/ai-request-guard.ts) impõe autenticação, reserva de quota e registro de uso. `TutorContextBuilder` recupera atividade/erro, mas precisa de uma entrada de aula com segmento, objetivo, texto exibido, último checkpoint, variante e preferências. Reaproveitar seu padrão de seleção de contexto; não simplesmente enviar todo `StudyState` ou o transcript inteiro. Um futuro `TeachingAgent` deve produzir **explicação curta e ações permitidas tipadas**, e o servidor/runtime valida referências e limites. O agente não pode executar `seek`, concluir aula, alterar nota ou inventar `activityId`.

## 8. Estado de aprendizagem, personalização e adaptação

`StudyState` guarda tentativas, atividades concluídas, erros, revisões, fala, escrita, conversas, perfil e eventos por curso ([study-state.ts](src/domain/study/study-state.ts), [course-state-storage.ts](src/domain/study/course-state-storage.ts)). O onboarding já produz `goal`, `contexts`, `skillPriorities`, `skillWeights`, `preferredSessionMinutes` em [learning-preferences.ts](src/domain/study/learning-preferences.ts), persistidos em `user_course_profiles` e no estado do curso. A aula deve receber um **`AdaptationContext` derivado** dessas preferências e de `LearningProfile`, não copiar preferências para uma segunda entidade mutável.

`LearningRecommendationEngine` decide prioridade entre revisões, erros e novas atividades; `buildStudyPlan` monta uma sessão com orçamento de tempo. A política intra-aula deve ser pequena e determinística no início: após checkpoint errado, inserir reforço curado ou repetir; após acerto, continuar; após “não entendi”, registrar sinal e ofertar exemplo. Compartilhar **entradas** (`LearningProfile`, erros, preferências, conceitos) e regras de evidência, não a classe de recomendações como se controlasse a aula. Limitar repetições, manter uma ordem canônica, registrar motivo de cada desvio e nunca inferir domínio só por exposição.

## 9. Persistência recomendada

Há `study_sessions` relacional para planos de estudo por **unidade**, com `performance` e atividades planejadas, e `user_course_state` para um JSON completo por curso ([migração inicial](supabase/migrations/20260930000100_initial.sql), [migração por curso](supabase/migrations/20261003000100_course_learning_state.sql)). O repositório grava o JSON completo com `upsert`, serializado por uma fila **somente dentro da instância do navegador**. Salvar posições a cada `timeupdate` inflaria o JSON e exporia perda por sobrescrita entre abas/dispositivos. `study_events` é telemetria, não fonte suficiente para retomar player/quadro. Portanto, **uma tabela pequena `interactive_lesson_sessions` é justificada** no produto, embora uma prova local sem persistência possa precedê-la.

Campos mínimos sugeridos: `id`, `user_id`, `course_id`, `lesson_id`, `content_version`, `status`, `runtime_phase`, `current_segment_id`, `playback_position_ms`, `completed_segment_ids`, `runtime_path` compacto, `resume_anchor_ms`, `board_snapshot` pequeno/opcional, `revision`, `started_at`, `updated_at`, `completed_at`. Validar `course_id + lesson_id` pelo servidor/pacote; usar FK para `auth.users`, `courses` e `lessons` onde o seed publicar IDs. Índices por `(user_id, course_id, updated_at desc)` e, se houver uma sessão ativa por lição, índice único parcial para `(user_id, course_id, lesson_id)` quando o status for retomável. `revision` permite atualização condicional para detectar conflito entre abas. Uma migração futura deve aplicar RLS `auth.uid() = user_id` **e** política restritiva MFA, seguindo [user_course_state_mfa](supabase/migrations/20261003000300_mfa_for_course_state.sql); incluir limites de tamanho e validação de payload no servidor. Nada disso foi criado nesta auditoria.

Separação proposta:

| Dado | Destino | Motivo |
| --- | --- | --- |
| Posição, fase, segmento, caminho adaptado, âncora | `interactive_lesson_sessions` | Retomada operacional rápida |
| `board_snapshot` | JSON pequeno na sessão **se** a intervenção alterar estado fora dos cues | Pode ser reconstruído; não salvar cada frame |
| Intervenções | Resumo compacto na sessão + eventos significativos | Tabela própria só com volume ou consulta real |
| Checkpoint/pronúncia | Tentativas e fala atuais, com IDs ligados à sessão | Única fonte de evidência pedagógica |
| Início, pausa, pedido de exemplo, fim | `study_events` com `course_id` e `lessonSessionId` em metadados | Analytics/sinal; não usar como player state |

Salvar na entrada/saída de intervenção, conclusão de segmento, resultado de checkpoint/fala, pausa, saída e conclusão; posição de mídia em intervalo discreto e `visibilitychange`. Não salvar por frame. A migração [study_events_course](supabase/migrations/20261003000600_study_events_course.sql) já adicionou escopo do curso. O projetor [study-event-projection.ts](src/repositories/study-event-projection.ts) só escreve `activity_id` relacional se a atividade existir no curso; evento da aula deve usar `lessonSessionId`/`segmentId` em metadados e `activity_id` apenas quando houver atividade real.

## 10. State machine e retomada

O código usa `StudyProvider` e hooks `useState`; não há máquina formal/reducer reutilizável para esse workflow. Para v1, um `useReducer` puro com **fase discriminada** e efeitos assíncronos fora do reducer basta; não há ganho demonstrado em adicionar XState. As 15 etiquetas do contrato podem ser agrupadas em fases estáveis: `idle`, `loading`, `presenting` (`playing`/`paused`), `intervening` (`teacher_responding`/`waiting_for_student`), `checkpoint` (`evaluating`/`feedback`), `speaking` (`recording`/`evaluating`/`feedback`), `resuming`, `transition`, `completed`, `error`. Registrar transições permitidas e invariantes: um checkpoint aberto pausa apresentação; apenas um efeito de IA/avaliação em andamento; resultado atrasado não altera segmento já trocado; conclusão persiste antes de navegar.

`ResumePoint` deve conter `segmentId`, âncora anterior ou igual à posição, fase anterior, `boardSnapshot`/estado derivável, e origem da interrupção. `resumeAnchorsMs` pertencem ao conteúdo compilado; escolher âncora estável, geralmente início da frase ou do bloco, evita retornar no meio da palavra. Ao voltar de intervenção: restaurar estado derivado até a âncora, reabrir a apresentação, e só iniciar playback por ação do aluno se o navegador bloquear autoplay. Persistir apenas o ponto necessário para retomar após recarregar; histórico fino de ticks fica em memória. A UI reage ao runtime: “Não entendi” → pausa → `ResumePoint` → intervenção; “Mais devagar” → rate do player; prática/checkpoint → atividade real; feedback → decisão; conclusão → sessão finalizada.

## 11. Player, timeline, transcript e quadro

**Menor abstração de mídia:** adapter sobre `HTMLMediaElement` para vídeo/áudio com `play`, `pause`, `seek`, `rate`, `currentTime`, `duration` e eventos. Para slides/quadro sem mídia, relógio interno controlado pelo runtime ou avanço explícito; não forçar interface de vídeo em todos os modos. `timeupdate` e `seeking/seeked` fornecem sincronização; `requestAnimationFrame` pode suavizar o indicador **somente enquanto toca**, consultando o `currentTime` real. Cancelar listeners/RAF ao trocar segmento. Não há `<video>`, track de legendas temporizadas ou timeline no código atual; textos de `listening` são transcript sem timestamps ([schema.ts](src/content/schema.ts)).

Para a escala de uma aula curta, `TimelineEngine.getStateAt(t)` deve **reaplicar deterministicamente os cues stateful ordenados até `t`** a um estado inicial imutável. `seek` calcula e substitui estado; não executa efeitos como `playAudio`, `openActivity` ou `requestSpeech`. Cues transitórios disparam apenas ao cruzar seu instante durante reprodução normal e respeitam `once` por sessão. Snapshot periódico só se o número de cues crescer a ponto de tornar o replay custoso; não é necessário na v1. Cues de intervenção vivem no caminho da sessão, separados dos cues canônicos. Ordenação estável por `(atMs, id)` evita divergência no seek.

Contrato mínimo de autoria: por segmento, `durationMs` ou duração de mídia, `mediaRef` existente, `transcript` com trechos `{startMs,endMs,text}` quando houver sincronização, `captions` opcionais por locale e `cues` com IDs/ações válidos. Para vídeo acessível, legendas temporizadas devem acompanhar a mídia do MVP; texto corrido sem timestamps pode ser exibido, mas não destacado por tempo. `activeConceptIds` podem constar nos trechos/cues. Validar intervalos dentro da duração, sobreposição intencional e fallback textual.

**Board v1:** estado serializável com elementos identificados, destaque e tradução visível. Elementos mínimos: `text` (com semântica opcional de regra), `example` (original/tradução), `comparison` (duas colunas) e `image` (alt obrigatório, apenas se usado pela primeira aula). Tabela rica, desenho livre, canvas, drag/drop e editor ficam fora da v1. Reutilizar estilos de texto, exemplos e [SpeakButton](src/components/audio/speak-button.tsx); o `BoardController` pode ser reducer puro + renderer React. “Outro exemplo” usa primeiro `Concept.examples`/`LexiconEntry.examples` ([contracts.ts](src/content/contracts.ts)); depois alternativas curadas da aula; IA só quando faltar exemplo adequado. Um `ExamplePool` pode inicialmente ser **índice derivado** do pacote, sem entidade de banco.

## 12. `UIAction` v1 e fronteira de confiança

Schemas Zod próximos aos contratos de conteúdo para ações authored; schema de saída IA em `domain/ai/schemas.ts`, ambos validados no servidor. O runtime executa um **registry fechado**, nunca comandos dinâmicos. Para v1:

| Ação | Classe | Executor | Regra |
| --- | --- | --- | --- |
| `board.show`, `board.highlight`, `board.clear` | Stateful | Board reducer | IDs de elementos/alvos existentes |
| `translation.show`, `caption.show` | Stateful | Board/presentation reducer | Apenas texto/trilha validada |
| `teacher.state` | Stateful visual | Runtime/UI | Estado visual permitido, sem navegar |
| `audio.play` | Efeito | Presentation adapter | Mídia/locale permitido; gesto quando exigido |
| `activity.open` | Efeito controlado | Runtime | `activityRef` do pacote; jamais resposta privada |
| `speech.request` | Efeito controlado | Runtime | Activity speaking existente e capacidade do idioma |

`board.showExample`, `board.showComparison` e `showImage` podem ser **variantes de payload de `board.show`**, evitando ações redundantes; `showTranslation` equivale a `translation.show`. Se o primeiro conteúdo não usar imagem/áudio automatizado, adiar as respectivas ações. A IA inicialmente só propõe subconjunto seguro (`board.show`, `translation.show`, `teacher.state`), com limite de quantidade/tamanho e whitelist de referências. `seek`, `goToSegment`, `completeLesson`, gravação silenciosa, escrita de mastery e chamada de API não são `UIAction` de IA.

## 13. Intervenções e TeachingAgent

| Ação | IA? | Conteúdo? | Runtime? | Fala? | Atividade? |
| --- | --- | --- | --- | --- | --- |
| Não entendi | Opcional para reformular | Primeiro explicação/exemplo curado | Pausa, âncora, retoma | Não obrigatório | Checagem curta opcional |
| Pergunta | Sim, se aberta | Contexto/termos do pacote | Pausa e limita escopo | Entrada por voz opcional | Não por padrão |
| Outro exemplo | Só após pool curado | Sim, primeira escolha | Mostra exemplo e volta | TTS opcional | Não |
| Praticar | Não | `activityRef` existente | Abre e recebe resultado | Se activity speaking | Sim |
| Mais devagar | Não | Não | `playbackRate = 0.75` ou faixa validada | TTS só se modo TTS | Não |
| Automática | Opcional para explicação | Reforço curado primeiro | Política após sinal/resultado | Se reforço oral | Checkpoint/atividade se previsto |

`InterventionSession` precisa de pedido, segmento/posição, motivo, resultado, origem do conteúdo e `ResumePoint`. `TeachingAgent` usa o provider atual, contexto curto por pacote e structured output. Em falha ou quota, a aula oferece explicação/exemplo curado e botão de continuar. A intervenção não vira conversa livre persistida em `ConversationSession` sem escolha explícita de produto; isso misturaria objetivos e métricas.

## 14. Telemetria, evidência e fallbacks

| Evento proposto | Analytics | Sinal de adaptação | Evidência de domínio |
| --- | --- | --- | --- |
| `lesson.started`, `.interrupted`, `.resumed`, `.completed` | Sim | Persistência/abandono, com cautela | Não |
| `lesson.did_not_understand`, `.example_requested`, `.slower_requested` | Sim | Sim, sinal fraco | Não |
| `lesson.checkpoint.passed/failed` | Sim | Sim | **Sim, pela tentativa existente** |
| `lesson.speaking.attempted` | Sim | Sim | Só se houve avaliação confiável |
| `lesson.reinforcement.inserted` | Sim | Diagnóstico da política | Não |

Evitar dupla contagem: o evento da aula referencia a tentativa/`submissionId`, enquanto o domínio usa os registros já consumidos por `buildLearningProfile`. O evento `lesson.completed` não é o `lesson_completed` que [study-state.ts](src/domain/study/study-state.ts) hoje emite ao marcar atividade; tipos novos devem ser distinguíveis. Metadados pequenos com `courseId`, `lessonSessionId`, `segmentId`, `activityId` real quando houver e `contentVersion`; nada de áudio bruto ou resposta integral em analytics.

| Falha | Comportamento mínimo |
| --- | --- |
| OpenAI/TeachingAgent ou quota | Exemplo/explicação curada; continuar a aula; mensagem curta |
| Azure/transcrição/pronúncia | Repetir ou digitar quando permitido; salvar áudio sem nota se houver consentimento e capacidade; não marcar checkpoint avaliado como aprovado |
| TTS do navegador | Texto/legenda e mídia gravada disponível |
| Vídeo/áudio principal | Retry e fallback textual/slides; se conteúdo essencial indisponível, pausar sem concluir automaticamente |
| Avatar | Usar vídeo/áudio/texto; avatar não é dependência do MVP |

Os endpoints existentes já retornam indisponibilidade/limite com status apropriado ([pronunciation](src/app/api/pronunciation/route.ts), [tutor](src/app/api/ai/tutor/route.ts)); faltam transições coordenadas do runtime. Evitar registrar o mesmo erro como fracasso pedagógico.

## 15. Pipeline, multilíngua e qualidade

Estender **`content:validate` → `content:pedagogy` → `content:compile`**, em vez de manter `lessons:validate` como pipeline independente. Um alias `lessons:validate` pode filtrar mensagens depois, mas o build deve passar sempre pela validação única. O loader atual já checa IDs, refs, mídia e capacidade; acrescentar referência de lição, segmento, activity, concept, cue, alvo do quadro, duração, âncora, transcript/legenda e ação. A revisão pedagógica deve verificar objetivo por segmento, excesso de explicação, checkpoint ligado ao objetivo, fallback sem voz e ausência de prova de domínio por playback. Compilar índices/ref resolvidas uma vez; o runtime consome somente conteúdo validado. Ver [content-loader.ts](scripts/content-loader.ts), [content-pedagogy.ts](scripts/content-pedagogy.ts) e [compile-content.ts](scripts/compile-content.ts).

Para ES, EN e `xx-Test`, o runtime deve ler `LanguagePackage.capabilities`, variant/locales, texto/normalização e recursos do `CoursePackage`; não inserir `es-ES`, “Spanish” ou “Frecuencias” no código genérico. `xx-Test` permite provar fronteira sem fala: segmento speaking opcional deve desaparecer/substituir por prática textual **na compilação/política de conteúdo**, e um checkpoint obrigatório de fala deve falhar validação do pacote. O [check-architecture.ts](scripts/check-architecture.ts) já sinaliza marcadores de idiomas no Core; manter esse gate. ES e EN possuem configuração Azure, mas a experiência depende de serviços/vozes disponíveis. IDs do conteúdo devem permanecer estáveis entre versões para não perder vínculo de tentativas.

## 16. Gaps por prioridade e riscos

| Prioridade | Lacuna concreta | Por que importa |
| --- | --- | --- |
| **Crítico** | Definição compilada + refs válidas + conteúdo público sem respostas | Sem aula executável e segura não há MVP. |
| **Crítico** | Runtime de estados, timeline determinística, seek e retomada | A intervenção quebraria o estado ou repetiria efeitos. |
| **Crítico** | Sessão operacional/versionamento/estratégia de save | Perda de posição, conflito entre abas e retomada em conteúdo mudado. |
| **Alto** | Ligação de checkpoint ao fluxo atual de tentativas | Sem isso, revisão e domínio divergem. |
| **Alto** | Conclusão da aula separada de `lesson_progress` e mastery | A projeção atual é calculada por atividades; playback não mede aprendizagem. |
| **Alto** | Resultado de fala chegando ao runtime e fallback por capacidade | `onSaved` atual não informa feedback; `xx-Test` não fala. |
| **Alto** | Segurança/quotas/validação das ações da IA | Impede ação inválida e gasto/estado sem limite. |
| **Médio** | Transcript/captions com tempo, fontes de vídeo e fallback | Não há mídia temporizada no conteúdo atual. |
| **Médio** | Política de exemplo alternativo e adaptação calibrada | Conteúdo curado é desigual por conceito/curso. |
| **Baixo** | Avatar em tempo real, editor de quadro, snapshots de cues, analytics detalhado de intervenções | Não necessários para provar a arquitetura. |

Riscos adicionais: (1) o `StudyProvider` grava snapshots completos e a fila é local à aba, portanto não resolve concorrência entre dispositivos; (2) `runtimeBundle` e o seed relacional precisam receber novos IDs/referências antes de publicar uma aula, senão surgem FKs ausentes; (3) mídia pré-gravada e TTS do navegador têm relógios diferentes; (4) callbacks de atividade que substituem `submitAttempt` podem perder evidência; (5) conteúdo versionado pode mover cues depois de uma sessão pausada; (6) IA pode citar IDs inexistentes, produzir texto longo ou repetir explicação, exigindo whitelist e limites. Nenhum desses riscos justifica uma segunda stack de atividades ou IA.

## 17. MVP técnico mínimo e fases

**Prova recomendada:** uma lição vinculada a uma `Lesson` existente; 2–3 segmentos (preferencialmente **vídeo curto pré-gravado + quadro HTML**, como orienta o roadmap; áudio/slides são fallback técnico), exemplo e checkpoint; 3–5 cues; quadro de texto/exemplo; legendas e transcript temporizado; botão “Não entendi” com alternativa curada **e** explicação limitada do provider atual; um checkpoint objetivo com `ActivityRenderer`; uma speaking activity existente se o idioma permitir; retomada em âncora; sessão salva e recarregada; uma regra simples de reforço após erro. Rodar também um pacote sem fala (`xx-Test`) com speaking opcional omitido ou fallback textual. Não é necessário avatar, vídeo gerado por IA, editor ou adaptação probabilística.

Ordem de implementação recomendada **para uma etapa futura**, com entrega verificável a cada fase:

1. **Contrato e conteúdo:** decidir vínculo com `Lesson`; extensão do schema/loader/pedagogia/compile, separação público/privado e uma definição pequena validada. O pipeline vem primeiro, pois o runtime precisa de conteúdo confiável.
2. **Runtime local:** reducer/transições, player adapter, cues stateful/transient, seek e quadro; testes de reconstrução e cancelamento de efeitos.
3. **Persistência operacional:** tabela/RLS/MFA, versionamento, save em eventos significativos, revisão/conflito e retomada após reload.
4. **Activity/checkpoint:** referência existente, um registro de tentativa, resultado para runtime, progresso separado de domínio.
5. **Intervenção determinística:** “Não entendi”, “Outro exemplo” curado, “Mais devagar”, âncora e restauração.
6. **Fala:** speaking activity atual com callback de resultado e fallback sem Azure/sem capability.
7. **TeachingAgent limitado:** estender `AIProvider`/schema/guard; contexto curto e UIActions permitidas; fallback curado.
8. **Adaptação intra-aula:** regras pequenas baseadas em evidência, limites de repetição, explicabilidade e validação em ES/EN/`xx-Test`.

Esta sequência consolida as fases 1–10 do [roadmap específico](DESTRAVA_ROADMAP_AULA_PARTICULAR_INTERATIVA.md): a **validação técnica mínima** de conteúdo precisa existir na fase 1 para o runtime ler uma aula segura; o **pipeline editorial completo** (blueprint, script, alignment, mídia, publicação e Course Factory) continua evolução posterior, como prevê o roadmap. O MVP do roadmap inclui TeachingAgent, speaking e adaptação simples; as fases acima os deixam para depois do runtime determinístico, mas **dentro do MVP**, não os descartam.

## 18. Decisões humanas antes de escrever código

1. A aula interativa será caminho principal de uma `Lesson` existente ou opção adicional? Isso determina navegação, percentual e copy de conclusão.
2. Para o MVP, existe mídia gravada licenciada/produzida com legenda, ou a primeira prova usará slides + áudio/texto? O contrato suporta ambos, mas a timeline precisa de uma fonte de duração.
3. “Concluiu a aula” significa só terminar apresentação ou requer checkpoint? Recomendo conclusão operacional separada de domínio, com checkpoint obrigatório para progresso pedagógico.
4. O que fazer com uma sessão pausada após mudar `contentVersion`: continuar versão antiga armazenada, migrar âncora validada ou reiniciar com aviso? Recomendo migrar somente se IDs/âncoras forem compatíveis.
5. Fala é obrigatória no primeiro curso publicado? Para idiomas sem speech, a definição precisa de alternativa curada; nunca de aprovação automática.
6. Que dados de áudio/transcrição/intervenção serão retidos e por quanto tempo? O bucket atual guarda gravações de speaking e a sessão proposta não deve duplicar esse áudio.
7. Qual é o conteúdo pedagógico e o critério de qualidade do primeiro checkpoint/explicação? O contrato técnico não substitui revisão humana de uma aula real.
8. Quem produz/revisa o primeiro vídeo, legenda, transcript, exemplos e provenance? O roadmap pede mídia pré-gerada e gates editoriais; sem esse material não há aula real para o MVP.

## 19. Requisitos adicionais confirmados pelo roadmap

O [roadmap da Aula Particular Interativa](DESTRAVA_ROADMAP_AULA_PARTICULAR_INTERATIVA.md) explicita requisitos de produto além dos contratos de runtime. Eles não exigem criar subsistemas nesta etapa, mas precisam entrar nos critérios de implementação:

| Tema | Situação atual e decisão recomendada |
| --- | --- |
| **Mobile e acessibilidade** | A UI atual já tem componentes responsivos, mas não existe interface da nova aula. Validar controles por teclado/toque, foco após intervenção, contraste, legenda, transcript, estado “professora fala/aluno age”, rate e fallback textual em viewport mobile antes de publicar. |
| **Custo por aula** | `ai_requests`/`logAIRequest` já registram tokens/custo estimado de IA; pronúncia e transcrição passam pelo guard, mas vídeo, banda, storage, TTS e custo Azure por minuto não são agregados por `lessonSessionId`. Para medir custo por aluno, correlacionar chamadas/consumo por sessão, sem pôr payload financeiro no runtime pedagógico. |
| **Feature flags** | [feature-flags.ts](src/lib/feature-flags.ts) já controla recursos como speaking/tutor; adicionar flags específicas apenas quando houver fluxos reais, mantendo desligamento de IA/voz/adaptação sem bloquear conteúdo base. |
| **Proveniência e publicação** | `provenanceSchema` possui origem, gerador, fontes e status de revisão, mas não todos os campos de licença/modelo/versão de prompt do roadmap. A expansão pertence ao conteúdo e ao pipeline editorial; conteúdo gerado não pode publicar diretamente. |
| **Alignment** | O roadmap prefere cue semântico → alinhamento → timestamp compilado. O código atual não tem alinhador nem timestamps; v1 pode usar timestamps humanos validados, com modelo de cue preparado para `semanticAnchor` futuro. |
| **Corporativo e Course Factory** | São fases futuras. `metadata.goals/contexts/audience` do contrato cobre parte da seleção; `organizationId`, visibilidade e indústria requerem decisão de autorização/publicação antes de virarem schema. Nenhum desses campos é pré-requisito do MVP pessoal. |

## Quanto desta arquitetura já existe hoje no Destrava?

| Camada | Estado | Avaliação |
| --- | --- | --- |
| Curso/idioma/compilação base | **PRONTA** | Pacotes, variantes, validação e registry existem; falta extensão de aula. |
| Atividades, correção, evidência e revisão | **PRONTA** | O fluxo atual pode servir checkpoints; precisa callback/associação à sessão. |
| Speech e TTS | **PARCIAL** | Gravação, transcrição e avaliação existem para atividades; falta orquestração e fallback de aula. |
| IA e contexto pedagógico | **PARCIAL** | Provider, schemas, quota e tutor existem; falta TeachingAgent com saída limitada ao segmento. |
| Perfil, preferências e recomendação | **PARCIAL** | Sinais e seleção de estudo existem; falta política intra-aula. |
| Sessão e persistência da aula interativa | **NOVA** | `StudySession` atual tem outra semântica. |
| Player sincronizado, timeline, cues, quadro e runtime | **NOVA** | Não há equivalente no repositório. |

**Estimativa aproximada:** cerca de **40–50% da infraestrutura de apoio** pode ser reaproveitada ou adaptada; no **núcleo específico da aula interativa**, menos de **20%** está pronto. São estimativas arquiteturais, não medição de linhas de código ou prazo. O maior trabalho novo está na orquestração confiável de apresentação, interrupções e retomada.
