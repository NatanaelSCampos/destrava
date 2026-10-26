# F2 — bootstrap do ambiente local limpo

Data: 23/10/2026. **Resultado histórico: F2 — BLOQUEADO.** O STOP de binding de rede foi acionado antes do bootstrap das migrações da plataforma. Não há homologação funcional deste ambiente. A execução posterior, exclusivamente de isolamento, está na seção 9 — F2-R, abaixo.

**Atualização F2-R: ISOLAMENTO VALIDADO nesta execução; QA e Revisor favoráveis.** Serviços encerrados após a verificação. As 20 migrações e a homologação funcional F2 continuam pendentes de retomada autorizada.

## 1. Identidade e escopo

- Baseline confirmada: `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, main após a PR #12 integrada.
- Checkout novo: `D:/Documents/destrava-worktrees/destrava-release-clean`.
- Branch: `test/release-f2-clean`; HEAD permanece na baseline, sem commit F2.
- Projeto exclusivo: `destrava-release-clean`.
- Supabase CLI instalada neste checkout: **2.118.0**; Docker Server: **29.6.1**; contexto `desktop-linux`, endpoint local `npipe:////./pipe/dockerDesktopLinuxEngine`.
- Destinos preparados: API 55421, PostgreSQL 55422, aplicação 3100; shadow 55420, Studio 55423, correio 55424/55425/55426, analytics 55427 desabilitado, pooler 55429 desabilitado, inspector 8183. O preflight também verificou 9447; essa verificação pontual não reserva portas no sistema operacional.

Foram consultados os documentos obrigatórios e os guards F1 integrados. Nenhum runner legado que fixa `espanhol-plataform` foi executado. As operações de serviços selecionaram apenas nomes, labels e IDs do projeto novo; recursos do projeto anterior não foram inventariados, consultados no banco ou alterados. Não se apresenta essa restrição de comandos como uma comparação byte a byte dos ambientes antigos.

## 2. Etapas e resultados observados

| Etapa | Resultado | Evidência e limite |
| --- | --- | --- |
| F2.1 — checkout e preflight | Preparado | Worktree própria, 12 portas propostas sem conflito antes do startup; nomes de recursos novos inicialmente ausentes |
| Dependências | Instaladas | `npm.cmd ci --no-audit --no-fund --cache .tmp/npm-cache`, exit 0, 386 pacotes, sem copiar node_modules/caches de outro checkout |
| Configuração F1 | PASS no perfil estático | CLI do guard com ambiente filho restrito: `ok:true`, `phase:F1`, **`operational:false`** |
| F2.2 — criação dos serviços | Startup executado; isolamento REPROVADO | CLI retornou exit 0, mas metadados reais mostram bindings incompatíveis e mount proibido |
| Contenção | Concluída | Dez contêineres novos parados; zero listeners nas 12 portas propostas na conferência final; volumes e rede retidos |
| F2.3 — 20 migrações | **Não aplicadas** | Os 20 SQL ficaram indisponíveis durante o startup e foram restaurados com os hashes originais |
| F2.4 — homologação | **Não executada** | Nenhum teste de banco, Auth/MFA, RLS/TRUNCATE, B1/R1P2, I7/I8, A2/B2, aplicação/browser, build, TypeScript ou ESLint nesta rodada |
| F2.5 — atualização U1/U2 | **Não executada** | Depende de ambiente operacional isolado e bootstrap homologado |

O exit 0 do startup não é aprovação de F2. A validação de configuração F1 também não comprova isolamento operacional.

## 3. Recursos criados e configuração própria

Foram criados exclusivamente:

- Rede bridge `supabase_network_destrava-release-clean`, ID `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`.
- Volumes locais `supabase_db_destrava-release-clean`, `supabase_config_destrava-release-clean` e `supabase_storage_destrava-release-clean`.
- Dez contêineres do novo projeto: db, kong, auth, rest, realtime, storage, edge_runtime, pg_meta, studio e inbucket.

Rede e volumes receberam labels de projeto/workdir no ato de criação, com recibos. Os metadados reais de db/kong confirmaram projeto, workdir e NetworkMode da rede dedicada. A configuração da bridge incluía `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` e IPv6 desabilitado na rede. Isso **não impediu publicações de portas no host IPv4/IPv6**.

Somente `supabase/config.toml` foi alterado entre os arquivos rastreados, preparando projeto, portas, URLs locais, seed desabilitado, migrations automáticas desabilitadas e analytics desabilitado. SHA-256: `769ffb1443200d0e32dc8d6fe9afd6373d73d5b28ad74022c385511f8191830e`.

Credenciais locais próprias foram geradas em artefatos ignorados, sem copiar env remoto ou de outro projeto; não estão neste relatório e não foram verificadas operacionalmente. Nenhum `.env` antigo foi lido ou copiado para provisionamento. Não foi preparado env funcional da aplicação. O startup usou diretórios próprios de configuração do usuário e excluiu logflare/vector para evitar coleta de logs de outros projetos.

## 4. Incompatibilidades confirmadas

### B-F2-01 — portas publicadas fora de loopback — gravidade alta

`NetworkSettings.Ports` dos contêineres novos registrou **12 bindings incompatíveis**, dois por porta:

| Serviço | Porta do host | HostIp observados |
| --- | ---: | --- |
| PostgreSQL | 55422 | `0.0.0.0` e `::` |
| Kong/API | 55421 | `0.0.0.0` e `::` |
| Studio | 55423 | `0.0.0.0` e `::` |
| Inbucket web/SMTP/POP | 55424, 55425, 55426 | `0.0.0.0` e `::` em cada porta |

O guard F1 foi executado offline sobre o snapshot real fiel de db/kong e suas dependências. Resultado: **FAIL `docker-ports`**, sem alterar metadados ou enfraquecer o guard. Os serviços ficaram brevemente iniciados com essas publicações; não foi testada acessibilidade de outras máquinas e não se afirma ausência de exposição durante esse intervalo.

