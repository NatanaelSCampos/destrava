# Roteiro proposto — execução futura do Ciclo 2

**NÃO EXECUTAR nesta PR documental.** Complementa [spec](spec.md), [plan](plan.md) e [tasks](tasks.md), sem ampliar autorizações. Procedimento de agentes: [canônico](../../../DESTRAVA_MULTIAGENTE.md).

## Handoff curto, somente após aprovação

> Leia AGENTS.md e docs/features/fase4-ciclo2 na baseline aprovada. Execute apenas trilha/tarefas atribuídas, no ownership, respeitando decisões em docs/DUVIDAS.md, gates, isolamento e STOP. Entregue candidato/patch/hashes/testes/limites nos dez campos canônicos. Não faça merge, deploy, migração ou exclusão por inferência.

Lead acrescenta baseline/commit, papel, workdir absoluto, paths, aceite, recursos reservados e autorização efetiva. Não duplicar contratos ou histórico em prompts.

## Antes da implementação

1. Confirmar as seis decisões **aprovadas** na spec integrada e **autorização funcional expressa separada**. Aprovação dessas decisões ou merge documental, isoladamente, não autoriza executar.
2. Reconsultar main; inventariar índice/branches/worktrees/pendências e hashes. Não mover pilotos/branches ocupadas; sem reset hard, clean, stash automático ou force.
3. Só agora criar worktrees de implementação, ownership sem sobreposição e contexto delimitado. Não compartilhar env/node_modules/cache por links.
4. Revalidar baseline/delta e interfaces. Não integrar componente ES antigo sobre as provas B1 atuais.

## Antes de banco/browser/build

- Lead comprova checkout, Docker/projeto/labels, processos e portas. Runners devem passar integralmente; não relaxar guards para executar em novo worktree.
- **C2-O01 aprovado:** o Lead comprova stack local/labels/workdir/loopback e relata políticas adicionais; bootstrap, migração, reset, exclusão ou mudança de políticas exigem autorização específica.
- Usar perfil local isolado, loopback e contas sintéticas; não copiar backup remoto ou imprimir credenciais. Testes determinísticos sem provedores externos.
- Reservar serviços sequencialmente; typecheck não concorre com geração de tipos/build. Encerrar só processos identificados do checkout.
- Inspecionar harness antes de executar. Nome `local` não autoriza exclusão/reset/seed/migração. Esta preparação não concede tais operações.

## Verificações planejadas, não executadas aqui

Reusar comandos de package.json por impacto: `runtime:verify`, `installations:verify`, `sync:verify`, `session:verify`, `assessment:semantics:verify`, `policies:verify`, `actions:verify`, `interactive:verify`, `interactive:segments:verify`, `interactive:availability:verify`, `fase4:verify`, variantes/vozes, arquitetura, TypeScript e ESLint. SQL/browser/build pelos runners protegidos quando autorizados e compatíveis com o checkout.

Adicionar cobertura ausente de diagnóstico, ciclo pedagógico e narração. Reaproveitar evidência inalterada por comparação sem alegar execução nova; não fixar contagens futuras como resultados.

## STOP

Interromper operação afetada e informar proprietário se houver decisão pendente, conflito com perda potencial, isolamento não comprovado, contrato público/política/schema insuficiente, operação paga/remota/destrutiva, necessidade de habilitar aula instalada, escrita sobre outro ownership, teste essencial sem explicação ou candidato diferente do revisado.

## Encerramento

Congelar candidato integrado, obter QA/Revisor e registrar comandos reais/saídas/limites. Preservar pilotos/pendências. Commit/push/PR funcional/merge/deploy dependem da autorização futura; publicação da PR documental não autoriza publicar A2/B2.
