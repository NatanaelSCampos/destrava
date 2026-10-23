# Destrava — Fase 4, primeiro ciclo paralelo

Implementação local em 22/10/2026. Escopo: **A1, disponibilidade das ações**, e **B1, evidências independentes da Aula Particular**. **Homologação local aprovada no recorte testado**, com QA independente e revisão estática favoráveis. Resultados abaixo distinguem execução, revisão e limites. Não autoriza o ciclo seguinte.

## Baseline e publicação anterior ao ciclo

O pedido de commit e publicação foi executado **antes** desta implementação:

| Checkout | Commit | Escopo |
| --- | --- | --- |
| Motor, `D:\Documents\espanholPlataform` | `3f7bd01efed99ff1b56c05f8d138bf94c0bdac00` | Onze arquivos: cobertura de estudo, confirmação de persistência do onboarding e feedback imediato da troca de curso. |
| Piloto pessoal EN, preservando ES | `b0ce81fb489d50ac8abb182f18c11d2b05346bad` | Checkpoint do piloto e as mesmas correções de jornada. |

A publicação partiu do checkout pessoal, com **cinco pacotes compilados**, pelo proxy IPv4 e script de produção. Imagem Fly `deployment-01M5K14G9CR3YF602GEWDC65S4`, digest `sha256:5e4563a17c9a7ff2d72e213822cd8ff17740285127a7f1c6235961a4a057ac5e`. Smoke público: login HTTP 200, pilotos ES/EN no catálogo e novos textos de jornada; sem login autenticado ou alteração de progresso em produção. Não houve push. A imagem anterior foi registrada para rollback, sem executá-lo.

O ciclo F4 parte de `3f7bd01`, branch `feat/fase4-first-parallel-cycle`, no checkout do motor, com **três pacotes compilados**. Pilotos e publicação ficaram preservados em seus checkouts. **No encerramento técnico, as mudanças F4 ainda não tinham commit nem publicação.** A autorização posterior de atualização do GitHub está registrada na seção H.

`DESTRAVA_AUDITORIA_RECURSOS_FASE_4.md` permanece sem commit e com os bytes originais. `next-env.d.ts` e `espanholPlataform.code-workspace` são exclusões locais preservadas. Não foram alterados conteúdos ES/EN, contrato público de pacote ou lockfile.

## A. Trilha Motor

Antes, flag ativa ou existência de implementação podiam produzir recomendação/link incompatível com o curso. Exemplo reproduzido pelo QA: erro vencido gerava revisão com SRS indisponível. Fundamentos também ofereciam prática de números ainda não integrada ao instalado.

Agora `learningActionAvailability()` combina quatro dimensões, sem substituir a autorização do servidor:

| Dimensão | Pergunta e efeito |
| --- | --- |
| Implementação | Existe executor suportado? Declaração sem executor não vira ação. |
| Compatibilidade | Fonte e escopo do curso suportam a ação? DTO não habilita recurso ainda não integrado. |
| Operação | Flags/dependências permitem executar? Configuração ausente bloqueia; serviço configurado com saúde/cota desconhecidas continua **unknown**. |
| Permissão | O contexto permite oferecer a ação? Negada/desconhecida impede elegibilidade. Servidor revalida identidade e autoridade. |

Tentativa condicional pode ser apresentada com aviso quando a operação é desconhecida; isso não promete provedor saudável ou cota disponível. `serverServiceAvailability()` é reutilizada na projeção e no guard anterior à reserva de cota/chamada externa.

Foram alinhados recomendações, planner, dashboard, progresso, estudo, erros, vocabulário, fundamentos de números e navegação do AppShell. Alternativas opcionais respeitam o contexto; requisitos curriculares bloqueados continuam nomeados e pendentes, sem conclusão artificial.

O gate de avaliação considera `assessmentId`; sem ID preserva o seletor. A projeção da Aula Particular herda bloqueios da unidade, lição e atividades obrigatórias. Atividade opcional bloqueada não impede a aula inteira.

**Arquivos centrais:** novo `src/domain/study/learning-action-availability.ts`; recommendation-engine/planner; `src/engine/capabilities/availability-projection.ts`; `src/content/public.ts`; application-course-runtime/capability-environment/client-capabilities; ai-request-guard; páginas dashboard/progress/study/mistakes/vocabulary; number-guide e app-shell.

