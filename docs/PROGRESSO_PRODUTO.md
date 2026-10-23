# Destrava — progresso do produto e desenvolvimento

**Atualizado em 23/10/2026. Distinguir Git verificado, evidência histórica e proposta.**

## Baseline oficial

- **`origin/main` verificada em 23/10/2026:** `6bdd26c336ce50d59569a74581044fe3ddc89284`, **PR #5 (política ES-A1) integrada**, após PR #6 A2/B2 e PRs #2–4. O candidato funcional A2/B2 mantém a árvore validada localmente `e780e56e95d4462aac556b17f5039af3dde70a9f` antes do merge documental.
- O Ciclo 2 tem **QA/Revisor GO e homologação local** relatados em [implementação](features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md). CI remoto, vozes reais, dispositivos físicos, produção e bootstrap limpo não foram certificados por esse merge.
- Pilotos pessoais ES/EN, worktrees e pendências históricas permanecem separados. [Relatório de preparação](features/fase4-ciclo2/RELATORIO_EXECUCAO.md). Esta reconciliação de GitHub **não inspecionou os worktrees Windows**.

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
- A2/B2 implementados e testes locais concluídos: [relatório funcional](features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md), QA/Revisor GO no recorte local; **PR funcional #6 integrada na main**, sem publicação operacional.

## Laboratório ES-A1 — descoberta concluída e decisão editorial

- **Auditoria estática Codex recebida** em 23/10/2026: [relatório de descoberta](features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md); curso compilado pessoal `espanhol-a1-pessoal` `0.1.0`/`1.5`, 703 atividades, 119 lições, 21 roteiros de Aula Particular. A U2 tem 78 múltiplas escolhas antes da primeira lacuna. **Esses números vêm do relatório local, não foram recontados na `main`.**
- **Decisão ESLAB-D01 aprovada:** evoluir o acervo existente e reorganizar profundamente o percurso, **U2 primeiro**; preservar exemplos/gabaritos válidos e melhorar explicação recuperável, feedback específico e avaliação.
- **STOPs relatados para integrar piloto e motor:** duas migrações diferentes compartilham `20261022000100`; proteção de geração/reset do piloto pode divergir do escritor privado B1. São riscos de composição **não homologados em banco**.
- A versão atualmente selecionada pelo aluno no Fly/Supabase remoto, as vozes físicas e o resultado no navegador **não foram verificados na auditoria**. Nenhuma implementação/alteração de curso decorre do registro.

## Próximos marcos

1. **Revisar PR documental de consolidação** de [spec](features/piloto-es-a1-pos-ciclo2/spec.md), [plano](features/piloto-es-a1-pos-ciclo2/plan.md), [tarefas](features/piloto-es-a1-pos-ciclo2/tasks.md) e [auditoria](features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md). Aprovação do merge é separada.
2. **P0 — próximo handoff ao Codex:** sob autorização própria, **investigação somente de leitura** para composição motor/piloto, migrações duplicadas e guarda de geração versus B1; gerar um plano, **não corrigir nem executar SQL**.
3. **Depois do P0 e autorização funcional específica:** aplicar fatia vertical **U2** (objetivo explícito, ajuda acessível, feedback contextual, formatos variados), validar com QA/Revisor e somente então expandir U2/U1.
4. **Piloto e operação:** o proprietário testa a única experiência pessoal; Fly/Supabase remoto, migrações, reset, custos e publicação têm autorizações individuais. A ampla reformulação visual continua no pré-lançamento.

## Norte estratégico registrado

- **Política decidida pelo proprietário (23/10/2026):** o curso pessoal ES-A1 de duas unidades é o [laboratório vivo do Destrava](produto/CURSO_LABORATORIO_ES_A1.md). O melhor conjunto realmente disponível e pertinente deve ser oferecido; limitações e ausências, justificadas. Não exigir segundo curso pessoal para preservar histórico experimental.
- **Decisão de direção aprovada:** [evoluir acervo após a auditoria](features/piloto-es-a1-pos-ciclo2/spec.md), com [plano por fases](features/piloto-es-a1-pos-ciclo2/plan.md). Implementação, SQL e deploy não foram autorizados.


- [Roadmap até piloto/lançamento](produto/ROADMAP_ESTRATEGICO.md): consolidação pedagógica instalada, IA/voz, Aula Particular aprofundada, Foundry/Admin, UI/UX e piloto.
- [Matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md): 33 recursos pedagógicos (auditoria histórica) versus 44 capacidades técnicas do perfil instalado. O status desta matriz é **baseline documental para revisão**, não homologação nova.
- **Decisão de priorização visual:** corrigir UX bloqueante/essencial a cada ciclo; reservar redesign completo e design system consolidado para o marco pré-lançamento, com auditoria por telas antes de implementar.

## Restrições persistentes

Foundry produz/aprova conteúdo; motor valida/importa/executa contrato público. Preservar pilotos ES/EN e pendências. Não ampliar suporte instalado de IA/voz/SRS/aula por inferência. Auth/MFA, identidade/versão, segredos e leitura antes de escrita são obrigatórios. Serviços são coordenados; migrações/exclusões/pago/release dependem de autorização própria.
