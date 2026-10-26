# Escrita — organização da cena e das orientações

Data: 25/10/2026. **Disponível para revisão local do proprietário.**

## Identidade e escopo

Baseline 548a729a33b80fa7dfb8681855cd1e2a71c5174b; branch test/release-f2-clean. Workspace D:\Documents\destrava-worktrees\destrava-release-clean. Candidato **F3-WRITING-LAYOUT-C2**, 1144 pinos, digest SHA-256 4b59111a12d3f9552e85b0c1ff1243b637f5fc6636353b6bf26b260e59e5c80e. Curso Español a tu paso, edição 1.5.0 preservada; pacote compilado SHA-256 49fe807124284947267f693f22b02e84941ea114e5aac3aec2a24d295f6a7767.

Pedido: organizar a quantidade de informação da atividade de escrita, mantendo o conteúdo útil e destacando a ação do aprendiz. Três arquivos de apresentação alterados: writing-editor.tsx, practice-conversation.tsx e lesson-experience.css, todos em src/components/activities. Não há nova regra de correção ou contrato de conteúdo.

## Organização entregue

1. Cena ilustrada mais compacta para atividades de escrita.
2. A tarefa permanece destacada e junto da resposta.
3. Campo com rótulo visível “Sua mensagem”, seguido da contagem e do botão de salvar.
4. Orientações autorais integrais em um único painel com ícones e separadores, sem disclosures ou cartões repetidos. Campos e índices de anotações preservados.
5. A posição lateral só é usada quando o próprio componente tem espaço suficiente; em telas menores o painel fica depois da escrita. No celular o avatar decorativo lateral sai do fluxo para ampliar o campo.

O componente é comum às atividades de escrita; não contém IDs, conteúdo espanhol ou critérios pedagógicos fixados no Motor. O Foundry continua fornecendo cena, prompt, guidance e anotações pelo contrato existente. Nenhuma fonte autoral ou pacote foi modificado.

## Verificação

- TypeScript local sem incremental: exit0; TypeScript novamente durante o build final: exit0.
- ESLint dos dois fontes TSX: exit0, zero avisos.
- Build final: exit0, ID E7UdE-GJxP3qOX0ZEpnkg; assets do próprio checkout copiados para o standalone e conferidos por hash.
- Browser C2: PASS em1600/1280/390/360px, orientação exata, campo dentro do contêiner e legível, rótulo visível, painel lateral/empilhado conforme espaço, sem overflow do documento.
- Rascunho após reload: PASS. Salvar pelo botão real: PASS; texto sintético confirmado por leitura RLS do próprio owner no banco e preservado após nova navegação.
- Zero erros JS ou bloqueios inesperados; barreira CDP drenada. Navegador de QA encerrado. Capturas c2-writing-*.png examinadas pelo Lead.

Validação deste pedido feita pelo Lead; não se apresenta parecer independente novo. Teste de escrita somente com a conta sintética de QA já existente, sem preencher respostas do proprietário. Não foi reavaliada a eficácia pedagógica nem executada a totalidade das outras jornadas.

## Revisão visual e limites

C1 passou salvamento/rascunho, mas a revisão das capturas revelou campo estreito em1280px: o breakpoint por viewport não representava o espaço interno. C2 usa container query e amplia a conversa no celular; o novo teste exige que o campo caiba no contêiner. Evidências C1 preservadas separadamente. Uma leitura auxiliar com tsx no sandbox encontrou uv_os_get_passwd/ENOMEM; repetida nas ferramentas locais autorizadas, sem alteração do produto para contornar o erro. A transferência inicial por stdin degradou acentos de rótulos novos; corrigidos antes do primeiro build, com UTF-8 conferido.

Todos os textos autorais continuam disponíveis; sua redação e as ressalvas de avaliação foram preservadas. A mudança reorganiza a apresentação e não promete correção contextual de resposta livre.

## Operação e entrega

Mesmo ambiente destrava-release-clean e ledger F2-R preservado (09d6a9011040462c9f1708ff9ad62f1996debc1aaa0f46d43c380dad33083bd1). F1/C4 reais conferidos no preflight dos serviços em execução. Nenhum start de Supabase, migração, seed, reset, exclusão, alteração Auth/ACL ou limpeza de progresso. Somente o processo próprio da aplicação foi substituído após conferência PID/comando/listener; app final PID 65664, 127.0.0.1:3100, mantido para estudo. API55421/DB55422 e recursos existentes preservados.

Sem produção, remoto, Fly, API paga, commit, push, PR, merge ou deploy. O build é local Windows, sem nova homologação Linux/publicação. Artefatos desta rodada: .tmp/f3/writing-layout-001/, com snapshots anteriores, candidatos C1/C2, logs, capturas, recibos, resultado, preservação e patch focalizado incluindo este documento.

URL: http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1/lesson/nao-entendi-essa-parte?activity=atp-u1-l2-own
