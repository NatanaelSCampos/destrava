# Destrava — metodologia "Do Chat ao Commit"

**Status: metodologia adotada na PR #1 e confirmada pelo proprietário.** Atualização pós-merge da PR #2 em 23/10/2026; esta preparação altera somente documentação.

## Princípio

**Nenhuma implementação importante deve depender só de uma conversa ou de um prompt temporário.**

O **ChatGPT** ajuda a discutir objetivos e decisões de produto; o **GitHub** preserva especificações aprovadas; o **Lead/Code​​x** decompõe a execução e coordena Implementador, QA e Revisor, conforme [procedimento multiagente](../DESTRAVA_MULTIAGENTE.md). Não recriar os perfis ou o mecanismo de worktrees.

## Fluxo de uma demanda

1. **Descoberta (chat + repositório):** descrever o problema, consultar o progresso atual, inspecionar o código e procurar recursos existentes antes de propor novas estruturas.
2. **Decisão de produto:** explicitar alternativas, restrições, critérios observáveis e decisões que exigem o proprietário. Ambiguidades pendentes entram em [DUVIDAS.md](DUVIDAS.md).
3. **Especificação documental:** branch isolada com \`docs/features/<id>/spec.md\`; adicionar \`plan.md\`, \`tasks.md\` ou \`ROTEIRO_TAREFA.md\` somente quando a complexidade justificar. PR documental separada de alterações de código.
4. **Aprovação:** só após revisão e integração da especificação na baseline que será usada pelo Codex a tarefa fica \`APROVADA PARA EXECUÇÃO\`. Não presumir que a criação da PR seja autorização.
5. **Handoff curto:** "Leia AGENTS.md, spec/plan/tasks aprovados e contratos indicados; implemente apenas o escopo; execute gates; registre evidências; abra PR funcional." Não repetir toda a especificação no prompt.
6. **Implementação:** Lead define interfaces, delega tarefas independentes com contexto mínimo, isola escrita por worktrees e integra um candidato identificável. QA deriva testes a partir da spec; Revisor audita o candidato congelado.
7. **Evidências e revisão:** registrar SHA/branch/candidato, comandos reais, resultados \`PASSOU / FALHOU / PARCIAL / BLOQUEADO / NÃO EXECUTADO\`, limitações, diff e testes de integração relevantes. Revisão independente produz \`GO / AJUSTES / NO-GO\`.
8. **Integração:** o proprietário autoriza merge e operações operacionais conforme escopo. Atualizar [PROGRESSO_PRODUTO.md](PROGRESSO_PRODUTO.md) somente após confirmar o resultado real.

## Papéis e limites

- **Proprietário:** decisões de produto, autorização de custos, dados, deploy e merge.
- **Chat de planejamento:** interpreta necessidades, verifica evidências no GitHub e redige a especificação proposta; não assume que o GitHub está atualizado só porque um relatório foi colado.
- **Lead Codex:** traduz a spec aprovada em briefings, coordena especialistas, testes e integração; não substitui decisões de produto.
- **Implementador:** código dentro do escopo autorizado.
- **QA:** testes independentes derivados de critérios; não afrouxa verificações para aprovar.
- **Revisor:** segurança, arquitetura, integridade e riscos do candidato; não corrige o próprio achado.

## Regras para velocidade sem perder segurança

- **Primeiro reuso, depois código novo.** Consultar contratos, serviços, componentes e testes existentes.
- **Contexto seletivo.** Ler apenas documentos da demanda e dependências relevantes. Em sessões novas, briefing curto + arquivos canônicos, não o histórico inteiro do chat.
- **Proporcionalidade.** Fix pequeno pode usar descrição/aceite na própria PR, se for autocontido. Mudança de contrato, regras pedagógicas, banco, IA ou segurança exige spec independente e critérios explícitos.
- **Paralelo só com interfaces estáveis.** Duas frentes podem trabalhar ao mesmo tempo se não editarem definições compartilhadas sem acordo prévio.
- **Testes por impacto.** Rodar verificadores rápidos por tarefa e gates completos no candidato integrado, após mudanças relevantes; nunca considerar testes antigos válidos para uma alteração que os invalida.
- **Não transformar melhorias futuras em bloqueios artificiais.** Distinguir requisito do marco, necessidade de integração e backlog posterior.
- **Sem autodeclaração de sucesso.** Alegações de "pronto" devem apontar para commit, ambiente e evidência do estado verificado.

## STOP

Interromper e registrar impedimento se surgir mudança de escopo ou de produto não autorizada; necessidade de migração remota, exclusão, novo custo ou publicação; risco de dados/segredos; conflito entre branches com perda potencial; teste essencial sem explicação; contrato insuficiente para decisão segura. Não contornar STOP desabilitando testes, alterando permissões ou inventando evidências.

## Git, ambientes e implantação gradual

A reconciliação foi concluída pela PR #2 em `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, com árvore homologada `24b31199507e901bc9cacb9058756244bf4fa0c6`. A main é a baseline oficial confirmada; checkouts locais podem continuar atrás e devem ser inventariados antes de atualização. Não fazer novos merges/rebases automaticamente. O planejamento A2/B2 está em [spec](features/fase4-ciclo2/spec.md), com execução autorizada posteriormente em 23/10/2026 sobre `b2e94ce`, mantendo merge/deploy/migrações fora da autorização.

O Fly.io e Supabase remoto não fazem parte do ciclo padrão. O ambiente local isolado e comandos protegidos permanecem normativos em [AGENTS.md](../AGENTS.md).

A PR #4 acrescentou o [roadmap estratégico](produto/ROADMAP_ESTRATEGICO.md) e a [matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md), preservados na base documental `4a9a5e918d345cf7a8d37d176068ea8ae4892810`. Sua integração não amplia a autorização A2/B2.

## Artefatos por feature

| Arquivo | Finalidade |
| --- | --- |
| \`spec.md\` | Resultado, regras, casos negativos e aceite; é o contrato da mudança |
| \`plan.md\` | Abordagem técnica, reuso, módulos, dependências e riscos, após investigação |
| \`tasks.md\` | Fatias pequenas, estado e evidência por critério |
| \`ROTEIRO_TAREFA.md\` | Opcional: tarefa sensível com permissões, comandos, STOP e limites |
| \`RELATORIO_EXECUCAO.md\` | Resultado efetivo, comandos, hashes, testes, pendências, divergências |
| \`PROGRESSO_PRODUTO.md\` | Próximas prioridades e estado consolidado; não duplica relatórios históricos |

Não criar automaticamente todos os arquivos para cada bug. Uma tarefa só vira "[x]" quando os critérios estiverem comprovados no candidato integrado.
