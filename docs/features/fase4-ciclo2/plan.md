# Ciclo 2 — plano técnico proposto

**Somente planejamento.** Aceite: [spec](spec.md). Baseline: `dccbdec` / árvore `24b3119`. Decisões: [DUVIDAS](../../DUVIDAS.md). Controles: [roteiro](ROTEIRO_TAREFA.md).

## Investigação e reuso comprovado

| Área | Fonte na baseline | Reuso e limite |
| --- | --- | --- |
| Contexto | `src/lib/application-course-runtime.ts`; `src/app/layout.tsx` | Resolução compiled/installed, remount por identidade e seleção/versionSession |
| Sessão pedagógica | `src/components/study-provider.tsx:746`, `:837` | Início verifica versão ativa/flush/CAS; encerramento registra tempo. Sem callback explícito pause/resume |
| Jornada/estado | `src/app/study/page.tsx:100`, `:105`; `src/domain/study/study-state.ts:96` | Cursor local React; timer pausa por visibilidade/inatividade. Estado não tem cursor/pausa explícita |
| Persistência | `src/repositories/installed-study-http-repository.ts:59`; `src/domain/installed-study/service.ts:178`, `:208`; `src/lib/study-sync-cache.ts:13` | Leitura antes de escrita, pendência/retry, projeção canônica, cache por conta/instalação/hash/sessão |
| Avaliações | `src/app/api/assessments/route.ts`; `study-provider.tsx:620`; runners adaptive/fixed | Resultado privado canônico, guards de geração/versão. Respostas em andamento ainda locais |
| Inspeção instalada | `src/app/installed-courses/[sessionId]/page.tsx` | Read-only com áudio, não a jornada pedagógica completa |
| Compatibilidade | `src/domain/installed-study/compatibility.ts`; `src/domain/study/learning-action-availability.ts` | Suporte real do caminho, sem ampliar gates por transportar DTO |
| B1 | `src/domain/interactive-lesson/runtime.ts`, `evidence.ts`, `integrity.ts`, `server.ts`, `progress-receipt.ts` | Máquina, âncoras, provas e CAS; narração não cria evidência |
| Reprodução | `src/domain/interactive-lesson/presentation-controller.ts`; `src/components/interactive-lesson/interactive-classroom.tsx` | Mídia/timeline separados; RESUME volta paused na âncora; não controla TTS |
| Voz/apresentação | `src/lib/speak-text.ts`, `speech-voice-preference.ts`; `src/engine/variants/speech.ts`; `src/engine/presentation/text.ts`; `src/components/audio/speak-button.tsx` | Seleção/preferência locale, source/target; TTS cancela globalmente e retorna boolean, sem handle de sessão |
| Idiomas editoriais | `src/content/contracts.ts:260`, `:463`; `src/content/interactive-examples.ts` | Idioma por linha e apoio/alvo existem; não separam uma string mista automaticamente |
| Professor contextual | `src/app/api/ai/interactive-lesson/route.ts`; `src/domain/ai/schemas.ts`, `ai-provider.ts` | DTO de strings; adaptar papéis de message/example/translation/followUp, sem presumir idioma efetivo |

### Cobertura existente e lacunas

- `verify-installed-runtime-local.tsx:861` cobre onboarding/atividade/avaliação **final**, não diagnóstico. Fixture pública `contracts/package-v1/example-source.json:54` só tem final; produtor independente clona avaliações (`produce-independent-learning-course.mjs:126`).
- A menção histórica de oito casos VM do callback real de início em `DESTRAVA_RUNTIME_INCREMENTO_8.md:90` não foi localizada nos scripts versionados. Localizar artefato antes de prometer reuso; caso contrário criar cobertura rastreável.
- Reusar verificadores de runtime/instalações, sync, tempo, semântica de avaliações, jornada, variantes/vozes e B1. Cada evidência nova deve ser vinculada ao candidato realmente executado.
- O piloto ES tem helper pequeno de idioma por linha e locale no botão; é referência parcial de leitura, sem lifecycle completo. Não copiar sala inteira de baseline antiga sobre B1.
- Banco local conhecido contém políticas extras de geração ausentes da main. Não alegar bootstrap exato; preparação operacional tem decisão C2-O01 e autorização próprias.

## Abordagem recomendada

**A2:** definir A01/A02; fixture de diagnóstico adaptativo/final distintos; reusar provider/planner/repositório/avaliador e exercitar navegação/HTTP reais. Corrigir só lacunas demonstradas por negativos após autorização. Se aprovado cursor/pausa/rascunho, preferir extensão interna mínima do estado com sanitização; schema/política/contrato público requer STOP. Provar nova leitura e contagens, não só HTTP 200.

