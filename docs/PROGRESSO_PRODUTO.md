# Destrava — progresso do produto e desenvolvimento

**Atualizado em 23/10/2026. Distinguir Git verificado, evidência histórica e proposta.**

## Baseline oficial

- Baseline documental atual da PR funcional: `4a9a5e918d345cf7a8d37d176068ea8ae4892810`, merge da PR #4. Código, contratos, migrações e critérios não mudaram desde a baseline inicial. O roadmap e a matriz permanecem preservados.

- Baseline de execução confirmada em `origin/main`: `b2e94ce89e9bbaf964e4738b8464dc49f049cb2d`, após integração das decisões aprovadas pela PR #3. A PR #2 permanece integrada em `dccbdec`, sem alteração da release Fly por inferência.
- Baseline confirmada antes de implementar. Checkouts históricos não foram atualizados automaticamente; o principal é usado temporariamente para os serviços protegidos e suas pendências são preservadas.
- Planejamento: branch `docs/fase4-ciclo2-planejamento`, worktree `D:\Documents\destrava-worktrees\fase4-ciclo2-planejamento`, criado da main confirmada; sem env/deps copiados ou implementação.
- Inventário e preservação: [relatório desta preparação](features/fase4-ciclo2/RELATORIO_EXECUCAO.md).

## Concluído conforme commits/relatórios

- Incrementos 1–8: contratos, avaliações, políticas, capacidades, texto/variantes, importação, instalações/versionamento e interoperabilidade básica.
- Estrutura multiagente canônica e [Do Chat ao Commit](DO_CHAT_AO_COMMIT.md), sem outra plataforma.
- Fase 4 Ciclo 1 A1: disponibilidade contextual; B1: evidências/checkpoints por segmento e mobile. Evidência histórica QA 33, SQL 25 e browser oito, com limites no [relatório F4](../DESTRAVA_FASE4_CICLO1.md).
- R1P2 em `18a67c5`, incorporado pela PR #2: ausência de chave privada bloqueia aula; configuração completa continua condicional. [Relatório](features/pr2-r1p2/RELATORIO_EXECUCAO.md).
- Merge integrou código na main, sem homologar Fly/banco remoto/bootstrap exato/pilotos. Release de cinco pacotes continua separada.

## Ciclo 2 — implementação e homologação local

[Spec](features/fase4-ciclo2/spec.md), [plan](features/fase4-ciclo2/plan.md), [tasks](features/fase4-ciclo2/tasks.md) e [roteiro](features/fase4-ciclo2/ROTEIRO_TAREFA.md): **seis decisões aprovadas e execução autorizada expressamente em 23/10/2026:**

- A2: sessões pedagógicas e diagnóstico adaptativo real, pausa explícita+automática, recuperação de sessão/plano/etapa/tempo confirmados e respostas submetidas. Sem rascunhos incompletos ou novo diagnóstico fixo.
- B2: apoio/alvo pelo curso, TTS por ação do aluno, uma reprodução ativa, mídia pausada e retomada por frase/âncora, fallback textual e provas B1 preservadas; sem realtime/avatar/avaliação acústica.
- A2/B2 implementados e testes locais concluídos: [relatório funcional](features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md). QA/Revisor GO no candidato local; publicação Git autorizada, sem merge ou publicação operacional.

## Próximos marcos

1. Proprietário revisar a PR funcional com QA/Revisor GO e seus limites.
2. Merge, release e outro ciclo dependem de autorização própria; nenhuma dessas operações é iniciada pela homologação.
3. Preservar o roadmap e a matriz da PR #4; atualizar a maturidade com esta entrega somente em revisão documental própria. A próxima integração vertical e o redesign amplo dependem de especificação e autorização separadas.

## Norte estratégico proposto

- [Roadmap até piloto/lançamento](produto/ROADMAP_ESTRATEGICO.md): consolidação pedagógica instalada, IA/voz, Aula Particular aprofundada, Foundry/Admin, UI/UX e piloto.
- [Matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md): 33 recursos pedagógicos (auditoria histórica) versus 44 capacidades técnicas do perfil instalado. O status desta matriz é **baseline documental para revisão**, não homologação nova.
- **Decisão de priorização visual:** corrigir UX bloqueante/essencial a cada ciclo; reservar redesign completo e design system consolidado para o marco pré-lançamento, com auditoria por telas antes de implementar.

## Restrições persistentes

Foundry produz/aprova conteúdo; motor valida/importa/executa contrato público. Preservar pilotos ES/EN e pendências. Não ampliar suporte instalado de IA/voz/SRS/aula por inferência. Auth/MFA, identidade/versão, segredos e leitura antes de escrita são obrigatórios. Serviços são coordenados; migrações/exclusões/pago/release dependem de autorização própria.
