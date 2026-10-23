# COM-1 — Matriz de alternativas SQL (levantamento inicial)

> **Status: MATRIZ PRELIMINAR, NÃO FECHADA.** Derivada da análise **estática** do [relatório COM-1](RELATORIO_COM1.md), do [COM-0](RELATORIO_COM0.md) e da [decisão arquitetural](DECISOES_COM1.md). O proprietário aprovou comparar as alternativas, **não escolheu tabelas `_v2` nem DDL**. **Nenhum SQL foi executado ou banco consultado** para preparar esta matriz.
>
> Esta tabela oferece uma **lista de perguntas por objeto**, não uma especificação de colunas/PK/FK pronta para aplicar. A matriz final deverá conter metadados/assinaturas exatos (com origem e evidência), chaves e índice atual/futuro, donos de escrita/leitura, contexto `G`/versão/origem, histórico, ACL/RLS, reset/Storage, provas de continuidade EN e rollback. Fonte de verdade técnica: schemas e código efetivamente inspecionados em COM-1B, com limites do COM-0.

## 1. Estratégias candidatas: não escolher antes da análise por objeto

| Alternativa | Benefícios possíveis | Custos/riscos relevantes | Gate para considerar segura |
| --- | --- | --- | --- |
| **A — Evoluir tabelas atuais** | Menos cópias, pontos de escrita e operação de migração; IDs e histórico preserváveis quando modelo permitir | Alterar PK/FK/unicidade sob dados legados pode quebrar EN, recibos, RLS e rollback; `G` nula/antiga **não** ganha geração atual | Contrato por coluna e operação que garanta falha fechada, migração reversível ou transição explícita, teste EN e integridade de provas |
| **B — Criar seis tabelas `_v2` propostas no COM-1** | Isolamento declarativo de autoridades atuais e históricas; permite transição controlada se migração in-place for insegura | Mais estruturas, RPCs/ACL/triggers/cópias, custo de manutenção e cutover EN; perigo de leitura dupla incoerente ou gravação V1/V2 simultânea | Prova objetiva de que in-place viola requisito ou tem maior risco; chaves/colunas exatas, cutover sem dual-write incompatível e testes independentes |
| **C — Híbrida, caso a caso** | Usa isolamento `_v2` só onde indispensável e mantém objetos estáveis sem duplicação | Maior cuidado com relações cruzadas, FKs e plano de desativação de rotas antigas | Matriz por objeto e diagrama transacional completos, com um único protocolo autorizado para escrita pessoal |

**Não escolher `A`, `B` ou `C` por preferência abstrata.** Objetivo: **menor mudança cuja segurança, continuidade real do EN e correção de provas possam ser demonstradas**. Não criar estrutura paralela apenas porque o COM-1 listou seis nomes.

## 2. Inventário e comparação por objeto

**Legenda:** *In-place* = alterar estrutura/constraints/leitores existentes; *isolado* = nova estrutura/escopo versionado. Todo caminho depende de consentimento e QA de implementação futura.

| Objeto/caminho mencionado nos relatórios | Estado e problema conhecidos | Opção in-place a investigar | Opção isolada a investigar | Evidência/decisão COM-1B |
| --- | --- | --- | --- | --- |
| `public.user_learning_generations` + helpers | Existentes no local, sem proveniência no histórico; constraint só `generation >= 0` | Preservar autoridade; definir teto seguro e leitura de `G` com lock por usuário | Evitar segundo contador global sem justificativa; journal de reset distinto pode ser necessário | Colunas/constraints/roles efetivas, preflight agregado **não executado**, idempotência reset, sem reduzir `G` |
| `public.interactive_lesson_sessions` | Unicidade atual `(user_id,course_id,lesson_id)`; B1 sem `G`; mudança U2 altera hash U1 | Expandir chave/índice com `G`, `contentVersion`, `definitionHash` e nova sessão por escopo | Estrutura versionada nova se constraints/retorno histórico impedirem expansão segura | Unicidade/FK, comportamento de `maybeSingle`, autoria, rollback, sessão antiga intacta e corte EN |
| `public.interactive_lesson_receipts` | PK `(session_id, attempt_id)`, FK de sessão `ON DELETE CASCADE`; sem geração própria | Incluir escopo verificado/immutability e proteger cascata/replay | Ledger de comprovantes versionado se FK/cascata impede retenção necessária | Idempotência de retry, owner/`G`/hash, retenção/snapshot/cursor, áudio em `bytea` |
| `destrava_private.course_version_sessions` | Sessões I7 sem `G` na autoridade do protocolo atual | Acrescentar geração e relações às versões/conteúdos | `course_version_sessions_v2` proposto | PK/FK atuais, adoção legada e impactos reais em EN |
| `destrava_private.course_version_evidence` | Evidências I7; não promover registros pré-reset ao escopo novo | Contextualizar recibos atuais sem alterar prova histórica | `course_version_evidence_v2` proposto | Origem/versionamento de cada evento, `operationReceipt` versus `currentSnapshot` |
| `destrava_private.runtime_course_selections` | Seleção I8 com CAS e read-after-write atuais | Expandir chave para proprietário/`G`/origem e blindar callbacks | `runtime_course_selections_v2` proposto | Troca A→B→A; EN e cursors; seleção atual versus recibos históricos |
| `destrava_private.runtime_selection_operations` | Ledger de operações I8 com idempotência | Persistir `G` + envelope imutável no ledger existente | `runtime_selection_operations_v2` proposto | ACK perdido, payload divergente, retry A depois de B; sem restaurar snapshot velho |
| `destrava_private.installed_study_progress` | Progresso instalado I8 com versão selecionada | Acrescentar `G` à identidade quando seguro | `installed_study_progress_v2` proposto | Pausa/diagnóstico A2, perdas/retomada após reload e versões de instalação |
| `destrava_private.installed_progress_operations` | Operações de progresso instalado e CAS | Escopo imutável em tabela existente | `installed_progress_operations_v2` proposto | Repetições, prefixo diagnóstico confirmado, não salvar rascunhos, persistência A2 |
| **Snapshot/avaliações/progresso compilados e projeções** | Piloto reset lista 22 tabelas públicas; código antigo pode persistir estado sem `G` | Adicionar geração/versão **somente após inventário real** e leitura antes de escrita | Estruturas separadas de snapshot atual por owner/`G`/curso/versão | Listar **cada** tabela/PK/FK/trigger e quais dados pessoais devem continuar históricos; não inventar nomes |
| **Áudio B1 (`audio_bytes`) e Storage `speaking-audio`** | Conteúdo privado; URLs assinadas anteriores podem durar até TTL relatado de 1h | Endurecer emissão, leitura e replay owner-only; preservar objetos históricos | Media access endpoint/fluxo com contexto `G` e versão para novas requisições | Política do áudio histórico pós-reset e TTL, risco de link já emitido; **reset desabilitado até decisão** |
| **Catálogo/instalações I7, ponteiros globais e ledger de consumo** | Não são progresso pessoal a reiniciar | **Preservar**; alterar somente quando houver motivo específico | Duplicação global não indicada | Identificar nomes reais; provar que EN, instalações, provedores e consumo permanecem intactos |
| **RPCs B1/I7/I8, rotas e leitores** | RPCs V1 sem barreira completa de geração; fast-path de recibo fora da validação transacional | Versionar assinaturas/caminho interno, remover execução V1 sem alternativo inseguro | Introduzir funções/rotas V2 com migração/cutover único | Locks após espera, retry idempotente antes de CAS, RLS/MFA, owner, `TRUNCATE`, EN |
| **Paginação/caches/recuperação** | Offset + timestamp não garante corte consistente; risco de recibos/projeção fora de escopo | Ordinal, watermark `H`, manifesto hash e vetor de revisões com cursor verificável | Estrutura/lote de snapshot novo, se falta garantia usando schema atual | Provar estabilidade de corte; assinatura e falha fechada; teste 501+ comprovantes, reset entre páginas |

