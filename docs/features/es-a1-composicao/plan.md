# ES-A1 — Plano de composição segura motor + piloto pessoal

**Estado em 23/10/2026: P0 concluído por leitura; COM-0 concluído com metadados SQL locais; COM-1 entregou desenho estático com `DECISÕES PENDENTES`.** Fontes: [P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md), [COM-0](RELATORIO_COM0.md), [COM-1](RELATORIO_COM1.md), [cinco diretrizes aprovadas para especificação](DECISOES_COM1.md), [matriz SQL preliminar](MATRIZ_ALTERNATIVAS_SQL_COM1.md), [spec](spec.md), [tarefas](tasks.md). O PostgreSQL local foi classificado `parcial/divergente` no COM-0; **nenhuma composição foi implementada**. Baseline estática do COM-1: `1b1b27908f3babb89b04dac222ed5bbcee7f1ca1`. Esta PR **somente documenta**, sem autorização de novas consultas, código, SQL, worktree, migração, reset ou deploy.

## O que preservar

- Motor da `main` é fonte do runtime A1/B1/A2/B2, I8, Auth/MFA/CAS, TTS e repositórios. **Não copiar** implementações antigas do piloto sobre esse motor.
- ES compilado pessoal é fonte editorial do curso `espanhol-a1-pessoal`: HEAD `8cf0557` no P0. EN pessoal HEAD `b0ce81f` e variantes/editoriais do EN devem permanecer intactos. A duplicação semântica de 30 arquivos ES no checkout EN não dá permissão de sobrescrever nenhum deles.
- 20 worktrees/249 pendências foram preservados segundo relatório local P0. Inventário novo deve ser **somente leitura**, sem `git clean`, reset, stash, rebase ou checkout dos branches existentes; worktrees funcionais novos exigem autorização.
- **Schema/metadados locais foram conferidos em COM-0**, mas histórico de origem do reset segue indeterminado e migração registrada só para B1. Versão pessoal no Fly/Supabase remoto, schema remoto, dispositivos e vozes não foram verificados; não alegar produção pronta.

## COM-0 — histórico da inspeção já realizada; não repetir automaticamente

**COM-0 foi autorizado pelo proprietário especificamente para leitura do PostgreSQL local `espanhol-plataform` e foi encerrado**, conforme [relatório COM-0](RELATORIO_COM0.md). Ambiente relatado: PostgreSQL 17.11, porta local 54322, contêiner identificado, transações `REPEATABLE READ READ ONLY` encerradas com `ROLLBACK`. **Classificação: `parcial/divergente`.** As instruções abaixo permanecem como critérios históricos de inspeção, **não** novo comando nem nova permissão.

1. Confirmar ambiente, host/porta, papéis e identidade do banco antes de qualquer consulta, sem revelar credenciais e sem iniciar serviços que apliquem migrações/seeds ou modifiquem banco.
2. Com acesso de leitura explicitamente autorizado, inspecionar por `SELECT`/catálogos `pg_catalog`/`information_schema`: histórico de migrações, nomes e estado de `user_learning_generations`, sessões e recibos B1, dados I8 privados, Storage, índices/constraints/FKs/cascatas, RLS/ACL/grants, assinaturas e corpos de RPC `SECURITY DEFINER`, proprietários e `search_path`.
3. Classificar estado real: **reset-only**, **B1-only**, **ambos**, **novo** ou **parcial/divergente**. Identificador `20261022000100` por si só **não comprova** nenhum objeto. `IF NOT EXISTS` não é teste de equivalência.
4. **Entregue:** [relatório COM-0](RELATORIO_COM0.md), com 21 SELECT Q01–Q21, cinco transações somente leitura, 20 registros de migração, objetos reset e B1 presentes, apenas B1 no histórico, constraint divergente e grant `TRUNCATE` remanescente. **Nenhuma correção realizada**; estado divergente exige desenho e autorização para qualquer alteração.
5. Nenhum `supabase db push/pull` escritor, `migration repair`, reset, `ALTER`, `UPDATE`, `INSERT`, `DELETE`, `GRANT`, alteração de Storage ou migração em COM-0.

## COM-1 — desenho técnico entregue por análise estática; decisões detalhadas pendentes