## B. Trilha Aula Particular

### Invariantes definidos antes da implementação

1. Evidência pertence a **usuário + curso + aula + sessão + versão + hash da definição + segmento + atividade + tentativa**.
2. Checkpoint A não aprova B; fala 1 não entrega fala 2. Flags globais são derivadas da etapa atual, não autoridade.
3. Resposta objetiva é corrigida no servidor pelo avaliador existente. Texto/gravação entregues não recebem nota oficial inventada.
4. Cliente autenticado não grava diretamente sessão/comprovante confiável.
5. Repetição idêntica recupera o comprovante original. Mesmo ID com outro payload conflita; nova tentativa válida continua possível.
6. CAS impede revisão obsoleta. Leitura falha não libera gravação. Evidência confirmada reaparece no progresso mesmo sem flush posterior do cliente.
7. Flags legadas sem comprovantes não são promovidas a aprovação. Versão/hash divergentes produzem conflito explícito.

### Funcionamento

`InteractiveClassroom → POST /api/interactive-lessons/segment → autenticação/MFA/escopo/disponibilidade → avaliador existente → transação CAS + comprovante → ACK → estado da etapa e progresso geral`.

Runtime V2 mantém `segmentEvidence` e sequências por segmento. Evidência só satisfaz a etapa correspondente; reprovação posterior não herda aprovação anterior. Pausa, reforço e retomada preservam contexto. Conclusão exige todas as evidências obrigatórias.

Servidor usa definição privada e hash canônico. Escrita usa validação textual existente; fala exige WAV PCM válido de até vinte segundos e transcrição declarada pelo usuário. **Confirmar a entrega não significa reconhecer a fala, avaliar a acústica ou pontuar pronúncia.** Áudio é privado no comprovante, sem endpoint de reprodução neste ciclo.

Transação persiste sessão, tentativa/submissão e telemetria por segmento. Na leitura, o repositório reconcilia comprovantes com progresso geral, usando IDs estáveis e deduplicação. Provider confere usuário/geração após ACK, evitando aplicar resposta de contexto antigo.

`Rever aula` conserva evidências anteriores e permite novas tentativas; não cria ciclo independente de avaliação. Concorrência geral do progresso entre dispositivos continua fora do recorte.

**Arquivos centrais:** `src/domain/interactive-lesson/` (runtime/telemetry, novos evidence/integrity/progress-receipt/request-body/server/session-state); nova API segment e API session; interactive-classroom; callbacks opcionais em activity-renderer/exercise-card/writing-editor/speaking-recorder; study-provider/study-state/supabase-study-repository; validate-interactive-lessons; migração aditiva local `20261022000100_interactive_segment_evidence.sql`.

## C. Processo multiagente

| Papel | Agente | Isolamento e responsabilidade |
| --- | --- | --- |
| Lead | `/root` | Checkout principal: interfaces, integração, banco, browser, build e relatório. |
| Implementador A | `/root/impl_personal_es` | Worktree `D:\Documents\destrava-worktrees\fase4-motor`: disponibilidade e consumidores delimitados. |
| Implementador B | `/root/impl_f4_aula` | Worktree `D:\Documents\destrava-worktrees\fase4-aula`: evidências, persistência e callbacks delimitados. |
| QA | `/root/qa_personal_es` | Worktree `D:\Documents\destrava-worktrees\fase4-qa`: testes independentes, sem correções de produção. |
| Revisor | `/root/revisor_fase4` | Candidato integrado congelado: arquitetura/segurança/integridade, sem escritas. |

Máximo de quatro agentes ativos, contando Lead. A/B avançaram em paralelo; QA preparou negativos independentemente. Revisor entrou após liberação de vaga. Especialistas não subdelegaram. Banco, navegador e build continuaram sequenciais.

Perfis fornecidos explicitamente; papel nativo solicitado quando disponível. Isso não comprova sandbox separado. Worktrees têm branches/índices/dependências/caches próprios, sem credenciais remotas copiadas. Restrição do Revisor foi procedural, fiscalizada por hashes; não constitui barreira contra agente malicioso.

