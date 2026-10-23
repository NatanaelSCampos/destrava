# Destrava — progresso do produto e desenvolvimento

**Atualizado em 23/10/2026. Distinguir Git verificado, evidência histórica e proposta.**

## Baseline oficial

- `origin/main`: `370c742c7d2feabed6e9d05a7a94281342d9f1c5`, **PR #6 A2/B2 mesclada**; árvore correspondente ao candidato funcional `e780e56e95d4462aac556b17f5039af3dde70a9f`. PRs #2/#3/#4 já integradas.
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

## Próximos marcos

1. Revisar a [política de laboratório vivo ES-A1](produto/CURSO_LABORATORIO_ES_A1.md) e a [spec da revisão das duas unidades](features/piloto-es-a1-pos-ciclo2/spec.md), propostas na PR documental #5; seu merge exige autorização própria.
2. A pré-condição técnica A2/B2 foi atendida pela PR #6. **Auditar os arquivos reais das duas unidades pessoais** e a paridade de capacidades **apenas após autorização da nova demanda**; nenhum conteúdo pessoal foi modificado por esta reconciliação.
3. Planejar variedade de exercícios, explicação recuperável e feedback específico por erro, sem expor gabaritos privados e sem prometer IA/voz/SRS instalados antes da integração.
4. Publicação Fly/Supabase, dados, migrações e futuros ciclos continuam com gates e autorizações específicos; o redesign visual completo segue para pré-lançamento.

## Norte estratégico registrado

- **Política decidida pelo proprietário (23/10/2026):** o curso pessoal ES-A1 de duas unidades é o [laboratório vivo do Destrava](produto/CURSO_LABORATORIO_ES_A1.md). O melhor conjunto realmente disponível e pertinente deve ser oferecido; limitações e ausências, justificadas. Não exigir segundo curso pessoal para preservar histórico experimental.
- **Próxima proposta:** [auditar/reformular as duas unidades](features/piloto-es-a1-pos-ciclo2/spec.md), sem execução, migração ou deploy autorizado por esta PR.


- [Roadmap até piloto/lançamento](produto/ROADMAP_ESTRATEGICO.md): consolidação pedagógica instalada, IA/voz, Aula Particular aprofundada, Foundry/Admin, UI/UX e piloto.
- [Matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md): 33 recursos pedagógicos (auditoria histórica) versus 44 capacidades técnicas do perfil instalado. O status desta matriz é **baseline documental para revisão**, não homologação nova.
- **Decisão de priorização visual:** corrigir UX bloqueante/essencial a cada ciclo; reservar redesign completo e design system consolidado para o marco pré-lançamento, com auditoria por telas antes de implementar.

## Restrições persistentes

Foundry produz/aprova conteúdo; motor valida/importa/executa contrato público. Preservar pilotos ES/EN e pendências. Não ampliar suporte instalado de IA/voz/SRS/aula por inferência. Auth/MFA, identidade/versão, segredos e leitura antes de escrita são obrigatórios. Serviços são coordenados; migrações/exclusões/pago/release dependem de autorização própria.
