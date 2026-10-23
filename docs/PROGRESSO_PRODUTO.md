# Destrava — progresso do produto e desenvolvimento

**Atualizado documentalmente em 23/10/2026. Distinguir Git verificado, auditoria histórica, autorização de execução e implementação comprovada.**

## Baseline oficial

- `origin/main`: `b2e94ce89e9bbaf964e4738b8464dc49f049cb2d` (PR #3 integrada; conferido em 23/10/2026). A PR #2 havia integrado o motor com o commit `dccbdec` e árvore homologada `24b3119`.
- O histórico de inventário dos 14 worktrees e respectivas pendências refere-se à preparação documental anterior (ver relatório); **não houve atualização nem revalidação dos worktrees Windows nesta PR de roadmap**.
- Planejamento: branch `docs/fase4-ciclo2-planejamento`, worktree `D:\Documents\destrava-worktrees\fase4-ciclo2-planejamento`, criado da main confirmada; sem env/deps copiados ou implementação.
- Inventário e preservação: [relatório desta preparação](features/fase4-ciclo2/RELATORIO_EXECUCAO.md).

## Concluído conforme commits/relatórios

- Incrementos 1–8: contratos, avaliações, políticas, capacidades, texto/variantes, importação, instalações/versionamento e interoperabilidade básica.
- Estrutura multiagente canônica e [Do Chat ao Commit](DO_CHAT_AO_COMMIT.md), sem outra plataforma.
- Fase 4 Ciclo 1 A1: disponibilidade contextual; B1: evidências/checkpoints por segmento e mobile. Evidência histórica QA 33, SQL 25 e browser oito, com limites no [relatório F4](../DESTRAVA_FASE4_CICLO1.md).
- R1P2 em `18a67c5`, incorporado pela PR #2: ausência de chave privada bloqueia aula; configuração completa continua condicional. [Relatório](features/pr2-r1p2/RELATORIO_EXECUCAO.md).
- Merge integrou código na main, sem homologar Fly/banco remoto/bootstrap exato/pilotos. Release de cinco pacotes continua separada.

## Próxima etapa funcional — autorização existente, conclusão não comprovada

[Spec](features/fase4-ciclo2/spec.md), [plan](features/fase4-ciclo2/plan.md), [tasks](features/fase4-ciclo2/tasks.md) e [roteiro](features/fase4-ciclo2/ROTEIRO_TAREFA.md): seis escolhas de produto aprovadas e **integradas na PR #3**. O proprietário autorizou o início de A2/B2 em conversa posterior e recebeu o handoff ao Codex. **Não há PR funcional nem commit A2/B2 confirmado no GitHub nesta revisão**; a autorização não é prova de execução:

- A2: sessões pedagógicas e diagnóstico adaptativo real, pausa explícita+automática, recuperação de sessão/plano/etapa/tempo confirmados e respostas submetidas. Sem rascunhos incompletos ou novo diagnóstico fixo.
- B2: apoio/alvo pelo curso, TTS por ação do aluno, uma reprodução ativa, mídia pausada e retomada por frase/âncora, fallback textual e provas B1 preservadas; sem realtime/avatar/avaliação acústica.
- Investigação por leitura, nenhum teste de runtime novo. Final I8 não comprova diagnóstico; botão TTS não é controlador bilíngue completo.

## Próximos marcos

1. **A2/B2:** aguardar entrega real do Codex Lead, com baseline, candidato, QA/Revisor, testes e PR funcional. Não inferir resultado a partir do prompt de autorização.
2. **Roadmap e matriz:** revisar [roadmap estratégico](produto/ROADMAP_ESTRATEGICO.md) e [matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md), propostos na PR documental atual, sem transformar isso em autorização de novas fases.
3. **Após o Ciclo 2:** atualizar a matriz com evidências reais, escolher a próxima integração vertical (SRS, IA, speech e Aula Particular instalada) e abrir spec/PR documental próprias.
4. **Pré-lançamento:** reformulação visual ampla após estabilização dos fluxos principais; usabilidade essencial, acessibilidade e segurança são obrigatórias ao longo dos ciclos.

## Norte estratégico proposto

- [Roadmap até piloto/lançamento](produto/ROADMAP_ESTRATEGICO.md): consolidação pedagógica instalada, IA/voz, Aula Particular aprofundada, Foundry/Admin, UI/UX e piloto.
- [Matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md): 33 recursos pedagógicos (auditoria histórica) versus 44 capacidades técnicas do perfil instalado. O status desta matriz é **baseline documental para revisão**, não homologação nova.
- **Decisão de priorização visual:** corrigir UX bloqueante/essencial a cada ciclo; reservar redesign completo e design system consolidado para o marco pré-lançamento, com auditoria por telas antes de implementar.

## Restrições persistentes

Foundry produz/aprova conteúdo; motor valida/importa/executa contrato público. Preservar pilotos ES/EN e pendências. Não ampliar suporte instalado de IA/voz/SRS/aula por inferência. Auth/MFA, identidade/versão, segredos e leitura antes de escrita são obrigatórios. Serviços são coordenados; migrações/exclusões/pago/release dependem de autorização própria.