Handoffs trouxeram baseline, ownership, decisões, testes, limites, patches completos e manifestos SHA-256. Só Lead integrou após `git apply --check`, conferindo bytes finais. Diferenças LF/CRLF e headers de patch QA foram normalizados após comparação integral, sem conflito de conteúdo.

A dependência A→B descoberta na revisão foi coordenada: A projetou escopos mínimos e Lead fez o servidor B consumir a mesma disponibilidade. A extensão delimitada do provider/repositório para replay foi necessária para não perder progresso geral depois do ACK da aula.

## D. Qualidade

### Isolamento

`run-fase4-local.mjs` reutiliza `local-environment.mjs`. Antes de banco/browser comprova Docker `desktop-linux`, daemon local por named pipe, projeto `espanhol-plataform` e label de workdir deste checkout. Destinos fixos: API `127.0.0.1:54321`, DB `54322`, app `127.0.0.1:3000`. Perfil sem OpenAI/Azure/Turnstile; fetch limitado a loopback.

Primeiro acesso Docker negado pelo sandbox; repetição autorizada pela ferramenta comprovou isolamento. Nenhum guard relaxado. `checkpoint:migrate` aplicou somente a migração nova com `--local`, sem reset/seed amplo/exclusão/operação remota. SHA-256: `b55c691a28c76a4e2eed299adb1c77ce202f4d5ef004d95068dadc0c87e812a2`.

### Resultados automáticos

| Verificação | Resultado e alcance |
| --- | --- |
| `actions:verify` | **27/27**, projeção, permissões, instalado/compilado, requisitos obrigatórios e SSR. |
| `interactive:segments:verify` | **59 checks**, runtime/callbacks/identidade/serialização/limites. |
| `fase4:verify`, pelo QA | **33/33**, exit 0; rodada final C3, 51 hashes exatos antes/depois. |
| `fase4:verify:local`, pelo Lead | **25 casos**, exit 0; Auth/MFA e SQL reais locais, catálogo sintético e handlers reais em VM. Destinos externos: zero. |
| Jornada existente | **8 grupos**, exit 0; navegador com provider/router/repositório simulados, sem erros/requisições externas. |
| Regressões | **16 verificadores**, todos exit 0: aula, aprendizagem, políticas, avaliações, vocabulário de contratos, sync, arquitetura, capacidades, runtime instalado, instalações, multilinguismo, pacotes, tempo, onboarding; inclui técnicos A/B. |
| TypeScript | `tsc --noEmit --incremental false`, exit 0. |
| ESLint | Exit 0; zero erros, três avisos anteriores de arquivos `.tmp` ignorados. Browser/helper novamente lintados. |
| `build:local` | Exit 0; Next 16.3.8, três pacotes, 44 páginas/rotas geradas. Nova API incluída. |
| `fase4:verify:browser`, pelo Lead | **8 checks**, exit 0; cookies locais, resposta corrigida no servidor, reload antes/depois da aprovação, GET anônimo 401 e viewports 360/390 exatos sem overflow. Zero erros de runtime ou requisições externas. |

SQL cobre nove dimensões de escopo incompatível, conclusão forjada, leitura falha sem escrita, CAS com um vencedor, retry/deduplicação, payload divergente, checkpoints A/B, falas A/B, escrita, requisitos completos, replay antes de flush, bloqueios de unidade/lição/atividade, inatividade, RLS/grants e MFA AAL1/AAL2. `GET` próprio permanece acessível para recuperação quando novas ações estão bloqueadas.

VM não certifica cookies/proxy HTTP. Navegador real cobre separadamente cookies, checkpoint antes/depois da correção no servidor e reload. Microfone, STT e qualidade acústica não são certificados.

### Achados e retrabalho

