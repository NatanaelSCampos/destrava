# Destrava — implementação da Aula Particular Interativa v1

**Período:** 4 a 9 de outubro de 2026

**Rota:** `/live-classes` · **Menu:** Aula particular
**Curso de demonstração:** Espanhol A1, lição `l-grammar`, roteiro `aula-tener-idade`

## 1. Resumo

A lição de espanhol sobre **tener para falar de idade** agora abre uma aula guiada. A tela usa a composição do repositório de protótipo fornecido: professora, quadro, controles, ações rápidas e roteiro. O conteúdo e as transições são reais: apresentação em slides, cues no quadro, interrupção com retomada, checkpoint, fala e conclusão persistida. A rota está publicada no Fly e a tabela da sessão está no Supabase remoto.

O protótipo não continha vídeo próprio/licenciado. A demonstração usa a foto da professora disponibilizada naquele repositório, slides identificados como tais, transcrição e áudio por voz do dispositivo. O controlador aceita `<video>` e `<audio>` quando um asset for publicado no catálogo do curso.

## 2. Arquivos principais

- Conteúdo e contratos: `src/content/contracts.ts`, `src/content/validate-interactive-lessons.ts`, `src/content/interactive-examples.ts`, `scripts/content-loader.ts`, `content/courses/frecuencias-a1/interactive-lessons/aula-tener-idade.json`.
- Motor: `src/domain/interactive-lesson/runtime.ts`, `presentation-controller.ts`, `telemetry.ts`.
- Interface: `src/app/live-classes/page.tsx`, `live-classes.css`, `src/components/interactive-lesson/interactive-classroom.tsx`, `public/images/professora-sofia.jpg`.
- Integração: `src/components/activities/activity-renderer.tsx`, `speaking-recorder.tsx`, `src/components/study-provider.tsx`, `src/app/api/interactive-lessons/session/route.ts`, `src/app/api/ai/interactive-lesson/route.ts`.
- Banco: `supabase/migrations/20261004000100_interactive_lesson_sessions.sql`.
- Verificação: `scripts/verify-interactive-lessons.ts`, `scripts/verify-interactive-session-remote.ts`, `scripts/verify-content-remote.ts`.

## 3. Decisões frente à auditoria

Foi adotada a entidade paralela referenciada por `Lesson.interactiveLessonRef`. A aula usa o pipeline de conteúdo existente, o `ActivityRenderer`, `/api/grade`, o `SpeakingRecorder`, o `StudyProvider`, o provider de IA e `study_events`. O runtime operacional fica fora de `user_course_state`. A versão 1 não inclui avatar, editor de timeline nem geração automática de vídeo.

## 4. CoursePackage e Lesson

`CoursePackage.interactiveLessons` contém as definições; uma `Lesson` pode referenciar no máximo uma. O loader lê `interactive-lessons/*.json`, valida o vínculo com curso/unidade/lição e compila junto dos pacotes existentes. A lição referenciada direciona para `/live-classes?lesson=l-grammar`; lições sem referência continuam na tela antiga.

## 5. Schema e versionamento

O curso de espanhol usa `CoursePackage.schemaVersion=1.1` e `contentVersion=1.1.0`. O loader continua aceitando `1.0`, usado pelos cursos inglês e Testês. `LanguagePackage` permaneceu em 1.0. Se a versão de conteúdo da sessão divergir da publicada, a tela recomeça o runtime usando a mesma linha e revisão, sem importar um estado incompatível.

## 6. Runtime

Um reducer governa `idle`, `presenting`, `paused`, `intervening`, `checkpoint`, `speaking`, `reinforcement` e `completed`. Só um segmento canônico fica ativo. A apresentação não avança antes do fim; checkpoint e fala obrigatórios bloqueiam o avanço até haver resultado. `runtimePath` acrescenta no máximo um reforço sem alterar o pacote editorial.

## 7. PresentationController

`HtmlMediaPresentationController` expõe `load`, `play`, `pause`, `seek`, velocidade, tempo e duração para mídia nativa. A aula publicada usa slides com relógio controlado e legenda; erros de carregamento de vídeo/áudio caem nesse modo identificado. Nenhuma mídia externa aleatória foi incorporada.

## 8. TimelineEngine

`load`, `tick`, `seek`, `getStateAt` e `reset` ordenam cues por tempo e ID. `seek` reconstrói somente ações de estado. Efeitos transitórios (`audio.play`, `activity.open`, `speech.request`) são emitidos apenas em playback normal e uma vez por cue.

## 9. Board e UIAction

O quadro serializável suporta texto, exemplo e comparação. O registry Zod fechado aceita `board.show/highlight/clear`, tradução, legenda, estado da professora e os três efeitos transitórios. React mostra o conteúdo como texto, sem HTML arbitrário. O estado do quadro é refeito ao buscar um ponto da apresentação ou retomar em uma âncora.

## 10. Persistência

