# ES-A1 — Especificação proposta de composição segura do motor e piloto pessoal

> **Estado (23/10/2026): DOCUMENTAÇÃO EM REVISÃO.** O proprietário autorizou **registrar P0 em PR documental**, não aprovou aqui implementação, desenho definitivo de banco, leitura de banco, criação de worktrees, testes com escrita, merge funcional, migração ou deploy. Decisão editorial **ESLAB-D01** (evoluir acervo, U2 primeiro) já aprovada e independente deste gate.
>
> Fonte: [relatório P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md) — parecer do Codex **PLANO SUFICIENTE**, obtido por leitura; [auditoria de conteúdo](../piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md); [política do curso laboratório](../../produto/CURSO_LABORATORIO_ES_A1.md); [plano desta composição](plan.md) e [tarefas](tasks.md).
>
> **Baseline auditada:** `main` `cacbacb6b6c2e5308885f6174e660f8c9c23bd19`, merge da PR #7. Verificar novamente os refs ao iniciar qualquer tarefa. Piloto ES `espanhol-a1-pessoal` (versão 0.1.0 / contrato 1.5) continua em worktrees locais, distinto da `main` e da publicação remota não verificada.

## 1. Problema, objetivo e escopo

O piloto pessoal possui políticas de **geração persistida e reset**, além de conteúdo ES/EN, enquanto a `main` possui escritor privilegiado de **comprovantes B1**, sessões/diagnóstico A2 e narração B2. Copiar arquivos em bloco entre worktrees viola invariantes de segurança e pode regredir funcionalidades. Existem **duas migrações SQL diferentes com a versão `20261022000100`**, histórico efetivamente aplicado desconhecido.

**Objetivo futuro:** permitir que o mesmo curso pessoal ES seja executado sobre o motor atual, com autorização, identidade, geração, versão, provas e persistência corretas, sem curso pessoal duplicado para preservar histórico. O EN, versões anteriores e worktrees não podem ser danificados por composição automática.

**Incluído para especificação, mas não executado nesta PR:**
- Plano de convergência de esquema e histórico de migrações com inspeção autorizada e estratégias distintas por estado do destino.
- Protocolo seguro de geração, lock, CAS, confirmação idempotente e replay, inclusive para B1, A2, estado privado I8, leitura e cache.
- Escopo versionado e preservação de sessões/provas B1 quando o conteúdo muda.
- Reuso seletivo do conteúdo/roteiros ES e preservação dos recursos A1/B1/A2/B2, do EN e do motor genérico.
- Matriz de testes independentes por camada e STOPs operacionais.

**Fora deste ciclo de composição:** refazer a U2/U1, novo feedback público por distrator, novo contrato externo do produtor, novos sistemas IA/voz, publicação Fly, reset administrativo efetivo e alterações no projeto Foundry/Admin. A fatia pedagógica U2 ocorrerá **depois** de homologar a composição.

## 2. Riscos confirmados por leitura versus ambiente ainda não comprovado

| ID | Achado P0 | Evidência/limite |
| --- | --- | --- |
| **COMP-R01** | Piloto e motor possuem migrações diferentes com ID `20261022000100` | Arquivos lidos localmente pelo Codex; **nenhum histórico/schema atual de destino consultado** |
| **COMP-R02** | Piloto usa lock por usuário (seed `731984`), geração consultada após lock; B1 usa lock por usuário+curso+lição e RPC sem geração | Código comparado; corrida **modelada, não reproduzida em SQL** |
| **COMP-R03** | Rota B1 devolve comprovante já existente antes da RPC transacional | Código observado; precisa validação de geração/contexto também nesse caminho |
| **COMP-R04** | Hash B1 inclui definição + pacote inteiro + idioma; unicidade histórica por usuário/curso/lição | Edição da U2 pode alterar hash de sessão U1; **resultado no navegador não reproduzido** |
| **COMP-R05** | Reset legado não abrange explicitamente dados privados I8 e seus leitores/replay | Escopo antigo insuficiente; procedimento administrativo canônico não identificado pelo P0 |
| **COMP-R06** | Checkout ES/EN e motor divergiram, com mudanças reais a conciliar | Inventário Codex: 20 worktrees / 249 pendências; não é permissão para sobrescrevê-las |