| Origem | Achado | Correção e reteste |
| --- | --- | --- |
| QA baseline | Sete grupos: dois verdes e **cinco vermelhos** — herança de aprovação/fala, reprovação, telemetria e SRS. | Negativos preservados; matriz final 33/33. |
| Revisor A-R1, alta | Gate ignorava `assessmentId` e assumia diagnóstico. | Query explícita/seletor; QA reproduziu dois vermelhos antes e aprovou depois. |
| Revisor B-R1, média | WAV admitia cerca de 21,87 s, apesar do limite anunciado. | 640.044 bytes antes do Buffer; vinte segundos aceitos, uma amostra adicional negada. |
| Lead B-R2 | API não conferia unidade/lição ativa. | Guard e negativos 404, sem falso conflito de hash. |
| Revisor B-R3, média | Aula/servidor ignoravam bloqueios do escopo curricular. | Projeção única e guard B; três negativos SQL 503 sem escrita, opcional não bloqueia tudo. |
| Lead, navegador | Grid lateral alargava página mobile; teste anterior só comparava scrollWidth com innerWidth já alargado. | Coluna `minmax(0, 1fr)`; teste exige largura solicitada, botão visível ao toque e fechamento de popups pelos controles existentes. |

Falhas de harness/ambiente foram separadas das de produto: porta ocupada, permissões Docker, fixture com lição vazia, bindings antigos VM, flags de integração injetadas em controles positivos puros, wrapper `.tsx`, apresentação iniciada pausada e `.click()` atravessando modal. Corrigidos os harnesses, asserções preservadas ou fortalecidas. Contas sintéticas de execuções interrompidas foram conservadas, sem limpeza destrutiva.

Revisor aprovou estaticamente **F4-C2**, 48 arquivos, e o delta final **F4-C3**, 51 arquivos, com hashes exatos antes/depois, sem achados abertos. Não executou SQL/browser/build; são evidências do Lead. O build foi repetido após a correção CSS e passou; TypeScript e lint dos helpers também passaram após as últimas alterações. Regressões/SQL anteriores continuam aplicáveis porque nenhuma lógica A/B mudou entre C2 e C3: somente CSS e harness browser/helper.

**Candidato final:** `F4-C3`, digest `a6f27ce083ac1288cad64afa62663f5ab74fdc133c0e839b26e86351e5a3a7cb`. Manifesto SHA-256 `76ca1ff5e14bfc14332ad9f1251126397ddaad9a9ccb1630db957778b9e1972b`. Conferência após o build preservou os mesmos 51 hashes. `git diff --check` passou; nenhum arquivo staged; scanner de padrões de segredos não encontrou ocorrências nos 51 arquivos. Scanner não é garantia absoluta de ausência de segredos.

Cliques centrais usam mouse CDP com hit-test em viewport móvel emulado; não são toque físico. Reprodução e alguns controles de fechamento usam `.click()` do DOM; não foram todos exercitados por ponteiro. Capturas inspecionadas: `.tmp/fase4-classroom-390.png` e `.tmp/fase4-classroom-360.png`. A largura exata evita a falsa aprovação anterior, na qual o navegador já havia alargado o layout. Não houve alteração geral da navegação ou dos popups.

### Rastreabilidade e pendências manuais

Manifestos/patches/logs ignorados: `.tmp/fase4-cycle/`. `verification.json` consolida candidato, comandos, resultados, autoria e limites; `pure-gates.json` registra as 16 saídas; resultado QA final identifica C3. Browser final e segundo build têm saídas persistidas; SQL final de 25 casos permanece no histórico de ferramentas, explicitamente identificado no resumo de execução. Esse resumo não é apresentado como log bruto SQL persistido. Relatório é mutável e fica fora do manifesto de código.

Pendentes: dispositivos físicos, teclado virtual, leitores de tela/foco, microfone real, vozes e qualidade acústica/pedagógica. Mobile deste ciclo cobre somente larguras/jornada exercitadas; não certifica toda a aplicação. Chamadas pagas: zero. Servidor local reiniciado pelo comando protegido `npm.cmd run dev:local`, porta **3000**, rota de revisão **http://127.0.0.1:3000/live-classes**. Use uma conta local; a sessão remota não é uma credencial do Supabase local.

## E. Arquitetura

Contrato público de pacote/conteúdo/políticas preservado. `interactiveLessonScopes` é DTO interno com `unitId`, `lessonId`, `requiredActivityIds`, extraídos dos contratos existentes; sem gabaritos e sem habilitar instalado.

