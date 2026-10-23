# Release limpo — plano por etapas e gates de autorização

> **PLANO DOCUMENTAL, SEM EXECUÇÃO AUTORIZADA.** Base `1487da9647a06d878f0a2e4e92c3d6d45e878f76` (PR #10). Fontes: [relatório Codex](RELATORIO_PLANO.md), [especificação/16 aceites](spec.md), [tarefas](tasks.md), [roteiro F1](ROTEIRO_TAREFA.md). A direção é **ambiente local isolado → testes necessários → curso novo compilado → homologação remota → Fly.io**. O plano COM-1B de preservação de legado fica em **reserva histórica**, sem cópia automática de `_v2`.

## Guardas gerais

- **Não usar o Supabase já instalado de estudo `espanhol-plataform` nem o Fly/Supabase atuais como ambiente de testes.** Sem reset, `migration repair`, seed genérico, limpeza, porta compartilhada, sobrescrita de env, alteração do Fly nem exclusão de dado.
- **Não executar wrappers existentes contra o novo projeto antes de refatorar os guards.** Os scripts atuais fixam o projeto e as portas antigas; `npm ci`, compile, build, verificação SQL, CLI e browser podem escrever arquivos/dados.
- Os recursos da `main` validados historicamente têm **limites de caminho**: A2 instalado local, B2 aula compilada. Instalar pacote externo no Fly atual não habilita I8 em produção.
- Trabalho funcional pede aprovação **após documentação integrada**; Lead organiza Implementador/QA/Revisor em worktrees novos e isolados, com arquivos de responsabilidade e candidato congelado. Commit, PR funcional, merge, banco local, remoto, custo e deploy têm autorizações separadas.

## F0 — Esta PR (documentos, aguardando aprovação de merge)

Registrar os critérios, ajustes sobre o relatório, próximos gates e roteiro de F1. **Nenhuma alteração funcional**.

## F1 — Primeira entrega funcional futura: proteção de ambiente e release

**Gate de entrada:** F0 integrada **e autorização expressa de código/worktree/testes simulados/PR funcional**, distinta do merge documental.

Implementador propõe mudanças mínimas em:
1. **Perfil novo** `destrava-release-clean`: IDs e allowlists exclusivos, portas sugestivas API `55421`, DB `55422`, app `3100`; aux/Studio/shadow/CDP isolados, Docker guard de projeto/workspace/volumes/loopback; verificar disponibilidade real de portas antes de autorizar inicialização.
2. **Runners**: parametrizar ou duplicar somente adapters estritamente necessários sem enfraquecer os guards `espanhol-plataform`. Se o perfil estiver ausente/incorreto, **falhar fechado antes de qualquer operação**.
3. **Deploy Fly**: `deploy-fly.ps1` deixa de ler `.env.local` como fonte implícita. Exigir perfil de produção/identidade/SHA/HTTPS/URL Supabase não local/app Fly esperado; separar chave pública build vs segredo runtime. Testar com **Fly simulado**, provando zero chamada externa sob dados inválidos. Nenhum deploy real, recurso remoto ou imagem de produção nesta etapa.
4. **Manifesto mínimo**: commit/árvore/lockfile, ambiente, migrações/hashes, versão de curso e imagem/digest quando existirem, flags/limitações, QA e plano de abortar release.

**QA independente (simulação apenas):** URL local no deploy, URL de produção no runner, segredo em `NEXT_PUBLIC_*`, workspace errado, projeto/label/porta divergente, env ausente, id de app errado, SHA inconsistente, ausência de credencial, falha de build e nenhum comando Fly real. **Revisor**: candidato congelado e dados antigos preservados.

**Gate de saída:** perfis/guards com negativos verdes em candidato local **sem acessar banco nem inicializar Docker**, PR funcional própria pronta para revisão. Mesclar exige aprovação explícita.

## F2 — Ambiente novo e bootstrap local (autorização operacional separada)

**Gate de entrada:** F1 aprovada e integrada; autorização para **criar** checkout, arquivos local-only, serviços/volumes Docker e aplicar migrações no **projeto novo identificado**. Sem acesso/alteração de produção ou banco de estudo.

- Preparar novo worktree e configs próprios, endpoints e autenticação locais, seed automático desativado, bind loopback se suportado; nada copiado de env remoto.
- Executar migrações da `main` em ordem num DB vazio: **20 versões**, com **7 de `20261003` e 1 de `20261004`**. Não importar reset experimental antigo nem marcar versões aplicadas.
- Comparar schema/histórico a migrações versionadas. Se houver `TRUNCATE` excessivo, tratar por pequena migração aprovada após evidência SQL nova; não ampliar escopo para compatibilizar progresso antigo.
- Executar somente verificadores adequados ao projeto novo e aos efeitos autorizados: Auth/MFA/RLS/ACL, B1/R1P2/CAS/retry/ACK, I7/I8, A2 instalado em teste local, B2 aula compilada com voz simulada, contratos, typecheck sem incremental, lint, build e navegador mobile/desktop. O gate I7 nasce desabilitado/nonce nulo.
- **Já neste F2**, executar ensaio de **segunda edição** de um curso de teste com progresso sintético U1 e edição U2. Resultado de conflito/versionamento deve ser registrado, sem reatribuir evidência antiga; se necessário, abrir correção de versão antes da primeira atualização real.
- Não executar `db:seed` genérico com referências antigas; fixtures sintéticas têm autorização e política de retenção/limpeza separadas.

**Gate de saída:** bootstrap reproduzível, permissões comprovadas, casos críticos verdes; cada diferença tem correção mínima autorizada, rollback e resultado verificável. Falha = STOP.

## F3 — Novo ES-A1 compilado pelo fluxo IA/Foundry

**Gate de entrada:** F2 suficiente, autorização específica de autoria/edição de conteúdo e eventual orçamento de API. Não usar código de IA não habilitado como promessa de funcionalidade do curso.

- Examinar capacidades comprovadas no **caminho compilado**; usar recursos úteis e integrados. Nada de declarações falsas de STT, pronúncia, A2 compilado ou voz física.
- IA/Foundry produz nova edição do **curso pessoal de espanhol A1**, aproveitando o conteúdo antigo como referência revisável quando útil; não reescrever os worktrees ES/EN. Contrato público validado, objetivos por lição, explicações acessíveis, alternância de recuperação/produção, feedback contextual aprovado e itens sem vazamento de gabarito.
- Revisão humana/editorial, provas canônicas, recursos/mídia licenciados, QA de jornada integral, acessibilidade e falhas reais do aluno. Definir `courseId`, `contentVersion` e digest congelados; revalidar o ensaio de upgrade.
- Compilar fontes novas no candidato e carregar **somente referências necessárias** no Supabase novo, sob autorização de escrita local. Não chamar seed genérico indiscriminadamente.

**Gate de saída:** curso final revisado + artefatos de build e manifesto, limitações honestas e evidências locais. Não subir ao Fly por consequência.

## F4 — Preparar e homologar o destino remoto (permissões independentes)

**Gate de entrada:** F3 aprovada. Decidir **novo Supabase remoto vs destino atual** e **app Fly existente vs novo** com riscos/custo/contas/Auth; não criar destinos por este plano.

- Planejar login, MFA, redirects, DNS/Turnstile/SMTP, Storage e permissões no destino aprovado. **Novo Supabase não herda contas/sessões/2FA do anterior**; isso exige confirmação de aceitação e comunicação, sem migração presumida.
- Aplicar as migrações somente ao **destino remoto explicitamente autorizado**, validar RLS/ACL/curso, sem apagar produção antiga.
- Construir com parâmetros públicos remotos corretos; conferir chave/segredos de runtime separadamente. Validar em modo produção e homologar a **imagem final de digest conhecido**: build local com Supabase local **não** é esse mesmo artefato.
- Provar que há um caminho de abortar e reverter que não exige desfazer DDL ou apagar usuário; publicação remota pode ter custos próprios.

**Gate de saída:** imagens/ambientes e aceite de autenticação confirmados, rollback preparado, sem alteração do Fly antigo sem permissão.

## F5 — Fly.io e dogfooding no laboratório

**Gate de entrada:** autorização **separada** para deploy/app/digest/release e smoke remoto; app Fly existente ou novo decidido. Verificar `fly.toml` e origem reais.

Publicar **exatamente o digest aprovado**, inspecionar health, cookies/login/MFA, versão do curso, atividades, evidência B1, TTS disponível/fallback, mobile, erros e logs sem PII. Falha aciona abort/rollback autorizado; sem tentar `db reset` para corrigir release. O curso pessoal novo vira o laboratório vivo e a evolução do currículo continua baseada em uso real.

## Política para TODO release posterior

Em cada versão depois desta implantação:

1. **Mudança de schema** entra por migração Git única, revisada e testada no banco novo e na **atualização incremental de um DB sintético da versão anterior**, além do bootstrap do zero.
2. **Mudança de curso** tem `contentVersion`/hash declarado, manifesto da edição antiga/atual, QA de compatibilidade de sessões/provas ou bloqueio honesto, **nunca reinterpretação silenciosa**.
3. **Configuração e imagem** fixadas por manifesto/digest; atualizações do Fly não substituem migração/revisão de dados; verificação de contas/Auth e eventual rollback por camada.
4. **Progresso pessoal acumulado local e em produção poderá continuar existindo**. Reinstalação limpa desta primeira release é exceção, não rotina.

**As etapas podem ser enxugadas conforme evidências verificadas, mas não pular os gates de isolamento, segurança, curso versionado e publicação.**
