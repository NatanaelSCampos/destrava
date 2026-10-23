# COM-1 — Diretrizes de arquitetura e decisões pendentes

> **Registro da decisão de produto em 23/10/2026.** Após ler o [relatório COM-1](RELATORIO_COM1.md), o proprietário concordou em **avançar com as cinco diretrizes abaixo como critérios para especificação e comparação de alternativas**. É uma aprovação de **direção arquitetural**, não de desenho SQL final, seis tabelas `_v2`, cinco migrações sugeridas, novas consultas, implementação, dados, rede, cutover, merge ou publicação.
>
> **Base verificada antes desta PR:** `main` `1b1b27908f3babb89b04dac222ed5bbcee7f1ca1` (PR #9). O COM-1 foi apenas estático; COM-0 inspecionou por leitura um único banco **local** classificado `parcial/divergente`. Consulte [spec](spec.md), [plano](plan.md), [matriz de alternativas SQL](MATRIZ_ALTERNATIVAS_SQL_COM1.md), [COM-0](RELATORIO_COM0.md) e [tarefas](tasks.md).

## 1. Diretrizes aprovadas para o desenho

| ID | Diretriz de arquitetura aprovada | Obrigação observável e limite |
| --- | --- | --- |
| **COMP-AD01 — Legado** | Preservar dados sem geração como **histórico**, sem promover automaticamente `G` ou evidência pedagógica da versão atual. Adoção apenas mediante critérios verificáveis, por objeto. | Impedir `DEFAULT G_atual`, reconstrução de nota/recibo, escrita implícita ou perda silenciosa. Expor estado `LEGACY_REVIEW_REQUIRED` quando aplicável. **Ainda falta definir critérios de adoção por tabela, leitura histórica e data policy.** |
| **COMP-AD02 — Continuidade EN** | Preservar **funcionamento e arquivos** do piloto inglês antes de qualquer troca de protocolo/banco compartilhado. | **STOP de cutover** sem testes funcionais de leitura, escrita legítima, retomada, evidências, áudio e versões EN; não basta conservar bytes dos worktrees. Não criar segundo curso pessoal ES para conservar histórico. |
| **COMP-AD03 — Proveniência** | Aceitar documentação explícita dos objetos reset já existentes como **proveniência indeterminada**, sem inventar o método/autor/data da aplicação. | Convergir com IDs **novos e únicos**, precondições reais e verificação do estado `parcial/divergente`; não `migration repair` por inferência, alteração retroativa de `schema_migrations` ou reaplicação das duas migrações de mesmo ID. |
| **COMP-AD04 — Áudio histórico** | Manter reprodução **somente sob autorização atual de proprietário**. Não prometer revogação instantânea de URLs assinadas já emitidas (TTL histórico relatado de 1 hora). | Projetar política para emissão futura, download/replay, gravações em recibos e Storage. **Reset administrativo permanece desabilitado** até haver estratégia aprovada para áudio, expiração e acesso legado. Não apagar mídia histórica por inferência. |
| **COMP-AD05 — Menor mudança comprovável** | Exigir matriz SQL **por objeto/tabela** com colunas, chaves, FKs, unicidade, privilégios, operação idempotente, dado legado, opção de reversão e QA; comparar **alterar tabela existente** contra **tabela `_v2`**. | A escolha não está feita. Seis tabelas `_v2`, migrações com IDs propostos, novos protocolos ou ampliação de contrato **não** são automaticamente aprovados. Preferir menor mudança **somente quando segurança, continuidade EN e clareza de provas forem demonstráveis**. |

Essas diretrizes são **restrições para o COM-1B e propostas futuras**, não aceitação de uma implementação específica.

## 2. Invariantes técnicos do desenho COM-1 que continuam propostos

- Capturar `G`, conta, origem, curso, versão/hash, operação e época **antes da fila**. `operationReceipt` imutável separado de `currentSnapshot`; repetir operação A após B **não** restaura o estado anterior.
- Writer pessoal B1/I7/I8 e reset devem compartilhar lock por usuário; validação de geração/resetting **depois do lock**, na mesma transação da escrita. Confirmação idempotente antes do CAS para operação nova; fast-path HTTP de recibo também deve respeitar a geração.
- Escopo B1 por `usuário + G + curso + lição + contentVersion + definitionHash`; sessão antiga é histórico, não aprovação automática nova. Editar U2 pode mudar hash de U1 porque o algoritmo atual abrange o pacote completo.
- Recuperação paginada exige corte consistente (watermark de recibos, revisões, manifesto da versão, cursor vinculado ao owner/G/versão, validação por página). Não publicar projeção parcial nem declarar snapshot linearizável sem teste.
- Revogar explicitamente `TRUNCATE` de `PUBLIC`/`anon`/`authenticated` quando houver SQL autorizado, conferindo privilégios herdados, defaults, RLS/MFA, `SECURITY DEFINER` e revisando RPCs antigas.
- Tratar divergência de `generation >= 0` versus teto `9007199254740991`. A **consulta agregada de gerações fora do teto não foi autorizada**, nem executada pelo COM-1. Não alterar constraint às cegas.
- O bind PostgreSQL local `0.0.0.0`/`::` deve ter plano de restrição futura; **não há prova de alcance externo nem autorização para modificar rede**.

Essas condições exigem especificação detalhada e validação/QA futura. Nenhuma mudança de banco ou código ocorreu.

## 3. Decisões que permanecem abertas — não substituir por suposições

| ID | Decisão técnica ainda necessária | Evidência para fechar |
| --- | --- | --- |
| **COMP-PD01 — Adotar legado** | Para cada objeto com dados sem `G`: manter só histórico consultável, conversão seletiva ou descartar lógica futura? | Matriz de dados/autoridade e critérios de versão/identidade/proveniência; migração/escrita só depois de autorização |
| **COMP-PD02 — Cutover EN** | Como manter continuidade **funcional** do inglês com escritor V1 desativado? | Plano de compatibilidade e testes negativos/positivos no candidato; sem escrita simultânea incompatível |
| **COMP-PD03 — Áudio depois de reset** | Como tratar URLs antigas dentro do TTL, mídia Storage e bytea em recibos? | Política de acesso owner-only, TTL, pós-reset, download e replay, com limites honestos; reset não habilitado |
| **COMP-PD04 — Matriz SQL final** | Onde basta acrescentar geração/versão, onde é exigido esquema paralelo e como operar cutover sem perder provas? | [Matriz por objeto](MATRIZ_ALTERNATIVAS_SQL_COM1.md) concluída, alternativa motivada por evidência, DDL/ACL/rollback preflight e QA |
| **COMP-PD05 — Gravação e histórico** | Como prevenir paginação inconsistente, race reset x escrita e adoção de dados sem geração? | Pseudocódigo transacional revisado, invariantes de locking/SNAPSHOT, cursor/ordinal e testes especificados |

O parecer **COM-1: DECISÕES PENDENTES** do Codex permanece correto. A aprovação destas cinco diretrizes **reduz ambiguidades**, mas **não conclui a matriz por tabela, continuidade EN e áudio histórico**.

## 4. Handoff autorizado posteriormente, se solicitado

**COM-1B (próxima proposta):** somente leitura de código/relatórios e elaboração **documental** da matriz por objeto, alternativas in-place x `_v2`, continuidade do inglês e áudio. Sem Supabase, SQL executado, trabalho em worktree, PR funcional ou migrações. O proprietário deverá autorizar COM-1B separadamente após revisar/mesclar esta documentação.

**COM-2:** implementação somente após decisão de arquitetura detalhada, autorizações de código/infra/testes locais, QA/Revisor independentes e escopos explícitos. **Fly, remoto, Storage destrutivo, reset, migrações aplicadas e publicação continuam fora.**
