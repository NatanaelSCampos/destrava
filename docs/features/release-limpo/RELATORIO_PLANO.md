# PLANO DE RELEASE LIMPO — PRONTO PARA REVISÃO

> **Relatório do Codex recebido do proprietário em 23/10/2026; fonte histórica, apenas leitura estática.** Este texto foi preservado para rastreabilidade, sem reexecutar testes ou operações. A baseline verificada pelo Codex foi `1487da9647a06d878f0a2e4e92c3d6d45e878f76`, já com PR #10 integrada.
>
> **Ajustes de produto registrados após a revisão**, sem reescrever o parecer original: (1) novo ambiente local isolado, mantendo `espanhol-plataform`; (2) usar app Fly existente **ou** novo fica como decisão posterior, não pré-requisito; (3) testar atualização entre versões de curso com progresso sintético já na preparação da primeira release; (4) primeiro curso pessoal **compilado**, sem afirmar A2 instalado/B2 na aula compilada como cobertura universal. Ver [spec](spec.md), [plano](plan.md) e [tarefas](tasks.md).
>
> **Correção editorial de contagem:** o grupo `20261003000100`…`20261003000700` tem **7 migrações**, mais `20261004000100` = **8** no conjunto. O total das migrações da `main` é **20**.
>
> **Nada deste relatório ou desta PR autoriza:** criar ambientes, aplicar SQL, modificar Docker/arquivos, realizar chamadas pagas, gerar curso, mudar Fly/Supabase, instalar pacotes ou apagar dados da produção antiga.


**Baseline confirmada:** `main` em `1487da9647a06d878f0a2e4e92c3d6d45e878f76`.

Foram feitas somente leituras de Git, código e documentação. Nenhum arquivo, banco, serviço ou worktree foi alterado. **QA e Revisor concordam com o plano**, com os ajustes incorporados abaixo. Isso não representa aprovação para publicar.

## 1. Caminho recomendado

**Ambiente local novo → bootstrap e testes → curso novo compilado → homologação remota → Fly.io.**

Recomendo um **novo projeto Supabase remoto e um novo app Fly**, preservando a publicação experimental existente. Reutilizar os destinos atuais exigiria avaliação e autorização próprias.

A composição COM-1B e a migração de progresso experimental ficam fora desse caminho.

## 2. Ambiente local realmente separado

Proposta inicial, **ainda não criada nem verificada quanto a conflitos**:

| Item | Destino proposto |
|---|---|
| Projeto | `destrava-release-clean` |
| Checkout | Novo diretório, da baseline confirmada |
| API / PostgreSQL | `127.0.0.1:55421` / `127.0.0.1:55422` |
| Aplicação | `http://127.0.0.1:3100` |
| Serviços auxiliares | Portas próprias para Studio, SMTP, shadow, analytics e pooler, quando habilitados |
| Navegador | Porta CDP própria, diferente da atual `9337` |

Antes de iniciar:

- Conferir todas as portas e redirects/site URL do Auth.
- Separar nomes, labels, redes e volumes Docker.
- Instalar dependências próprias; não copiar `.env`, vínculos remotos, caches ou volumes antigos.
- Manter seed automático desabilitado.
- Comprovar destino local e restringir exposição à máquina, usando mecanismos suportados pela versão instalada.

**Adaptação necessária:** os runners atuais fixam projeto, portas e workspace antigos. Implementar um perfil explícito com allowlist dos novos destinos, preservando os guards. Não basta mudar `config.toml`.

**Aceite:** os runners reconhecem somente o novo ambiente e recusam o projeto antigo ou destinos não aprovados. Nenhuma operação é dirigida a `espanhol-plataform`.

## 3. Bootstrap do banco vazio

Aplicar futuramente **as 20 migrações da main, em ordem**, sem importar a migração experimental de reset do piloto:

| Grupo | Migrações |
|---|---|
| Base | `20260930000100_initial` |
| Serviços e autenticação | As seis `20261002000100`…`20261002000600` |
| Estado pedagógico | As oito `20261003000100`…`20261003000700` e `20261004000100_interactive_lesson_sessions` |
| Contratos e instalações | As três `20261010000100`…`20261010000300` |
| Runtime instalado | `20261011000100_installed_study_runtime` |
| Evidências B1 | `20261022000100_interactive_segment_evidence` |

O último identificador corresponde a **B1**, não comprova proteção de geração/reset.

O banco vazio ainda precisa ser homologado: as evidências anteriores vieram de um banco com migrações previamente aplicadas e políticas adicionais históricas.

### Gates obrigatórios

