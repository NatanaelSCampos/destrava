# Integridade do progresso — etapa 1

## Fluxo confirmado antes da mudança

O `StudyProvider` carrega autenticação e MFA, consulta `user_course_state` e,
quando não há registro, consulta `user_study_state` para migração legada.
O repositório já lança erros de leitura. O problema está no componente:
ele instala o repositório antes da leitura e marca `ready` mesmo no `catch`.
O efeito de salvamento e `flushStudyState` podem então gravar cache antigo
ou estado inicial. O `catch` também não verifica cancelamento, e gravações
enfileiradas não verificam se ainda pertencem à sessão atual.

O layout monta o provider com `key={course.id}`. Trocar de curso faz flush
e recarrega a página. Sair normalmente também recarrega; mudanças de
autenticação durante operações em andamento precisam invalidar a autorização.

## Invariantes definidos antes da implementação

1. Somente leitura remota bem-sucedida ou ausência confirmada permite escrita.
2. Erro, autenticação não verificada e leitura em andamento bloqueiam tanto
   salvamento automático quanto flush explícito.
3. Progresso remoto existente tem precedência sobre cache; recuperar leitura
   não aplica automaticamente um rascunho antigo sobre esse progresso.
4. Falha de escrita conserva o estado pendente em memória e tenta preservá-lo
   no navegador. Recuperação conserva rascunhos separados para exportação.
5. Usuário, curso e tentativa delimitam a sessão. Respostas antigas não mudam
   o estado nem autorizam operações da sessão seguinte; escritas ainda na
   fila são verificadas novamente antes de começar.
6. Conta nova continua inicializável após ausência confirmada. Estado legado
   válido continua migrável. Estado ilegível não representa ausência.
7. Falha no armazenamento local é informada e não significa que os dados
   foram preservados em disco.

## Escopo

Controle de carregamento e salvamento local, repositório simulado e mensagens
de recuperação. Nenhuma migração, alteração de dados reais, commit ou deploy.
Concorrência entre dispositivos, transação das projeções e cancelamento de
uma escrita já enviada ao servidor permanecem fora desta etapa.

## Decisões de implementação

- `StudyProgressSync` concentra o estado e a autorização de escrita, sem
  dependências de React ou Supabase. O provider usa `useSyncExternalStore`;
  restauração do estado e liberação de escrita são uma única publicação.
- `ready` continua indicando disponibilidade da interface. A escrita depende
  exclusivamente de `loaded` ou `absent`, repositório autorizado e geração atual.
- Toda nova tentativa incrementa a geração. Troca de autenticação invalida a
  geração imediatamente; fila, sucessos e erros antigos conferem a geração.
- Falha de gravação mantém `dirty`, estado atual e cópia `:pending`. Quando
  outra leitura recupera progresso remoto, esse rascunho vai para `:recovery`;
  não há mesclagem automática nem restauração destrutiva. A interface permite
  tentar novamente e exportar cópias em JSON.
- As chaves existentes de cache e a leitura legada continuam suportadas.
  Chaves adicionais incluem usuário e curso. Uma conta sem registro pode
  iniciar a partir de cache válido somente após ausência remota confirmada.
- O repositório usa presença de registro, não veracidade do payload. Registro
  ilegível bloqueia a leitura. `{}` continua sendo um registro existente válido
  conforme o default da tabela; campos antigos ausentes recebem defaults.
- Leitura legada bem-sucedida fornece o progresso existente; a próxima escrita
  válida materializa o estado por curso. O snapshot remoto restaurado não é
  regravado apenas por ter sido lido.
- Antes de uma nova leitura, aguarda-se a escrita já enviada terminar. Escritas
  antigas ainda na fila não começam. Não há promessa de cancelar uma chamada
  que já chegou ao servidor.

## Validação

`npm.cmd run sync:verify` executa cenários com repositório e cache simulados,
incluindo falha com/sem cache, ausência, sucesso, recuperação, erro de escrita,
respostas antigas, troca de usuário, fila antiga, alterações durante escrita,
indisponibilidade de cache e formatos legados/ilegíveis. Nenhum cenário usa rede.

A verificação automática do controlador não substitui validação manual de
autenticação, renderização React, modo offline e download no navegador.

Resultados em 2026-10-09:

- 13 cenários isolados de sincronização passaram.
- Os nove verificadores existentes passaram: conteúdo, pedagogia, arquitetura,
  motor, diagnóstico adaptativo, multilíngua, onboarding, aula interativa e tempo.
- TypeScript sem emissão/incremental e ESLint sem cache, com zero avisos exigido,
  passaram. `git diff --check` passou.
- A análise pedagógica manteve os dois avisos existentes sobre respostas aceitas
  duplicadas; nenhum conteúdo foi alterado nesta etapa.
- O servidor local iniciou na porta 3000. Não foi feito login automatizado nem
  validação manual de interface, e nenhum teste acessou serviços ou dados reais.
- Não houve migração, commit ou deploy.
