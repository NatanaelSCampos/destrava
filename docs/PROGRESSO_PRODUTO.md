# Destrava — progresso do produto e desenvolvimento

**Atualizado em 23/10/2026. Distinguir Git verificado, evidência histórica e proposta.**

## Baseline oficial

- `origin/main`: `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, merge confirmado da PR #2; árvore `24b31199507e901bc9cacb9058756244bf4fa0c6`, igual à homologada em `18a67c5`.
- Main não avançou desde esse merge na conferência desta preparação. Outros checkouts não foram atualizados automaticamente; principal permanece em `93ef6f2` com pendências preservadas.
- Planejamento: branch `docs/fase4-ciclo2-planejamento`, worktree `D:\Documents\destrava-worktrees\fase4-ciclo2-planejamento`, criado da main confirmada; sem env/deps copiados ou implementação.
- Inventário e preservação: [relatório desta preparação](features/fase4-ciclo2/RELATORIO_EXECUCAO.md).

## Concluído conforme commits/relatórios

- Incrementos 1–8: contratos, avaliações, políticas, capacidades, texto/variantes, importação, instalações/versionamento e interoperabilidade básica.
- Estrutura multiagente canônica e [Do Chat ao Commit](DO_CHAT_AO_COMMIT.md), sem outra plataforma.
- Fase 4 Ciclo 1 A1: disponibilidade contextual; B1: evidências/checkpoints por segmento e mobile. Evidência histórica QA 33, SQL 25 e browser oito, com limites no [relatório F4](../DESTRAVA_FASE4_CICLO1.md).
- R1P2 em `18a67c5`, incorporado pela PR #2: ausência de chave privada bloqueia aula; configuração completa continua condicional. [Relatório](features/pr2-r1p2/RELATORIO_EXECUCAO.md).
- Merge integrou código na main, sem homologar Fly/banco remoto/bootstrap exato/pilotos. Release de cinco pacotes continua separada.

## Próxima etapa — NÃO IMPLEMENTADA

[Spec](features/fase4-ciclo2/spec.md), [plan](features/fase4-ciclo2/plan.md), [tasks](features/fase4-ciclo2/tasks.md) e [roteiro](features/fase4-ciclo2/ROTEIRO_TAREFA.md), em proposta para aprovação:

- A2: sessões pedagógicas e diagnóstico adaptativo real no curso instalado, reusando versão fixada/CAS/avaliador/persistência. Pausa/cursor/rascunho exigem decisões.
- B2: apoio/alvo configuráveis e narração controlada, vozes/fallback e provas B1 preservadas; sem realtime/avatar/avaliação acústica.
- Investigação por leitura, nenhum teste de runtime novo. Final I8 não comprova diagnóstico; botão TTS não é controlador bilíngue completo.

## Próximos marcos

1. Proprietário revisar PR documental, responder [DUVIDAS](DUVIDAS.md) e aprovar spec versionada.
2. Autorizar expressamente A2/B2; merge da proposta sozinho não inicia implementação.
3. Lead estabilizar interfaces/ownership/isolamento e delegar conforme plano, até quatro agentes ativos.
4. Executar só o autorizado e registrar candidato/comandos/resultados/limites antes de propor checkpoint/merge funcional.

## Restrições persistentes

Foundry produz/aprova conteúdo; motor valida/importa/executa contrato público. Preservar pilotos ES/EN e pendências. Não ampliar suporte instalado de IA/voz/SRS/aula por inferência. Auth/MFA, identidade/versão, segredos e leitura antes de escrita são obrigatórios. Serviços são coordenados; migrações/exclusões/pago/release dependem de autorização própria.