- Histórico completo, sem versões duplicadas ou pendentes.
- Estruturas, constraints, índices, funções, RLS e privilégios correspondentes às migrações.
- Ausência das políticas extras do ambiente antigo.
- Verificação efetiva de `TRUNCATE`, incluindo `PUBLIC`, herança e privilégios padrão.

Há risco conhecido de concessão de `TRUNCATE`; a migração B1 revoga escrita comum, mas não resolve explicitamente esse privilégio. Se confirmado no banco novo, propor **correção mínima de segurança**, com autorização própria.

A carga inicial deve incluir **somente o curso novo e suas referências necessárias**. O seed atual percorre todos os pacotes e pode excluir itens de avaliação removidos; não deve ser reutilizado indiscriminadamente.

## 4. Validação mínima necessária

| Área | Evidência nova exigida |
|---|---|
| Auth/MFA | Login, sessão, regras de acesso antes/depois de MFA e negativa no contexto inadequado |
| RLS e permissões | Isolamento entre usuários; escrita direta e RPC privilegiada negadas; `TRUNCATE` negado aos papéis de cliente |
| B1/R1P2 | Configuração privada ausente bloqueia ação; CAS, retry, comprovantes, aprovação por segmento e recuperação após ACK perdido |
| Sessões/A2 | Iniciar, pausar, retomar, reload, encerrar uma vez, falhas de leitura/escrita e diagnóstico canônico |
| B2 | Início manual, idiomas declarados, pausa/cancelamento, conflito entre áudios e fallback textual |
| Instalações/I8 | Versão fixada, ativação, isolamento, rollback e recursos não integrados permanecendo bloqueados |
| Contratos/conteúdo | Arquitetura, contratos, capacidades, validação estrutural e revisão pedagógica do curso escolhido |
| Aplicação | TypeScript sem incremental, ESLint, build e navegador desktop/mobile |
| Produção | Execução em modo produção e homologação posterior do artefato final remoto |

Reutilizar os verificadores existentes, **após adaptação ao novo perfil**. Os resultados históricos orientam a seleção; não substituem esses gates de bootstrap.

O gate local I7 nasce desabilitado, com nonce nulo. Sua preparação para fixtures e restauração precisam ser explícitas; o runner C2 atual exige adaptação para preservar também esse estado nulo.

### Scripts que exigem autorização de escrita

| Comandos/scripts | Efeitos relevantes |
|---|---|
| `checkpoint:prepare` | Escreve arquivos de ambiente |
| `checkpoint:restart/migrate/seed` | Altera serviços, schema ou dados |
| `db:seed` | Faz upserts e pode excluir itens de avaliação |
| `checkpoint:verify`, instalação/I8, F4/C2 locais | Criam usuários, dados, evidências, fixtures e arquivos; alguns removem usuários/Storage sintéticos |
| `content:compile`, `dev`, `build:local` | Geram conteúdo, caches e artefatos |
| Exportadores de contratos/perfis | Escrevem arquivos gerados |
| Testes de pacotes/UI/browser | Podem criar e limpar temporários, perfis e capturas |

Nenhum deles foi executado. Limpezas de dados sintéticos devem receber autorização específica ou ser substituídas por retenção documentada.

## 5. Curso novo: compilado na primeira release

| Caminho | Cobertura e limite atual |
|---|---|
| **Compilado — recomendado** | Permite exercitar o fluxo original, avaliações, políticas, revisão, Aula Particular B1 e narração B2, conforme conteúdo, configuração e permissões |
| Instalado | Possui sessões/diagnóstico A2 e runtime versionado homologados localmente; **é bloqueado em produção** |
| Instalado sem integração | Aula Particular, SRS, fala/gravação e diversas capacidades de IA/voz continuam bloqueadas |