`interactive_lesson_sessions` guarda usuário, curso, lição, versão, fase, posição, caminho, quadro, âncora, estado serializado e `revision`. A API valida IDs e tamanho do JSON. Saves ocorrem em mudanças de fase e periodicamente durante playback; não a cada frame. A atualização exige a revisão atual. Outra aba com revisão antiga recebe conflito; a interface pede recarga. A conclusão bloqueia a saída até ser salva.

## 11. Activity e checkpoint

`grammar-3` continua sendo uma Activity da lição. `ExerciseCard` chama `/api/grade`; com callback da aula, o resultado passa uma única vez por `submitAttempt` e pelo runtime. A correção, erros, domínio e revisão continuam nos mecanismos existentes. Duas falhas disponibilizam uma explicação de reforço, limitada a uma inserção.

## 12. Speech

`grammar-age-speaking` é uma Activity `speaking` da mesma lição. `SpeakingRecorder` reutiliza transcrição, avaliação de pronúncia e `saveSpeaking`; o callback informa ID da submissão, transcrição e feedback ao runtime. O conteúdo não pode exigir fala num idioma sem reconhecimento habilitado.

## 13. Intervenções

“Não entendi”, “Outro exemplo” e “Praticar” pausam a apresentação e criam `ResumePoint` com segmento, posição, quadro e âncora anterior. “Praticar” abre uma Activity relacionada ao trecho e retorna ao ponto salvo. “Mais devagar” usa velocidade 0,75 sem IA. Exemplos são buscados em `Concept.examples`, depois `LexiconEntry.examples`, depois alternativas da aula.

## 14. TeachingAgent

A operação `teachInteractiveLesson` foi adicionada ao `AIProvider` atual, com resposta estruturada validada por Zod, guarda de quota e log de uso. O servidor escolhe curso, trecho, variante e contexto; a pergunta do aluno é dado não confiável. A resposta pode acrescentar apenas um exemplo de quadro validado; não pode avançar segmento, concluir aula ou escrever domínio. Falha do provider usa explicação e exemplo curados, mantendo o botão de retomada.

## 15. Adaptação

As regras locais são: acerto → continuar; erro → tentar novamente; erros repetidos → reforço; fala salva → continuar. O reforço ganha um `RuntimeNode` visível entre o exercício e a etapa seguinte. A versão 1 não pede à IA para escolher a progressão.

## 16. Evidência de aprendizagem

Assistir, pausar, pedir exemplo e concluir a sessão são sinais operacionais. Eles não alteram mastery nem `lesson_progress`. Evidência vem de Activity e Speaking já existentes. O progresso mostrado na tela é a conclusão dos segmentos da sessão, distinto de domínio pedagógico.

## 17. Telemetria

O servidor deriva eventos pequenos de transições persistidas e os grava em `study_events`: início/conclusão de segmento e aula, interrupção/retomada, pedido de exemplo, dúvida, velocidade reduzida, acerto/erro no checkpoint, tentativa de fala e reforço. Metadados contêm IDs e versão; não há áudio bruto ou resposta completa. Falha de telemetria não bloqueia o salvamento da aula.

## 18. Fallbacks

Sem roteiro no curso, `/live-classes` mostra um estado explicativo. Sem vídeo ou áudio, a apresentação em slides fica identificada. Sem IA, a intervenção usa conteúdo curado. Sem capacidade de fala, a validação recusa uma aula que a exija. Um estado remoto incompatível é reiniciado na mesma sessão; uma falha de salvamento é mostrada e requer recarga.

## 19. Segurança

A tabela nova usa RLS por `auth.uid()` e política restritiva `mfa_access_allowed()`. A rota exige usuário autenticado, resolve curso/lição no pacote publicado, limita o tamanho do estado e valida segmento, caminho canônico e conclusão. O bundle da tela contém definição, mídia e Activities públicas; gabaritos permanecem em `/api/grade`. O teste remoto confirmou que o cliente anônimo não lê uma sessão de outro usuário.

## 20. Multilíngua

Os tipos, runtime, quadro, mídia, IA e persistência não codificam regras de espanhol. O curso espanhol fornece a primeira aula. Inglês e Testês seguem com schema 1.0 e sem aula interativa. O teste Testês verifica falha de autoria se uma aula exigir fala sem capability. Interface do produto permanece em português, como no restante da aplicação.

## 21. Testes automatizados

`interactive:verify` cobre versão 1.0/1.1, referências inválidas, segmento duplicado, cue fora da duração, âncora e alvo de quadro inválidos, Activity inexistente, capability de fala, actions proibidas, ausência de gabarito no bundle público, prioridade de exemplos, seek determinístico, transient sem replay, pausa/retomada, bloqueios, reforço limitado, serialização e isolamento do conteúdo canônico. `interactive:verify:remote` cria uma conta descartável sem envio de e-mail, testa RLS, insert, reload, revisão concorrente e a remove. `db:verify:remote` verifica tabela, Activity de fala e acesso anônimo.

## 22. Verificações manuais realizadas

- Build local e no Fly: `/live-classes` compilada.
- HTTP local e publicado: rota `200`, foto `200`, título da aula presente; HTML sem campo `answer`; API de sessão anônima `401`.
- Supabase remoto: migração aplicada, seed e contagens verificados; teste autenticado de sessão passou com usuário descartável.

