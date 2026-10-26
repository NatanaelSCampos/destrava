# Correção da sincronização — catálogo 1.2.0

25/10/2026. **Correção local confirmada.** Baseline 548a729a33b80fa7dfb8681855cd1e2a71c5174b; branch test/release-f2-clean; mesmo ambiente destrava-release-clean.

## Causa e correção

A atividade nova atp-u1-l1-build-conversation existia no pacote compilado 1.2.0 e no estado salvo do proprietário, mas não na tabela de referências activities. A projeção user_activity_progress falhava pela FK. O JSON principal é salvo antes das projeções normalizadas; não se declarou a persistência integral pela aprovação visual anterior.

Foi inserida somente essa referência, vinculada à lição atp-u1-l1. A posição de catálogo 9 já estava ocupada por atividade anterior retida: a primeira tentativa foi rejeitada pela unicidade, sem inserir a linha. Após reconferência, a inserção usou a posição livre 17; a ordem pedagógica continua sendo a posição 9 declarada no pacote. Nenhuma linha antiga foi removida ou reescrita.

O metadado courses.content_version foi atualizado de 1.1.0 para 1.2.0 com condição CAS da versão anterior. Foram duas operações REST locais distintas; não se anuncia transação global. Nenhuma resposta ou progresso do proprietário foi escrito pelo reparo.

StudySyncNotice agora apresenta uma mensagem comum de carga/sincronização, mantendo o erro e a possibilidade de retry. Detalhes técnicos permanecem no estado interno de diagnóstico, fora da mensagem ao aluno. Não se suprime a falha nem se anuncia sucesso antes da conclusão.

## Verificação real

- 131 referências esperadas do curso, incluindo recuperação diferida: todas presentes e ligadas à lição correta. Zero referências ausentes nos IDs concluídos do proprietário; somente esses IDs foram consultados, sem respostas.
- Três regressões renderizam o componente: erro SQL literal não aparece no HTML, falha de carga mantém retry próprio, recuperação e sucesso continuam distintos.
- Browser real com conta sintética preexistente: falha ConnectionReset deliberada e delimitada à projeção normalizada; aviso real apareceu. Controle negativo confirmou que a tentativa nova ainda não existia em exercise_attempts.
- Retry real: aviso e pendência encerrados; user_activity_progress e exercise_attempts confirmados por consultas autenticadas do próprio usuário de QA. Novo documento manteve a tentativa e a sincronização sem erro.
- Dois grupos de browser PASS; zero erros de runtime e zero bloqueios inesperados. A única falha de rede foi a injeção esperada.
- TypeScript sem incremental, ESLint e build: exit 0. Build lQkaMDJ2p8EG8qcGSkTaf. Pacote de conteúdo continua 1.2.0, SHA256 fce7f3196e9484cef6d13b13dc736e0a6a776c87ee336f995b51a39ce4560ef8.

Teste e inspeção pelo Lead. Não houve novo parecer independente. A conta do proprietário não foi usada para testes; dados sintéticos foram retidos. O screenshot com erro induzido foi capturado com a página rolada e não serve como prova visual do banner; a mensagem foi verificada no DOM e nos testes de renderização.

## Gate que faltava

A entrega anterior conferiu interface, correção e rascunhos, mas não assegurou a projeção normalizada da atividade recém-criada. Antes de liberar uma nova edição para estudo, conferir: versão do catálogo, todos os IDs canônicos/recuperações e pais; depois concluir uma atividade nova, esperar a fila de sincronização encerrar, conferir tentativa e progresso normalizados e recarregar. Zero exceções de JavaScript não substitui essa prova.

## Evidências e limites

Candidato F3-CATALOG-FIX-C1A, digest d253bf453cc77dff161f0c6c5cb79159f64a82d32688ba774236bb00cd5d7859. O resultado do driver usa o rótulo C1; C1A alterou somente o nome de variável no teste VM para satisfazer o lint antes do build/ensaio. Relatórios anteriores preservados como histórico.

Artefatos ignorados em .tmp/f3/catalog-fix-001: diagnosis, reconciliação após rejeição, intent/result das operações, candidato congelado, código e logs do build, result de navegador, patch e manifesto. Sem credenciais nos recibos.

Não houve reset, exclusão, alteração de schema/SQL/Auth/ACL, migração, API paga, remoto, deploy, commit, push ou publicação. Catálogo e progresso não foram limpos. Servidor próprio mantido ativo em 127.0.0.1:3100.

Para a página do proprietário que ainda mantém o envio pendente: usar Tentar sincronizar uma vez e aguardar o aviso desaparecer; depois atualizar a página para carregar o texto novo do aviso. Não é necessário reiniciar o estudo.
