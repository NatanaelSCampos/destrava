# Destrava — decisões aprovadas e questões futuras

Atualização documental: 23/10/2026. Decisões anteriores C2 de [Ciclo 2](features/fase4-ciclo2/spec.md) permanecem válidas; o código A2/B2 foi **integrado pela PR #6**, e a política do laboratório ES-A1 pela **PR #5**, com `main` em `6bdd26c336ce50d59569a74581044fe3ddc89284`. Esses merges não autorizam deploy/migração nem novas tarefas automaticamente.

## Confirmado

- Reconciliação: PR #2 integrada em `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, árvore homologada `24b31199507e901bc9cacb9058756244bf4fa0c6`.
- Metodologia Do Chat ao Commit adotada na PR #1 e confirmada pelo proprietário; não criar processo paralelo.
- PR #3 integrada; as decisões aprovadas constam na baseline `b2e94ce`. O proprietário autorizou depois a implementação no escopo do Ciclo 2.
- Os requisitos de spec integrada e autorização funcional do Ciclo 2 foram satisfeitos; **o merge da PR #6 já ocorreu**. Não implica publicação operacional, migração, custos ou autorização para um ciclo novo.

- A PR #4 integrou roadmap/matriz na main `4a9a5e918d345cf7a8d37d176068ea8ae4892810` durante esta execução. Seu delta é documental e não altera as seis decisões abaixo.

## Decisões do Ciclo 2 — APROVADAS pelo proprietário em 23/10/2026

| ID | Decisão vinculante | Limite e comportamento não autorizado |
| --- | --- | --- |
| **C2-A01** | Pausa por botão explícito **e** automática por visibilidade/inatividade. Tempo não ativo congelado; retomar, inclusive após reload, a sessão, o plano, a etapa confirmada e o tempo ativo confirmado. | Pausa não comprova domínio; mudança de schema/contrato requer STOP/autorização própria. |
| **C2-A02** | Priorizar diagnóstico adaptativo real. Preservar respostas **submetidas** e resultados **confirmados** após reload, separando diagnóstico e avaliação final. | Não salvar rascunhos/respostas parciais nem desenvolver diagnóstico fixo adicional; preservar o suporte fixo já existente. |
| **C2-B01** | Idioma de apoio de `course.sourceLanguage`, alvo de `course.targetLanguage` e variante efetiva; narração iniciada **somente pelo aluno**. | Sem autoplay, preferência global nova ou condições fixas por idioma. |
| **C2-B02** | Apenas **uma reprodução ativa**. Início de TTS pausa mídia conflitante; pausa, cancelamento, interrupção e retomada controlados; retomada a partir do **início da frase/âncora**. | Não alegar retomada acústica exata por palavra nem introduzir novo controle global de velocidade. |
| **C2-B03** | Sem voz de locale compatível: **texto acessível** e aviso claro. Fala legada/mista não anotada: apenas texto, sem deduzir idioma por string. `followUp` exige papel/idioma explícito antes de TTS. | Não usar voz de idioma incorreto ou criar novo seletor de vozes por inferência. |
| **C2-O01** | O Lead escolhe e comprova ambiente local isolado (workdir, Docker/projeto, labels, loopback, portas), com SQL/browser/build coordenados sequencialmente e diferenças reais de schema documentadas. | Não autoriza reset, bootstrap, migrações, alteração de políticas, deleções nem operações remotas. |

As seis alternativas ficaram decididas; a autorização expressa posterior permite **implementar A2/B2** no escopo aprovado. Novas decisões de negócio, mudanças de contrato/schema, custos ou operações sensíveis voltam ao proprietário.

## Release posterior

Conciliar motor e pilotos ES/EN com cinco pacotes, homologar schema remoto e preparar rollback operacional são demandas próprias. Não bloquear artificialmente revisão documental por release futura nem autorizar deploy automático.

Registro funcional C2: [relatório de implementação](features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md). As seis decisões C2-A01/A02/B01/B02/B03/O01 foram aplicadas sem alterar as escolhas aprovadas.