Ainda não foi possível executar no navegador uma jornada com a conta real do usuário, incluindo microfone/Azure, resposta OpenAI, refresh e logout/login. Esses passos devem ser conferidos na URL publicada antes de classificar a experiência visual e de fala como aprovada.

## 23. Comandos e resultados

| Comando | Resultado |
| --- | --- |
| `npm.cmd run typecheck`, `lint`, `build` | Passaram; rota incluída no build |
| `content:validate`, `content:compile`, `content:pedagogy` | Passaram; revisão pedagógica manteve 2 avisos preexistentes de respostas aceitas duplicadas |
| `architecture:check`, `learning:verify`, `multilingual:verify`, `interactive:verify` | Passaram; o teste multilíngua teve contagens antigas do curso inglês atualizadas |
| `supabase db push --skip-vault --yes`, `db:seed`, `db:verify:remote` | Passaram no projeto vinculado |
| `interactive:verify:remote` | Passou; usuário descartável removido |
| `scripts/deploy-fly.ps1` | Publicou a rota com a máquina em estado saudável |

## 24. Commits

- `e4f5a21` — contratos, conteúdo, runtime, APIs, migração e testes.
- Interface, integração com navegação, guia, aviso de novidade e documentação: commit seguinte no histórico Git.

## 25. Lacunas restantes

Faltam vídeo/áudio final da professora, teste visual autenticado em celular, verificação real da fala/Azure e um teste automatizado de navegação React com browser. O teste remoto de sessão valida banco e RLS, mas não substitui a jornada completa no navegador.

## 26. Itens adiados

Avatar em tempo real, geração de mídia, alinhamento automático transcript→cue, editor de curso/timeline, Course Factory e políticas probabilísticas de adaptação continuam fora desta versão.

## 27. Diferenças em relação ao contrato

O contrato sugeria várias classes (`BoardController`, `ActivityBridge`, `SpeechBridge`, `ExamplePool`). A implementação reutiliza reducer puro, callbacks mínimos e seleção derivada do pacote. A apresentação da demo usa slides e foto do protótipo porque não havia vídeo próprio. O estado `reinforcement` é uma fase do mesmo reducer, sem um segundo motor de atividades.

## 28. Próximos passos

1. Entrar no Fly com a conta real, abrir **Aula particular** e completar a jornada com microfone em um celular e no desktop.
2. Substituir slides por mídia própria alinhada aos cues; validar legendas e duração no conteúdo.
3. Registrar problemas de UX observados na jornada e ajustar apenas os pontos encontrados.

## Mapa das camadas

| Camada | Existia | Foi adaptada | Foi criada | Estado final |
| --- | --- | --- | --- | --- |
| CoursePackage, Lesson, loader | Sim | Ref e schema 1.1 | Definição interativa | Compila com 1.0/1.1 |
| Activity, correção e domínio | Sim | Callback de resultado | Não | Reuso sem tentativa duplicada |
| Speech e Azure | Sim | Callback da submissão | Não | Integrado; smoke de microfone pendente |
| AIProvider e quota | Sim | Operação estruturada | Não há provider novo | Integrado; smoke OpenAI pendente |
| Runtime, timeline e quadro | Não | — | Sim | Testes de estado passaram |
| Sessão operacional | Não | — | Tabela, API e revisão | Banco remoto testado |
| Telemetria | `study_events` | Novos eventos derivados | Não há segunda tabela | Eventos operacionais separados de domínio |
| Tela e guia | AppShell e tour | Menu e tour | `/live-classes` | Publicada no Fly |

## Mapa das ações

| Ação do usuário | Evento do runtime | Consumidor | Efeito |
| --- | --- | --- | --- |
| Iniciar | `START` | Reducer, persistência | Apresentação e sessão iniciadas |
| Pausar/reproduzir | `PAUSE`/`PLAY` | PresentationController | Relógio/mídia pausam ou seguem |
| Buscar um ponto | `SEEK` | TimelineEngine, Board | Quadro reconstruído sem efeitos transitórios |
| Não entendi/Outro exemplo | `INTERVENE` | Runtime, conteúdo curado | ResumePoint, explicação e mídia pausada |
| Mais devagar | `SLOWER_REQUESTED` | Controller, telemetria | Velocidade 0,75 |
| Praticar | `INTERVENE` | ActivityRenderer | Activity contextual e volta à aula |
| Perguntar | `INTERVENE` + resposta estruturada | AIProvider, UIAction validada | Explicação contextual; fallback curado |
| Retomar | `RESUME` | TimelineEngine | Volta à âncora e restaura o quadro |
| Responder exercício | `CHECKPOINT_RESULT` | `submitAttempt`, runtime | Evidência uma vez; bloqueio ou avanço |
| Salvar fala | `SPEAKING_SAVED` | `saveSpeaking`, runtime | Evidência de fala e avanço |
| Pedir reforço | `REINFORCE` | RuntimePath, UI | Explicação extra limitada |
| Próxima etapa/concluir | `NEXT` | Runtime, persistência | Novo segmento ou conclusão salva |