**Não comprovado:** qual das migrações está aplicada no banco local/piloto/remoto, catálogo real de objetos/políticas e permissões, qual build/versão o usuário estuda, dispositivos físicos, qualidade acústica, provedores, comportamento efetivo do reset ou compatibilidade integrada no navegador. Não promover hipótese a fato.

## 3. Invariantes de autoridade e persistência

**COMP-I01 — Identidades distintas:** geração persistente de aprendizagem `G` (reset), época local do provider (callbacks), CAS/revisão, `contentVersion/definitionHash`, sessão/tentativa/`operationId` têm significados independentes. Não usar um como substituto de outro.

**COMP-I02 — Captura imutável de contexto:** antes de enfileirar, capturar usuário, `G`, época local, curso, origem compilado/instalado, versão/hash, sessão e operação. Retry usa **exatamente o contexto original**; nunca recebe a geração/conta/curso atuais por conveniência.

**COMP-I03 — Auth/MFA/owner:** autenticação e permissão pelo servidor, isolamento por usuário e origem; RPC `SECURITY DEFINER` com privilégio restrito, sem aceitar autoridade declarada pelo cliente. Direitos de RLS autenticado não substituem validação explícita no escritor privilegiado.

**COMP-I04 — Serialização com reset:** nova operação B1 adquire a **mesma trava por usuário** usada pelo reset antes de ler geração/resetting; valida `G` e escopo **na mesma transação** em que escreve. Lock por curso/lição pode permanecer como nível adicional, mas não como substituto.

**COMP-I05 — Ordem transacional correta:** sob autoridade e lock de geração: confirmar escopo/generation, recuperar comprovante idêntico quando existente e válido, aplicar CAS **somente à nova operação**, escrever e devolver confirmação. Mesmo ID com payload diferente = conflito. Repetição após ACK perdido = mesmo efeito/mesmo recibo, sem exigir revisão nova. Não permitir atalho HTTP de retry sem checagem de geração.

**COMP-I06 — Leituras também isoladas:** leitores de sessões/recibos, paginação, resultados/normalização, cache, pendências e recovery devem filtrar geração e versão; sem promover dados legados sem geração à atual. Resposta antiga é ignorada se o contexto do cliente mudou (incluindo A→B→A e C→D→C).

**COMP-I07 — Reset administrativo monotônico:** se futuramente autorizado, reset registra `operationId`, geração esperada/resultante, escopo e fase; freeze + incremento atômicos, bloqueio enquanto Storage e destinos não confirmados. Retry idêntico após ACK perdido retorna **a mesma geração resultante**; conclusão antiga não desbloqueia reset posterior; nunca reduzir geração em rollback.

**COMP-I08 — Não apagar autoridade alheia:** catálogo/instalações globais I7 e ledger de consumo/cotas não são progresso pessoal a apagar. I8 privado, Storage e comprovantes exigem tratamento declarado por objeto. Nenhum dado de outro usuário ou curso EN sofre reset por evolução editorial do ES.

**COMP-I09 — Escopo B1 por versão:** usar identidade equivalente a `usuário + G + curso + lição + contentVersion + definitionHash`. Revisar índices, RPCs, consultas e `ON CONFLICT` em conjunto. Alterar conteúdo ES, inclusive só U2, **não deve reabrir/atribuir automaticamente provas de hash antigo**. Sessões velhas podem permanecer históricas, sem aprovar novo escopo.