## Laboratório pessoal ES-A1 — decisão editorial aprovada

| ID | Decisão | Limite |
| --- | --- | --- |
| **ESLAB-D01** | **Evoluir o acervo existente**, preservar bons materiais, reorganizar profundamente os percursos **U2 antes de U1** e priorizar feedback por erro, explicação recuperável e variedade significativa. A decisão foi confirmada pelo proprietário depois da [auditoria estática](features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md). | Aprovação da **direção editorial e documentação**, não de implementação, migração, reset, publicação ou merge funcional. |

**Questões e bloqueios que exigem plano antes de execução:**

- **ESLAB-B01:** conflito de identificador de migração `20261022000100` entre `learning_reset_generation.sql` do piloto e `interactive_segment_evidence.sql` do motor; sem verificar banco nem presumir correção por renomeação.
- **ESLAB-B02:** reconciliar proteção da geração/reset do piloto com autorização/CAS e comprovantes B1 do motor, sem permitir escrita por aba antiga ou replay.
- **ESLAB-B03:** decidir, a partir da auditoria e do contrato público, o menor mecanismo seguro de **feedback editorial por alternativa errada**, sem gabarito público antes da submissão. Se exigir novo contrato/schema, STOP.
- **ESLAB-B04:** qual é a versão remota realmente em uso e o estado do schema/provedores? A auditoria estática não comprova; investigar só com permissão operacional delimitada.

**P0 técnico concluído apenas por leitura:** [relatório P0](features/piloto-es-a1-pos-ciclo2/RELATORIO_P0.md) com parecer PLANO SUFICIENTE. Riscos ESLAB-B01/B02 **não estão resolvidos no código ou banco**. Próxima proposta em revisão: [spec de composição](features/es-a1-composicao/spec.md), [plano COM-0→COM-4](features/es-a1-composicao/plan.md), [tarefas](features/es-a1-composicao/tasks.md). **COM-0 (consulta de schema/histórico do destino) depende de autorização específica**, separada da PR documental. Histórico experimental pode ser reconstruído, mas operações destrutivas continuam proibidas sem autorização explícita.

## Propostas técnicas do P0 para revisão — NÃO autorizam implementação

| ID | Desenho proposto | Condição pendente |
| --- | --- | --- |
| **COMP-D01** | Convergir SQL por versões **novas e únicas**; não reescrever históricos `20261022000100` | Confrontar com schema/histórico aplicado no ambiente explicitamente autorizado |
| **COMP-D02** | Geração `G` e writer B1 sob lock compartilhado de usuário, validação na transação; retry e leitura também isolados | Projeto SQL/código, Auth/MFA/owner, privilégio e QA próprios |
| **COMP-D03** | Escopo B1 versionado: usuário + G + curso + lição + `contentVersion` + `definitionHash` | Ajustar índices/RPCs/lookup após revisão de schema, sem atribuir recibos antigos ao novo |
| **COMP-D04** | Reset administrativo com `operationId`, freeze e incremento idempotente de geração, falha fechada | Procedimento canônico atual ainda não identificado; desenho e dados/Storage exigem análise |
| **COMP-D05** | Composição **sele­tiva** do acervo ES sobre motor atual com B1/A2/B2, EN intacto | Worktrees/SQL/código ainda não autorizados; P1 pedagógico só depois da integração segura |

O relatório P0 não executou SQL, QA/browser, migração, reset nem testou concorrência em runtime. **"PLANO SUFICIENTE" é um parecer de planejamento, não um GO funcional ou operacional.**

## Ideia futura — Língua Viva / Idioma nas Ruas

**Conceito acolhido para estudo, sem implementação aprovada nesta demanda:** ensinar naturalidade, registros, intenções comunicativas e variantes regionais/contextuais; reutilizar particularidades regionais, role-play e missões. A autoria/verificação linguística pertence ao Language Foundry; incluir em U1/U2 somente em recorte editorial posteriormente aprovado. **Não adicioná-la a ESLAB-P0/P1 por inferência.**