A opção da bridge é um default e não basta para assegurar o HostIp efetivo. Uma futura solução deve controlar a publicação real por serviço e comprovar o resultado no Docker inspect, incluindo auxiliares. [Documentação oficial de bridge e binding padrão](https://docs.docker.com/engine/network/drivers/bridge/).

### B-F2-02 — bind mount no Kong incompatível com F1 — gravidade média

O Kong novo recebeu mount **Type `bind`, `RW:true`**, originado no template do checkout novo, com destino `/home/kong/templates/email/confirmation.html`. O guard atual permite somente volumes nomeados validados. Isso é uma segunda incompatibilidade observada, embora a avaliação do snapshot real pare primeiro em `docker-ports`. Não foi reportado um segundo resultado de execução que não ocorreu.

Uma retomada precisa eliminar essa necessidade no perfil novo ou aprovar separadamente um desenho estritamente delimitado para esse mount. Não se autoriza implicitamente aceitar binds genéricos ou flexibilizar F1.

## 5. STOP, retenção e integridade

Ao detectar o binding incompatível, foram interrompidas as etapas seguintes. A contenção conferiu label de projeto e workdir antes de parar os contêineres, selecionados apenas pelo projeto novo. Os dez ficaram `running:false`, `status:exited`. Nenhum contêiner, volume, rede ou dado foi removido. Conferência posterior das 12 portas do perfil: **zero listeners**.

Para impedir aplicação automática de SQL antes da prova de isolamento, os 20 arquivos canônicos foram temporariamente movidos, dentro do checkout novo, para `.tmp/f2/migrations-hold/`, com manifesto de hashes. O diretório de migrations não continha esses SQL durante o startup. Um bloco de restauração devolveu todos aos paths originais, conferindo hashes e ausência de colisão. `git diff --exit-code HEAD -- scripts/release-guards supabase/migrations` terminou com exit 0. Não houve alteração dos guards ou do conteúdo/identificador das migrações.

O startup inicializou componentes internos do Supabase no volume novo; portanto, não se descreve esse volume como fisicamente vazio. **Não houve consulta SQL nem aplicação deliberada das 20 migrações da plataforma**, seed, reset, repair ou importação do reset experimental. O histórico de migrações e o schema desse banco não foram consultados; permanecem sem certificação.

Tentativas auxiliares não foram contadas como gates aprovados: o primeiro processo do guard rejeitou variável herdada `CHROME_CRASHPAD_PIPE_NAME`; passou após allowlist de ambiente filho, sem mudar o guard. Um helper falhou por formato de módulo Node e foi corrigido antes de produzir a evidência. A conferência final de listeners exigiu execução fora da restrição inicial de leitura CIM, que retornou acesso negado. A instalação npm também informou scripts pendentes de dependências; nenhuma prontidão de build é inferida disso.

## 6. Evidências locais

Artefatos ignorados em `.tmp/f2/`, neste checkout:

- `preflight.json`: baseline, versões, portas e manifesto dos 20 SQL.
- `f1-check.json`: validação estática F1 com `operational:false`.
- `resources-created.json` e `resources-before-start.json`: recibos e identidade dos recursos novos.
- `migration-hold.json` e `start-result.json`: retenção e restauração dos 20 SQL; exit 0 do startup.
- `runtime-before-stop.json`: metadados estruturais reais, sem Config.Env.
- `f1-real-snapshot.json`: entrada fiel usada na negativa `docker-ports`.
- `stop-evidence.json`: bindings, mounts, estados finais e integridade dos SQL.
- `ports-after-stop.json`: zero listeners nas portas do perfil após a contenção.

Arquivos locais de credenciais e log do startup não são anexados ao relatório nem candidatos a commit. Os artefatos não são evidência de CI, produção ou homologação funcional.

## 7. QA e Revisor

**QA `/root/f1_qa`: F2 — BLOQUEADO.** Reexecutou offline o guard sobre o snapshot fiel e reproduziu `docker-ports`. Onze checks de evidências passaram, exit 0; uma auditoria adicional das dez identidades e NetworkIDs e a leitura da evidência final das portas também passaram, exit 0, usando Node v24.18.0 via stdin. Confirmou os 12 bindings em quatro contêineres, a segunda incompatibilidade do bind do Kong, a correspondência exata dos dez IDs parados e os hashes dos 20 SQL contra os dois manifestos. O primeiro harness offline do QA esperava incorretamente cinco contêineres com portas publicadas; a expectativa foi corrigida para o conjunto exato dos quatro nomes observados. Outra tentativa exigiu tratar UTF-16LE no JSON de portas. Nenhuma dessas correções alterou guard ou evidências. Esses checks validam a evidência do bloqueio, não as funcionalidades da plataforma.

Hashes SHA-256 conferidos pelo QA: `stop-evidence.json` = `0eb18f93406387b885f590a2ab77f7a8e44faac7918c43fff56bff6f98c03dad`; `f1-real-snapshot.json` = `45ae76e304f7762d4349ee2cd13c44b5d6f7eef4ccbbcc6627b58d85a7d8bd23`; `ports-after-stop.json` = `a9eadb0e1ad4bcb94061b14b0060b5b98d69fd2d2f13ef6a38e5efcc1c5355b7`.

**Revisor `/root/f1_revisor`: F2 — BLOQUEADO.** Conferiu os snapshots e este relatório; confirmou as duas incompatibilidades, os dez IDs/estados de contenção e a integridade dos 20 SQL. Classificou B-F2-01 como alta e B-F2-02 como média. Solicitou explicitar `RW:true` e corrigir a expressão “reserva de porta” para verificação pontual; ambos os ajustes foram incorporados. O bind permite escrita do contêiner no template do host. Conferiu 8/8 hashes das evidências sem alteração; digest da lista ordenada examinada: `26519e4a97cb4510bac2cc23ba322a95b67db0975008e8815a95905c63f78055`. Não executou testes de produto ou serviços, nem criou arquivos. Recomendou manter os recursos parados e corrigir o lançamento/mount mediante autorização delimitada antes de retomar F2.

Os perfis canônicos QA e Revisor foram fornecidos explicitamente. A avaliação foi independente em responsabilidade, compartilhando máquina e filesystem; worktrees e instrução de leitura não constituem sandbox técnico separado. Especialistas não reiniciaram serviços nem consultaram o banco. Não houve revalidação live por eles: conferiram os registros produzidos pelo Lead, e o QA executou verificações offline. Ausência de exposição anterior, saúde, schema e funcionalidades continuam sem certificação.

## 8. Retomada proposta e autorizações necessárias

1. Autorizar uma correção delimitada do lançamento/perfil **do projeto novo**, para obter publicações efetivamente em `127.0.0.1`/`::1`, sem mudar configuração global do Docker, firewall ou ambiente anterior. Validar a estratégia antes de voltar a publicar serviços.
2. Resolver o mount de template do Kong no perfil novo. Preferir configuração que não produza bind incompatível; eventual mudança de contrato de guard exige aprovação e negativos independentes, sem relaxamento genérico.
3. Autorizar nova rodada operacional F2 com os recursos retidos: verificar sua identidade/estado real e ausência de bootstrap da plataforma antes de decidir reaproveitamento. Não remover/resetar por conveniência; não reexecutar migrations às cegas.
4. Somente após a prova operacional de isolamento, aplicar os 20 SQL canônicos e examinar schema/histórico/RLS/ACL/TRUNCATE. Falha de bootstrap ou privilégio excessivo exige STOP da etapa afetada e proposta focalizada.
5. Executar os testes sintéticos previstos em F2.4/F2.5, com QA independente e Revisor sobre o candidato/evidências finais. Evidências históricas não substituem essas execuções.

F3, curso pessoal novo, Supabase remoto e Fly permanecem sem homologação por F2. Compatibilidade de atualização U1/U2, privilégios TRUNCATE, Auth/MFA, recibos e demais funcionalidades ainda não foram testados neste banco novo. Não houve acesso a produção, deploy, chamada paga, geração de curso, COM-1B, modificação de pilotos, commit, push, PR ou merge. Downloads de dependências/imagens e consulta Git/GitHub não são apresentados como execução sem rede externa.

**F2 — BLOQUEADO. Pare no relatório; não iniciar F3 ou uma correção operacional sem a autorização delimitada acima.**

## 9. F2-R — correção focalizada do isolamento

Autorização posterior expressa do proprietário: corrigir e verificar apenas o isolamento do projeto novo, sem bootstrap da plataforma. Data: 23/10/2026. Baseline/HEAD continuam `548a729a33b80fa7dfb8681855cd1e2a71c5174b`; branch `test/release-f2-clean`; única raiz operacional `D:/Documents/destrava-worktrees/destrava-release-clean`. Nenhuma branch/worktree adicional foi criada nesta correção.

### 9.1. Causas comprovadas

| Bloqueio | Evidência original real | Correção realizada |
| --- | --- | --- |
| Binding amplo | `HostConfig.PortBindings.HostIp` era **vazio**; `NetworkSettings.Ports` publicou `0.0.0.0` e `::`. A bridge já tinha default `127.0.0.1`, insuficiente neste Docker Desktop/CLI | Criar substitutos com `HostIp:127.0.0.1` explícito em cada publicação, na mesma rede exclusiva; conferir metadados live e listeners Windows |
| Kong bind RW | `Source=D:\Documents\destrava-worktrees\destrava-release-clean\supabase\templates\confirmation.html`, `Destination=/home/kong/templates/email/confirmation.html`, `Type=bind`, `RW=true` | Volume nomeado exclusivo montado RO em `/home/kong/templates/email`, com template de hash fixado, arquivo `0444` e diretório `0555` |
| Bind auxiliar Studio | Diretório novo `supabase/snippets`, `Type=bind`, `RW=true` | Volume nomeado novo, `NoCopy:true`; helper comprova vazio antes do start |

A versão instalada **2.118.0** oferece `--network-id`; o help não ofereceu flag de HostIp. Não houve upgrade de CLI, pull/build de imagem ou alteração global de Docker/firewall. A rede retida foi reconhecida e mantida, sem excluir/recriar recursos para contornar divergências. A correção usou a [API local do Docker Engine](https://docs.docker.com/reference/api/engine/version/v1.51/) com campos de criação explícitos; não voltou a executar `supabase start`.

O template original foi conferido como arquivo regular da raiz nova, sem symlink/hardlink ou resolução para fora do workspace. A ACL Windows original permitia modificação por usuários autenticados locais; essa ACL não foi modificada. O contêiner corrigido deixa de montar o arquivo do host. Em runtime, executando como o usuário `kong`, passaram leitura, negativa de escrita e negativa de symlink; `stat` registrou **regular file 444 0 0**, com SHA-256 `fa18214c6d17fa4d26e5a5e7d3311bec504fb7e203ea545e2052dccc67e2229f`.

### 9.2. Proveniência, retenção e estado observado

O preflight confirmou os dez IDs originais novos parados, imagens locais por ID, labels de projeto/workdir, três volumes e rede da criação F2. Nove originais tinham restart `unless-stopped`; os dez foram explicitamente configurados com restart `no` antes da substituição. Nenhum original foi reiniciado. Todos foram retidos, com o sufixo de nome `_f2r_original`, conservando seus IDs.

| Recurso | Antes F2-R | Resultado da verificação operacional |
| --- | --- | --- |
| Originais do projeto novo | Dez parados | Dez retidos/parados, restart `no` |
| Substitutos | Inexistentes | Dez criados por IDs de imagem locais; os mesmos dez iniciados e validados |
| Helper | Inexistente | Um contêiner sem rede, encerrado com exit 0; DB e snippets montados RO |
| Rede | `supabase_network_destrava-release-clean` | Mesmo ID `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2` |
| Volumes | db/config/storage do projeto novo | Os três preservados; adicionados `supabase_email_templates_destrava-release-clean` e `supabase_snippets_destrava-release-clean`, com labels reais de criação |
| Publicações | Doze bindings amplos em seis portas | Seis bindings, exclusivamente `127.0.0.1`, portas 55421–55426; nenhum binding IPv6 amplo |
| Host binds | Kong e Studio RW | Zero nos dez substitutos |
| Health observado | Não homologado por F2 | Oito `healthy`; edge/runtime e PostgREST sem healthcheck configurado; zero reinícios nos dez |

São **21 IDs de contêiner retidos**, contando originais, substitutos e helper; não são 21 serviços ativos. `repair-state.json` registra o mapeamento completo original→substituto, imagens, digests da configuração, aliases, destinos e cópias permitidas. Não houve remoção de contêineres, volumes, dados ou rede.

Configuração, Env, comandos e healthchecks dos serviços foram preservados, com digests sem valores de credenciais. Seis arquivos/diretórios gerados pela CLI nos contêineres novos originais foram copiados por arquivos tar em memória para os substitutos: `/root/index.ts`; Kong `kong.yml`, `localhost.crt`, `localhost.key`; DB `/etc/postgresql` e `/etc/postgresql-custom`. UID/GID foram preservados. Conteúdo privado não foi impresso, exportado para relatório ou transformado em imagem. São recursos do **mesmo ambiente novo**, sem importação de ambientes antigos.

### 9.3. Barreiras antes do lançamento e prova live

1. QA e Revisor conferiram candidatos congelados antes de preparar e iniciar. O plano vincula hashes dos fontes/configuração, template, IDs e corpos de criação. O helper foi inspecionado antes de executar: rede `none`, nenhuma publicação, DB/snippets RO e somente o volume de template RW.
2. O helper conferiu `PG_VERSION=17` e a existência de `global/pg_control`, sem consultar SQL ou respostas de alunos; isso demonstra cluster já inicializado, não schema da plataforma. Conferiu snippets vazio e hash/permissões do template.
3. Os dez substitutos foram inspecionados ainda `created`/parados. Neste estado o Docker retornou `NetworkID:""`; a evidência foi preservada. O validador permite esse vazio **somente** em `created` com `Running:false`, nome/modo da rede exatos e rede real conferida por ID. Não preenche ou fabrica metadados. A validação live exige o NetworkID concreto.
4. Durante o start, o PowerShell manteve `repair-state.json` aberto com **FileShare.Read**, bloqueando escrita/substituição enquanto o Node executava. Fontes, configuração e template também ficaram abertos para leitura. SHA do ledger antes/depois: `09d6a9011040462c9f1708ff9ad62f1996debc1aaa0f46d43c380dad33083bd1`. Conjuntos dos dez IDs novos/antigos, nomes e imagens foram comparados aos recibos; nenhum fallback sem lock foi usado.
5. As 12 portas propostas estavam livres imediatamente antes do start. Depois, Windows registrou seis listeners — 55421 a 55426 — todos em `127.0.0.1`, **zero fora de loopback**. Não foi testada exposição a partir de outra máquina.
6. O gate completo dos dez serviços passou com IDs reais, aliases, imagens/configuração, volumes, ausência de binds e bindings live. O **F1 inalterado passou sobre snapshot fiel** de db/Kong e dependências; seu retorno continua `operational:false`, conforme contrato F1. A prova operacional adicional pertence a F2-R.

### 9.4. Prova de não execução das 20 migrações

Durante o start controlado, os **20 SQL canônicos foram fisicamente retidos** em `.tmp/f2-r/migrations-hold/`; o diretório canônico não continha SQL. `db.migrations.enabled=false` e `db.seed.enabled=false` foram novamente exigidos. Nenhum substituto recebe host bind do workspace ou do diretório de migrations; os originais retidos continuam parados. O lançador só chama start pelos dez IDs aprovados: **não chama CLI Supabase start, cliente SQL, migration, seed, repair ou reset**.

Após a rodada, **20/20 arquivos foram restaurados**, zero erros e todos os hashes idênticos ao manifesto anterior. `git diff --exit-code HEAD -- supabase/migrations scripts/release-guards/clean-local.mjs`: exit 0. Não houve bootstrap das 20 migrações por esta execução.

Os serviços Supabase podem executar suas próprias operações SQL internas de inicialização/healthcheck. Não se afirma ausência absoluta dessas operações. Nenhuma consulta SQL foi executada pelo Lead/QA/Revisor, nem se inspecionou o histórico/schema do banco nesta correção; a barreira comprovada é a não disponibilização/não invocação das migrações da plataforma. O volume não é certificado como banco vazio, e não se infere homologação funcional.

### 9.5. Testes e achados corrigidos

| Verificação | Resultado observado |
| --- | --- |
| `node --test scripts/release-guards/*.test.mjs` | **362/362 PASS**, exit 0; inclui testes locais/Fly simulados, sem Fly real |
| Subconjunto local F1 + reparo | **139/139 PASS**, incluindo 50 testes de reparo; exit 0 |
| ESLint dos quatro scripts/testes afetados | Exit 0, zero erros/avisos |
| QA independente C4, negativos via Node stdin | **56/56 PASS**, exit 0, fixtures sintéticas; oito verificações adicionais dos recibos parciais passaram |
| Preparação e reconciliação | Dez substitutos criados/parados, sem iniciar serviços; exit 0 na retomada C4 |
| Wrapper com pins e lock + start C4 | Exit 0; pins antes/depois PASS, FULL10 live PASS e F1 fiel PASS |
| Listener Windows, template runtime e integridade dos SQL | Exit 0; seis listeners loopback, template RO legível e hash exato, 20 SQL restaurados |

Os negativos cobrem IPv4/IPv6 amplos, HostIp vazio, LAN, portas extras/incorretas, IDs duplicados/sobrepostos, rede/aliases/labels errados, imagem/Env/comando divergentes, mounts externos ou graváveis indevidos, namespaces/privilegios inesperados e helper inseguro. O F1 continua rejeitando bind do Kong, inclusive somente leitura; nenhuma exceção genérica foi introduzida.

Achados QA/Revisor corrigidos antes do lançamento: vínculo ao plano congelado; inspeção real do helper antes de iniciá-lo; confirmação DB RO; configurações de host inesperadas; IDs antigos/novos únicos/disjuntos; retenção dos hardenings ou rejeição da fonte; restauração tentando todos os SQL antes de anunciar sucesso; contenção tentando todos os IDs e agregando erros. As evidências anteriores não foram rebatizadas como execução da versão final.

Uma preparação C3 falhou em `digest(undefined)` para healthcheck ausente no edge. Resultado retido: dois substitutos criados/parados e edge original renomeado sem entrada no ledger. Nenhum dos dez serviços iniciou nessa tentativa. O helper já havia encerrado com sucesso. C4 adicionou representação distinta para `undefined`, regressão e reconciliação explícita pelos dez IDs; preservou os dois substitutos e o helper/volumes existentes, exigiu ausência de clone edge para o slot sem recibo, e calculou todos os hashes antes de novas mutações. Não repetiu `prepare` às cegas.

Outra falha era do teste F1 de adaptação em memória: ele ativava exemplos SMTP comentados mesmo com portas já ativas no config F2, causando chave duplicada. O teste agora só ativa exemplos quando o campo está ausente. As asserções e a rejeição de TOML duplicado no guard foram preservadas. Falhas de leitores/harnesses dos especialistas ficaram separadas de defeitos de produto.

### 9.6. Candidato e arquivos

Candidato de código **F2R-C4**, sem commit novo:

| Arquivo | SHA-256 |
| --- | --- |
| `scripts/repair-release-clean.mjs` — novo lançador focalizado | `5e180369c2873de5f79ca3389eb8fee3c87b51ba672cac75c2156904a4fb5a37` |
| `scripts/release-guards/clean-repair.mjs` — validação adicional | `f4cdcd1a5ad8f2bde42e0264a0dc5fa0f3ba850e0d496fe39dd9111ae0f68e41` |
| `scripts/release-guards/clean-repair.test.mjs` — regressões novas | `11c807f86f35277785f803e5d19247962edd9f4c62985fe2cc036c0c7e04d105` |
| `scripts/release-guards/clean-local.test.mjs` — ajuste de fixture | `2a29441ec7b122e8db7076197d65e99c66d45ca9d8e11acd7a24ac8249c1e6b5` |

O guard F1 `clean-local.mjs` permanece em `0cb62755212516263f77c6d42faf9183af0c3fdd339fa82cffcc21763314bca4`. `supabase/config.toml` conserva os bytes preparados em F2, hash `769ffb1443200d0e32dc8d6fe9afd6373d73d5b28ad74022c385511f8191830e`. Este relatório foi ampliado, preservando o registro histórico. Artefatos/receipts, wrapper de lock, checks e logs de testes estão ignorados em `.tmp/f2-r/`; não contêm dump de banco ou Env privado nos snapshots estruturais.

O reparo é deliberadamente vinculado aos recibos desta rodada e ao Engine local Windows. Não é um gerenciador genérico de Supabase. Não executar `supabase start` nesse checkout para gerenciar os originais arquivados ou regenerar configurações com HostIp vazio. Uma rodada futura precisa revalidar identidade, pins, método de inicialização e diretórios de retenção existentes; não remover recibos/holds para forçar nova execução.

### 9.7. Parecer independente e encerramento

**QA `/root/f1_qa`: GO para isolamento operacional observado.** Além dos 56 negativos puros e da inspeção pré-start, conferiu diretamente os 21 IDs autorizados, rede/cinco volumes, listeners nas 12 portas e os hashes atuais dos 20 SQL, todos exit 0. Reexecutou F1 tanto no snapshot salvo quanto em snapshot fresco: PASS. Confirmou os mesmos dez substitutos ativos, dez originais parados, helper encerrado, NetworkID real, seis listeners `127.0.0.1`, zero publicação IPv6 ampla, Kong RO/Studio NoCopy, oito healthchecks saudáveis e dois ausentes. Conferiu wrapper/pins sem alegar teste adversarial do lock ou execução própria do lançamento. Digest da inspeção live direta: `7871d9d1357ad4ddbeff5118e7b8ddb4b0d85a4f3908a4602d5dfc787975f31c`. Snapshot F1: `b44c2cb05302d382ea95730cc738d082a74893fa5f50dc31916d11060f7d283b`. Wrapper: `b52a0a6473ece88938948f989cb0c49e23c03314b0ba5b0b667aa2b82cc2753c`.

**Revisor `/root/f1_revisor`: ISOLAMENTO VALIDADO NESTA EXECUÇÃO**, sem achados abertos. Leu os mesmos artefatos e a seção 9, sem testes/Docker/SQL ou escrita. Conferiu a rodada live e o encerramento, integridade dos 20 SQL, pins e ausência de listeners finais; pediu apenas distinguir os mounts dos substitutos daqueles dos originais parados, ajuste incorporado. Evidências finais estáveis: `final-resources.json` SHA-256 `886675e27cdc2bc34691c2aad2be2d9eb98ef25acc1a7c40765ac411985f2de7`; `listeners-final.json` SHA-256 `cafc409f2b11808c29f84ff5912c36b5391a021a227d2c674fc42dee96681b44`. Recomendou manter tudo parado e revalidar identidade/pins/método antes de futura retomada.

Perfis canônicos foram reaplicados explicitamente; especialistas não subdelegaram. Houve independência de análise e, no QA, inspeção estrutural real distinta. Os agentes compartilham máquina/filesystem; não se presume sandbox técnico de leitura por papel. As operações de serviços foram sequenciais, pelo Lead; QA recebeu janelas explícitas somente de leitura.

**Encerramento operacional:** após o QA live, o Lead parou somente os dez substitutos, exit 0. `final-resources.json` conferiu os **21 contêineres retidos/parados**, todos com restart `no`, **cinco volumes preservados**, rede original retida e zero endpoints ativos. `listeners-final.json` registrou **zero listeners nas 12 portas**. O ledger permaneceu com SHA `09d6a9011040462c9f1708ff9ad62f1996debc1aaa0f46d43c380dad33083bd1`. Nenhum serviço ficou iniciado como consequência da entrega.

Permanece **sem autorização nesta entrega** o bootstrap das 20 migrações, Auth/MFA/RLS/TRUNCATE, testes B1/A2/B2/I7/I8, atualização de curso, curso pessoal, F3, produção ou Fly. Não houve acesso a recursos de `espanhol-plataform`, alteração global, exclusão, SQL manual, seed, reset, commit, push, PR ou merge. A homologação funcional F2 continua pendente e exige retomada autorizada própria.

**Veredito final: F2-R — ISOLAMENTO VALIDADO.** Pare após este relatório. A decisão limita-se ao candidato e à execução registrados; não homologa schema ou funcionalidades nem inicia o bootstrap das 20 migrações.


## 10. F2-B — bootstrap canônico e segurança

Data: 23/10/2026. **Resultado: F2-B — BLOQUEADO por privilégio excessivo de TRUNCATE.** Bootstrap das 20 migrações concluído; segurança e homologação funcional não aprovadas. Esta seção atualiza o estado operacional das seções anteriores, preservadas como histórico.

### 10.1 Baseline, preservação e destino

- HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, checkout `D:/Documents/destrava-worktrees/destrava-release-clean`. Nenhum commit novo.
- F2R-C4 preservado: seis arquivos pendentes inventariados em `.tmp/f2-b/before-files.json`; diff binário em `before.patch`, SHA256 `5c586cc9b8bf8d92e1ac6b320fef2da1f89b727e4a177840c0c0ef48a1d85d2b`. Os seis pinos de código/configuração do ledger e as 20 migrações permaneceram iguais durante a operação. Somente este relatório recebe acréscimo documental ao final; seu prefixo anterior será conferido byte a byte.
- Ledger `.tmp/f2-r/repair-state.json` SHA256 `09d6a9011040462c9f1708ff9ad62f1996debc1aaa0f46d43c380dad33083bd1`. Nenhum recurso antigo foi inspecionado para obter essa prova: ela se limita aos recursos do projeto novo e aos comandos com destino fixado.
- Docker `desktop-linux`, daemon local por `npipe:////./pipe/dockerDesktopLinuxEngine`. Projeto exclusivo `destrava-release-clean`, rede `supabase_network_destrava-release-clean`, ID `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`.
- Antes: 10 substitutos, 10 originais arquivados do próprio projeto novo e um helper parados; cinco volumes locais preservados, rede sem endpoints. Preflight operacional das 12 portas F1; erro de consulta de listeners bloqueia a operação.
- Durante: mesmos dez IDs aprovados, seis listeners reais em `127.0.0.1:55421–55426`; sem publicação IPv6. Portas auxiliares/app sem listeners. Gate completo F2R-C4 e F1 inalterado passaram em snapshot fiel. O retorno F1 `operational:false` não foi usado como prova operacional; IDs, bindings e listeners foram conferidos separadamente.
- Banco novo: contêiner `521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af`, volume `supabase_db_destrava-release-clean`, PostgreSQL 17.6, database/user `postgres`, porta interna5432, data directory `/var/lib/postgresql/data`, system identifier `7699958133051768869`. Mapeamento externo exclusivo `127.0.0.1:55422`.
- Pré-bootstrap em READ ONLY: histórico inexistente; nenhum objeto, função ou tipo da plataforma, nem reset experimental. O cluster já possuía estruturas internas do Supabase: não se alega volume fisicamente vazio. Evidência preservada em `prebootstrap-identity-result.json`.

### 10.2 Executor e comandos efetivamente executados

Harness local ignorado, não integrado ao produto: `.tmp/f2-b/ops.mjs`, `pinned.ps1`, cinco consultas SQL e manifestos. Candidato final de coleta **F2B-C3**, digest dos sete arquivos executores/consultas `772fd511b2aaf8e48f6f0afaa2f1e65ade1edf0305ee32f9bce103a3a6528ad3`.

| Artefato | SHA256 |
| --- | --- |
| ops.mjs | `5b9c9e0bf4ed256b340d76d003ca486d7aef1af3c66577c0ca3082d31f391e5c` |
| pinned.ps1 | `58a4717a81dcae8db2f0cb7d8cee2dc58b3b8a46ad3e0525802eab8788680861` |
| identity.sql | `fe519fe41b9d96dc22c9ec9d46e6e56a469ee7d7dca60a4475f7d4f19e6db959` |
| history.sql | `e1ba9d0e4183f274240a00e5b61b19fb4326f094abf424998f59eada42871fdb` |
| schema.sql | `93242b907fd259788c7493cf26cfd44add73f88af9f779dcfd92d794eee0bc3b` |
| security.sql | `ba4402e53329b71297f8ee02f3f71687a6fc1e39ccd4845c9b39c1aef84c01c4` |
| gates.sql | `003ef2cb1b706168306f255b0db00168e976c510a629013a1970de314cd2e2a3` |

1. Leitura de documentos/perfis, Git `rev-parse`, `status`, `diff --binary` e `cat-file`; hashes, Node `--check`, preflight somente de recursos novos e inspeção das 12 portas.
2. `powershell -NoProfile -ExecutionPolicy Bypass -File .tmp/f2-b/pinned.ps1 -Phase identity`: reinício por `docker --context desktop-linux start <ID-novo-pinado>`; nenhuma chamada `supabase start` e nenhum SQL da plataforma disponibilizado aos entrypoints por bind mount.
3. **Uma chamada** `pinned.ps1 -Phase apply`, com ops da aplicação SHA256 `5082e7dcd677dfa90f0d437a18a5b10831322e707eaffd422841bbed9991943f`, aprovado por QA/Revisor. Comando interno: `node node_modules/supabase/dist/supabase.js migration up --db-url postgresql://postgres@127.0.0.1:55422/postgres?sslmode=disable --workdir D:\Documents\destrava-worktrees\destrava-release-clean`. Exit0. Senha local própria fornecida somente em ambiente de processo, sem parâmetro público ou registro.
4. `pinned.ps1 -Phase audit`: consultas de metadados `identity`, `history`, `schema`, `security`, `gates`, cada uma em `BEGIN TRANSACTION READ ONLY` e `ROLLBACK`, com timeouts e `PGOPTIONS=default_transaction_read_only=on`. Psql `-X`, host127.0.0.1/porta5432 explícitos dentro do DBID novo; `PGSERVICE`/`PGSERVICEFILE` removidos, arquivo de senhas desabilitado. Nenhuma RPC de negócio invocada.
5. Após falhas de harness, repetidos somente reinício protegido e consultas READ ONLY. O marcador de aplicação foi conservado; não houve segunda aplicação.
6. Análise offline dos resultados; janela independente QA somente leitura; parada final somente dos dez substitutos, preservando todos os volumes/contêineres.

CLI instalada2.118.0, binário próprio do checkout, sem atualização. A fonte oficial dessa versão confirma: `migration up` explícito lê os arquivos mesmo com `db.migrations.enabled=false`; não executa seed. Configuração `[db.vault]` ausente produz lista vazia e nenhum round-trip de vault. Não havia env real; somente `.env.example` conferido contra o blob da baseline, que o loader não carrega. Processo CLI sem vínculos/tokens remotos herdados; endpoint literal de loopback. Fontes públicas dirigidas guardadas em `.tmp/f2-b/`, sem segredos.

A CLI gravou cada arquivo e seu histórico na mesma transação. Não se afirma uma transação global para os 20 arquivos. Marcador criado antes da chamada; falha/timeout não autoriza retry. As inicializações dos próprios componentes Supabase podem executar suas migrações internas; não são confundidas com seed ou com as 20 migrações da plataforma.

### 10.3 Histórico canônico — 20/20, uma execução

| Versão | Nome no histórico | Resultado |
| --- | --- | --- |
| 20260930000100 | initial | Aplicada |
| 20261002000100 | atomic_ai_quota | Aplicada |
| 20261002000200 | trusted_devices | Aplicada |
| 20261002000300 | recent_mfa_for_trusted_device | Aplicada |
| 20261002000400 | google_login_blocks | Aplicada |
| 20261002000500 | remove_google_login_blocks | Aplicada |
| 20261002000600 | feature_announcements | Aplicada |
| 20261003000100 | course_learning_state | Aplicada |
| 20261003000200 | mistake_course_context | Aplicada |
| 20261003000300 | mfa_for_course_state | Aplicada |
| 20261003000400 | course_profiles | Aplicada |
| 20261003000500 | generic_vocabulary | Aplicada |
| 20261003000600 | study_events_course | Aplicada |
| 20261003000700 | pedagogical_onboarding | Aplicada |
| 20261004000100 | interactive_lesson_sessions | Aplicada |
| 20261010000100 | assessment_semantics | Aplicada |
| 20261010000200 | learning_policies | Aplicada |
| 20261010000300 | course_installations | Aplicada |
| 20261011000100 | installed_study_runtime | Aplicada |
| 20261022000100 | interactive_segment_evidence | Aplicada |

Versões e nomes idênticos ao manifesto; 280 entradas de statements no histórico. A última versão corresponde somente ao B1 canônico. Não foi importado o SQL experimental de reset com identificador duplicado. Arquivos locais conferem com a baseline após normalizar somente CRLF/LF; hashes físicos permanecem iguais ao inventário F2. Digest independente dos 20 `{name,sha256}`: `4838e631bf550623f75e1d15c5d81b2f26f277aa88777f27a6dcf3199b598264`.

### 10.4 Schema e segurança efetivos

| Camada | Resultado observado / limite |
| --- | --- |
| Inventário gerenciado | 36 tabelas public+11 destrava_private; todas47 com RLS; 355 colunas,231 constraints validadas,85 índices válidos/prontos,11 triggers habilitados,51 funções,249 dependências catalogadas |
| Correspondência SQL | Nomes47/51/11 conferidos independentemente; QA comparou os corpos finais das51 funções ao último CREATE das migrações, somente normalização EOL. Não se apresenta contagem de colunas/constraints/dependências como prova de equivalência integral ou comportamento |
| Auth/MFA | Seis estruturas Auth/MFA esperadas presentes com RLS; funções MFA/recuperação com search_path vazio;24 políticas MFA. Configuração e fluxo funcional são camadas distintas; nenhum login/enrollment/challenge foi executado |
| B1 | definition_hash/constraint, recibos e RPC privilegiada instalados. I/U/D diretos nas sessões negados a anon/authenticated; recibos sem acesso de clientes e apenas SELECT para service_role; escritor restrito a service_role. **TRUNCATE nas sessões ainda concedido** |
| I7/I8 | Objetos privados presentes, sem privilégios diretos para anon/authenticated/service_role; RPCs esperadas instaladas. Gate singleton enabled=false, nonce NULL; nenhuma instalação/ativação realizada |
| Storage | Buckets course-artifacts e speaking-audio privados, políticas/guards catalogados. **TRUNCATE efetivo nos metadados Storage**; não se homologa segurança apenas por public=false |
| Reset experimental | Nenhuma tabela/função de reset e nenhuma coluna generation/reset nas355 colunas gerenciadas; histórico contém somente B1 na versão duplicada |
| Remoções canônicas | Google blocks e hook removidos pela migração correspondente, sem reaparecimento |

**Risco bloqueante confirmado:** `has_table_privilege` concede TRUNCATE a `anon` e `authenticated` em **34 tabelas para cada papel:31public e3storage**. Os grants diretos somam68; ACL PUBLIC não concede TRUNCATE. Foram examinados PUBLIC (`aclexplode`/grantee0), privilégios efetivos, roles, memberships/herança e default ACL. Os dois papéis não são superusers nem BYPASSRLS, mas RLS não controla TRUNCATE.

As31 tabelas public são: activities, activity_options, ai_feedback, ai_requests, assessment_attempts, assessment_items, assessments, courses, exercise_attempts, interactive_lesson_sessions, lesson_progress, lessons, mistakes, profiles, review_schedules, reviews, skill_progress, speaking_submissions, study_events, study_session_activities, study_sessions, unit_progress, units, user_activity_progress, user_course_profiles, user_course_state, user_review_targets, user_study_state, user_vocabulary, vocabulary_items e writing_submissions. Storage: buckets, buckets_analytics e objects.

Não foi executado TRUNCATE de teste ou DELETE pelo Lead/especialistas, nem exploração HTTP ou afirmação de que cada tabela seria truncável isoladamente apesar de suas FKs. A autorização SQL excessiva basta para falhar o gate solicitado. REFERENCES/TRIGGER também aparecem nas ACLs amplas; sua revisão exige escopo próprio. PUBLIC EXECUTE remanescente em create_profile_for_new_user foi registrado; trata-se de função de trigger, não de RPC de aluno certificada por esta inspeção.

### 10.5 Achados do executor, tentativas e limites

- QA encontrou preflight com11 portas e tratamento permissivo de falha CIM: corrigido para12/incluindo9447 e ErrorAction Stop; quatro regressões estáticas passaram.
- Primeira inspeção não conectou: `PGSERVICEFILE` vazio rejeitado pelo psql. Dez serviços contidos; corrigido somente o harness para remover as variáveis. Evidências em `attempt1/`; nenhuma migração tentada nessa rodada.
- `.env.example` bloqueava o gate de aplicação: QA/Revisor identificaram antes da chamada; exceção limitada a bytes do template da baseline. Arquivos reais de ambiente continuam proibidos.
- Primeiro audit de security executou SQL READ ONLY com exit0, mas o parser por linha falhou. Nenhuma conclusão ACL foi tirada dessa saída perdida. Captura bruta e framing NUL corrigidos; QA testou a expressão real do parser com7 cenários puros, todos PASS. Nova coleta real contém10 separadores NUL e57 newlines; comprova saída JSON multilinha. Resultado final de todas cinco consultas exit0; tentativa anterior e schema preservados em `postbootstrap-attempt/`.
- Esses erros de harness não são contados como gates verdes nem como defeitos corrigidos da plataforma. Não houve alteração de produção ou das migrações para contorná-los.
- F1/F2-R anteriores são evidência histórica. Esta execução revalidou seus hashes/recursos/guards, sem reapresentar os362 testes anteriores como nova execução.
- Não foram executados jornadas A2/B2/I8, CAS/replay/ACK perdido, testes U1/U2, TypeScript/lint/build/browser ou geração de curso nesta etapa. Banco bootstrap aprovado não implica baseline funcional homologada.

### 10.6 Pareceres independentes e estado final

**QA /root/f1_qa: bootstrap20 e isolamento confirmados; BLOQUEADO para segurança/homologação funcional.** Executou duas rodadas de auditoria independentes, exit0, sem escrita: identidade/system identifier/histórico20, privilégios reais/PUBLIC/herança/owners/SchemaCREATE, 21 RPCs I7/I8/B1, MFA e buckets. Conferiu template Kong diretamente: diretório555/root:root, arquivo regular444/root:root, SHA256 fa18214c6d17fa4d26e5a5e7d3311bec504fb7e203ea545e2052dccc67e2229f. Digest dos metadados diretos a83b675d53cc3a0ff8cc18cb3f2365b870421f073f57e1bc7c6e8f7c7f9b8b44. Regressões puras:4 preflight e7 parser, exit0; comparação offline das51 funções PASS.

**Revisor /root/f1_revisor: bootstrap canônico20 confirmado; F2-B BLOQUEADO pelo achado R1 de alta severidade.** Conferiu os artefatos/hashes e a preservação dos pinos sem executar Docker, SQL ou testes. Não identificou autorização para corrigir ACLs; exigiu distinguir owners e privilégios administrativos na proposta.

Perfis canônicos explicitamente reaplicados: DESTRAVA_PROFILE_QA_V1 e DESTRAVA_PROFILE_REVISOR_V1. Três agentes ativos no máximo; sem subdelegação. Isolamento procedimental e ownership não constituem sandbox técnico exclusivo. Banco e recursos compartilhados operados sequencialmente: Lead; janela QA READ ONLY; Lead para contenção. Nenhum especialista escreveu arquivos.

Estado final observado: **21 contêineres novos parados, zero endpoints na rede nova, cinco volumes retidos, zero listeners nas12 portas do perfil**. As20 migrações e dados internos/canônicos permanecem no volume novo. Não há usuários/progresso de testes funcionais criados por esta tarefa; não foram consultadas respostas ou dados pessoais. Não houve limpeza ou descarte adicional aos comandos das20 migrações autorizadas. Configuração Auth não secreta: API/origem/redirects em loopback; TOTP enrollment/verify true; telefone false; mailer local/autoconfirm true. Chaves ausentes no ambiente do serviço não foram tratadas como prova de defaults.

Evidências locais ignoradas .tmp/f2-b/:

| Resultado | SHA256 |
| --- | --- |
| history-result.json | a3ccc674531fc4aaf82b04c65f47a99fc6e2aeeef0970a869f1824cacac13ebc |
| schema-result.json | 4b8f7451fc5cf96806c9baa6a7fd353cf9e4159e753c4260937c93028c880a7e |
| security-result.json | 10c248eafe928487633f02831cc8543c9864f092fe45610c3096a3d68e411c7c |
| gates-result.json | a03021475c51b7f966264c9182a2fac280367c46cea5f570caf9146557fc80f5 |
| final-resources.json | b96a47101e0af8a261d3f4b08260cdb65f6ce72081c2563851b39ee77f0b5a40 |
| listeners-final.json | 84b1c14e68260082e3e79edff0a78f4ebf1942cfd6c593246044ec2149cbb87d |

before-files/before.patch, prebootstrap-identity, migration-attempt/result/stdout/stderr, consultas/saídas brutas NUL, preservation-before-report, auth-config e executor-manifest completam a rastreabilidade. Este documento não contém credenciais ou logs de alunos. Scripts/configuração F2R-C4 e SQL canônico preservados; única mudança F2-B fora de artefatos ignorados é o acréscimo deste relato ao relatório local existente.
### 10.7 Correção mínima recomendada — proposta, NÃO EXECUTADA

1. Autorizar tarefa focalizada de código/SQL/testes em candidato isolado, com nova migração de identificador único. Não editar as20 migrações nem reparar/regravar seu histórico.
2. Separar revogações das ACLs existentes e dos default privileges. Remover TRUNCATE de PUBLIC/anon/authenticated nos objetos afetados de public e Storage, sem ampliar permissões de outros papéis.
3. Defaults observados exigem tratar criadores distintos: postgres em public/storage; supabase_admin em public e outros schemas de infraestrutura com grants aos clientes. Delimitar por schema/objeto aprovado; não aplicar revogação global indiscriminada aos componentes internos.
4. O administrador usado postgres **não é superuser** e não tem caminho de membership para supabase_admin nem supabase_storage_admin. Grants atuais Storage têm grantor supabase_storage_admin. Não se promete que ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ou REVOKE desses grants executará como postgres. Comprovar autoridade de owner/grantor e obter autorização explícita para o acesso administrativo local adequado; sem ALTER ROLE, novas memberships ou escalada implícita.
5. Exemplos documentais condicionais, NÃO EXECUTADOS: `REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated`; `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM PUBLIC, anon, authenticated`. A parte Storage/defaults de outros owners depende do gate de autoridade; esses exemplos isolados não resolvem todo o achado.
6. QA deverá confirmar ausência efetiva de TRUNCATE, inclusive PUBLIC/herança/defaults, preservação dos demais privilégios necessários e comportamento do Storage. Não testar apagando dados. Revisor examina candidato congelado; verificar também eventual reaplicação de grants por upgrades da infraestrutura.
7. Revalidar instalação limpa e atualização em destinos explicitamente autorizados, preservando este banco e seus20 registros. Só depois de segurança favorável solicitar a etapa funcional F2 seguinte, com autorização própria; não iniciar F3 ou publicação por consequência.

Nenhuma correção DDL/ACL foi executada. Não houve reset, seed genérico, migration repair, limpeza de volumes, alteração de credenciais remotas, acesso ao projeto de estudo/produção/Fly, chamada paga, geração de curso, commit/push/PR/merge. Fontes públicas da CLI e o aviso de atualização não são acesso ao backend do produto. As fronteiras de preservação foram mantidas por operações com IDs/destinos permitidos; não se alega comparação de hashes ou inspeção de ambientes cujo acesso estava proibido.

**Veredito: F2-B — BLOQUEADO.** Pare após este relatório; nenhuma continuidade funcional ou correção automática está autorizada.


## 11. F2-ACL — correção focalizada das permissões

Data: 23/10/2026. **F2-ACL — VALIDADO LOCALMENTE NO DOMÍNIO DESTRAVA.** QA e Revisor favoráveis no recorte declarado. O bloqueio das tabelas Destrava foi corrigido; os grants internos de Storage continuam positivos, separados como risco residual. Não há aprovação de F2 funcional completo ou produção. Esta é a atualização mais recente; as seções anteriores permanecem históricas.

### 11.1 Candidato, preservação e ambiente reutilizado

- Referência/HEAD: `548a729a33b80fa7dfb8681855cd1e2a71c5174b`; branch `test/release-f2-clean`; mesma worktree `D:/Documents/destrava-worktrees/destrava-release-clean`. Nenhum commit, push ou PR criado.
- Candidato **F2ACL-C2**; digest dos 12 arquivos de implementação, executor e consultas: `52be5f4afde47116bd96af1e93588a7f802ad14c62b207ca9c5a817e4bcc58d2`, manifesto `.tmp/f2-acl/candidate.json`.
- Antes de escrever arquivos: conferidos os seis arquivos pendentes da entrega F2-B, seis pinos F2R-C4, ledger e os 20 SQL originais. Relatório anterior com SHA256 `7a5a96c6deaf1acbcc995f67986e8164b74909330d4d40a471a7c7098bc3f6e3`; prefixo preservado no acréscimo final. Inventário/diff em `.tmp/f2-acl/before-files.json` e `before.patch`.
- Mesmo contêiner DB `521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af`, mesmo volume `supabase_db_destrava-release-clean`, PostgreSQL17.6, system identifier `7699958133051768869`, endpoint externo `127.0.0.1:55422`.
- Mesma rede `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`, mesmos cinco volumes e 21 contêineres retidos. Os dez substitutos foram os únicos serviços iniciados; mesmos guards F1/F2R-C4, bindings explícitos de loopback e mounts nomeados, Kong RO. Nenhum ambiente, volume, contêiner ou worktree adicional foi criado.

### 11.2 Diagnóstico reconfirmado e alteração mínima

A reconferência SQL foi feita no banco existente em transações READ ONLY com ROLLBACK. O histórico continha exatamente as 20 versões anteriores, sem pendências históricas divergentes. Foram separados:

| Escopo | Antes | Depois |
| --- | --- | --- |
| 36 tabelas Destrava em public, todas owned postgres | 31 tinham TRUNCATE para anon/authenticated; cinco já negavam | Zero TRUNCATE efetivo para ambos os papéis nas 36 tabelas |
| ACLs das tabelas public | 62 concessões diretas de TRUNCATE, grantor postgres | Exatamente 62 removidas; zero grants adicionados |
| Defaults de postgres em public | Duas concessões de TRUNCATE aos clientes | Exatamente duas removidas; demais privilégios preservados |
| Defaults globais de postgres | Nenhum TRUNCATE inseguro para clientes/PUBLIC/herança | Permanecem iguais; nenhum default global alterado |
| Storage: buckets, buckets_analytics e objects | Owner/grantor supabase_storage_admin; três grants por papel cliente | Seis grants positivos preservados, sem tentativa de REVOKE |
| Defaults de outros owners/schemas, roles/memberships | Catalogados separadamente | Idênticos antes/depois |

**Arquivos desta tarefa:**

| Arquivo | SHA256 |
| --- | --- |
| `supabase/migrations/20261023000100_revoke_destrava_truncate.sql` | `591e0a6cd6c7671e1f657ba2a81ec90d67bd63abcfdb6fbd1e8c8f433adfffc1` |
| `scripts/sql/verify-destrava-truncate.sql` | `5d98f78158ec09bd8a374c52aa338fb366423d7f59ab98d822b6d2c1a41ba473` |
| Este relatório | Acréscimo documental; hash final no manifesto de entrega para evitar autorreferência |

A migração exige executor e owners `postgres`, usa allowlist das 36 tabelas da baseline e aborta diante de default global inseguro. Executa somente REVOKE TRUNCATE nessas tabelas e nos defaults postgres/public, com RESTRICT e pós-condições efetivas dentro da mesma transação da CLI. Os cinco objetos já protegidos não receberam permissões novas. Não há GRANT, DML de aprendizagem, alteração de RLS, funções persistentes, roles, memberships, owners ou objetos Storage.

Os defaults de supabase_admin e de postgres/storage não foram alterados. A proteção futura é do criador normal das migrações Destrava, postgres/public; não se anuncia política universal sobre objetos criados por outros owners. Defaults por schema são aditivos aos globais, portanto a migração rejeita a configuração global insegura em vez de produzir falso aceite. [PostgreSQL17](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

### 11.3 Aplicação incremental e testes observados

Reutilizado o mecanismo F2-R: start por IDs fixados, inspeção completa F1/C4 e listeners; nenhum `supabase start` genérico. Executor em `.tmp/f2-acl/ops.mjs` SHA256 `8c354baa1e1a45eafd8166104585018768c5f9503c83cdf31a2629260006542d`; wrapper `pinned.ps1` SHA256 `56ed397116524356d8f82c53c4a42a9489894cee8d6cd5570a726ab8c7d76097`. Arquivos, recibos, candidato e SQL ficaram com locks FileShare.Read durante as fases do wrapper.

| Verificação efetivamente executada | Resultado / limite |
| --- | --- |
| Preflight físico: IDs, labels, rede, volumes, configuração, seis listeners e 12 portas | PASS; mesmo destino; somente loopback; nenhuma operação no ambiente antigo |
| QA, trechos reais do executor com I/O simulado | 18/18 PASS; 15 entradas inválidas impediram CLI; controle válido chamou uma vez; falha CLI não repetiu. Não equivale a execução SQL |
| Primeiro DO da migração em READ ONLY como postgres | Exit0, no preflight do Lead e na conferência independente QA |
| Mesmo guard com SET LOCAL ROLE authenticated | Exit3 esperado: F2_ACL_EXECUTOR_REQUIRED; nenhuma mutação de role ou ACL |
| Verificador de aceite ANTES da correção | Exit3 esperado: F2_ACL_TRUNCATE_ANON; falha real de aceite, usada como controle negativo |
| Uma chamada `pinned.ps1 -Phase apply` | Exit0; CLI2.118.0 aplicou somente 20261023000100_revoke_destrava_truncate.sql |
| Histórico após aplicação | 21 versões; mesmas 20 versões, nomes e contagens anteriores; hashes dos 20 arquivos SQL preservados; uma nova versão, sete statements registrados |
| `pinned.ps1 -Phase audit`, incluindo verificador | Exit0; oito grupos do verificador passaram em READ ONLY |
| Comparação offline completa dos catálogos antes/depois | PASS; apenas 62 grants TRUNCATE public e dois defaults previstos removidos |
| QA pós-aplicação, SQL direto independente e verificador do produto | Exit0; oito grupos passaram; confirmou destino, histórico, privilégios e preservação |

A chamada interna foi `node node_modules/supabase/dist/supabase.js migration up --db-url postgresql://postgres@127.0.0.1:55422/postgres?sslmode=disable --workdir D:\Documents\destrava-worktrees\destrava-release-clean`, com senha própria somente no ambiente do processo. Pré-condições exigiram as 20 versões originais exatas e uma única pendência; marcador criado antes da chamada impediu retry. Não houve reinstalação das 20 migrações, seed, reset, repair ou escrita manual no histórico. A CLI gravou a nova migração e seu recibo na mesma transação.

O schema gerenciado e os gates ficaram idênticos antes/depois, inclusive 47 tabelas com RLS, 51 corpos de funções, constraints, índices, triggers e buckets privados. Foram preservadas SELECT/I/U/D/REFERENCES/TRIGGER, ACLs administrativas/service_role, políticas, roles, memberships, configurações e credenciais. O teste não executou TRUNCATE para obter erro42501: a prova é a permissão efetiva negada e a comparação de catálogos; os erros esperados acima são asserts explícitos, sem apagar dados.

### 11.4 Storage: alcance real e aceite local delimitado

A documentação oficial distingue os grants internos dos caminhos de acesso SQL. A remoção desses privilégios pode depender de atualização do próprio Storage; não se tentou forçar REVOKE como postgres nem alterar roles, ownership ou schema interno. [Supabase](https://supabase.com/kb/troubleshooting/revoking-privileges-on-storage-pg_cron-vault-and-extension-objects-has-no-effect).

Evidências desta execução:

- Configuração real do PostgREST: `PGRST_DB_SCHEMAS=public,graphql_public`, extra search path `public,extensions`. Storage não está exposto como schema Data API; extra search path não cria endpoints para seus objetos. [PostgREST](https://docs.postgrest.org/en/stable/references/configuration.html#db-extra-search-path).
- Catálogo ampliado: 88 funções com concessões a clientes nos schemas examinados. As 11 nos schemas expostos são dez funções public e um placeholder GraphQL; não foi identificado TRUNCATE ou execução dinâmica arbitrária nessas definições. A função de criação de perfil retorna trigger, não representa RPC de aluno validada nesta tarefa.
- As 19 funções Storage examinadas não constituem endpoints PostgREST nesse perfil. Três constroem consultas SELECT dinâmicas com valores parametrizados/USING e opções de ordenação restritas; não foi identificada ponte para SQL arbitrário. Uma ocorrência textual de “Truncate” era comentário, não comando. Isso não certifica toda a implementação interna do fornecedor.
- anon/authenticated são NOLOGIN. Existem papéis administrativos/de serviço com LOGIN e capacidade intencional de assumir esses papéis; nenhuma membership foi alterada. A publicação PostgreSQL fica em loopback. Sondagem não destrutiva ao endpoint local como authenticator observou desafio SASL(10), sem enviar senha nem SQL; não certifica login completo ou a lista de mecanismos SCRAM.
- A consulta administrativa HBA retornou permission denied for function pg_hba_file_rules em duas tentativas auxiliares, ambas contidas sem mudança no banco. A operação foi interrompida e retirada da coleta; não houve superusuário, alteração de permissões internas ou alegação de HBA inspecionado.

**Conclusão Storage:** os seis grants permanecem reais. Não foi identificado caminho HTTP para explorá-los nas configurações, funções e módulos examinados; não se afirma ausência universal de vulnerabilidades. Uma conexão SQL administrativa válida continua sendo um caminho de poder elevado. É fundamentado aceitar a correção local do domínio Destrava com essa ressalva explícita, sem exigir modificação interna não suportada. A versão/ACL do Storage e os caminhos SQL deverão ser reconferidos no destino de release; não há aceite de produção por esta entrega.

### 11.5 Pareceres e encerramento

**QA /root/f1_qa: GO para a correção delimitada do domínio Destrava.** Executou preflight e pós-verificação independentes no mesmo DBID, com READ ONLY/ROLLBACK, sem arquivos ou dados escritos. Confirmou diretamente o delta exato, histórico21, preservação dos 20 anteriores, 51 funções, RLS/políticas/roles/defaults/Storage e oito grupos do verificador. Digest dos metadados pós-aplicação: `f79a4862351c267971739458fdf5ca762dcd373e2b4449c761f938c491225627`. Os 18 negativos/controles puros de configuração são uma camada distinta. As seis concessões Storage não foram apresentadas como corrigidas.

**Revisor /root/f1_revisor: correção ACL public validada no recorte examinado, sem achado bloqueante.** Leu os artefatos e comparou os deltas independentemente; não executou Docker, SQL ou testes nem escreveu arquivos. Considerou coerente o aceite local delimitado, preservando a ressalva Storage e sem homologar F2 completo ou produção.

Perfis QA_V1/REVISOR_V1 reaplicados explicitamente; Lead integrou e operou os serviços, com janelas QA sequenciais somente leitura. Três agentes no máximo, sem subdelegação ou escrita paralela. A independência é de responsabilidade e análise; não se afirma sandbox técnico exclusivo por papel.

**Estado final:** os mesmos 21 contêineres retidos estão parados; mesmos cinco volumes preservados, rede original com zero endpoints, zero listeners nas12 portas F1. Banco retido com as21 migrações, sem reset ou descarte. Código/configuração F2R-C4, 20 SQL anteriores, arquivos pendentes e histórico documental anterior preservados. Não foram acessados recursos de espanhol-plataform, pilotos ES/EN, worktrees antigos, Supabase remoto, produção ou Fly; não houve chamadas pagas, geração de curso, alteração de credenciais, commit/push/PR/merge.

Evidências em `.tmp/f2-acl/`: before-files/before.patch; before/ com sete catálogos; diagnosis/exposure/API/probe; preflight-tests e erros esperados; candidate.json; migration-attempt/result/stdout/stderr; verify; comparison; final-resources/listeners-final; manifesto final de preservação. Nenhum artefato contém valores de credenciais ou respostas de alunos.

| Evidência | SHA256 |
| --- | --- |
| history-result.json | 8fab7ae7252fddb129308c5843392ae4c2b65b1d970a7d75fd061d3e7f985183 |
| security-result.json | 83a893ce010651700e3a2838d649cd367fdbb3b6a14d2a23bd8206ca319493a6 |
| comparison.json | `b9e0005e2a6178b01308f0c8f764f9408e30898a12242758e0197f23b0935a6b` |
| final-resources.json | 61c89f86c83551397bea994f80db206368280f0ae743951ff740567b96c828d1 |
| listeners-final.json | 84b1c14e68260082e3e79edff0a78f4ebf1942cfd6c593246044ec2149cbb87d |

Erros e retrabalho não contados como verde: duas consultas HBA negadas e contidas; verificador C1 inicialmente tinha comentários antes do marcador READ ONLY e não estava no audit, corrigido em C2 antes da aplicação. O QA corrigiu binding ausente em seu mock de teste, sem mudar asserções ou produto. O verificador emite aviso libpq sobre /dev/null não ser arquivo regular; seu exit0 e o NOTICE de oito grupos foram conferidos, sem ignorar falhas SQL. Não foram executados testes funcionais completos, build, browser ou geração de curso nesta etapa de ACL.

### 11.6 Próximo pacote funcional mínimo, no mesmo ambiente

F2-ACL encerra apenas a correção de privilégios. Antes de F3, executar um pacote coordenado, com dados sintéticos retidos e QA independente, reutilizando este banco e seu histórico21:

1. Auth/MFA e dois usuários: login, bloqueio AAL1 quando MFA exigido, recuperação autorizada/AAL2 e isolamento entre contas; Storage próprio versus outra conta e buckets privados. Nenhum TRUNCATE destrutivo.
2. B1/R1P2 por HTTP: criar/retomar sessão, evidência/recibo canônico, CAS, retry/ACK perdido e replay/versão obsoleta; confirmar que cliente não fabrica aprovação.
3. Jornada compilada de estudo e B2: persistência/reload, narração manual, pausa/cancelamento, voz simulada indisponível e fallback textual, desktop/mobile. Sem chamada paga.
4. I7/I8+A2 local e atualização U1/U2 sintética conforme os aceites F2. Os runners/guard de runtime instalado ainda fixam portas antigas: adaptar somente o perfil autorizado, sem usar a recusa atual como falso teste verde. Não inferir paridade instalada/compilada nem habilitar instalado em produção.
5. Gates de código/conteúdo pertinentes e um build/browser do candidato funcional, sem repetir bootstrap ou verificadores históricos não afetados. O ensaio U1/U2 deve detectar preservação ou rejeição honesta do hash, sem reinterpretar notas antigas.

Esse pacote requer autorização operacional própria para a etapa funcional e para eventual adaptação focalizada dos runners. Não criar outro ambiente, não reinstalar as 20 versões, não migrar progresso pessoal e não iniciar geração paga de curso por consequência. F3/Foundry, Supabase remoto e Fly permanecem tarefas posteriores autorizadas separadamente.

**Classificação final: F2-ACL — VALIDADO LOCALMENTE NO DOMÍNIO DESTRAVA, COM STORAGE RESIDUAL DOCUMENTADO.** Nenhuma continuidade automática, merge ou publicação.

## 12. F2-C — homologação funcional mínima

Data: 23/10/2026. **F2-C — BLOQUEADO no caminho instalado.** O caminho compilado passou nas verificações descritas abaixo. I7/I8/A2 não foram homologados neste perfil: os guards de aplicação ainda exigem as portas antigas. Nenhum guard do produto foi contornado ou alterado. Esta seção atualiza as anteriores, preservadas como histórico; não autoriza F3 ou publicação.

### 12.1 Candidato, identidade e preservação

- HEAD/referência `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, mesma worktree `D:/Documents/destrava-worktrees/destrava-release-clean`.
- Candidato **F2C-C5**, digest `8434286375b0a4806aaedec08ed5ac8f4cf78ab1b5f6096eda98e46a455fbb2c`, manifesto `.tmp/f2-c/candidate-c5.json`. Treze arquivos novos de runners/testes; sem alteração de domínio, contrato, conteúdo, migrações ou guards anteriores. Nenhum commit, push, PR ou merge.
- Pinos F2R-C4, ledger e oito arquivos pendentes anteriores reconferidos. Os 346 arquivos originais de `src`, `scripts` e `content` permaneceram byte a byte iguais; os 21 SQL foram preservados. Relatório anterior SHA256 `cbfe0c5639e2372dd0b7d0bd82c1d09ac83a31416782b9ee340185eae16aca53`, preservado como prefixo no acréscimo final.
- Mesmo DBID `521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af`, volume `supabase_db_destrava-release-clean`, system identifier `7699958133051768869`. API `127.0.0.1:55421`, DB externo `127.0.0.1:55422`, app `127.0.0.1:3100`, CDP9447.
- Rede original `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`, mesmos cinco volumes e 21 contêineres retidos. Antes: 21 parados e 12 portas livres. Start somente pelos dez IDs substitutos aprovados F2-R; inspeções live F1/C4 e listeners em loopback. Sem `supabase start`, nova instância, seed, reset ou chamada de migração.
- Novo executor ignorado `.tmp/f2-c/ops.mjs` reutiliza as inspeções F2-R/F2-ACL; a ação de aplicação de migrações foi removida integralmente. Wrapper mantém locks e contenção em falha. Identidade e histórico21 foram conferidos antes de fixtures. Credenciais locais próprias vêm exclusivamente do perfil F2 já existente, após validação de workspace/projeto/URLs e inspeção F1/C4; nenhum env antigo/remoto foi lido ou copiado.

### 12.2 Arquivos e execução

Arquivos novos, todos em `scripts/`:

- `release-clean-environment.mjs` e `.d.mts`: adaptador exclusivo, destinos fixos, ambiente filho restrito e inspeção F1/C4.
- `run-release-clean-functional.mjs`: ações explícitas Auth/catalog/B1/browser/update/build, sem migration/reset/seed.
- `prepare-release-clean-fixture.ts`: INSERT apenas das referências necessárias do catálogo compilado, exige catálogo vazio e registra tentativa antes da escrita. Não grava gabaritos nem reescreve registros existentes.
- `verify-release-clean-auth.tsx`, `verify-release-clean-b1.tsx` e `verify-release-clean-update.tsx`: testes sintéticos e verificações de persistência/autoridade.
- `release-clean-browser.mjs`, `.d.mts`, `release-clean-narration-browser.ts`, `verify-release-clean-browser.tsx`: cópias delimitadas dos verificadores existentes; originais preservados, CDP9447 e perfis retidos.
- `release-clean-cdp.mjs` e `.test.mjs`: recusa de porta ocupada, verificação do PID do navegador próprio e WebSocket em loopback.

Comandos realmente executados, no checkout identificado:

1. Git/read/hash e `node .tmp/f2-c/ops.mjs preflight`; inspeção das 12 portas com `Get-NetTCPConnection -ErrorAction Stop`.
2. `powershell -NoProfile -ExecutionPolicy Bypass -File .tmp/f2-c/pinned.ps1 -Phase identity` e `-Phase audit`: start por IDs e consultas READ ONLY/ROLLBACK, incluindo histórico e verificador ACL. Não houve aplicação das 21 migrações.
3. `node scripts/run-release-clean-functional.mjs auth`, `catalog`, `b1`, `build`, `browser`, `update`, nas rodadas registradas em `.tmp/f2-c/`.
4. Verificadores `verify-contract-vocabulary.ts`, `check-architecture.ts` e `validate-content.ts` via `node --import tsx`.
5. `node node_modules/typescript/bin/tsc --noEmit --incremental false`; ESLint de todos `src`, `scripts` e configurações, com rodada final `--max-warnings 0`.
6. `node --test scripts/release-clean-cdp.test.mjs`; Node syntax check e lint direcionado após o único ajuste posterior de CDP.

Os gates de código sem log bruto próprio têm comandos/exit codes do Lead no resumo explicitamente identificado `code-gates-result.json`; não são apresentados como execução independente. O build possui stdout/stderr brutos. Alterações posteriores limitaram-se a testes/runners, com TypeScript e lint pertinentes; os fontes de produção permaneceram iguais. O build foi Next16.3.8, 44 páginas geradas e 47 entradas na árvore de rotas, exit0. Não foi executado `content:compile` nem alterada qualquer fonte ES/EN. A jornada utilizou o registro compilado da main como fixture experimental, com referências novas no banco de teste, sem editar pilotos pessoais ou produzir novo curso. O build standalone próprio recebeu cópias dos próprios `public` e `.next/static`; o servidor usou `HOSTNAME=127.0.0.1`, `PORT=3100` e credenciais locais próprias. Testes compilados desabilitam explicitamente o runtime instalado; isso não constitui teste positivo de I8.

### 12.3 Resultados por camada e caminho

| Camada | Resultado observado | Limite |
| --- | --- | --- |
| Identidade, histórico e ACL | Mesmo SID/DBID; histórico21; verificador READ ONLY de oito grupos passou | Sem nova migração ou teste destrutivo de TRUNCATE |
| Auth/MFA/RLS/Storage | **5 grupos PASS**, exit0: duas contas, login/identidade, leitura/escrita cruzadas negadas, buckets privados, upload/download/URL assinada próprios e negação a outro/anon, AAL2 versus AAL1, recuperação autorizada seguida de TOTP | Recuperação não contorna MFA; objetos e fatores sintéticos retidos |
| B1/R1P2 | **25 cenários PASS**, exit0: sessão/retomada, correção, recibos, idempotência, payload divergente, CAS, forja negada, MFA e escrita privilegiada | Handlers reais em VM com Auth/SQL reais; não são 25 journeys HTTP |
| Compilado HTTP/browser e B2 | **18 checks PASS**, exit0, incluindo 10 de narração; cookies/HTTP, checkpoint corrigido pelo servidor e preservado no reload; 1280/360/390; zero erro de runtime ou requisição externa bloqueada | Voz Web Speech simulada; HTMLAudio real com WAV silencioso local; sem voz física, microfone ou qualidade acústica |
| U1/U2 e ACK | **5 checks PASS**, exit0: sessão U1, prova aceita, ACK perdido após commit real e retry único; U2-only rejeita retomada/replay/persistência por hash, segunda edição também rejeita, V1 restaurada retoma | Catálogo privado em VM e banco reais; não é troca HTTP de edição nem migração automática de progresso |
| Contratos/arquitetura/conteúdo | Exit0; 24 regressões de dependência rejeitadas; grafo sem ciclos; três pacotes existentes válidos | Aprovação técnica não é aprovação editorial do futuro curso |
| TypeScript/lint/build | Exit0; TypeScript sem incremental; lint final sem avisos; build com 44 páginas geradas/47 entradas de rotas | Build local não é imagem de produção com Supabase remoto |
| I7/I8/A2 instalado | **Não homologado / STOP do perfil** | Dois guards do produto fixam54321/3000; recusa não foi contada como PASS funcional |
| Segurança do runner CDP | 19 negativos/controles puros PASS, lint0; smoke real de lançamento/avaliação/encerramento do próprio navegador PASS, exit0, CDP9447 sem listeners após fechar | Resultado específico de lançamento do C5, distinto da jornada funcional C3 |

**U1/U2:** V1 `contentVersion=1.2.0`, `definitionHash=dfbc7520d72317a104b204fed7aeb5304b8d5b774fa62bed954798ee964af5f5`. Alterar somente o título da U2, mantendo U1 e a versão, produz `d59a0abc5d6376f873dcff0a15bf1639cdfc605b0b2cf97904d2e7b314aa0885`. GET, submissão e persistência U1 retornaram `409/LESSON_VERSION_CONFLICT`; projeção dos recibos sob o hash novo permaneceu vazia, sem alterar sessão ou recibo original. V2 `2.0.0` também rejeitou o estado antigo. Restaurar V1 em memória retomou a sessão original e sua evidência. A prova U1 foi aceita/correta e vinculada a owner, sessão, curso, lição, segmento, atividade, tentativa, versão e hash confirmados no banco.

O modelo atual escolhe rejeição segura, não continuidade transparente de U1 após edição U2. Para F3: congelar identidade/versão/hash da primeira edição; uma futura atualização precisa preservar a edição original consultável ou definir transição explícita antes de prometê-la. Não foi implementada arquitetura COM-1B, nova tabela, migração de progresso ou mudança de contrato.

### 12.4 Retenção, falhas e alcance das evidências

Foram retidas **dez contas exclusivamente sintéticas**, inclusive tentativas interrompidas, identificadas em `.tmp/f2-c/qa-scope.json`; nenhum token/senha integra o inventário. Catálogo de FK novo: um curso de referência, uma unidade, 11 lições e 46 atividades. Nenhum `activity_answers` foi importado. Uploads de teste, fatores MFA, sessões, recibos e perfis de navegador permanecem retidos. WAVs temporários de `public` foram movidos para `.tmp` pelo comportamento documentado do runner; artefatos servidos pelo standalone também permanecem no build local. Não houve remoção de contas, objetos Storage, volumes ou dados de aprendizagem.

Tentativas não contadas como PASS:

- Adaptador inicial procurava JWTs no Env do Kong, onde não existem; falhou antes de dados. Corrigida somente a fonte para o perfil local próprio já provisionado.
- Browser1 criou mídia depois do startup do servidor estático e não observou reprodução; logs/conta/perfil retidos. Passou a pré-disponibilizar o WAV, com HTTP200/hash exato e startup do standalone. A fonte instalada Next mantém uma lista de arquivos públicos no startup.
- Browser2 leu a contagem TTS imediatamente após o clique e encontrou1 em vez de2. A cópia do helper passou a aguardar o estado esperado, preservando a asserção exata e timeout; QA conferiu delta único. Browser3 passou18 checks.
- QA encontrou falso verde no primeiro oráculo de ACK: um recibo rejeitado também passaria. Antes da execução, foram acrescentadas aceitação/correção/escopo e igualdade da prova autoritativa; 12 negativos passaram a rejeitar o falso positivo.
- Update1 interrompeu antes de contas por referências de política U2 ainda apontando para U1; corrigida a fixture, mantendo contrato exigente. Update2 encontrou revisão de cliente anterior ao ACK, que mascarava o teste de hash; corrigido só o estado do cliente após retry. Update3 rejeitou a versão não numérica da fixture; alterado o literal para `2.0.0`, com validação pura das três variantes antes da rodada final. As contas e provas intermediárias foram retidas.
- TypeScript encontrou acesso à resposta no formato raw, corrigido para a atividade runtime pelo ID. Lint intermediário acusou imports/auxiliares não usados no teste novo; removidos. Uma expressão diagnóstica do browser falhou na transformação antes de executar e foi corrigida. Nenhum desses erros exigiu mudança no produto.
- Revisor encontrou possibilidade de conexão a CDP preexistente no helper copiado. Nas três rodadas, o Lead verificou9447 livre antes de lançar; não há evidência de contaminação. A correção terminou no C5 e acrescenta recusa/ownership/WS validado e negativos independentes; não rebatiza as18 verificações anteriores como nova jornada do C5.

Evidências históricas F1/F2-R/F2-B/F2-ACL não foram recontadas como testes novos. Artefatos desta rodada ficam ignorados em `.tmp/f2-c/`: manifestos, hashes/diff iniciais, snapshots/consultas READ ONLY, logs Auth/B1/browser/update/build, catálogos/contas retidos, tentativas1–3, screenshots, prova de mídia, bloqueio instalado e encerramento. Evidências de QA emitidas por stdin são registradas no parecer, sem inventar arquivo TAP.

### 12.5 QA, Revisor e encerramento

**QA /root/f1_qa: GO no recorte compilado auditado; F2 integral pendente.** Executou inspeção independente dos IDs reais e SQL READ ONLY/ROLLBACK, exit0: mesmo SID/histórico21, zero TRUNCATE para clientes nas 36 tabelas public, RLS ativo, gate false/nonce NULL, dez contas inventariadas, dois fatores verificados, seis sessões/11 recibos, oito exercícios/uma escrita/duas falas, 47 eventos/três estados de curso. Confirmou uma prova e um recibo aceitos na sessão final U1, com revisão3 e hash original. Conferiu F1 em snapshot fiel, rede/cinco volumes/IDs/bindings/Kong RO. Não leu respostas, áudios ou credenciais. Digests diretos: SQL metadata `986aacd2630596e8e4424c1f89161a5e5083bfc071a782e0443a73e6c6cb9f11`; Docker `d8649e0b1c693dae4a223a4ae256724379e96495570e68fd0e0716c721d884f1`. Os resultados Auth5/B125/browser18/update5 são execuções do Lead conferidas pelo QA; sua auditoria persistida é execução distinta. Controles puros independentes: 54 de URL/ambiente/perfil e 13 do oráculo de ACK, além de verificações pontuais dos ajustes. A primeira leitura Docker foi negada pelo sandbox; a leitura escalada autorizada passou. No helper CDP final, nove cenários independentes em VM com I/O simulado passaram: porta ocupada, PID alheio/ausente, perda de ownership, falha de lançamento, redirect, WS inválido/falho e positivo. Negativos nunca enviaram Browser.close e mataram somente o child simulado. Isso é distinto do smoke real do Lead.
**Revisor /root/f1_revisor: F2-C BLOQUEADO pelo caminho instalado; sem outro achado bloqueante aberto nos runners C5.** Achado CDP encerrado nos bytes finais após validar ownership antes da descoberta/WS, recusa de redirects e contenção do próprio child. Conferiu 13/13 hashes e digest C5, os 346 fontes originais, evidências Auth5/B125/browser18/update5 e contenção final dos 21 IDs/cinco volumes/zero endpoints/listeners. Examinou o smoke C5 separadamente da jornada anterior. Gates de código constam como exit0 no resumo do Lead; não executou esses testes independentemente. Sem Docker, SQL ou escrita. Confirmou rejeição segura U2/U1 e restauração V1, preservando os limites VM/voz sintética e a pendência instalada.

Perfis canônicos DESTRAVA_PROFILE_QA_V1/DESTRAVA_PROFILE_REVISOR_V1 reaplicados; especialistas sem subdelegação/escrita. Lead operou serviços/browser, QA recebeu janela sequencial READ ONLY e Revisor examinou fontes/artefatos sem Docker/SQL/testes. Independência de análise e execução não implica sandbox técnico exclusivo. Candidato final e prefixo do relatório conferidos por hashes.

**Encerramento observado:** app e navegador próprios encerrados; os mesmos 21 contêineres retidos estão parados, mesmos cinco volumes preservados, rede com zero endpoints e zero listeners nas 12 portas do perfil. `final-resources.json` e `listeners-final.json` registram a conferência final. Histórico21 e todas as fixtures permanecem no volume. Nenhum recurso de espanhol-plataform, worktree/piloto antigo, Supabase remoto ou Fly foi acessado; sem chamadas pagas, geração do curso pessoal, limpeza, reset, migração, commit, publicação ou deploy.

### 12.6 Bloqueio preciso e menor próximo passo

`src/lib/installed-runtime-scope.ts:10–11` e `src/lib/course-installation-runtime.ts:22–23` exigem API54321 e app3000. Com o perfil autorizado55421/3100, o guard real rejeita com `NOT_AUTHORIZED`; a reprodução pura não acessou rede nem usou credencial válida. Alterar apenas os runners não libera a integração instalada. Não foram executados os runners antigos, não foi ativado o gate I7 e não se declarou I7/I8/A2 disponível no compilado ou na produção.

Para fechar os aceites instalados, basta uma autorização focalizada para adaptar esses guards de aplicação ao perfil local novo explicitamente identificado, mantendo negação em produção, autoridade/gates, allowlists e testes negativos; adaptar somente os runners indispensáveis e executar I7/I8/A2 no **mesmo** banco. O nonce inicial desabilitado/NULL deverá ser preservado/restaurado exatamente. Não há motivo para novo ambiente, bootstrap, reset, migração de progresso ou repetir Auth/B1/B2/U1U2 já aprovados sem mudança pertinente.

Alternativamente, o proprietário pode decidir expressamente que o recorte compilado comprovado é suficiente para iniciar F3, adiando os aceites instalados. Isso altera o critério de saída; não foi presumido pelo agente. O residual Storage continua como na seção11, sem correção interna forçada e sem aceite de produção.

**Classificação final: F2-C — BLOQUEADO pelos aceites instalados pendentes.** Compilado/Auth/B1/B2 e bloqueio seguro de atualização possuem evidências locais acima. Nenhuma continuidade automática para F3, commit, publicação ou deploy.
### 12.7 F2-CI — desbloqueio focalizado do caminho instalado

Data: 23/10/2026. **F2-CI BLOQUEADO.** Os dois guards foram adaptados e os comportamentos instalados abaixo foram observados no ambiente existente. A última suíte terminou com exit 1; não há homologação integral de A2 nem autorização de F3/publicação. Esta atualização preserva integralmente o texto anterior.

#### Candidato e alteração delimitada

- HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, mesma raiz `D:/Documents/destrava-worktrees/destrava-release-clean`. Nenhum commit novo.
- Código de produto/runners congelado em **F2CI-C4**: 22 arquivos, digest `36f3bcd3471c6d1a0ff5adbbd93e62b20ffc5cb66373b59eaba3e8b2f96b49d0`, incluindo 12 fontes e dez arquivos locais de execução/consultas. Esses bytes permaneceram iguais nos ensaios posteriores.
- Último ensaio **F2CI-C9B**, 46 arquivos, digest `bc9887411a757051043b285f52798532222b1f902aaaf66307f829b21bc97a6b`, manifesto `.tmp/f2-ci/final-cors/candidate-c9b.json`. É digest SHA-256 de arquivos, não SHA de commit. As continuações ficaram em diretórios próprios; marcadores, leases, logs e falhas anteriores foram retidos.
- `installed-runtime-scope.ts` e `course-installation-runtime.ts` delegam a um único helper novo, `src/lib/installed-local-profile.ts`. Mantidos o perfil anterior autorizado, os códigos de erro e a recusa em produção, sem credenciais, em URLs remotas ou em combinações inconsistentes de projeto/portas.
- Para o perfil novo, variáveis não bastam: o helper exige Windows/realpath desta worktree, script de prova com hash fixado e inspeção real somente de leitura. `scripts/verify-installed-local-target.mjs` comprova daemon local, ledger/pinos F2-R, dez substitutos e originais arquivados do próprio projeto novo, rede, cinco volumes, mounts, bindings e gates F1/C4. Overrides são recusados; o filho recebe allowlist de ambiente sem credenciais. A prova é refeita a cada chamada, sem cache permanente.
- Nenhuma mudança de contrato público, SQL/migração, política, owner, role, autoridade de aplicação, pacote pedagógico ou lógica de correção. O emissor opaco e a lease de teste permanecem exclusivos do harness local; não são importados por rotas da aplicação.

Os **12 caminhos** estão no manifesto/patch de entrega: três fontes em `src/lib` citadas acima; `verify-installed-local-target.mjs`; `installed-local-profile.test.mjs`; pares `release-clean-installed-environment.{mjs,d.mts}` e `release-clean-installed-browser.{mjs,d.mts}`; `release-clean-installed-authority.ts`; `verify-release-clean-installed.tsx`; `run-release-clean-installed.mjs`. Há duas alterações em fontes existentes e dez fontes novas. O relatório recebe somente este acréscimo.

Hashes de produção: helper `4e1019f64217c6e3519f014296c0c3dd5091c1675640a40d2794b42852764dc8`; scope `6a5d600cbd7704bbf80ec805947d24bcaeaa880912b4b1fd9b75d4e4787e0a19`; installation runtime `f72adccda714098002b3b4873fe15ed06f6ffca60723530b57296bae5c132a64`; CLI de prova `8b23b5e221f80c4e081e5bcfa9d395a1afef0672d4a33fe5cabb1a79aa2a7cd4`.

#### Execução e resultados efetivos

| Camada | Resultado desta execução | Limite |
| --- | --- | --- |
| Guards simulados do Lead | `node --test` dos testes do perfil novo e guards F1/C4: **169/169 PASS**, exit 0; 30 são do helper novo | Sem bancos/SDK/Fly reais nos negativos; perfil antigo somente simulado |
| QA independente, controles puros | Grupos de 76, 17, 47, 84 e 32 controles passaram; os três negativos Node inicialmente vermelhos ficaram verdes após exigir POST único, CAS, operação própria e corpo exato | Grupos de rodadas distintas; não somados como testes únicos. Resultados por stdin/parecer; sem inventar logs TAP |
| TypeScript e lint pertinentes | `tsc --noEmit --incremental false`, exit 0; ESLint das 12 fontes, zero erros/avisos | Scripts locais de continuação também tiveram syntax check; não equivalem a banco/browser |
| Arquitetura automatizada | **Exit 1**, regex identifica o literal de infraestrutura `espanhol-plataform` no helper; grafo dos contratos de conteúdo/capacidades verificados sem ciclos | Literal exigido para preservar o perfil autorizado. Checker não foi alterado nem suprimido; gate global não é apresentado como PASS |
| Build do código alterado | Next16.3.8: compilação, TypeScript e 44 páginas concluídos; exit 0 | Aviso ENOENT na cópia para `.next/standalone/D:\.../scripts`; standalone **não homologado para publicação**. Sem `content:compile` |
| I7/I8 real, primeira rodada C4 | **13 verificações OK**: instalação/aprovação/ativação, dependência obrigatória bloqueada, CAS/recibos, onboarding, grade/final/reload, V1/V2, owner, rollback, produtor indisponível e gates AI/voz/interativo | Rodada global C4 terminou exit 1 posteriormente; os 13 OK são registrados individualmente |
| A2 real, primeira rodada C4 | **Sete verificações OK**: início único/cursor/pausa/reload; GET falho sem POST; ACK perdido; visibilidade/fim único; diagnóstico submetido/canônico; owner/V1 fixada; 360/390 sem overflow | Último caso de troca não terminou no timeout de 25 s. Não há alegação 8/8 PASS |
| Último caso A2, C9B | Fluxo ultrapassou as asserções de troca/renderização compilada, CAS, preservação de todas as chaves de aprendizagem, sessão existente, estado compartilhado e owner403 | **Suíte FAIL/exit 1** na asserção seguinte de rede: um bloqueio inesperado; não reclassificada como PASS |
| Auditoria posterior do Lead | SID/histórico21/gate/ACL e comparações READ ONLY passaram; V1 projetada e quatro evidências preservadas | Prova persistida distinta do browser; não completa a suíte reprovada |

Os comandos operacionais usaram `powershell -NoProfile -ExecutionPolicy Bypass -File .../pinned.ps1 -Phase identity/dev/verify` nas pastas `.tmp/f2-ci/` e das continuações, sempre com locks/pinos e destinos fixos. O build foi `node .tmp/f2-ci/final-cors/build.mjs`. O encerramento usou `.tmp/f2-ci/closure/pinned.ps1`, limitado a `identity/audit/stop`, sem launcher funcional. Somente `docker --context desktop-linux start <IDs novos pinados>` iniciou serviços; não houve `supabase start` ou invocação de migrações. Consultas de auditoria usaram READ ONLY/ROLLBACK. A lease temporária do gate usou o protocolo de escrita/restauração CAS autorizado; dados funcionais foram sintéticos e retidos.

#### Falhas preservadas e diagnóstico

1. **C4:** 20 OK e exit 1 no último caso, aguardando a interface de destino por 25 s. Logs registram troca/compilação e respostas HTTP; não se afirma causalidade comprovada apenas por latência.
2. **C5/C6 propostos:** revisão independente impediu executar `verify` com premissas incorretas. O progresso é compartilhado por owner/installation; uma nova VersionSession não cria estado vazio. C6 executou somente identidade/leitura. Não houve seed para forçar retomada.
3. **C7:** falhou antes de retomar porque o helper bloqueou OPTIONS de Auth. **C8:** bloqueou cinco OPTIONS de `user_study_state` e um de anúncios; a troca retornou 200, mas a readiness expirou. Essas falhas do harness permaneceram distintas de defeitos do motor.
4. **C9/C9B pré-operação:** QA detectou PUT/PATCH/DELETE indevidamente aceitos pelo filtro Node; corrigido antes do ensaio. Os bloqueios locais de anúncios passaram a ter classificação exata: somente POST, origem/rota e os 13 IDs versionados, sem campos extras. A RPC continuou negada por `Fetch.failRequest`; nenhuma resposta HTTP foi fabricada.
5. **C9B executado:** `/dashboard` Document200, leituras posteriores200 e outro proprietário403; pela ordem do código congelado, as asserções funcionais citadas já haviam passado. O resultado final é `failed / verify-final-context-and-authority / 1 !== 0`. Total de bloqueios **2**: um POST de anúncio esperado e um **OPTIONS `/rest/v1/study_events` inesperado**, após a projeção compilada gravar `user_course_profiles`. Zero eventos `Runtime.exceptionThrown` registrados. O POST de `study_events` não foi liberado. Não se certifica persistência compilada completa nem ausência universal de falhas de rede.

Foi aplicado STOP, sem C10, nova liberação de DML, reset ou alteração do motor. O bloqueio restante da suíte exige revisão explícita do inventário de persistência normalizada do harness; o trace não demonstrou defeito do motor. Os resultados anteriores do caminho compilado permanecem históricos, com fontes/evidências conferidas por hash; não foram recontados como testes novos de Auth/B1/B2/U1-U2.

#### Retenção, isolamento e preservação

Mesmo DBID `521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af`, volume `supabase_db_destrava-release-clean`, SID `7699958133051768869`, API55421/DB55422/app3100 em loopback. Rede original `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`, cinco volumes, mesmos 21 contêineres retidos. F1/C4 foram revalidados em metadados reais; a prova estática F1 continua `operational:false` e não substitui a inspeção live adicional.

Cinco contas novas exclusivamente sintéticas foram retidas na primeira rodada CI, além das dez anteriores. As continuações reutilizaram duas dessas contas, sem criar StudySession ou limpar progresso. Versões/referências adicionais legítimas foram inventariadas. A StudySession V2 `66d4b977-bb62-4498-8c31-f2f304255246` permaneceu única, mesma instalação e identidade. Na coleta final: progresso V2 revisão11, duração28, cursor0, paused=false; seleção final compilada `frecuencias-a1`, revisão7. V1 permaneceu revisão19 e sessão finalizada igual. Todos os campos de estado fora de `sessions` conservaram fingerprints; a comparação completa no teste permitia somente duração/cursor/pausa da sessão alvo. Referências antigas/novas da mesma instalação leem o mesmo estado compartilhado; não se promete imutabilidade de uma linha de progresso por VersionSession.

As quatro evidências canônicas mantiveram a projeção integral comparada, fingerprint de metadados `614e74ea21b6729b5923f841131e591d` (MD5 do JSON, não garantia criptográfica de segurança). Arquivos de evidência e manifestos usam SHA-256. `v1CollectedProjectionEqual` cobre referência, revisão e todos os campos de StudyState consultados; não significa igualdade de toda a linha SQL, como `updated_at`, ausente da consulta.

Auditoria final de hashes: 357 dos 359 fontes inventariados antes de CI permanecem iguais; somente os dois guards existentes autorizados mudaram. Treze fontes C5, sete pendências anteriores, 12 evidências nomeadas da entrega C5, 21 SQL e os 22 pinos C4 foram conferidos. Prefixo documental anterior: 80.851 bytes, SHA256 `5bbc09ca8ea40b12c3df28c1b0ec011d82dd42135231b7dfe98044f691291f49`. O patch completo dos 12 caminhos, inclusive novos, está em `.tmp/f2-ci/product.patch`, SHA256 `8a352e41af00c38a28532681d7fe10c5d61b0f17f45b6821faa1c2bccdaf45b7`; `git apply --numstat` exit0. Nenhum staging/commit foi feito.

**Estado final observado:** app e navegador próprios encerrados; 21 contêineres retidos/parados com restart=no; cinco volumes preservados; rede original com zero endpoints; zero listeners nas 12 portas do perfil. Gate `enabled=false`, `nonce=NULL` confirmado pelo Lead e pelo QA. O banco mantém as 21 migrações e dados sintéticos, sem descarte. Os recibos finais estão em `.tmp/f2-ci/final-resources.json` e `listeners-final.json`.

#### Pareceres independentes e limites

**QA `/root/f1_qa`: BLOQUEADO; invariantes persistidas corroboradas.** Auditoria independente: metadados dos 21 IDs, três chamadas psql READ ONLY/ROLLBACK e listeners das 12 portas, todos exit0. Confirmou SID/histórico21, gate false/NULL, V1 projetada igual, mesma sessão V2 e campos protegidos, quatro evidências iguais e os oito grupos do verificador ACL. Estado compilado do owner/destino: zero sessões/tentativas/avaliações/adaptativos/escritas/falas/conclusões e nenhum ID instalado; existem **dois eventos onboarding_started**, ambos do curso compilado. Não se alega zero eventos. Digest SQL `74cedf33df58aa6f9e7b8947f291c826b33388199b37aaa3477b65c68c1bb68e`; Docker `91afdfdbd395f454e0a3a7e5442b4826a340f3fef89be35f8048e9de1cbf2310`. QA não inspecionou Env/Cmd nem executou a jornada browser; não certificou persistência compilada completa. Devolveu a janela antes da contenção do Lead.

**Revisor `/root/f1_revisor`: homologação global BLOQUEADA.** Conferiu fontes congeladas, ordem das asserções, resultados/trace e comparações de metadados, sem executar Docker/SQL/testes ou escrever arquivos. Considerou os asserts funcionais já percorridos evidência parcial; exigiu preservar exit1, os dois bloqueios e as pendências de arquitetura/standalone. Aprovou somente a coleta READ ONLY de encerramento após restaurar locks de dependências e a sinalização de falha de contenção no wrapper. Sem achado novo sobre contratos/autoridade do produto; o FAIL da suíte permanece aberto.

Perfis canônicos QA_V1/REVISOR_V1 reaplicados explicitamente; Lead foi o único escritor e operador de serviços. QA derivou negativos e recebeu janela sequencial READ ONLY; Revisor leu candidatos congelados e artefatos, sem SQL/Docker/testes ou escrita. Não houve subdelegação. A independência é de responsabilidade/análise e, no QA, inspeção real distinta; não se alega sandbox técnico separado.

Os seis grants internos TRUNCATE de Storage permanecem sob a ressalva local da seção11, sem modificação interna forçada. Nenhuma migração, seed, reset, repair, limpeza de fixtures/volumes, curso pessoal, COM-1B, credencial remota, ambiente antigo, produção, Fly ou API paga foi acessado nesta execução. A preservação dos ambientes antigos é sustentada pelo escopo dos comandos exclusivamente no projeto novo; não se afirma inspeção/comparação byte a byte de recursos cujo acesso estava proibido. Sem commit/push/PR/merge/deploy.

#### Evidências finais

Artefatos ignorados locais; não são CI ou produção. QA por stdin consta no parecer acima.

| Arquivo | SHA-256 |
| --- | --- |
| .tmp/f2-ci/final-cors/result.json | 853ef68a256009db4a92205eedfae173af8e5148655b5db74f17c79e0b12e0c6 |
| .tmp/f2-ci/final-cors/gate-restored.json | 1da58c72724c96f78cd43b1e738b55f77444ca22cd6b4fb910564bb635d12c1e |
| .tmp/f2-ci/closure/history-result.json | 8fab7ae7252fddb129308c5843392ae4c2b65b1d970a7d75fd061d3e7f985183 |
| .tmp/f2-ci/closure/retained-comparison.json | 679dd1f06e83cda3e997a32c1853580444db226570693c5abb98a7cc12ea6b51 |
| .tmp/f2-ci/final-resources.json | 123ead99c08148ec4295adea741f624b8dbb143dddd829070b5e5d085668220b |
| .tmp/f2-ci/listeners-final.json | b423bb45501e0fa49d3b77e635f800a29f1fdcf5a58e00c7e04a7ff7833045f2 |
| .tmp/f2-ci/preservation-final-before-report.json | 7656f6a46ba9135059400f26d90b62cd71ef2cb417ded152d00e1a205250711e |
| .tmp/f2-ci/product.patch | 8a352e41af00c38a28532681d7fe10c5d61b0f17f45b6821faa1c2bccdaf45b7 |
| .tmp/f2-ci/final-cors/build-result.json | 2611d8e70195509f2c2eb0ec013388bfa1ed9f14bf6b2c50abc34c6a984feef4 |

#### Menor próximo passo

Rever somente a política do harness para a persistência compilada normalizada observada na troca, com payloads/owner/curso restritos e negativos independentes; não liberar tabelas/RPCs genéricas. Depois, executar apenas o último caso A2 ainda pendente no mesmo banco/estado, sem repetir as 21 migrações ou criar ambiente. Resolver separadamente o gate lexical de arquitetura e a montagem do standalone antes de aprovar um artefato de publicação. I7/I8 e os sete grupos A2 observados, assim como Auth/B1/B2/U1-U2 anteriores com fontes preservadas, podem ser reutilizados se os caminhos continuarem inalterados.

**Classificação final: F2-CI BLOQUEADO.** Guard de perfil corrigido; suíte final reprovada e artefato de publicação sem homologação. Encerramento somente de leitura concluído conforme evidências finais. Nenhuma continuidade automática para F3 ou publicação.
#### Retomada autorizada — fechamento focalizado (24/10/2026)

**F2-CI — BLOQUEADO.** A única rodada autorizada expirou na navegação CDP inicial, antes das asserções A2. Arquitetura e testes puros passaram; a persistência compilada da nova política não foi alcançada. O FAIL histórico C9B permanece preservado.

##### Candidato e preservação

Mesmos HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean` e workspace `D:/Documents/destrava-worktrees/destrava-release-clean`. Candidato **F2CI-CLOSE-C4**, digest dos 38 caminhos `3a69efc1cc146e15db07caaeaa4c7004ade8d3fd86526d27d72f01805c6928f5`, manifesto `.tmp/f2-ci-close/run/candidate-c4.json`. Inclui os 12 arquivos C9B como dependências inalteradas. Nenhum fonte de produção mudou nesta retomada.

Antes de escrever: 1.105 hashes e diff registrados em `.tmp/f2-ci-close/before.json` e `before.patch`; 60 entradas do manifesto anterior conferidas. Após o STOP, somente `scripts/check-architecture.ts` diferia entre os arquivos inventariados. Quatro arquivos novos e este acréscimo completam o diff focalizado. Fontes, pendências, 21 SQL e artefatos anteriores preservados. Prefixo documental anterior: 96.927 bytes, SHA256 `efe8997b64d7100215d788a1c60a239c04cf673b3d92ca3c811774fa1408b662`; a entrega confere prefixo e append exatos.

| Arquivo desta retomada | SHA256 |
| --- | --- |
| scripts/check-architecture.ts | `0fc31fdd816a97373e742a2786bf858e58b888365b15cbc7741a6e7a79f5939e` |
| scripts/architecture-language-check.ts | `a4ed63b88dcd016e5300214f23c3253ddeaf8efd8cfb0bb9509dd631144977fd` |
| scripts/architecture-language-check.test.mjs | `0569a51cae74057cc1134277ec56270b96f6ca519f71b9896ab3165b30398756` |
| scripts/release-clean-final-policy.ts | `e6eb705c524f034a77c8dbab4f9e6ec581fe6c28091c84a581fffc62188859a8` |
| scripts/release-clean-final-policy.test.mjs | `de9041ce782be12c920012536ad4a7acdb0e3332606b3236fd9566b09f50697b` |

##### Correções e controles negativos

A fonte real de SupabaseStudyRepository.save confirma upserts POST sequenciais. Para o estado sintético retido, a cadeia exige seis recursos: user_course_state, user_course_profiles, study_events, lesson_progress, unit_progress e skill_progress. A política anterior permitia somente os dois primeiros POSTs e não o preflight de study_events. A nova política deriva linhas/URLs/colunas/conflitos usando o repositório e SDK reais com fetch em memória.

Restrição: API http://127.0.0.1:55421, origem http://127.0.0.1:3100, owner 12418a8e-d2bf-4127-b609-8d262a89e0ec, curso frecuencias-a1, token/chave locais em memória, schema public e Prefer de upsert. OPTIONS exige POST e headers apikey, authorization, content-profile, content-type, prefer, x-client-info; há somente um GET delimitado do estado com sua lista própria. Preflight não autentica usuário: owner/curso/token são vinculados no pedido efetivo. Não houve liberação genérica de OPTIONS, study_events, escrita ou RPCs. O POST exato de anúncios continua deliberadamente bloqueado e contado separadamente.

O caso planejava um clique normal em Continuar no onboarding compilado: step0→1, preservando os dois eventos anteriores e acrescentando somente onboarding_step_completed/Idioma, sem conclusão ou resposta pedagógica. Exige seis ACKs HTTP2xx do mesmo snapshot por hash e Network.requestId/Fetch.networkId. Zero pedidos não produz PASS. Estado monotônico, rejeições imutáveis e revalidação após await impedem mistura de ACKs e regressões concorrentes.

O checker mantém a regex linguística e os gates de contratos/capacidades. A exceção AST é somente o span literal exato espanhol-plataform no arquivo installed-local-profile.ts, no lado direito de env.DESTRAVA_LOCAL_PROJECT === literal, sem optional chaining. Outros matches na mesma linha, comentários, código em strings, outros arquivos e referências pedagógicas continuam reprovados. A string de infraestrutura não foi mascarada no produto.

##### Execução efetiva

| Camada/comando | Resultado desta retomada |
| --- | --- |
| node --import tsx --test scripts/architecture-language-check.test.mjs scripts/release-clean-final-policy.test.mjs | **47/47 PASS**, exit0: 21 scanner e 26 política; SDK com fetch simulado, sem banco/HTTP |
| node --import tsx scripts/check-architecture.ts | Exit0; fronteiras, nove módulos de contratos sem ciclos e capacidades |
| TypeScript --noEmit --incremental false; ESLint dos cinco arquivos | Ambos exit0 no C4; c4-code-gates.json |
| QA independente C4 | **73 controles scanner + 25 política/concorrência/CDP em VM PASS**, exit0; não equivale a navegador |
| pinned.ps1 -Phase identity | Exit0; mesmos recursos, F1/C4 reais, seis listeners loopback e SQL READ ONLY/ROLLBACK |
| Pré-condições frescas | SID 7699958133051768869; histórico de 21 exato; gate false/NULL; seleção compiled/revisão 7; progresso 11, mesma StudySession 66d4b977-bb62-4498-8c31-f2f304255246, paused false; compilado step 0/dois eventos idêntico ao baseline |
| pinned.ps1 -Phase dev | Ready em 127.0.0.1:3100; Next16.3.8 webpack; sem build/bootstrap |
| **UMA chamada pinned.ps1 -Phase verify** | **Exit1**, step reuse-existing-active-study, Browser protocol timeout: Page.navigate |
| Prova CDP | Somente GET/study; zero bloqueios, Runtime.exceptionThrown, preflights e ACKs da política; flush/troca/persistência planejados não alcançados |

O CDP congelado limita comandos a 30.000ms. O Lead observou no stdout Next (sessão4924, chunkc286cf) **GET/study200 em 34,7s**, sendo 21,9s de compilação e 12,8s de aplicação. O trace CDP não recebeu responseReceived: a página foi fechada no timeout. Esses tempos são observação do servidor registrada em observed-timing.json; não medem prontidão/hidratação do navegador. A duração HTTP total observada pelo Lead excedeu 30s; não foram medidos TTFB nem o instante do ACK CDP. A compilação inicial é uma explicação compatível com os registros, sem provar toda a causa do atraso do protocolo. Não foi demonstrado defeito do motor ou bloqueio CORS nesta rodada.

O setup canônico chegou a criar VersionSession `cb692bd8-5f9d-445b-931d-2f8a7555b61d`, confirmando seleção instalada/revisão 8 e mesmo progresso 11/StudySession antes de navegar. Dados retidos; não se desfez seleção por DML. Não houve flush/persistência compilada planejado, o que não significa ausência absoluta de persistência: o setup foi realizado. Marcador exclusivo impede retry; não houve segunda rodada, aquecimento exploratório ou ajuste de prazo após a falha.

Retrabalho separado de resultados verdes: preflight READ ONLY R1 recusou BOM de retained.sql antes de executar esse SQL e conteve os serviços; a nova cópia remove somente o BOM e preserva o original. Um teste do Lead inicialmente usou nome de import errado. QA/Revisor detectaram optional chain, mutação de expectativa após deny, mistura/regressão de snapshots e corrida após await: corrigidos com negativos antes da única operação. C1–C3 não são homologações funcionais; os 112 controles exploratórios QA do C3 não foram recontados como C4. Uma tentativa de gerar o rascunho Markdown falhou na sintaxe do gerador, sem escrever no relatório histórico; o rascunho foi preparado diretamente depois.

##### Standalone

Pendência histórica mantida, sem build novo. O trace _not-found/page.js.nft.json contém `../../../../D:/Documents/destrava-worktrees/destrava-release-clean/scripts/verify-installed-local-target.mjs`. A leitura de Next16.3.8 mostra que o join/rebase de tracing incorpora o drive Windows num caminho inválido; o erro de cópia é capturado como aviso, explicando exit0 sem assegurar completude. A referência Windows do helper local é causa provável da emissão, sem prova integral da origem do emissor. Não houve ajuste de tracing/Nextconfig/produção. A imagem Linux de release exige homologação posterior própria; não foi criado outro ambiente. Essa ressalva é distinta do bloqueio local atual.

Auth/B1/B2/browser/U1-U2 e os 13 casos I7/I8 + sete A2 individuais continuam evidências históricas dos candidatos declarados; os arquivos desses caminhos não mudaram. Não foram repetidos nem apresentados como nova suíte aprovada. A nova política permanece sem comprovação HTTP/browser de persistência, pois a navegação falhou antes.

##### Pareceres e encerramento

**QA /root/f1_qa: BLOQUEADO**, após GO pré-op delimitado. Conferiu 38 hashes, FAIL, zero ACKs e restauração do gate por recibo, sem SQL pós-rodada. Inspecionou diretamente 21 IDs, cinco volumes, labels, rede sem endpoints e 12 portas sem listeners, exit0; digest estrutural `ff7c0f3407fdd11ff62d64346736cfc8d4055f7fa6fb74c6263267acfc0d476a`. Puros não substituem exercício real.

**Revisor /root/f1_revisor: BLOQUEADO**, sem achado aberto no candidato estático. Conferiu 38 hashes, resultado, setup e contenção, somente leitura, sem testes/Docker/SQL/escrita. Confirmou que o timeout impediu as asserções A2 e que o tempo HTTP é observação do Lead.

Perfis QA_V1/Revisor_V1 explicitamente reaplicados; três agentes no máximo, sem subdelegação. Lead único escritor/operador; inspeção QA de recursos só após contenção. Responsabilidades independentes em máquina/filesystem compartilhados, sem alegação de sandbox técnico por papel.

**Final:** 21 contêineres parados, restart no, cinco volumes retidos, rede original com zero endpoints e zero listeners nas 12 portas. Restauração CAS e SELECT confirmaram gate false/nonce NULL antes da parada. App próprio e filho encerrados após identidade PID/comando. Não houve reinício para SQL pós-STOP; não se alega auditoria SQL final independente com serviços parados. Histórico21 reconfirmado antes e nenhuma migração invocada nesta etapa.

Evidências novas em `.tmp/f2-ci-close/`: before/diff, candidatos, gates, run/preconditions, snapshots/consultas READ ONLY, attempt/result, retained-version-session/gate-restored, observed-timing, app-before-stop, final-resources/listeners-final e manifesto/patch final. Não contêm tokens/chaves nos proofs ou respostas de alunos.

**Único bloqueio operacional observado:** prazo de Page.navigate antes das asserções do último caso A2. Próximo passo mínimo: revisar o prazo frente aos 34,7s medidos, testar o ajuste e obter autorização para uma nova rodada delimitada a partir da seleção instalada/revisão 8 retida. Não exige novo ambiente, reinstalar 21 migrações ou repetir os 20 casos individuais anteriores por causa desse timeout. A persistência real da política ainda precisa ser demonstrada; ampliar prazo, isoladamente, não a homologa.

Nenhum ambiente antigo, curso pessoal, worktree anterior, remoto, produção ou Fly foi acessado. Só recursos do projeto novo foram selecionados; isso não equivale a auditoria dos ambientes de acesso proibido. Sem reset, seed, limpeza, migração, SQL/ACL/Auth de produto, contrato público, regra pedagógica, API paga, deploy, commit, push, PR ou merge. Logins sintéticos e setup local são os explicitados acima. **F2-CI — BLOQUEADO. STOP cumprido; sem continuidade para F3.**


## 13. F2 FINAL — homologação local suficiente para iniciar F3

Data: 24/10/2026. **PODEMOS INICIAR F3? SIM, para autoria do curso compilado.** O Último caso integrado A2 passou nesta execução, com persistência real e reload comprovados. A homologação é local e suficiente para começar a autoria; não aprova publicação, acesso remoto ou execução paga. F3 não foi iniciado. Os FAIL anteriores continuam históricos, com seus arquivos e resultados preservados.

### 13.1 Candidato e mudanças

Mesmo HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, worktree `D:/Documents/destrava-worktrees/destrava-release-clean`. Candidato **F2-FINAL-C3**, digest SHA-256 dos 38 caminhos `49634482399518ac4acc09473f1c5367226a8128e7677b001c7be77f1b8cbfb3`; manifesto `.tmp/f2-final/a1/candidate-c3.json`. Não é SHA de commit.

A autorização desta missão permitiu o ciclo completo de diagnóstico/correção/QA; substituiu o limite anterior de uma tentativa. Foi necessária **uma execução funcional nesta missão**, a1, exit0. C1/C2/C3 são revisões estáticas com controles puros antes da operação, não três jornadas de banco/browser.

| Arquivo alterado ou novo nesta missão | Mudança |
| --- | --- |
| `src/lib/installed-local-profile.ts` | Resolve primeiro o realpath do workspace, exige igualdade com a raiz autorizada e monta o path do script a partir desse valor validado. Conserva negação em produção, Windows/raiz exatos, pinos, perfil antigo, credenciais e prova Docker real sem cache permanente |
| `scripts/release-clean-final-policy.ts` e `.test.mjs` | Preservam a política estrita dos seis recursos; acrescentam comprovação do corpo da leitura real e correlação com pedido, estado, HTTP200 e reload. Respostas vazias, ausentes, inválidas ou de outro snapshot são rejeitadas |
| `scripts/release-clean-navigation.mjs` e `.test.mjs` | Prazo específico de 90s para Page.navigate; demais comandos continuam 30s. Fornecem ao browser/verificador a instrumentação para distinguir ACK, TTFB, fim da resposta e prontidão semântica, rejeitando métricas inválidas |

São três arquivos existentes modificados e dois novos. O executor/consultas/browser desta rodada ficam ignorados em `.tmp/f2-final/a1/`; não constituem novo mecanismo de ambiente. Não houve mudança de domínio pedagógico, contrato público, SQL/migração, ACL, Auth/RLS, autoridade ou configuração de produção. A rota local exercitada foi `http://127.0.0.1:3100/study`, seguida de `/dashboard`; a aplicação está encerrada na entrega.

### 13.2 Diagnóstico, prazos e standalone

O limite antigo de 30s para Page.navigate era menor que os 34,7s HTTP observados pelo servidor anterior. Nesta missão, a instrumentação distinguiu os tempos reais:

| Etapa desta execução | Medida |
| --- | --- |
| Navegação inicial /study | ACK CDP 10,171s; TTFB 10,159s; responseEnd 10,168s após timeOrigin; controle semântico pronto 3,555s depois do ACK |
| Servidor /study | 10,2s totais: 4,1s de compilação e 6,0s de aplicação, conforme log Next |
| Troca instalado → compilado | 33,789s do gesto ao controle pronto; /dashboard TTFB 14,110s; prontidão 9,728s depois do fim HTTP |
| Reload /dashboard | ACK 5,159s; TTFB 5,135s; novo documento/loader e nova leitura do backend comprovados |

O orçamento é finito: navegação 90s, prontidão 90s e janela funcional 120s conforme o caso congelado; não há retry automático ilimitado. A compilação inicial é uma explicação compatível com o timeout histórico, mas não foi isolada experimentalmente a contribuição de todas as causas nem reproduzida a mesma condição fria. O aceite se apoia nas asserções funcionais, ACKs e estado persistido, não no aumento do prazo.

**Standalone Windows corrigido neste build.** O path derivado da constante de drive Windows entrava no tracing como caminho relativo inválido. A refatoração mínima acima mantém a mesma raiz comprovada e removeu a emissão inválida observada: build Next16.3.8 exit0, 44 páginas, stderr sem ENOENT; inspeção de **48 NFT/6.350 entradas**, zero drive embutido, zero arquivo referenciado ausente e zero referência a .tmp/.env nos traces. `.next/standalone/server.js` existe. Não houve mudança em next.config, exclusão genérica de tracing ou enfraquecimento de guard.

A jornada atual usou o servidor dev local; não foi apresentada como smoke de servidor standalone nem imagem Linux. O empacotamento Windows foi verificado no artefato gerado, enquanto execução da imagem Linux e publicação permanecem na homologação futura de release.

### 13.3 Execução e resultados novos

Mesmo DBID `521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af`, volume `supabase_db_destrava-release-clean`, PostgreSQL17.6, SID `7699958133051768869`. Mesma rede `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`, cinco volumes e 21 contêineres retidos. API55421/DB55422/app3100/CDP9447 em loopback; seis publicações reais dos serviços em 127.0.0.1. Start somente pelos dez IDs aprovados, mecanismos F2-R/F1/C4, locks FileShare.Read e env filho restrito.

Comandos operacionais: `powershell -NoProfile -ExecutionPolicy Bypass -File .tmp/f2-final/a1/pinned.ps1 -Phase identity/build/dev/verify/post/stop`, cada fase chamada separadamente. Identity/post usam SQL READ ONLY/ROLLBACK; verify é a jornada sintética autorizada, com lease e restauração CAS do gate. Não foi invocada migração, seed, reset, repair ou supabase start. A coleta SQL anterior foi preservada em `a1/before-audit/` antes de gerar a posterior.

| Verificação executada | Resultado |
| --- | --- |
| Testes puros do Lead, Node/tsx | **97/97 PASS**: 30 perfil instalado, 21 scanner de arquitetura, 31 política de persistência, 15 navegação |
| Checker completo de arquitetura | Exit0; fronteiras, nove módulos de contratos sem ciclos e capacidades; exceção lexical estreita anterior preservada |
| TypeScript sem incremental; ESLint dos cinco fontes | Exit0 em ambos, zero avisos de lint |
| Build Next16.3.8 e inspeção dos traces | Exit0; empacotamento Windows observado corrigido, sem content:compile ou alteração dos pacotes ES/EN |
| Preflight físico e SQL | Mesmo SID, histórico21 exato, ACL verificada, gate false/NULL; seleção instalada revisão8; estado sintético retido conferido antes de testes |
| **Último caso integrado A2, a1** | **PASS/exit0**: flush falho conserva contexto e envia zero POST de seleção; recuperação envia um POST canônico; troca para compilado; owner alheio403 |
| Persistência compilada e reload | **Seis ACKs reais**, mesmo snapshot; novo loader/documento HTTP200; GET real não vazio corresponde ao hash e à UI restaurada; consulta independente confirma estado |
| SQL posterior e comparação offline | Exit0; seis projeções e invariantes delimitadas iguais ao esperado, gate restaurado, histórico21 preservado |

A rodada reutilizou a VersionSession `cb692bd8-5f9d-445b-931d-2f8a7555b61d`, a instalação V2 e a única StudySession `66d4b977-bb62-4498-8c31-f2f304255246`. Não criou outra StudySession/VersionSession, conta ou catálogo. A seleção terminou compiled/frecuencias-a1, revisão9. A referência de versão antiga continuou resolvendo o estado compartilhado da mesma instalação; não se afirma estado independente por VersionSession.

O clique normal no onboarding compilado avançou step0→1, preservou os dois eventos anteriores e acrescentou somente onboarding_step_completed/Idioma. Não criou nota, conclusão ou evidência pedagógica. As linhas normalizadas de progresso inicial não significam lições concluídas.

| Recurso persistido | Linhas esperadas/SQL | ACK HTTP |
| --- | ---: | ---: |
| user_course_state | 1 | 200 |
| user_course_profiles | 1 | 200 |
| study_events | 3 | 201 |
| lesson_progress | 11 | 201 |
| unit_progress | 1 | 201 |
| skill_progress | 6 | 201 |

Os seis recibos correspondem ao hash `ca47d5426a073ac11edb2c53754f8c4fce8d0d311d4127acfa04a4ca2c4abbe9`, correlacionados pelos IDs reais Network/Fetch. Seis preflights POST e dois GET delimitados concluíram HTTP200. A política continua exigindo origem3100, API55421, schema/headers, token/chave locais em memória, owner, curso, URL, conflito e corpo exatos. Preflight não autentica owner: a identidade é validada no pedido efetivo.

O reload teve loader novo `D7D40B5AA42195695A932D0759BBCF72`; GET `115724.125` iniciado depois do reload retornou uma linha com hash correspondente, step1. UI/cache isoladamente não seriam aceite. O GET Node posterior e os catálogos SQL corroboraram o estado. Houve **um bloqueio intencional de anúncio, zero bloqueios inesperados e zero eventos Runtime.exceptionThrown**. As RPCs não autorizadas continuam negadas; nenhum HTTP de sucesso foi fabricado.

As quatro evidências canônicas ficaram iguais; a projeção V1 coletada permaneceu igual. V2 manteve os campos de aprendizagem e a mesma sessão; a comparação funcional permitiu apenas duração/cursor/pausa da sessão alvo. Não se afirma imutabilidade de updated_at ou dos campos operacionais deliberadamente exercitados.

### 13.4 QA e Revisor independentes

**QA /root/f1_qa: FAVORÁVEL à suficiência local para iniciar F3 no recorte de autoria compilada.** Conferiu 38 hashes estáveis; auditoria direta por SQL READ ONLY/ROLLBACK, Docker por IDs, CIM nas 12 portas e correlação offline, todos exit0. Mesmo SID/histórico21/gate false/NULL; oito grupos do verificador ACL passaram, zero TRUNCATE de clientes nas 36 tabelas public, defaults do escopo seguros e RLS ativo. Confirmou seis projeções 1/1/3/11/1/6, step1/eventos3 sem delta de aprendizagem, seleção compilada revisão9, V1 coletada/revisão19 igual, V2 revisão13 com a mesma única StudySession (duração30), quatro evidências preservadas. Inspeção estrutural: mesmos 21 IDs e cinco volumes, seis listeners dos serviços em loopback, sem listeners app/CDP; F1 offline sobre snapshot fiel passou. Não leu Env/Cmd nem reexecutou browser. HTTP e reload são execuções do Lead corroboradas pelo QA. Digest SQL direto `b04c484f717a63d9ce9d594ee5c773b41b96b6f34f15af379e55ca4aec4b122a`; correlação offline `7f7458be388e784dfbb1aef775a7c57fe47b1df6cbe95cd589963cd7725a536c`.

Controles independentes antes da operação: no C1, 27 de navegação/ACK, 83 de política, 17 do handler CDP em VM e 53 de helper/guards passaram; três falhas de telemetria motivaram correção. No C2, 19 controles de telemetria passaram; no C3 final, 31 controles focais passaram e os 38 hashes foram conferidos. São grupos de revisões distintas, não somados como testes finais únicos, e não equivalem a HTTP/banco. Resultados por stdin/parecer, sem inventar logs TAP.

**Revisor /root/f1_revisor: FAVORÁVEL à suficiência local para autoria compilada F3 no recorte examinado.** Conferiu 38/38 hashes, fontes, ordem das asserções, traces, seis ACKs de um snapshot, reload com documento/loader e GET real correspondente, owner403, comparação SQL e build/tracing. Não executou testes, Docker ou SQL nem escreveu arquivos. Aceitou a reutilização histórica delimitada; não certificou causalidade exclusiva do timeout antigo, imagem Linux ou produção. Revisão documental final e encerramento constam do manifesto de entrega.

Perfis canônicos DESTRAVA_PROFILE_QA_V1 e DESTRAVA_PROFILE_REVISOR_V1 reaplicados por leitura explícita e briefing. Lead único escritor e operador de serviços/browser; QA teve janela sequencial READ ONLY; Revisor examinou os mesmos bytes congelados, sem testes/Docker/SQL/escrita. Sem subdelegação, três agentes no máximo. A independência é de responsabilidade/análise e execução delimitada; não se afirma sandbox técnico exclusivo por papel.

A avaliação independente fortaleceu o oráculo: UI ainda poderia exibir cache quando a leitura remota falhasse. Antes da operação, passaram a ser exigidos corpo real não vazio/hash correto, novo loader e pedido iniciado após reload. Controles encontraram métricas ausentes/NaN/invertidas e uma diferença de timeline; foram corrigidos no C2/C3 antes de executar. Esses achados de instrumentação não foram contados como defeitos do motor.

### 13.5 Capacidades suficientes e limites por caminho

| Caminho | Evidência aplicável | Alcance para F3 |
| --- | --- | --- |
| Isolamento/ACL | Histórico F2-R/F2-ACL preservado; reconferência live e SQL nesta missão | Mesmo ambiente e histórico21; TRUNCATE de clientes negado no domínio Destrava |
| Auth/MFA/RLS/Storage | Cinco grupos históricos da seção12, fontes relevantes preservados | Acesso e isolamento local comprovados nesse perfil; sem homologação remota |
| Compilado/B1/R1P2/B2 | 25 cenários históricos handlers em VM+Auth/SQL reais; 18 checks HTTP/browser/B2 | Recibos/CAS/replay e jornada compilada existentes; 25 cenários não são 25 jornadas HTTP |
| I7/I8 | 13 verificações individuais históricas; guards equivalentes testados de novo e prova live usada no A2 atual | Instalação/ativação/gates locais sintéticos; sem promessa de instalado em produção |
| A2 | Sete grupos individuais históricos mais Último caso integrado novo PASS | Troca controlada, flush/retry, owner/versão/instalação e persistência após reload comprovados |
| Atualização U1/U2 | Cinco checks históricos de ACK/hash e restauração V1 | Rejeição segura de estado incompatível; não é migração transparente de progresso |
| Código/artefato | Arquitetura/TypeScript/lint/testes/build novos; tracing Windows sem erro observado | Suficiente para autoria; imagem Linux e publicação ainda não homologadas |

A aplicabilidade histórica foi conferida contra hashes, contratos e fontes pertinentes. O único fonte de produto alterado nesta missão mantém a semântica do guard e foi revalidado com regressões e execução real. Resultados históricos não foram reapresentados como execuções novas; as suítes antigas com exit1 não foram rebatizadas como PASS.

**Limites para publicação, sem bloquear a autoria compilada F3:** os seis grants internos TRUNCATE do Storage continuam reais sob a ressalva local da seção11; nenhuma modificação interna foi forçada. O destino de release deverá reconferir versão/ACL e caminhos SQL. Imagem Linux, runtime standalone de release, configuração remota/Auth/segredos e deploy dependem de homologação/autorização próprias.

**Limites funcionais/editoriais:** fala Web Speech simulada/WAV local não certificam voz física, microfone ou qualidade acústica; não há aprovação editorial do novo curso nem geração paga executada. Para a primeira edição F3, congelar courseId/contentVersion/definitionHash; uma edição futura deve conservar a anterior consultável ou definir transição explícita antes de prometer continuidade. Nenhuma arquitetura COM-1B ou migração de progresso foi acrescentada.

### 13.6 Preservação, encerramento e decisão

**Encerramento observado pelo Lead:** app próprio encerrado após conferir PID/comando; browser próprio fechado pelo teste. Depois da devolução explícita da janela QA, somente os dez substitutos foram parados pelo wrapper pinado, exit0. Coletor final confirmou **21 contêineres retidos/parados com restart=no, cinco volumes preservados, rede original sem endpoints e zero listeners nas 12 portas**. Restauração CAS e leitura efetiva confirmaram gate **enabled=false, nonce=NULL** antes da parada; QA também o conferiu diretamente. O histórico continua com 21 migrações e todas as fixtures permanecem retidas. Não se alega auditoria SQL com banco parado.

Inventário inicial: 1.256 hashes; relatório anterior 108.112 bytes, SHA256 `61b5e4571ce0f9beeeceea2f9cc3512314b99483d3136b424a6e9b840ea0e21a`. O prefixo documental permanece byte a byte igual. Originais dos três fontes alterados foram arquivados e conferidos em `.tmp/f2-final/previous-sources/`; candidatos, resultados e artefatos anteriores foram preservados. Os dois fontes de navegação são novos. Manifesto final registra hashes, diff focalizado incluindo arquivos novos e append exato, sem staging ou commit.

Evidências principais em `.tmp/f2-final/`: before/before.patch; a1/candidate-c3; c3-code-gates e logs brutos; a1/preconditions, initial-timing, result/attempt, expected-projections, before-audit, identity/history/verify/retained/projections; comparison; build/tracing; gate-restored; recursos/listeners e delivery-manifest. Snapshots e proofs não imprimem valores de chaves/tokens ou respostas de alunos. Não se faz alegação de CI ou produção.

| Evidência local | SHA-256 |
| --- | --- |
| a1/result.json | `26cf6350bcf54f483e588e177b29f0484048fafccab918ed6a3b33497905fc79` |
| comparison.json | `fbf2a0e6255b2dde6d5dbf416f22b86113b55aa602ebddcc55c44c58805dea64` |
| tracing-result.json | `43c704bbf27b39b05cf432e97eb5e1141d541270f38d07d6928f6ebfbf53c7d1` |
| a1/gate-restored.json | `1da58c72724c96f78cd43b1e738b55f77444ca22cd6b4fb910564bb635d12c1e` |
| final-resources.json | `6a4a1eddf31d07fd6ba90df0e1c58f73be613f0a941b1c56b946fbacb4d6cc2f` |
| listeners-final.json | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

Não houve acesso a espanhol-plataform, cursos pessoais ES/EN, worktrees antigas, produção, Supabase remoto, Fly ou API paga. Essa preservação é sustentada pelo escopo restrito dos comandos; não implica inspeção de ambientes proibidos. Sem novo ambiente, instalação das 21 migrações, reset, limpeza de fixtures/volumes, seed, alteração de ACL/contrato/política ou commit/push/PR/merge/deploy.

**Decisão consolidada: F2 — HOMOLOGAÇÃO LOCAL SUFICIENTE PARA INICIAR F3. PODEMOS INICIAR F3? SIM**, para preparar a primeira edição compilada do novo curso espanhol A1 dentro do contrato existente. Não há bloqueio local aberto desta missão para essa autoria. A execução de F3, seus custos e a futura publicação permanecem sujeitos às respectivas autorizações; nada foi iniciado automaticamente.