**COMP-I10 — Mudança editorial ≠ reset:** aumentar `contentVersion` ES ao atualizar o material quando aplicável; não aumentar `G` global por mudança de lição, não inventar nova versão do EN e não criar outro curso pessoal por conveniência.

**COMP-I11 — Evidência pedagógica preservada:** nenhum áudio entregue, sessão visualizada ou flag legada ganha nota/domínio/prova B1 sem correção e confirmação autorizadas; revisão/cursor/tempo A2 e TTS B2 não são notas oficiais.

**COMP-I12 — Falha fechada:** erro, ausência de confirmação, discrepância de schema/histórico, lock, geração, versão ou privilégio bloqueiam escrita e retornam erro/recuperação honesta. Não corrigir falha reabrindo DML direto, renomeando migração aplicada, simplificando DTO ou desabilitando QA.

## 4. Convergência SQL — decisão de desenho proposta, condicionada a inventário

Duas migrações de origem com número `20261022000100`:
- **Piloto:** `learning_reset_generation.sql`: `user_learning_generations`, `learning_generation()`, `learning_write_allowed(uuid)` e políticas restritivas de escrita/Storage.
- **Motor:** `interactive_segment_evidence.sql`: `definition_hash`, revogação DML direto, `interactive_lesson_receipts`, RPC privilegiada `save_interactive_lesson_session(...)`.

**Princípio proposto:** manter histórico e convergir com **novas versões únicas**, baseadas em **estado verificado dos objetos**, sem alterar retroativamente migrações aplicadas.

| Estado real a identificar | Política proposta antes da execução |
| --- | --- |
| Somente reset efetivo | Introduzir objetos B1 ausentes + protocolo de geração usando novas versões |
| Somente B1 efetivo | Introduzir geração e adaptar o writer e leitores em novas versões |
| Ambos completos | Não reaplicar originais; integrar apenas escopo/transação/leitura necessários |
| Destino novo | Cadeia canônica versionada e validada desde a base, sem colisão |
| Parcial, divergente ou ambíguo | **STOP.** Inventariar e obter decisão própria antes de reparo de histórico |

O inventário futuro autorizado deve verificar **histórico de migrações e objetos reais**, colunas, índices/FKs/cascatas, políticas RLS, grants/ACL, RPCs/overloads, proprietários, `SECURITY DEFINER`, `search_path`, dependências I8/Storage, dados legados e caminho de rollback. `IF NOT EXISTS` **não** comprova equivalência. É proibido inventar migrações aplicadas, aplicar uma sobre outra ou executar `migration repair` por inferência.

**STOP de desenho:** definições exatas de helpers privilegiados, migração corretiva, formato/compatibilidade de payload e tratamento de dados sem geração requerem confronto com schema real + revisão de segurança e aprovação específica antes de SQL. Este documento não é a autorização de banco.

## 5. Composição seletiva motor/piloto

- **Motor como base:** preservar runtime B1, pausas/diagnóstico A2, controlador bilíngue B2, políticas I8, guards MFA, versão/CAS e repositórios existentes. Não substituir provedores por cópias antigas do piloto.
- **Fonte editorial ES:** conservar o curso integrado local `8cf0557` com correções e overrides aprováveis; rascunhos editoriais antigos não substituem correções posteriores.
- **Projeto EN:** manter arquivos, overrides, avaliações, 52 roteiros privados suspensos e configuração do inglês. Parte do conteúdo ES também se encontra no checkout EN; não publicar alterações nesses worktrees por acidente.
- **Áudio ES:** 44 escutas com roteiro declarado público para TTS; não declarar essas atividades como avaliação com transcrição secreta nem desabilitá-las por inferência.
- **Fala:** discrepância entre instruções de 30–45 segundos e limite atual de gravação de 20 segundos exige correção editorial/funcional futura, não mudança silenciosa da duração nesta composição.
- **Aula Particular:** reutilizar 21 roteiros anotados quando compatíveis; flags antigas não viram recibos B1. Aula instalada permanece bloqueada fora do escopo de integração demonstrada.