**B2:** resolver idioma/papel antes da fala, reusando metadados/campos explícitos; adaptar reprodução com proprietário/generation e lifecycle testável. Fila/handle interno pequeno só se necessário. Reusar vozes/preferências/fallback; coordenar áudio transitório, mídia e timeline sem confundir relógio visual com posição acústica TTS. Eventos de reprodução não criam provas B1. Professor contextual/fallback usam a mesma política, testada sem provedor pago.

| Alternativa | Decisão proposta |
| --- | --- |
| Completar fluxo instalado/testes atuais | Preferida para A2; preserva CAS/autoridade existentes |
| Novo subsistema de sessões | Rejeitado sem necessidade demonstrada: duplicaria persistência |
| Copiar toda a sala ES | Rejeitado: baseline antiga e risco B1 |
| Dados explícitos de idioma + adaptação de reprodução | Preferida; contrato atual cobre linhas homogêneas |
| Detectar língua pela string ou falar tudo com voz alvo | Rejeitado: ambiguidade editorial |
| Novo serviço realtime/contrato público V2 | Fora do escopo, aprovação independente se necessário |

## Interfaces e ownership futuros

| Fronteira | Controle |
| --- | --- |
| PublicCourse, pacote/textPresentation e políticas | Reusar contratos; nenhuma trilha muda schema unilateralmente |
| Identidade conta/curso/instalação/hash/versionSession | Lead fixa invariantes antes do paralelo |
| A1/R1P2/compatibilidade instalada | Lead controla alteração de gate; sem ampliação incidental |
| Provider/repositório | A2 é dono; B2 usa callbacks B1 existentes. Necessidade conjunta volta ao Lead |
| Aula/apresentação | B2 é dono; servidor/comprovante B1 não muda por conveniência da voz |
| Utilitários globais de voz/texto | B2 delimita mudança e inclui regressão dos outros consumidores |
| Scripts npm, fixtures compartilhadas, banco/browser/helper | Integração e recursos coordenados pelo Lead |

## Equipe, sequência e contexto

Usar [procedimento canônico](../../../DESTRAVA_MULTIAGENTE.md). Esta preparação tem Lead+QA+Revisor; nenhum implementador foi iniciado.

Após autorização: **dois implementadores delimitados**, A2 e B2, com o mesmo perfil canônico, em worktrees separadas. Máximo quatro agentes ativos contando Lead:

1. Lead estabiliza decisões/interfaces/ownership; QA deriva negativos independentemente.
2. Lead + Implementador A2 + Implementador B2 + QA podem avançar em paralelo sem sobreposição de escrita.
3. Congelar entregas e liberar ao menos uma vaga de implementação antes de iniciar Revisor. Não executar cinco papéis simultaneamente.
4. Lead recebe patches completos/manifestos, checa e integra. Banco/browser/build sequenciais no checkout cujo isolamento foi comprovado.
5. QA testa candidato integrado e Revisor lê o mesmo candidato congelado; alteração invalida evidências afetadas. Retrabalho retorna ao dono, serializado quando necessário.

Worktrees A2/B2/QA são apenas **propostas para criação futura**, não criadas aqui. O worktree documental serve ao planejamento e não recebe env/deps/copias de caches.

Briefing curto: baseline+trilha/tarefa+spec/plan/tasks+ownership+aceite+restrições; sem histórico completo nem contrato duplicado em prompts. Handoff em dez campos, arquivos novos/patch/hashes/comandos/exits/limites. Só Lead integra.

O runner local verifica projeto/daemon/workdir/labels; não presumir execução no novo worktree nem relaxar guard. Lead reserva portas/processos/serviços; typecheck não concorre com geração de tipos/build. Provedores externos desativados nos testes determinísticos. Scripts que apagam dados exigem autorização própria, mesmo chamados local.

Métricas: falhas reproduzidas, achados independentes, retrabalho, sobreposição, duração de gates e integridade de hashes. Tokens/custo só quando realmente disponíveis; não alegar ganho percentual sem comparação medida.

## Riscos/controles

Sessão de versão confundida com estudo: A01/A02 e leitura nova. Falha/ACK/troca: CAS, geração, identidade de retry. Final como diagnóstico: fixture e propósito distintos. Linha mista/voz errada: idioma explícito ou texto. Áudio/callback velho: proprietário, cancelamento e exclusividade. Prova B1 perdida: regressões por segmento. Schema/checkout divergente: C2-O01, labels e nenhum bootstrap alegado por inferência.