A guarda de produção está explícita no [runtime instalado](https://github.com/NatanaelSCampos/destrava/blob/1487da9647a06d878f0a2e4e92c3d6d45e878f76/src/lib/course-installation-runtime.ts). Instalar um pacote no Supabase remoto não o torna executável no Fly.

O curso novo deve ser produzido/revisado pelo fluxo IA/Foundry e validado pelo contrato. Para a primeira release, incorporá-lo ao caminho compilado.

**Não inferir disponibilidade operacional:** IA, reconhecimento de fala e pronúncia dependem de integrações, configuração e homologação próprias. Entrega de gravação B1 não equivale a avaliação acústica.

### Atualizações futuras

Congelar a primeira edição antes da publicação. Hoje, alterações no pacote inteiro podem mudar o hash de sessões de outras unidades; apenas aumentar a versão editorial não resolve isso.

Antes da segunda edição, uma tarefa delimitada deve tratar:

- Identidade de edição/hash nas sessões e comprovantes.
- Preservação ou apresentação histórica das definições antigas.
- Isolamento entre versões.
- Teste “alterar U2 sem reinterpretar evidências U1”.

Não sobrescrever silenciosamente o conteúdo ativo nem migrar progresso experimental por padrão.

## 6. Proteção do release remoto

O [deploy atual](https://github.com/NatanaelSCampos/destrava/blob/1487da9647a06d878f0a2e4e92c3d6d45e878f76/scripts/deploy-fly.ps1) lê `.env.local` e verifica presença dos valores, sem rejeitar loopback. Também não fixa completamente o contexto de execução.

**Correção necessária antes de qualquer publicação:**

- Perfil de produção obrigatório e explícito, sem fallback para `.env.local`.
- Projeto Supabase, HTTPS, app Fly, origem, checkout e SHA esperados.
- Recusa de loopback, destinos privados, flags locais e chave privada no campo público.
- Contexto/configuração do build fixados.
- Correspondência entre configuração pública do build e credenciais privadas do runtime.
- Testes negativos com Fly simulado, comprovando que configurações inválidas impedem a chamada externa.
- Uso do wrapper IPv4 previsto no projeto.

`NEXT_PUBLIC_*` é incorporado ao build. Portanto:

1. Validar localmente o modo produção.
2. Construir posteriormente a imagem com a configuração remota aprovada.
3. Homologar essa imagem e publicar **exatamente seu digest**.

A imagem local não pode ser apresentada como o mesmo artefato remoto. Se o teste usar Docker, documentar a rede: `127.0.0.1` dentro do contêiner não aponta automaticamente para o Supabase do host.

## 7. Etapas e autorizações

| Etapa | Implementador | QA / Revisor | Autorização necessária |
|---|---|---|---|
| 1. Preparação | Adaptar perfis/guards e proteção do deploy | Negativos de destino e revisão estática | Código, arquivos e checkout isolado |
| 2. Baseline limpa | Criar novo ambiente e bootstrap | Auth/MFA/RLS/ACL e integrações reais | Docker local, migrações no projeto novo e dados sintéticos |
| 3. Curso novo | Produzir, incorporar e carregar seletivamente | Revisão editorial, contratos e jornada | Geração/revisão; orçamento se houver chamadas pagas; carga local |
| 4. Homologação remota | Preparar projeto novo, Auth e schema | Conferir ambiente, configuração e imagem final | Acesso remoto, migrações/carga e recursos aprovados |
| 5. Publicação | Promover imagem homologada | Smoke autenticado e conferência do manifesto | Deploy explícito |

Commit, push ou PR devem constar da autorização da respectiva entrega.

### Comandos propostos — não executados

Após autorizar a preparação:

```powershell
git worktree add -b test/clean-release <CHECKOUT_LIMPO> 1487da9647a06d878f0a2e4e92c3d6d45e878f76
npm.cmd ci
```

Após adaptar e comprovar os novos guards:

```powershell
npm.cmd run architecture:check
npm.cmd run contracts:verify
npm.cmd run content:validate
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build:local
npm.cmd run runtime:verify:local
node scripts/run-ciclo2-local.mjs journey
node scripts/run-ciclo2-local.mjs narration
node scripts/run-ciclo2-local.mjs b1
```

A inicialização/migração ficará em comando protegido do novo perfil. **Não usar `supabase db push` genérico nem os wrappers atuais contra o projeto antigo.**

## 8. Manifesto e aceite final

Manifesto simples, sem segredos:

- SHA/árvore Git e lockfile.
- Migrações ordenadas com hashes e fingerprint do schema.
- ID, edição, contrato e hash do curso.
- Ambiente, projeto Supabase, app/origem Fly e flags.
- Imagem/digest, comandos, resultados e limitações.
- Imagem anterior, compatibilidade de schema/curso e procedimento de recuperação.

**Aceite:** banco vazio reproduzível, testes críticos verdes, curso revisado, destinos inequívocos e imagem final identificada.

Rollback de imagem não desfaz migrações ou dados. Na primeira publicação em app novo, registrar também o procedimento de abortar/desativar a release; não presumir uma versão anterior disponível.

**Pareceres:** QA favorável ao plano; Revisor favorável após incorporar a separação das imagens e a topologia de rede. A independência foi procedural, sem alegação de sandbox exclusivo de leitura. Nenhuma validação operacional nova foi executada.

**PLANO DE RELEASE LIMPO — PRONTO PARA REVISÃO**