**COM-1 já foi autorizado separadamente e executado somente por análise de arquivos**, conforme [relatório](RELATORIO_COM1.md). Seu parecer foi **`DECISÕES PENDENTES`**: o protocolo foi desenhado, mas falta fechar matriz por objeto, continuidade do inglês, áudio histórico e opções in-place versus `_v2`. As diretrizes [COMP-AD01…05](DECISOES_COM1.md) foram aceitas como **premissas de revisão**, não como SQL/contratos finais. O detalhamento histórico abaixo deve ser lido como requisitos, **não como novo comando**. O COM-1 não acessou o banco, alterou worktrees ou executou código:
- Identidades distintas `G`, época local, owner/curso/origem, `contentVersion`/`definitionHash`, sessão, tentativa/`operationId`, revisão CAS.
- Writer B1 e reset usam mesma trava **por usuário**; validação da geração `G` e `resetting` na transação privilegiada. Helper `SECURITY DEFINER` com autoridade explícita e restrita, não confiar em `auth.uid()` do service_role.
- Antes do CAS, recuperar recibo **idêntico e válido** sob geração/versão/owner; ACK perdido não cria novo efeito. Mesmo ID/payload divergente conflita.
- Incluir checagem de geração/escopo em retorno antecipado de recibo, leituras/paginação, caches, recovery, projeções privadas I8 e callbacks. Nunca tornar registros sem geração prova da geração atual.
- Reset administrativo **ainda não identificado como código canônico** precisa de definição versionada `operationId`/freeze/geração/Storage; retry administrativo idêntico recupera mesmo resultado, e falha mantém escrita bloqueada. Não mexer no ledger/catálogo I7/EN.
- Escopo B1 proposto `usuário + G + curso + lição + contentVersion + definitionHash`. Índices, unicidade, `ON CONFLICT`, RPC, leitura e respostas devem ser consistentes. Editar U2 modifica hash de sessão U1: criar novo escopo sem promover comprovantes antigos; `contentVersion` ES muda, **não** a geração global.
- **Destino local selecionado = `parcial/divergente`:** ambos os conjuntos de objetos existem, mas histórico da versão `20261022000100` registra somente B1; constraint de geração tem `generation >= 0` sem teto `9007199254740991`. **Propor versões SQL novas/únicas para esse estado reconhecido**, condicionadas a precondições de catálogo e tratamento explícito da proveniência não rastreada. `IF NOT EXISTS` ou `migration repair` inferencial não bastam.
- **Condição agregada futura:** definir consulta mínima para detectar gerações acima de `9007199254740991` **sem executá-la**; nova autorização específica será requerida se essa verificação for indispensável antes do DDL.
- **Privilégio P0:** `anon`/`authenticated` têm `TRUNCATE` na tabela de sessões, apesar de DML bloqueado; desenhar **revogação explícita**, inspecionar grants efetivos/herdados/default privileges e prever negativos de acesso, sem afirmar exploração HTTP.
- **Porta P1 operacional:** bind Docker em `0.0.0.0` e `::`, não restringido a loopback; documentar risco e plano de confinamento, **sem testar exposição de rede nem alterar Docker** sem permissão.
- **Convergência SQL por migrações novas e únicas**, sem renomear/marcar aplicados os originais; estado inesperado exige STOP.

Contratos públicos, DDL, RLS/grants, migrações locais e mudanças reais de código exigem escopo e permissão futuros específicos; plano não equivale a aprovação desses comandos.

## COM-1B — próximo gate PROPOSTO: concluir a matriz e as escolhas de arquitetura

**Não autorizado a executar por esta PR.** Depois de revisar/mesclar os documentos do COM-1, o proprietário poderá autorizar **investigação e proposta exclusivamente estáticas** para:

1. Completar a [matriz SQL por tabela](MATRIZ_ALTERNATIVAS_SQL_COM1.md): esquema/FKs/PKs/grants de fonte comprovável, titular do dado, `G`/versão, RLS, legado, EN, testes e rollback. Comparar **in-place**, **`_v2`** e **híbrida** por objeto, com justificativa para cada escolha. Não criar seis tabelas `_v2` por padrão.
2. Definir critérios de adoção ou exclusão **lógica** de dados legados sem geração; preservar o histórico físico e não inventar nota, evidência ou promoção à `G` atual.
3. Demonstrar um **plano de continuidade funcional do inglês** para o mesmo banco compartilhado (antes/depois da desativação dos writers V1); não basta conservar bytes. Plano e cenários, **não testes executados** nesta etapa.
4. Definir política segura de acesso owner-only a áudio histórico e novos downloads, com TTL de URLs previamente assinadas e papel do reset. Manter reset administrativo desabilitado enquanto não for viável.
5. Especificar preflight de esquema local divergente, histórico não atribuído, consulta agregada do teto, `TRUNCATE`, lock/recibo/paginação; separar scripts ilustrativos de DDL proposta ainda não aprovada.
6. Entregar conclusão **`DESENHO PRONTO PARA PEDIR EXECUÇÃO`** ou **`DECISÕES AINDA PENDENTES`** e delimitar autorizações SQL, local sintético, worktrees, code/QA e publicação.