## 6. Aceites candidatos para a futura implementação (ainda não executados)

| ID | Aceite — oráculo observável |
| --- | --- |
| **COMP-01** | Inventário verificável e autorizado de schema/histórico por ambiente, explicitando cenário real de migração; nenhuma equivalência inferida apenas por ID |
| **COMP-02** | Versões SQL novas e únicas, convergência correta em reset-only, B1-only, ambos, bootstrap limpo; estado parcial falha com STOP |
| **COMP-03** | Auth/MFA/RLS/grants: anônimo, outra conta e AAL incorreto não acessam sessão, comprovante ou RPC; DML direto segue bloqueado |
| **COMP-04** | Writer B1 e reset compartilham lock de usuário e validam `G` na transação; writer antigo não atravessa reset após esperar |
| **COMP-05** | Mesmo retry/ACK perdido retorna único comprovante/geração resultante, mesmo payload; ID igual com dados diferentes conflita |
| **COMP-06** | CAS só para operação nova; concorrência com mesmo revision produz um vencedor e erro controlado, sem duplicação |
| **COMP-07** | Retorno rápido de comprovante e todos os leitores/replay respeitam `G`, versão e owner; recibos antigos não ressurgem |
| **COMP-08** | Callback stale, troca de conta/curso/versão e ABA A→B→A/C→D→C não reanimam contexto anterior |
| **COMP-09** | Reset administrativo retry/freeze/Storage isolados, falhas mantêm bloqueio e geração não diminui; nenhum dado EN/global/ledger apagado |
| **COMP-10** | Editar somente U2 cria novo escopo B1 quando hash/version muda; U1 e provas antigas não são declaradas atuais por flag ou migração implícita |
| **COMP-11** | A1/B1/A2/B2, variantes, avaliações e I8 não regrediram; compatibilidade ES compilado não habilita recursos instalados artificialmente |
| **COMP-12** | Piloto EN, fontes rastreadas/não rastreadas e worktrees anteriores preservados por manifesto e hashes |
| **COMP-13** | Testes por camada identificados e executados no candidato autorizado: puros/QA independente, SQL/Auth local, HTTP/browser, TypeScript, lint, build; relatos sem execução = NÃO EXECUTADO |
| **COMP-14** | Candidato congelado e Revisor GO, PR funcional separada e merge somente autorizado; nenhum deploy/reset/migração remotos por consequência |
| **COMP-15** | Registro de limitações por ambiente, versão efetivamente estudada e da publicação remota ainda não verificada, sem inventar resultado ou evidência |
| **COMP-16** | Compatibilidade com versão/hash de sessão, leitura paginada, Storage e projeções I8 demonstrada, sem promover dados legados sem geração |

## 7. Decisões e autorizações ainda pendentes

**Já decidido pelo proprietário:** o curso pessoal ES-A1 será o laboratório vivo; **ESLAB-D01** evoluirá o acervo existente, U2 primeiro. O relatório P0 foi entregue com `PLANO SUFICIENTE`.

**Em revisão nesta PR:** escolher esta arquitetura como **hipótese de trabalho para futuras implementações**, com invariantes e testes acima, **não aprovar a execução por merge documental**.

**Exigem autorização própria e eventual STOP:** ambiente e credencial para leitura de schema/histórico (local/remoto separados); desenho de SQL/migração e dados legados; edição de código/contrato; testes que escrevam dados sintéticos; uso de worktrees e publicação de PR funcional; merge funcional; operação remota, reset, `migration repair`, Fly, serviços pagos ou storage.

**Sequência canônica:** revisar/mesclar documentação → autorizar leitura do schema/histórico do destino identificado → validar plano SQL sobre o estado real e autorizar implementação em isolamento → QA/Revisor e PR funcional → autorizar integração → somente depois habilitar fatia U2 e, separadamente, eventual deploy.
