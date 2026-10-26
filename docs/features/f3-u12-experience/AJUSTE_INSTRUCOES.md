# Ajuste de destaque das instruções de atividade

25/10/2026 — disponível no compilado local.

## Mudança

A instrução deixou de ser uma caixa discreta entre a cena e a resposta. Agora integra o próprio bloco de resposta, com marcador de seta, título **Sua tarefa**, texto de maior tamanho/peso e separação visual dos controles. O texto vem do pacote, com a apresentação de idiomas preservada.

O componente reutilizável ActivityTask também aparece nas retomadas com flashcard e nos cartões de revisão. Conversas, exercícios de escolha e escrita usam o mesmo cabeçalho por PracticeConversation. Não há regra especial de idioma ou curso, novo contrato ou alteração editorial nesta correção.

## Verificação

- TypeScript sem incremental e ESLint dos quatro componentes: exit 0, executados pelo Lead.
- Build Next: exit 0; build `ynhcKQ0h-PIQsj-HWxxrk`, aplicação PID87380 em http://127.0.0.1:3100.
- Navegador real: cinco formatos — atividade apontada, escolha, retomada, revisão e escrita — em1600/360/390px, 15 capturas. PASS; ação antes dos controles, no mesmo grupo, fonte18px no desktop/17px no celular, sem caixa antiga ou overflow.
- Abertura/fechamento da ajuda mantém a resposta digitada. Nenhuma resposta foi submetida para esta checagem. Zero erro JavaScript ou bloqueio inesperado; o bloqueio deliberado de anúncios permanece identificado separadamente.
- Conferência local de recursos F1/C4 e listeners: PASS; app atualizado em loopback e CDP fechado. Serviços existentes mantidos para estudo.

A verificação foi executada pelo Lead. Os pareceres independentes da entrega anterior não são apresentados como uma nova revisão desta alteração visual.

## Identidade e preservação

HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`; candidato `F3-TASK-INSTRUCTION-C4`. Os850 pinos anteriores foram conferidos antes da edição. Mudaram quatro arquivos existentes e foi acrescentado `activity-task.tsx`. Conteúdo1.4.0, respostas, contratos, sincronização e21 SQL preservados. Nenhum reset, limpeza, migração, produção, deploy ou operação Git de publicação.

Artefatos: `.tmp/f3/task-instruction-001/`. O patch incremental inclui os quatro arquivos a partir dos bytes de entrada, o novo componente e este relatório. O manifesto vincula candidato, build, checagem e preservação, sem credenciais.

Tentativas do driver preservadas: geração inicial e transformação CJS falharam antes do navegador; a primeira navegação usou campo de rota incorreto, e uma seleção posterior exigiu um tipo de amostra inexistente. Corrigidos somente os scripts de teste; os bytes de produto permaneceram iguais desde o build. Resultados anteriores retidos separadamente do PASS final.