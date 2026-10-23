# ES-A1 — Tarefas propostas de composição motor + piloto

**Estado (23/10/2026): PR DOCUMENTAL EM PREPARAÇÃO, sem autorização funcional.** Ver [spec](spec.md), [plano](plan.md) e [relatório de leitura P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md). P0 encerrou planejamento por leitura com **PLANO SUFICIENTE**, mas não executou banco, navegador ou código de composição.

| ID | Gate | Tarefa verificável | Estado |
| --- | --- | --- | --- |
| **COMP-T00** | P0 | Auditar migrações e protocolo geração/B1, A2/B2, conteúdo ES/EN e worktrees | **Relatado concluído em leitura; não homologado em runtime** |
| **COMP-T01** | Docs | Registrar relatório P0, invariantes, alternativas e critérios COMP-01…16 em PR documental | **Em revisão; não mesclado** |
| **COMP-T02** | COM-0 | Autorizar e identificar precisamente banco de destino, privilégios e método estritamente read-only | **Pendente de permissão do proprietário** |
| **COMP-T03** | COM-0 | Consultar schema, histórico e grants por leitura; classificar reset-only/B1-only/ambos/novo/parcial | **Pendente, nenhum SQL executado** |
| **COMP-T04** | COM-0 | Entregar diferença do estado real versus proposta SQL, sem modificar dados | **Pendente** |
| **COMP-T05** | COM-1 | Congelar desenho de geração, lock comum, MFA/owner, writer service_role e CAS/idempotência | **Proposta, não implementada** |
| **COMP-T06** | COM-1 | Projetar reset versionado, ACK perdido, Storage e proteção de I8 sem apagar ledger/EN | **Proposta, não implementada** |
| **COMP-T07** | COM-1 | Definir migrações novas/únicas, índices, RPC/overloads, grants/RLS e rollback seguro | **Necessita inventário e aprovação de SQL** |
| **COMP-T08** | COM-1 | Definir escopo B1 por versão/hash/geração, replays e leitura/paginação/recovery | **Proposta, não implementada** |
| **COMP-T09** | COM-2 | Compor writer/geração/reset e RPC segura em worktree nova isolada | **Não autorizado** |
| **COMP-T10** | COM-2 | Compor provider, caches, callbacks, rotas, repositórios, I8/A2, versionamento, sem regredir B1/B2 | **Não autorizado** |
| **COMP-T11** | COM-2 | Trazer seletivamente acervo ES e 21 roteiros mantendo código `main` e EN intacto | **Não autorizado** |
| **COMP-T12** | COM-3 | QA independente para COMP-01…16, SQL/Auth/MFA/RLS, HTTP/browser, ABA/ACK/CAS/reset e regressões | **Não executado** |
| **COMP-T13** | COM-3 | Revisor em candidato congelado, evidências e riscos; relatório GO/AJUSTES/NO-GO | **Não executado** |
| **COMP-T14** | COM-3 | PR funcional própria, sem merge/deploy/migração por inferência | **Não autorizado** |
| **COMP-T15** | COM-4 | Confirmar versão e execução do curso pessoal ES real, sem duplicá-lo | **Não autorizado** |
| **COMP-T16** | P1 | Começar bloco U2 de explicação recuperável e feedback contextual após integração segura | **Fora do escopo desta composição** |

## STOPs

- Mesmo número de migração `20261022000100` com textos diferentes: **nenhum repair/aplicação/renomeação automáticos**.
- Falta de geração em RPC, fast-path HTTP, leitura ou cache é **falha de segurança da composição**.
- Reset e writer sem lock comum/escopo transacional, mesmo com RLS correto, não atendem COMP.
- Dados legados sem geração, privilégios divergentes, schema remoto ou diferença de versão pessoal = STOP e decisão separada.
- Não gravar estado, migrar, resetar, criar worktrees, alterar pilotos ou gastar em provedores por ter mesclado documentação.
- Cada PASS futuro exige SHA, comando, ambiente e evidência. Resultado histórico ou simulado deve ser classificado explicitamente.
