# COM-0 — inspeção do schema local para composição ES-A1

> **Estado em 23/10/2026: SCHEMA CONFERIDO — `parcial/divergente`, segundo relatório do Codex entregue pelo proprietário.** A inspeção ocorreu de **16:24 a 16:28 UTC**, com autorização específica de leitura do **PostgreSQL local**. Este documento registra o relatório recebido; o ChatGPT verificou a baseline da `main` no GitHub, mas **não reproduziu as consultas nem recebeu os logs SQL brutos**. Nenhum efeito operacional está autorizado por este registro.
>
> **Fonte:** relatório textual COM-0 apresentado pelo proprietário no chat em 23/10/2026. Omitimos apenas prefixo do ID transitório do container, sem alterar os achados; não há exportação de credenciais ou dados de usuários. Relatórios anteriores: [P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md), [auditoria do acervo ES](../piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md). Requisitos e decisões propostas em [spec](spec.md) e [plano](plan.md).

## 1. Ambiente identificado e limites da execução

| Item | Evidência relatada |
| --- | --- |
| Baseline da `main` | `df17c5d8adeb337ac886876183194e946b446a8a`, merge documental PR #8 |
| Projeto/serviço | `espanhol-plataform`; Docker Desktop, contexto `desktop-linux` |
| Contêiner | `supabase_db_espanhol-plataform`, identificado por labels de projeto/workdir e guard existente |
| PostgreSQL | **17.11**; database `postgres`, role `postgres` |
| Destino | Porta local `127.0.0.1:54322` mapeada ao PostgreSQL `5432` do contêiner; acesso efetivo via `docker exec … psql` e socket do contêiner |
| Condições | **5 transações `REPEATABLE READ READ ONLY`**, terminadas com `ROLLBACK`; `transaction_read_only=on` comprovado pelo Codex |
| Consultas | **21 SELECT (Q01–Q21)**, metadados exclusivamente; nenhuma função de aplicação invocada |
| Não acessado | Fly.io, Supabase remoto, outros provedores, dados pessoais, respostas/áudios/progresso individual |

**Observação operacional:** publicação de porta Docker mapeada para `0.0.0.0` e `::`, não exclusivamente loopback. **Não foi testada exposição pela rede**; não presumir conectividade externa ou brecha explorável. Reavaliar regra de rede/publicação de porta como tarefa futura autorizada; não modificar configuração nesta PR.

## 2. Histórico de migrações

O Codex encontrou **20 registros** em `supabase_migrations.schema_migrations`. Recorte relevante:

| Versão | Nome no histórico |
| --- | --- |
| `20261004000100` | `interactive_lesson_sessions` |
| `20261010000100` | `assessment_semantics` |
| `20261010000200` | `learning_policies` |
| `20261010000300` | `course_installations` |
| `20261011000100` | `installed_study_runtime` |
| **`20261022000100`** | **`interactive_segment_evidence`** |

Outros **14 registros**, de `20260930000100` a `20261003000700`, compõem a cadeia anterior. A entrada `20261022000100` contém **12 statements** associados a recibos B1, **sem referência a `user_learning_generations`**. **Nenhuma entrada `learning_reset_generation`** foi identificada.

**Achado-chave:** tanto objetos do reset quanto objetos B1 existem no schema, mas o histórico **só registra B1**. **Não foi demonstrada a origem, ordem nem método de aplicação dos objetos de reset.** Não fabricar histórico, alterar `schema_migrations`, renomear arquivos aplicados ou reaplicar cegamente qualquer uma das migrações de origem.

## 3. Inventário dos objetos e divergências

| Área | Estado constatado por inspeção local relatada |
| --- | --- |
| Reset/geração | `user_learning_generations`, `learning_generation()` e `learning_write_allowed(uuid)` presentes |
| Políticas legadas | **66** políticas restritivas de escrita em **22** tabelas públicas; **3** políticas de geração em `storage.objects` |
| **Constraint divergente** | Banco: apenas `generation >= 0`; arquivo do piloto: `generation >= 0` **e** limite superior **`9007199254740991`** |
| B1 | `definition_hash`, `interactive_lesson_receipts` e escritor privilegiado presentes |
| Unicidade B1 | `(user_id, course_id, lesson_id)`, **sem geração nem versão na chave** |
| Recibos B1 | PK `(session_id, attempt_id)`; FK para sessão com `ON DELETE CASCADE` |
| I7/I8 | **11 tabelas privadas** presentes, inclusive seleção, progresso, operações e evidências |
| Storage | Buckets privados `course-artifacts` e `speaking-audio` |

No recorte, foram examinadas **103 colunas, 85 constraints e 22 índices**: constraints `VALIDATED`, índices válidos/prontos segundo metadados. Isso **não** certifica conformidade com o protocolo futuro.

**Funções:** os corpos de **41 funções I7/I8/B1** conferidos coincidem com arquivos SQL da `main` após normalização de finais de linha/espaços externos; os **2 helpers de geração** coincidem com arquivo atual do piloto. A reconferência relatou hashes preservados de **45 funções** no recorte. A constraint diferente permanece divergência real.

## 4. Segurança e integridade — achados prioritários

### 4.1. Writer privilegiado fora da proteção de geração