**Proibido:** banco local/remoto, credenciais, novas consultas (inclusive agregados), alterações de arquivos/código, migrações, reset, mudança de rede, testes escritores, criação de worktrees/PR funcional, custo pago ou deploy sem outra autorização.

## COM-2 — Composição controlada (futura autorização separada)

1. Inventariar worktrees e criar candidato isolado **só após autorização**; Lead fixa interfaces, arquivos/owners e hashes, QA e Revisor independentes.
2. Tratar schema/geração/escritor sob gates e permissões separados para banco local, com rollback que não reduz `G` nem reabre DML direto.
3. Integrar provider, repositórios, APIs, leitura/replay, A2 e I8 sem regressão. Exigir negativo de reset concorrente, ACK perdido, corrida ABA, versão, Auth/MFA e Storage.
4. Incorporar curso ES e 21 roteiros anotados **se compatíveis**, preservando B1/B2 e os 52 roteiros EN privados. Não confundir 44 escutas ES com transcrição secreta; não habilitar IA/voz/SRS/aula instalada por inferência.
5. Sem remodelar a U2 nesta fase; a melhoria editorial começa em P1 **depois da composição comprovada**.

## COM-3 — QA, Revisor e PR funcional (futuros)

QA deriva COMP-01…COMP-16 da [spec](spec.md); prova casos de auth/roles/RLS, reset x writer, retries e payload divergente, CAS, replay/leitura com geração, paginação, Storage, efeito no hash U1 quando U2 muda, EN intacto, A1/B1/A2/B2 e idioma sintético. Separar testes puros, SQL/Auth local, HTTP/browser real, 360/390, lint, TypeScript e build, anotando **PASSOU/FALHOU/PARCIAL/BLOQUEADO/NÃO EXECUTADO**.

Revisor verifica candidato congelado, privilégios, hashes, SQL e negativos. Só após autorização própria: PR funcional, merge e **eventual** operação de banco/deploy em marcos independentes.

## COM-4 — Retorno ao curso pedagógico (futuro)

Depois da composição tecnicamente homologada, iniciar a **fatia vertical U2**: `En mi calle hay ___ tiendas`, explicação pública recuperável, feedback editorial específico **após submissão**, variedade progressiva e sem gabarito público. Resposta digitada não submetida permanece somente no estado temporário do exercício.

Continuar com o **mesmo curso pessoal**, sem duplicação de ambiente estável por histórico experimental. Não publicar ou resetar sem autorização operacional.

## Gates de passagem

| Passagem | Condição exigida |
| --- | --- |
| P0 → COM-0 | **Concluído por COM-0 local**, após PR #8 integrada e autorização própria; ambiente identificado e SELECTs somente leitura conforme relatório |
| COM-0 → COM-1 | **Concluído:** COM-1 foi autorizado e entregue por análise estática; relatório `DECISÕES PENDENTES`. Não herdou acesso ao banco do COM-0 |
| COM-1 → COM-1B | **Próxima proposta:** depois de PR documental revista/mesclada e autorização específica de leitura de código, fechar matriz/legado/EN/áudio; sem novas consultas SQL |
| COM-1B → COM-2 | Exigir desenho completo e aprovado **por objeto**, continuidade funcional EN, áudio/Storage, SQL/grants/TRUNCATE/legado e QAs definidos; novas autorizações separadas de worktrees, código, SQL e testes escritores |
| COM-2 → COM-3 | Candidato reproduzível e negativos executáveis |
| COM-3 → COM-4 | QA/Revisor e decisões de PR/merge/ambiente aprovadas independentemente |
| COM-4 → P1 | Caminho pessoal ES validado e autorização editorial funcional específica |

**Nenhuma etapa futura é automaticamente autorizada pela integração desta documentação.** COM-0 foi leitura local já encerrada; COM-1 entregou somente desenho estático. A `main` não recebe migração/código por mesclar documentos, o schema remoto não foi examinado, o cutover EN não foi comprovado e a U2 pessoal permanece não reformulada.