Uma única correção objetiva é reutilizada no servidor; uma projeção canônica orienta disponibilidade. Máquina de estados consome prova validada, sem converter evento de UI em domínio. Escrita privilegiada exige proprietário/MFA/guard. Aprovação editorial no Foundry continua distinta da execução no motor.

Limites: entrega escrita/fala não certifica qualidade; áudio privado sem replay; rever aula sem ciclo independente; concorrência geral do progresso entre dispositivos fora do recorte. Curso externo não ganha aula/IA/voz por transportar DTO compatível.

## F. Aprendizado e métricas

| Conceito | Aplicação real | Exemplo reutilizável |
| --- | --- | --- |
| Capability-Aware UX | CTAs/recomendações consomem disponibilidade contextual. | Checkout oferece só pagamento configurado para aquele lojista. |
| State Machines | NEXT exige prova da etapa atual. | Pedido enviado exige comprovante de expedição. |
| Evidence Scoping | Segmento/atividade/versão impedem aprovação cruzada. | Documento A não aprova documento B. |
| Idempotency | Retry recupera comprovante; ID com outro payload conflita. | Webhook repetido não duplica cobrança. |
| Context Isolation | Worktree/ownership/briefing por entrega. | Catálogo/cobrança integram contrato sem editar mesmos arquivos. |
| Contract Validation | Estrutura, versão, hash e referências conferidos no servidor. | Evento incompatível não altera assinatura. |
| Deterministic Authorization | Proprietário/MFA/guard precedem gravação. | IA sugere reembolso, mas não autoriza a transação. |
| Defensive Programming | Leitura falha/resposta obsoleta/flags legadas não aprovam. | Cache incompleto não substitui saldo canônico. |
| Integration Testing | ACK, persistência e nova leitura exercitados juntos. | Conciliar webhook no banco além de verificar HTTP 200. |

Antes: flag global `checkpointPassed` sobrevivia à troca de segmento. Depois: `SegmentEvidence` inclui escopo/segmentId; a flag atual é derivada dessa prova. Antes: link dependia só da flag do recurso. Depois: elegibilidade combina implementação, curso, operação e permissão.

Métricas observadas: duas implementações paralelas, máximo quatro agentes ativos; cinco falhas independentes reproduzidas na baseline; um achado alto e dois médios do Revisor resolvidos, mais guard/overflow encontrados pelo Lead; 33 grupos independentes e 25 casos SQL finais aprovados. Não somar grupos heterogêneos como taxa única de qualidade. Sem medição confiável de tokens/custo ou produtividade comparável; nenhum ganho percentual afirmado.

## G. Próximo ciclo recomendado — não iniciado

1. **Motor A2: homologar sessão instalada e diagnóstico no fluxo real.** Iniciar/pausar/retomar/finalizar/recarregar, desktop/mobile, versão fixada, falha de rede, evidência persistida e troca de curso. Depende de A1; não precisa habilitar IA/voz/aula instalada.
2. **Aula B2: política bilíngue e narração controlada.** Revisar/ integrar seletivamente solução ES: apoio/alvo por narração, pausa/cancelamento/retomada, voz compatível/fallback textual, com idioma sintético além de ES/EN. Não copiar componente inteiro ou prometer pronúncia. Reutiliza B1.

São complementares, viáveis em worktrees separadas com disponibilidade compartilhada, QA independente e integração sequencial pelo Lead. Exigem aprovação própria. Admin, novas avaliações de IA e publicação ficam fora do recorte proposto.

## H. Checkpoint GitHub autorizado posteriormente

Após a entrega técnica, o usuário solicitou atualizar o repositório `NatanaelSCampos/destrava` no GitHub. O checkpoint usa a branch `feat/fase4-first-parallel-cycle`, com os 51 arquivos do candidato F4-C3 e este relatório. A conferência anterior ao commit confirmou os mesmos hashes homologados, `git diff --check` sem falhas e nenhum segredo identificado pelo scanner de padrões.

Auditoria F4, configurações locais, credenciais e artefatos `.tmp` permanecem fora do commit. Essa autorização permite commit/push da branch; não inclui merge em `main`, deploy no Fly, migração remota ou início do próximo ciclo. O hash e o resultado do push são apresentados na entrega dessa operação.