**Apenas seis nomes `_v2` estão explicitamente propostos no COM-1**, todos nas seis linhas privadas I7/I8. A matriz também considera outras estruturas *hipotéticas* para comparação; isso **não** autoriza criar tabelas extras.

## 3. Colunas exigidas na matriz final por tabela/endpoint

O COM-1B deve preencher **sem inventar**, para cada objeto:

| Campo | Requisito de evidência |
| --- | --- |
| `identidade/PK/UNIQUE/FK/ON DELETE` | Nome da constraint, colunas e relação atual; mudança proposta/compatibilidade com histórico |
| `geração/versão/origem/owner` | Fonte da autoridade, quem calcula/valida, se é nulo no legado e semântica de leitura |
| `grants/RLS/SECURITY DEFINER` | Roles efetivos/herança/default privileges e restrições V1/V2; revogação `TRUNCATE` |
| `operações/autorização` | RPC/HTTP, lock por usuário, CAS, idempotência por operação e resultado versus snapshot |
| `legado/auditoria` | Só histórico, adoção seletiva condicionada, ou bloqueado `LEGACY_REVIEW_REQUIRED`; prova necessária |
| `EN` | Cenário de funcionamento antes/depois, sem duplicar arquivos ou invalidar versão por editar ES |
| `migração/preflight` | Confirmação de schema/histórico `parcial/divergente`, status dos objetos, valores incompatíveis pendentes |
| `rollback/fail-closed` | O que pode ser revertido sem reduzir `G`, reabrir DML nem perder evidências; condição STOP |
| `testes QA` | Casos positivos/negativos reais e oráculo independente com ambientes e permissões separados |
| `decisão A/B/C` | Justificativa localizada e aprovação ainda pendente; não escolher por conveniência |

## 4. Migrações ilustrativas do relatório — NÃO reservadas

O COM-1 cita cinco nomes em sequência proposta: `20261023010100_composition_baseline.sql`, `20261023010200_learning_scope_expand.sql`, `20261023010300_learning_rpc_v2.sql`, `20261023010400_learning_cutover_acl.sql` e `20261023010500_learning_generation_limit.sql`.

Estes são **identificadores hipotéticos, não arquivos criados, não verificados quanto à unicidade e não aprovados**. Nenhum se deve tornar migração executável sem matriz final, preflight de estado real, autorização de DDL e QA de rollback.

## 5. Bloqueadores de conclusão do COM-1

**Ainda não concluídos:**

- Matriz por tabela/coluna/FK/grant e escolha justificada A/B/C.
- Regra de leitura/adopção histórica por objeto, sem `G` atual implícita.
- Compatibilidade funcional do **EN** no cutover compartilhado.
- Política de acesso/TTL de **áudio histórico** e reset administrativo desabilitado até solução.
- Privilégio `TRUNCATE`, ACL/ownership e validação de código/ambiente — projeto detalhado e QA futuros.
- Consulta agregada de valores de geração acima do teto: **não foi autorizada**, e nenhuma contagem pode ser inventada.

**Entrega posterior recomendada:** completar esta matriz **por análise estática dos arquivos versionados e do inventário COM-0 já existente**, não acessando o banco novamente. Qualquer dado ou consulta adicional exige permissão própria. O resultado será proposta para decisão/QA, ainda não COM-2.
