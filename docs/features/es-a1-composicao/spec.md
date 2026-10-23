# ES-A1 — Especificação proposta de composição segura do motor e piloto pessoal

> **Estado (23/10/2026): P0 + COM-0 ENCERRADOS; COM-1 ENTREGUE POR ANÁLISE ESTÁTICA COM `DECISÕES PENDENTES`.** A PR #9 já foi integrada à `main` em `1b1b27908f3babb89b04dac222ed5bbcee7f1ca1`. O proprietário autorizou o COM-1 **somente de leitura**, recebeu [relatório COM-1](RELATORIO_COM1.md) e concordou em registrar as **cinco diretrizes de arquitetura** de [DECISOES_COM1.md](DECISOES_COM1.md). Essas diretrizes **não aprovam** seis tabelas `_v2`, migrações sugeridas, política detalhada de áudio, SQL concreto nem COM-2. A presente PR é apenas documental; **COM-1B** (fechar matriz SQL/continuidade EN/áudio) permanece proposta, não iniciada.
>
> Fonte: [relatório P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md) — parecer do Codex **PLANO SUFICIENTE**, obtido por leitura; [auditoria de conteúdo](../piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md); [política do curso laboratório](../../produto/CURSO_LABORATORIO_ES_A1.md); [plano desta composição](plan.md) e [tarefas](tasks.md).
>
> **Baselines de evidência:** P0 `cacbacb6...` (PR #7); COM-0 `df17c5d8...` (PR #8); COM-1 `1b1b27908f3babb89b04dac222ed5bbcee7f1ca1` (PR #9). Confirmar `main` antes de execução futura. O ES `espanhol-a1-pessoal` (conteúdo 0.1.0/contrato 1.5) permanece no caminho compilado pessoal em worktrees locais; Fly e schema remoto não foram inspecionados. Os resultados QA/Revisor mencionados no COM-1 são **análise estática do desenho**, não execução funcional.

## 1. Problema, objetivo e escopo

O piloto pessoal possui políticas de **geração persistida e reset**, além de conteúdo ES/EN, enquanto a `main` possui escritor privilegiado de **comprovantes B1**, sessões/diagnóstico A2 e narração B2. Copiar arquivos em bloco entre worktrees viola invariantes de segurança e pode regredir funcionalidades. Existem **duas migrações SQL diferentes com a versão `20261022000100`**. O **COM-0 identificou no banco local objetos de ambas**, mas o histórico local registra **somente `interactive_segment_evidence`**, com divergência de constraint e privilégios; o histórico/proveniência reais do reset continuam indeterminados. Não inferir o estado do remoto a partir do local.

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
| **COMP-R01** | Piloto e motor possuem migrações diferentes com ID `20261022000100` | **COM-0 local por SELECT:** ambos os conjuntos de objetos existem, mas 20 entradas de histórico registram só a migração B1 para essa versão. Proveniência do reset desconhecida; remoto não consultado |
| **COMP-R02** | Piloto usa lock por usuário (seed `731984`), geração consultada após lock; B1 usa lock por usuário+curso+lição e RPC sem geração | Código comparado; corrida **modelada, não reproduzida em SQL** |
| **COMP-R03** | Rota B1 devolve comprovante já existente antes da RPC transacional | Código observado; precisa validação de geração/contexto também nesse caminho |
| **COMP-R04** | Hash B1 inclui definição + pacote inteiro + idioma; unicidade histórica por usuário/curso/lição | Edição da U2 pode alterar hash de sessão U1; **resultado no navegador não reproduzido** |
| **COMP-R05** | Reset legado não abrange explicitamente dados privados I8 e seus leitores/replay | Escopo antigo insuficiente; procedimento administrativo canônico não identificado pelo P0 |
| **COMP-R06** | Checkout ES/EN e motor divergiram, com mudanças reais a conciliar | Inventário Codex: 20 worktrees / 249 pendências; não é permissão para sobrescrevê-las |

**Comprovado apenas no recorte de metadados local, conforme Codex:** presença de objetos reset e B1, permissões/constraints/funções listadas no [COM-0](RELATORIO_COM0.md). **Ainda não comprovado:** origem e ordem do reset, equivalência exata da geração, schema e histórico remotos, valores reais de geração, build/versão estudada no Fly, teste de exploração, dispositivos, provedor, reset funcional ou composição no navegador. Não promover metadados a homologação de execução.

## 2.1. Descobertas COM-0 — local `parcial/divergente`

[Relatório recebido do Codex](RELATORIO_COM0.md): inspeção em 23/10/2026, cinco transações `REPEATABLE READ READ ONLY` encerradas com `ROLLBACK`, 21 consultas SELECT Q01–Q21 de metadados (sem leitura de respostas/áudios/progresso individual).

- **COMP-R07 — constraint de geração:** no banco local `generation >= 0`; migração do piloto declara **também limite superior `9007199254740991`**. Dados de geração fora do limite **não** foram consultados. Verificação agregada mínima exige autorização específica; não alterar constraint por inferência.
- **COMP-R08 — grants `TRUNCATE`:** `anon` e `authenticated` possuem privilégio `TRUNCATE` nas sessões interativas. RLS não restringe `TRUNCATE`. **Revisar e projetar revogação explícita/testes de privilégios** no desenho de segurança, sem inferir exploração HTTP ou executar revogação neste ciclo.
- **COMP-R09 — rede:** o mapeamento do PostgreSQL publicado por Docker permite bind em `0.0.0.0` e `::`; a conexão usada foi local. **Exposição real não foi testada.** Avaliar plano de restrição à interface local por autorização operacional posterior; não alterar rede por este registro.
- **COMP-R10 — objetos de proteção:** 66 políticas restritivas em 22 tabelas públicas e três políticas de Storage; as **21 RPCs I7/I8/B1** examinadas são `SECURITY DEFINER`, `search_path` vazio e execução restrita a `service_role` entre papéis de aplicação testados por metadados. Essas propriedades são **estados de catálogo**, não prova de ausência de corrida no escritor.
- **COMP-R11 — integração confirmada como pendente:** writer B1 e I7/I8 não verificam geração; lock do reset é por usuário, lock B1 por usuário/curso/lição. Unicidade B1 segue apenas `(user_id, course_id, lesson_id)`. O protocolo versionado e transacional permanece **não implementado**.

**Gate:** COM-0 é **concluído somente por metadados locais**, com classificação `parcial/divergente`; o próximo trabalho proposto é **COM-1: desenho estático** baseado nessa evidência, sem banco/SQL executado. Não repetir COM-0 sem justificativa e nova autorização de acesso.

## 2.2. COM-1 — desenho estático produzido; diretrizes aprovadas, decisões ainda abertas

O [relatório COM-1](RELATORIO_COM1.md) propõe contexto imutável de operação com `G`, época local, revisão CAS, origem compilado/instalado, `contentVersion`, `definitionHash` e `operationId`. Ele separa **recibo imutável da operação** de **snapshot atual**: retry A depois de B não restaura snapshot antigo. Desenha lock de geração compartilhado, recuperação idempotente de ACK perdido antes do CAS, leituras e paginação com corte consistente (watermark, ordinal, manifesto de hashes e cursor vinculado), e escopo versionado B1. **Nada disso foi implementado ou testado**.

O proprietário concordou com cinco **diretrizes de arquitetura** em [DECISOES_COM1.md](DECISOES_COM1.md):

1. Preservar sem geração como **histórico**, sem atribuição automática de `G` ou nota atual; adoção seletiva exige critérios por objeto.
2. Preservar a **continuidade funcional do piloto inglês** — não basta preservar os arquivos. **STOP de cutover** até existir caminho e testes EN.
3. Registrar objetos de reset herdados com **proveniência indeterminada**, sem inventar aplicação histórica; convergir por migrações futuras novas e únicas.
4. Manter acesso ao **áudio histórico** apenas para proprietários autorizados e não prometer revogação retroativa de URLs já assinadas; **reset permanece desabilitado** até política específica de acesso/revogação/expiração.
5. Comparar **alterar tabelas existentes** e **seis tabelas privadas `_v2`** (ou solução híbrida) com matriz SQL por objeto, em vez de aceitar automaticamente a proposta mais extensa.

A [MATRIZ_ALTERNATIVAS_SQL_COM1.md](MATRIZ_ALTERNATIVAS_SQL_COM1.md) é **preliminar**. Seus campos de PK/FK, colunas, privilégios, impacto EN, legado, autoria e testes **não foram ainda preenchidos exaustivamente com prova por tabela**. As seis tabelas `_v2` e cinco migrações citadas no relatório são **hipóteses de design, não decisões fechadas**.

**Próximo gate proposto:** **COM-1B**, detalhar matriz por objeto/arquivos e selecionar alternativa justificada para posterior revisão do proprietário, sem consultas ao banco, sem novos arquivos de migração, sem SQL executado, sem worktrees e sem alterações no motor/ES/EN. O COM-1 encerrou com **`DECISÕES PENDENTES`**; autorizar COM-1B e sua futura execução dependerão de aprovação específica após esta PR.

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
| **Local COM-0: parcial/divergente conhecido** | **STOP operacional.** Projetar migração de convergência *nova/única* para esse estado identificado, com precondições estritas, verificação da constraint/privilégios e tratamento de proveniência não atribuída; só após revisão/autorização específica para SQL e testes locais. Se objetos divergirem do cenário identificado: STOP novamente |

O **COM-0 já inspecionou por leitura de metadados do banco local** histórico/objetos/colunas/constraints/índices/RLS/grants/RPCs/Storage; ver [relatório COM-0](RELATORIO_COM0.md). Antes de escrever SQL, **COM-1 deve confrontar o desenho com a fotografia de objetos já verificados, detalhar precondições e rollback**; valores de geração/dados legados não foram inspecionados e qualquer consulta agregada adicional exige autorização própria. A mesma inspeção de metadados não foi realizada no remoto. `IF NOT EXISTS` **não** comprova equivalência. É proibido inventar migrações aplicadas, aplicar uma sobre outra ou executar `migration repair` por inferência.

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
| **COMP-01** | Inventário autorizado de schema/histórico com **local classificado `parcial/divergente` por COM-0** (20 versões, ambos os conjuntos de objetos, apenas B1 no histórico, constraint divergente); outro destino requer leitura autorizada própria |
| **COMP-02** | Versões SQL futuras **novas/únicas**, plano de convergência verificável para **estado local `parcial/divergente` explicitamente reconhecido**, mais reset-only/B1-only/ambos/novo em QA; **qualquer divergência inesperada deve parar**, nunca reparo de histórico implícito |
| **COMP-03** | Auth/MFA/RLS/grants: anônimo/outra conta/AAL incorreto sem acesso; DML direto bloqueado; **revogação explícita de `TRUNCATE` e verificação de grants efetivos/herdados/default privileges**, sem alegação de exploração confirmada |
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

**COM-0 teve autorização própria de leitura local, já encerrada; COM-1 teve autorização para análise estática, também encerrada após entrega do relatório.** Qualquer consulta nova, inclusive agregados de geração, acesso remoto, leitura individual, teste escritor, alteração de schema/grants/Storage ou rede requer aprovação nova. **Próximo COM-1B apenas como futura proposta** para completar matriz por objeto, continuidade EN e áudio. Nenhum SQL/código, worktree, PR funcional, merge, migração, reset ou publicação está autorizado por esta PR documental.

**Sequência atualizada:** COM-0 documentado/mesclado → **COM-1 entregue e agora documentado em PR própria** (desenho estático, decisões técnicas pendentes) → **COM-1B**, se autorizado, fechar matriz SQL A/in-place versus B/_v2 versus C/híbrido, critérios de legado, continuidade EN e áudio histórico → revisão/decisão técnica específica → autorizar à parte SQL/código, testes locais e eventual consulta agregada de geração → QA/Revisor e PR funcional → merge/migração/deploy com permissões próprias → fatia pedagógica U2 em demanda posterior.
