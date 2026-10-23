# ES-A1 — Tarefas propostas de composição motor + piloto

**Estado (23/10/2026): P0 completo por leitura; COM-0 completo por 21 SELECT em cinco transações READ ONLY no PostgreSQL local autorizado, classificação `parcial/divergente`.** Evidências: [P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md), [COM-0](RELATORIO_COM0.md), [spec](spec.md) e [plano](plan.md). COM-1 ainda **não autorizado**. Nenhuma implementação, escrita ou migração foi feita.

| ID | Gate | Tarefa verificável | Estado |
| --- | --- | --- | --- |
| **COMP-T00** | P0 | Auditar migrações e protocolo geração/B1, A2/B2, conteúdo ES/EN e worktrees | **Relatado concluído em leitura; não homologado em runtime** |
| **COMP-T01** | Docs | Registrar relatório P0, invariantes, alternativas e critérios COMP-01…16 em PR documental | **Integrado via PR #8 (`df17c5d8`)** |
| **COMP-T02** | COM-0 | Autorizar e identificar precisamente banco de destino, privilégios e método estritamente read-only | **Concluído: autorização específica para Supabase local, ambiente/identidade confirmados** |
| **COMP-T03** | COM-0 | Consultar schema, histórico e grants por leitura; classificar reset-only/B1-only/ambos/novo/parcial | **Concluído por 21 SELECT, 5 transações READ ONLY com ROLLBACK; `parcial/divergente`** |
| **COMP-T04** | COM-0 | Entregar diferença do estado real versus proposta SQL, sem modificar dados | **Concluído: [RELATORIO_COM0.md](RELATORIO_COM0.md), nenhuma escrita/teste funcional** |
| **COMP-T05** | COM-1 | Congelar desenho de geração, lock comum, MFA/owner, writer service_role e CAS/idempotência | **Proposta, não implementada** |
| **COMP-T06** | COM-1 | Projetar reset versionado, ACK perdido, Storage e proteção de I8 sem apagar ledger/EN | **Proposta, não implementada** |
| **COMP-T07** | COM-1 | Projetar migração de convergência nova/única para estado local `parcial/divergente`, grants/índices/RPCs e rollback | **Inventário COM-0 disponível; projeto/SQL ainda não aprovados** |
| **COMP-T08** | COM-1 | Definir escopo B1 por versão/hash/geração, replays e leitura/paginação/recovery | **Proposta, não implementada** |
| **COMP-T09** | COM-2 | Compor writer/geração/reset e RPC segura em worktree nova isolada | **Não autorizado** |
| **COMP-T10** | COM-2 | Compor provider, caches, callbacks, rotas, repositórios, I8/A2, versionamento, sem regredir B1/B2 | **Não autorizado** |
| **COMP-T11** | COM-2 | Trazer seletivamente acervo ES e 21 roteiros mantendo código `main` e EN intacto | **Não autorizado** |
| **COMP-T12** | COM-3 | QA independente para COMP-01…16, SQL/Auth/MFA/RLS, HTTP/browser, ABA/ACK/CAS/reset e regressões | **Não executado** |
| **COMP-T13** | COM-3 | Revisor em candidato congelado, evidências e riscos; relatório GO/AJUSTES/NO-GO | **Não executado** |
| **COMP-T14** | COM-3 | PR funcional própria, sem merge/deploy/migração por inferência | **Não autorizado** |
| **COMP-T15** | COM-4 | Confirmar versão e execução do curso pessoal ES real, sem duplicá-lo | **Não autorizado** |
| **COMP-T16** | P1 | Começar bloco U2 de explicação recuperável e feedback contextual após integração segura | **Fora do escopo desta composição** |
| **COMP-T17** | COM-1 | Especificar tratamento da constraint `generation <= 9007199254740991` e consulta agregada mínima sobre valores incompatíveis **sem executá-la** | **Pendente; nova autorização de dados necessária para consultar** |
| **COMP-T18** | COM-1 | Projetar revogação explícita de `TRUNCATE`, checar grants/herança e definir testes negativos | **Prioridade de segurança — não implementada** |
| **COMP-T19** | COM-1 | Registrar plano para limitar publicação da porta Docker, distinguindo bind em todas as interfaces de exposição real | **Pendente de desenho/avaliação de rede, sem alteração autorizada** |
| **COMP-T20** | Docs | Registrar COM-0 em PR Markdown e atualizar ordem de gates | **Em revisão; não integrada** |

## STOPs

- Mesmo número de migração `20261022000100` com textos diferentes: **nenhum repair/aplicação/renomeação automáticos**.
- Falta de geração em RPC, fast-path HTTP, leitura ou cache é **falha de segurança da composição**.
- Reset e writer sem lock comum/escopo transacional, mesmo com RLS correto, não atendem COMP.
- **COM-0 local `parcial/divergente`:** objetos presentes mas histórico incompleto, constraint de geração diferente. Revisar e pedir aprovação antes de SQL. **Sem retorno automático a COM-0**.
- **TRUNCATE concedido a `anon`/`authenticated`** nas sessões interativas é achado de segurança; RLS não se aplica a TRUNCATE. Planejar revogação/testes sem executar nesta PR.
- Dados legados sem geração, privilégio excessivo, schema remoto ou versão pessoal divergente = STOP e decisão separada.
- A autorização de SELECT do COM-0 **terminou**. Não reler o banco, consultar valores agregados, alterar Docker/rede, gravar estado, migrar, resetar, criar worktrees, alterar pilotos ou gastar em provedores por ter mesclado documentação.
- Cada PASS futuro exige SHA, comando, ambiente e evidência. Resultado histórico ou simulado deve ser classificado explicitamente.