- Reset: helper `learning_write_allowed()` adquire trava por usuário com seed `731984` **antes** de ler `generation/resetting`.
- B1: escritor adquire trava por `user + course + lesson`, seed `0`, **sem** receber/consultar geração/resetting.
- Writers I7/I8 examinados tampouco fazem a verificação de geração exigida pelo futuro protocolo.
- As funções privilegiadas executam com autoridade que pode contornar RLS; políticas de `authenticated` **não** substituem validação dentro do escritor.
- Retorno rápido de recibo, leitores, paginação e replay também precisam respeitar geração/owner/versão; a leitura do COM-0 não constitui teste da correção desse fluxo.

**Risco derivado:** uma operação de geração antiga pode escapar da barreira de reset no writer privilegiado. **Incompatibilidade de código/schema confirmada; corrida ou incidente efetivo não reproduzido.** Requer desenho único de transação e testes negativos antes de compor o piloto.

### 4.2. Grants e privilégios

- Sessões B1: leitura por proprietário, MFA restritiva, `INSERT/UPDATE/DELETE` negados a `anon`/`authenticated`.
- Recibos: sem acesso direto desses papéis; `service_role` pode consultar.
- 11 tabelas privadas: RLS ativo, sem privilégios diretos nem acesso ao schema para papéis de aplicação examinados.
- **21 RPCs públicas I7/I8/B1:** `SECURITY DEFINER`, `search_path` vazio e `EXECUTE` restrito a `service_role` entre papéis examinados.
- Triggers de imutabilidade relevantes permanecem habilitados.
- **ALERTA DE SEGURANÇA:** `anon` e `authenticated` possuem privilégio **`TRUNCATE`** nas sessões interativas. `TRUNCATE` não é restringido por RLS. Esse fato de catálogo **não prova rota HTTP explorável**, execução destrutiva ou exposição remota.

**Ação proposta, ainda não executada:** incluir revisão da concessão efetiva e herança/owners/grants padrão e **revogação explícita de `TRUNCATE`** na futura especificação de migração segura, com testes negativos de acesso; não operar no banco sob a autorização COM-0 já encerrada.

## 5. Consultas Q01–Q21, efeito e limites

| Grupo | Objetivo dos metadados |
| --- | --- |
| Q01–Q04 | Identidade, modo de transação, objetos e histórico |
| Q05–Q07 | Colunas, constraints e índices |
| Q08–Q11 | RLS, funções, grants, schemas e roles |
| Q12–Q16 | Corpos/ACL das RPCs, triggers, dependências e grants de coluna |
| Q17–Q20 | Configuração dos buckets, RLS e ACL padrão |
| Q21 | Reconferência do histórico e hashes das funções |

Segundo o relatório: **somente 21 SELECT em 5 transações READ ONLY com ROLLBACK**. **Nenhum arquivo, código, conteúdo, worktree, configuração ou dado modificado**; sem login/HTTP/browser/testes funcionais, chamadas IA/voz ou inspeção de conteúdo pessoal. Não há logs Q01–Q21 anexados a esta PR, portanto esta evidência é documental e atribuída ao Codex.

## 6. Classificação, proposta e questões não resolvidas

**Resultado COM-0: `SCHEMA CONFERIDO — parcial/divergente`.** Os dois conjuntos de objetos estão presentes, mas a proveniência do reset é indeterminada, a constraint tem diferença real e a autorização para inspecionar dados foi limitada a metadados.

**Recomendações do relatório, para aprovação posterior:**

1. Tratar este **destino específico** como `parcial/divergente`; não presumir que outro banco/ambiente reproduza seu estado.
2. Propor convergência **por migrações novas com IDs únicos**, precondições por objeto e **STOP** ante estado inesperado; não reaplicar originais nem manipular histórico.
3. Reconstruir proveniência possível do reset por evidência não destrutiva; documentar o que não pode ser determinado.
4. Para decidir limite da geração, propor **consulta agregada mínima de valores incompatíveis**, somente com **nova autorização explícita**. Não usar dados pessoais nem inferir que todos os valores são válidos.
5. Desenhar writer/reset sob trava de usuário comum, validação de geração/transação, idempotência de retry, CAS para operações novas, leitor/replay versionado e proteção de I8.
6. Redesenhar em conjunto chave de sessão B1, índices, RPCs, `ON CONFLICT`, leitores e legado sem geração.
7. Corrigir no desenho de SQL os grants excedentes (`TRUNCATE`) e revisar roles/default privileges; verificar separadamente mapeamento das portas Docker.
8. Solicitar revisão independente de segurança, testes locais autorizados e aceite de SQL **antes de qualquer aplicação**.

**Decisões pendentes:** regra de proveniência sem inventar histórico; tratamento de dados legados sem geração; política para geração fora de limite; revogação de privilégios sem quebrar leitura/execução autorizadas; modelo de sessão versionado; autorização separada para dados agregados, implementação, testes escritores, migração e eventual publicação. O curso ES-A1 permanece em espera de composição técnica segura; a U2 não começou.

**Não autorizado por este relatório ou sua PR:** COM-1 como execução automática, novas consultas locais/remotas, execução SQL/DDL/DML, `migration repair`, reset, alteração de rede, rebase de worktrees, código, migrações ou deploy.
