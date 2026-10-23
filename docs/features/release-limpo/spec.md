# Release limpo — especificação do caminho local → curso → Fly.io

> **Estado 23/10/2026: direção aprovada PARA PLANEJAMENTO; nenhuma execução autorizada.** O proprietário confirmou a sequência **novo ambiente local isolado → validar o necessário → novo curso ES-A1 gerado/revisado → homologação de release remoto → Fly.io**, sem migrar progresso pessoal antigo. Foi autorizada apenas esta **PR documental**, não o merge, trabalho funcional, criação de ambiente, serviço remoto, uso de IA paga ou deploy.
>
> Baseline auditada: `main` `1487da9647a06d878f0a2e4e92c3d6d45e878f76` (PR #10). Fontes: [relatório Codex](RELATORIO_PLANO.md), [plano](plan.md), [tarefas](tasks.md) e [roteiro para a primeira entrega](ROTEIRO_TAREFA.md). QA/Revisor do relatório aprovaram apenas o **plano por análise estática**, sem testes operacionais novos.

## 1. O que muda — e o que preservamos

**Prioridade desta release:** substituir o caminho de migração de histórico experimental COM-1B por uma **instalação nova reproduzível** e um curso pessoal novo, evitando estruturas adicionais destinadas somente à compatibilidade histórica. COM-1B permanece documentado como análise técnica; suas seis tabelas `_v2`, seus cinco IDs ilustrativos e sua migração de dados **não foram aprovados nem são pré-requisitos**.

- O projeto local de estudo/desenvolvimento `espanhol-plataform`, seus volumes, arquivos e pendências **não serão tocados** para obter o ambiente novo. Não reiniciar, resetar, mover ou aplicar scripts a esse projeto.
- A produção antiga Fly/Supabase continuará sem alterações enquanto o candidato novo não estiver validado e aprovado; **ignorar progresso antigo para o novo ambiente não é autorização para apagar o antigo**. Nenhuma conta, dado, áudio ou instalação será excluída automaticamente.
- Cursos ES/EN e worktrees anteriores seguem preservados como fontes editoriais/históricas. A **primeira edição pessoal será gerada novamente**, validada por IA/Foundry e usada como laboratório vivo. Isso atualiza a direção anterior ESLAB-D01 (evoluir acervo U2/U1) quanto ao modo de produzir a primeira release, **sem apagar as decisões ou o acervo histórico**.
- O produto deve permanecer genérico. Correções de Auth/MFA, RLS, B1, versão, ACL e guardas de deploy são necessárias quando fundamentadas, mesmo sem migrar progresso antigo.

## 2. Decisões de planejamento e alternativas ainda pendentes

| ID | Direção do produto | Limite |
| --- | --- | --- |
| **RL-D01** | **Release limpa**, sem adotar notas/sessões pessoais experimentais antigas | Não executar reset, `migration repair`, migração ou descarte de dados de ambiente existente |
| **RL-D02** | Testar no projeto independente `destrava-release-clean` com portas inicialmente propostas API `55421`, DB `55422`, app `3100` | Portas/nomes auxiliares, Docker, volumes e redirects ainda não inspecionados/reservados na máquina |
| **RL-D03** | Planejar novo Supabase remoto como opção preferencial de isolamento; **Fly existente ou novo ficam como opções posteriores** | Criar projeto remoto, app, custos, credenciais, contas, migração ou alterar produção exigem decisão própria |
| **RL-D04** | **Curso compilado primeiro**, produzido/revisado pelo fluxo IA/Foundry; cobrir somente recursos realmente integrados e úteis | A2 foi homologado em curso **instalado local**, B2 em Aula Particular **compilada**; não prometer A2/B2 indistintamente nem habilitar caminho instalado bloqueado em produção |
| **RL-D05** | Ensaiar atualização de curso com **progresso sintético** ainda na primeira release e depois em cada ciclo; teste de bootstrap limpo **mais** teste de atualização incremental | Editar U2 altera hash do pacote inteiro e pode afetar sessões B1 da U1; antes da segunda edição do curso, resolver conflito/retomada ou bloquear atualização com erro honesto |
| **RL-D06** | Release por manifesto versionado: SHA, migrações, versão/hash do curso, ambiente, flags e digest da imagem | Merge, publicação, troca de destino, aplicação de migração e rollback exigem aprovações independentes |

## 3. Ambiente local isolado — pré-condição do bootstrap

O candidato deverá usar worktree/checkout novo do SHA aprovado, dependências próprias e **projeto Supabase, labels, rede, volumes e portas Docker diferentes** dos ambientes existentes. Além de API/DB/app, isolar Studio, SMTP, shadow, analytics, pooler e porta de navegador/CDP quando ativos; conferir Auth `site_url` e redirects. Seed automático desligado. Não copiar `.env`, `supabase/.branches`, links remotos, artefatos, caches ou credenciais anteriores.

**Guards atuais estão fixos no projeto antigo:** `scripts/local-environment.mjs`, `run-local-checkpoint.mjs` e runners I7/I8/F4/C2 conhecem `espanhol-plataform`, `54321`/`54322` e `3000`. **Não executar um runner antigo contra o candidato novo nem trocar apenas `config.toml`.** Criar perfil/allowlist própria para a release, recusar `espanhol-plataform`, endereços remotos e falhas de identidade de projeto/workdir/porta. Preservar guards de Docker local; não aceitar env de produção. Alterar arquivos e criar worktrees requerem autorização funcional depois desta PR.

**Comandos com efeitos:** `checkpoint:prepare` escreve arquivos de env; `checkpoint:migrate` chama `supabase db push --local`; `checkpoint:seed`/`db:seed` gravam dados e podem eliminar avaliações antigas; `checkpoint:verify`, I7/I8/F4/C2 locais criam usuários/registros e arquivos sintéticos; `content:compile`, `dev`, `build:local`, `npm ci` e exportadores geram arquivos. Nenhum foi executado por este planejamento. Preparar/reter/limpar fixtures exige escopo e permissão próprios.

## 4. Schema novo, permissões e QA

A `main` contém **20 migrações SQL versionadas**, da base `20260930000100` até B1 `20261022000100_interactive_segment_evidence`. A contagem correta é **7 versões `20261003` + 1 versão `20261004` = 8** no grupo de estado pedagógico/sessão. A migração antiga de reset do piloto com o mesmo ID **não integra a `main`** e não deve ser copiada para o novo banco.

O ambiente novo terá de provar bootstrap canônico das 20 migrações, schema/histórico equivalentes, RLS, grants, índices, funções, triggers, autenticação/MFA, isolamento entre usuários e Storage. Banco vazio **não contém por inferência** os objetos adicionais de reset observados no banco de estudo antigo. Scripts de teste I7 podem esperar nonce existente; preparar o gate desabilitado/nulo e restaurá-lo corretamente.

**Segurança não opcional:** verificar `TRUNCATE` efetivo para `PUBLIC`/`anon`/`authenticated` e herança/default privileges; se persistir no banco limpo, planejar revogação por **migração nova, teste negativo e aprovação próprios**. Validar também CAS, replays, ACK perdido, sessões B1, escritor privilegiado, hash/versão e recuperação de eventos. Não trazer o reset de progresso anterior só para suprir falha estrutural do curso novo.

O fato de A2/B2/B1 terem passado em bancos locais anteriores **não substitui** esse bootstrap. Reutilizar verificadores existentes apenas depois de adaptá-los à nova allowlist. Se o bootstrap ou QA falharem, STOP e correção mínima comprovada, não novos `_v2` ou `repair` por reflexo.

## 5. Novo curso compilado e laboratório vivo

Produzir curso ES-A1 **novo** pela IA/Foundry com critérios de qualidade humana: objetivos comunicativos, boa progressão, variedade útil de atividade, explicação recuperável durante o exercício sem perder rascunho nem revelar gabarito privado, feedback específico pós-submissão e roteiros B1/B2 compatíveis. Não confundir geração sintaticamente válida com qualidade pedagógica.

O pipeline `content-loader.ts` e `compile-content.ts` gera um registro `src/content/generated` no build. **Curso compilado é incluído na imagem**; `db:seed` genérico não é método padrão de publicação. Só carregar em banco o que for requerido e autorizado por um plano seletivo de referências. Preservar conteúdo anterior como referência editorial até descarte separado. Recursos de curso externo instalado seguem bloqueados no runtime de produção; não anunciar STT/pronúncia oficial nem voz de dispositivo não testada.

**Atualização futura:** congelar edição e digest para primeira release; realizar ensaio com progresso sintético U1 e alteração só de U2, verificando escopo B1/hash. Se o motor atual não aceitar segunda edição, registrar limite e corrigir de modo delimitado antes de atualização real, em vez de copiar notas ou trocar silenciosamente definições.

## 6. Release Fly/Supabase identificável

O atual `scripts/deploy-fly.ps1` lê `.env.local` e utiliza os valores no build sem rejeitar destino local. A primeira entrega funcional deve criar **perfil explícito de release sem fallback para `.env.local`**, exigir HTTPS/projeto Supabase/app Fly/origem/SHA esperados, recusar loopback e destinos não autorizados, validar chaves públicas vs privadas sem mostrá-las e impedir chamada real ao Fly em testes negativos. Preservar wrapper IPv4 e não fazer deploy na PR de proteção.

`NEXT_PUBLIC_*` é fixado durante o build; imagem construída contra Supabase local **não** pode ser a imagem homologada para Supabase remoto. Após autorizar ambiente remoto e custos, registrar **digest da imagem final**, validar sua configuração de produção e publicar o **mesmo artefato**. Homologação e rollback devem levar em conta banco/Auth/curso, não somente a imagem.

Supabase remoto **novo** é possibilidade não aprovação. App Fly **novo ou existente** (`fly.toml` hoje referencia `frecuencias-a1-natanael`) será decidido depois, mediante análise de riscos/contas/login e autorização de operação. Nada disso foi consultado ao vivo nem modificado.

## 7. Aceites propostos (todos futuros)

| ID | Gate verificável |
| --- | --- |
| **RL-01** | Manifesto de SHA/lockfile/candidato e worktree independente, preservação dos antigos |
| **RL-02** | Perfil isolado recusa projeto antigo/URL remota/portas erradas e protege Docker/volumes |
| **RL-03** | 20 migrações da `main` instaladas em banco novo, schema/histórico reproduzíveis sem reset piloto |
| **RL-04** | Auth/MFA/RLS/ACL/`TRUNCATE`/Storage/conta cruzada negativos comprovados |
| **RL-05** | B1/R1P2: CAS, idempotência, recibos, falhas e ACK perdido em ambiente novo |
| **RL-06** | A2 no instalado local e B2 em aula compilada testados **sem alegar paridade** |
| **RL-07** | I7/I8/versão/instalação com guards preservados e nenhuma ativação instalada em produção por inferência |
| **RL-08** | Contratos, conteúdo, typecheck sem incremental, lint, arquitetura, build e browser desktop/mobile |
| **RL-09** | Curso ES-A1 novo compilado, gerado/revisado pelo Foundry e pedagogicamente aceito |
| **RL-10** | Edição sintética U2 após progresso U1: nenhuma reinterpretação de provas/hash; limite e estratégia de upgrade documentados |
| **RL-11** | Deploy script com release profile explícito, `.env.local` recusado, testes negativos Fly simulados |
| **RL-12** | Supabase remoto e destino Fly escolhidos com aprovação, recursos/configs/contas/custos e imagem digest verificados |
| **RL-13** | Smoke autenticado de produção no artefato final, mantendo isolamento e sem prometer recursos não integrados |
| **RL-14** | Plano de abortar e reversão coerente com schema, Auth e versões de curso; sem delete automático |
| **RL-15** | Processo permanente: teste de instalação limpa **e** upgrade incremental em toda release futura |
| **RL-16** | Nenhum script altera os ambientes locais/remotos antigos sem permissão específica |

## 8. Primeiro escopo funcional futuro — bem menor que COM-2

**F1 — Guardas e perfis de release:** adaptar a allowlist para o projeto novo e preparar script de deploy com identidade de destino/digest e testes negativos **simulados**, sem iniciar Supabase, criar volumes, migrar, gerar curso ou publicar. QA/Revisor independentes sobre candidato isolado; PR funcional própria e merge aprovado separadamente.

**F2 — Bootstrap local novo:** somente com outra autorização, criar projeto/volumes/config e aplicar SQL **no destino novo comprovado**, testar Auth/MFA/RLS/B1/A2/B2/I8/upgrade sintético. Não tocar em `espanhol-plataform`.

**F3 — Novo curso IA/Foundry:** autoria/revisão, testes de jornada e incorporação compilada no candidato, após escopo/custo autorizado. **F4 — Homologação remota e Fly:** decisão explícita sobre destinos, contas, configs, imagem, deploy, rollback e smoke.

**STOP permanente:** um problema de versão/capacidade não justifica migrar dados experimentais antigos, enfraquecer Auth, copiar objetos sem proveniência ou alterar produção sem autorização.
