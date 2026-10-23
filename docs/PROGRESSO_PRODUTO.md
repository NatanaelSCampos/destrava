# Destrava — progresso do produto e desenvolvimento

**Atualizado em 22/10/2026. Status documental, não um resultado novo de testes.**

## Baselines verificadas nesta organização

- \`main\` no GitHub: \`10e426e\`, histórico anterior (04/10/2026). **Não é baseline segura para planejamento de novas implementações da Fase 4.**
- \`feat/fase4-first-parallel-cycle\`: \`93ef6f2\`, commit "feat: align learning availability and scope classroom evidence". Esta é a baseline remota recente inspecionada.
- O relatório [Fase 4 Ciclo 1](../DESTRAVA_FASE4_CICLO1.md) documenta o candidato F4-C3, verificações e limites. Não pressupor produção homologada nem que pilotos ES/EN estejam integralmente nesta mesma branch.

## Concluído conforme relatórios/commits

- Incrementos 1–8: contratos, avaliações, políticas, capacidades, texto/variantes, importação, instalação/versionamento e interoperabilidade básica de cursos externos.
- Estrutura multiagente com Lead, Implementador, QA e Revisor, worktrees e revisão.
- **Fase 4 Ciclo 1 / A1:** recomendações e CTAs consideram implementação, compatibilidade do curso, disponibilidade operacional e permissão.
- **Fase 4 Ciclo 1 / B1:** evidências e checkpoints independentes por segmento na Aula Particular; correções de apresentação mobile.
- Evidência relatada do F4: QA 33/33; 25 cenários de integração local; 8 verificações de navegador; Revisor sem achados abertos para o candidato final.

## Próxima etapa registrada — NÃO INICIADA

**Fase 4 Ciclo 2**, com duas frentes propostas pelo relatório F4:

- **Motor A2:** homologar sessões instaladas e diagnóstico no fluxo real: iniciar, pausar, retomar, finalizar, recarregar, versões fixadas, falha de rede, evidência persistida e troca de curso, desktop/mobile.
- **Aula Particular B2:** política bilíngue PT-BR (apoio/explicações) + idioma estudado (exemplos/prática), narração segmentada, pausa/cancelamento/retomada, voz compatível e fallback textual; incluir fixture de idioma sintético.

**Situação:** registrada para continuidade e planejamento; não autorizada para implementação só por constar aqui. [Proposta de escopo](features/fase4-ciclo2/spec.md).

## Restrições persistentes

- Language Foundry produz/revisa conteúdo; motor valida/importa/executa contratos públicos.
- Pilotos experimentais ES/EN e dados pessoais não devem ser apagados ou substituídos por conveniência do ciclo A2/B2.
- IA, voz, revisão espaçada e Aula Particular em cursos externos têm integrações parciais ou bloqueadas conforme o caminho; não anunciar suporte homogêneo.
- Fly.io: houve publicação anterior dos pilotos, mas não presumir que o ciclo A1/B1 esteja no deploy nem que o login autenticado tenha sido homologado.
- Segurança, autenticacão, MFA, autorização, integridade de versões e isolamento local continuam obrigatórios.

## Próximos marcos do processo

1. Revisar/adotar documentalmente "Do Chat ao Commit" sem alterar código.
2. Reconciliar a linha de desenvolvimento remota \`feat/fase4-first-parallel-cycle\` com a \`main\` somente por PR própria e autorização.
3. Aprovar ou ajustar as specs de A2 e B2, criar plan/tasks de execução orientados por evidência.
4. Lead executar A2/B2 nas worktrees, com QA/Revisor independentes e gates definidos.
5. Atualizar este arquivo com hashes, resultados e limitações **após**, nunca antes, da execução.

A fonte de comportamento efetivo é o código/contrato da baseline apontada, não uma descrição otimista do status.
