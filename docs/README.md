# Guia de documentação do Destrava

Este índice organiza **onde encontrar decisões**, sem substituir contratos e relatórios existentes.

## Leitura mínima por papel

- **Chat de produto / planejamento:** este índice, [progresso](PROGRESSO_PRODUTO.md), [dúvidas](DUVIDAS.md) e a especificação da demanda. Inspecionar código e contratos relevantes antes de aprovar arquitetura.
- **Lead no Codex:** [AGENTS.md](../AGENTS.md), [procedimento multiagente](../DESTRAVA_MULTIAGENTE.md), especificação aprovada, plano/tarefas e apenas os contratos afetados.
- **Implementador/QA/Revisor:** briefing delimitado pelo Lead; nunca ler o repositório inteiro por padrão.

## Fontes de verdade

| Tema | Documento ou artefato |
| --- | --- |
| Diretrizes operacionais | [AGENTS.md](../AGENTS.md) |
| Arquitetura e responsabilidades | [DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md](../DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md) |
| Processo de agentes | [DESTRAVA_MULTIAGENTE.md](../DESTRAVA_MULTIAGENTE.md) |
| Contrato para produtores externos | [contracts/package-v1/README.md](../contracts/package-v1/README.md) e schemas gerados |
| Evidência da Fase 4 Ciclo 1 | [DESTRAVA_FASE4_CICLO1.md](../DESTRAVA_FASE4_CICLO1.md) |
| Estado e próxima etapa | [PROGRESSO_PRODUTO.md](PROGRESSO_PRODUTO.md) |
| Direção estratégica até lançamento (PR #4 integrada) | [ROADMAP_ESTRATEGICO.md](produto/ROADMAP_ESTRATEGICO.md) |
| Status real por recurso e integração instalada (baseline) | [MATRIZ_MATURIDADE_RECURSOS.md](produto/MATRIZ_MATURIDADE_RECURSOS.md) |
| **Curso ES-A1 como laboratório vivo (política de produto)** | [CURSO_LABORATORIO_ES_A1.md](produto/CURSO_LABORATORIO_ES_A1.md) |
| Piloto ES-A1: acervo auditado; evolução curricular U2→U1 aprovada como direção | [auditoria do acervo](features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md), [spec](features/piloto-es-a1-pos-ciclo2/spec.md), [plano](features/piloto-es-a1-pos-ciclo2/plan.md) e [tarefas](features/piloto-es-a1-pos-ciclo2/tasks.md) |
| **Composição ES-A1: P0 leitura e COM-0 SQL local somente leitura concluídos; estado `parcial/divergente`** | [relatório P0](features/piloto-es-a1-pos-ciclo2/RELATORIO_P0.md), **[relatório COM-0](features/es-a1-composicao/RELATORIO_COM0.md)**, [spec proposta](features/es-a1-composicao/spec.md), [plano COM-1→COM-4](features/es-a1-composicao/plan.md), [tarefas](features/es-a1-composicao/tasks.md) e [roteiro histórico COM-0](features/es-a1-composicao/ROTEIRO_TAREFA.md) |
| Processo de demanda | [DO_CHAT_AO_COMMIT.md](DO_CHAT_AO_COMMIT.md) |
| Decisões pendentes | [DUVIDAS.md](DUVIDAS.md) |
| Fase 4 Ciclo 2: A2/B2 integrados e homologados localmente (sem deploy) | [spec](features/fase4-ciclo2/spec.md), [plan](features/fase4-ciclo2/plan.md), [tasks](features/fase4-ciclo2/tasks.md) e [roteiro](features/fase4-ciclo2/ROTEIRO_TAREFA.md) |
| Sincronização pós-merge | [relatório](features/fase4-ciclo2/RELATORIO_EXECUCAO.md) |

## Estados e hierarquia

Uma proposta **não** é implementação; um teste local **não** é homologação de produção; um commit em branch **não** é merge em \`main\`. A versão do código define o comportamento efetivo, enquanto a especificação aprovada define o comportamento exigido. Divergências são problemas a investigar, nunca motivo para alterar silenciosamente uma das fontes.

Criar documentos adicionais somente quando resolvem uma necessidade real. Não mover ou duplicar documentos legados nesta implantação.
