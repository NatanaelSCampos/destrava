# Destrava — decisões aprovadas e questões futuras

Atualização documental: 23/10/2026. Decisões C2 de [Ciclo 2](features/fase4-ciclo2/spec.md) continuam válidas. A `main` confirmada é `1b1b27908f3babb89b04dac222ed5bbcee7f1ca1` (PR #9, COM-0 documentado), após PR #8 P0, #7 auditoria ES-A1, #6 A2/B2 e #5 laboratório vivo. O Codex entregou **COM-1 somente estático, `DECISÕES PENDENTES`**. O proprietário concordou com **cinco diretrizes arquiteturais para especificação**, ainda **sem aprovar SQL, cutover ou implementação**.

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

**P0 concluído por leitura; COM-0 concluído por SELECT autorizado no banco local:** o [relatório COM-0](features/es-a1-composicao/RELATORIO_COM0.md) classificou o schema do projeto `espanhol-plataform` como **`parcial/divergente`**: os objetos de reset e B1 existem, mas somente B1 consta da versão `20261022000100` no histórico, e a constraint de geração é distinta. Não houve operação escritora. A [spec de composição](features/es-a1-composicao/spec.md) e o [plano](features/es-a1-composicao/plan.md) propõem **COM-1 desenho estático** como próximo gate, ainda não autorizado por este registro. A autorização de leitura de COM-0 **não se estende** a novas consultas, SQL, reset ou deploy.

## Propostas técnicas do P0 para revisão — NÃO autorizam implementação

| ID | Desenho proposto | Condição pendente |
| --- | --- | --- |
| **COMP-D01** | Convergir SQL por versões **novas e únicas**; não reescrever históricos `20261022000100` | Confrontar com schema/histórico aplicado no ambiente explicitamente autorizado |
| **COMP-D02** | Geração `G` e writer B1 sob lock compartilhado de usuário, validação na transação; retry e leitura também isolados | Projeto SQL/código, Auth/MFA/owner, privilégio e QA próprios |
| **COMP-D03** | Escopo B1 versionado: usuário + G + curso + lição + `contentVersion` + `definitionHash` | Ajustar índices/RPCs/lookup após revisão de schema, sem atribuir recibos antigos ao novo |
| **COMP-D04** | Reset administrativo com `operationId`, freeze e incremento idempotente de geração, falha fechada | Procedimento canônico atual ainda não identificado; desenho e dados/Storage exigem análise |
| **COMP-D05** | Composição **seletiva** do acervo ES sobre motor atual com B1/A2/B2, EN intacto | Worktrees/SQL/código ainda não autorizados; P1 pedagógico só depois da integração segura |

O relatório P0 não executou SQL, QA/browser, migração, reset nem testou concorrência em runtime. **"PLANO SUFICIENTE" é um parecer de planejamento, não um GO funcional ou operacional.**

## COM-0 — evidências e decisões pendentes em revisão

**Relatório de banco local (23/10/2026):** [RELATORIO_COM0.md](features/es-a1-composicao/RELATORIO_COM0.md). Inspeção de metadados apenas; **20 registros de migração, 21 SELECT, 5 transações READ ONLY encerradas com ROLLBACK**, classificada `parcial/divergente`.

| ID | Achado relatado / próxima decisão | Limite |
| --- | --- | --- |
| **COMP-C01** | Objetos reset e B1 presentes, só B1 registrado no histórico da versão `20261022000100` | Propor convergência em **migração futura nova e única**, sem inventar/apagar histórico; ausência de proveniência permanece explícita |
| **COMP-C02** | Constraint atual `generation >= 0`, sem teto `9007199254740991` do piloto | Consultar valores incompatíveis **somente se autorizado em nova leitura agregada**; não instalar constraint às cegas |
| **COMP-C03** | Privilégio efetivo `TRUNCATE` para `anon` e `authenticated` nas sessões interativas, RLS não controla TRUNCATE | **Prioridade de segurança**: desenhar revogação explícita e teste de grants/herança; sem exploração HTTP comprovada |
| **COMP-C04** | Writers privilegiados B1/I7/I8 sem geração/lock comum | Desenhar bloqueio transacional, retry/recibo/leitura/versionamento; não afirmar que reset é seguro |
| **COMP-C05** | Docker publica porta PostgreSQL em `0.0.0.0` e `::` | Avaliação/restrição futura da rede, **não** evidência de alcance externo confirmado |

**COM-1 foi autorizado e concluído como análise estática**. Sua autorização não se estende a novas consultas de banco, COM-1B/COM-2, alterações de grants, SQL, migração, dados, worktrees, testes escritores ou deploy. Ver [relatório](features/es-a1-composicao/RELATORIO_COM1.md), [diretrizes](features/es-a1-composicao/DECISOES_COM1.md) e [matriz SQL preliminar](features/es-a1-composicao/MATRIZ_ALTERNATIVAS_SQL_COM1.md).

## COM-1 — Diretrizes arquiteturais aceitas, escolhas técnicas não resolvidas

**Fonte:** [RELATORIO_COM1.md](features/es-a1-composicao/RELATORIO_COM1.md); parecer do Codex `COM-1: DECISÕES PENDENTES`. O proprietário concordou em **prosseguir com as cinco recomendações como diretrizes do desenho**, não como aprovação dos seis `_v2`, cinco migrações propostas ou nova versão operacional.

| ID | Diretriz aceita para projeto | Limite pendente |
| --- | --- | --- |
| **COMP-AD01** | Legado sem geração é histórico; adoção seletiva só com evidência | Critérios por tabela/objeto, sem `DEFAULT G_atual`, nota fictícia ou perda de histórico |
| **COMP-AD02** | EN preservado em **funcionalidade**, não apenas em bytes | **Cutover compartilhado bloqueado** até prova de compatibilidade e teste planejado |
| **COMP-AD03** | Reset herdado com proveniência desconhecida documentada; versões SQL futuras únicas | Sem `migration repair`, autoria/data inventada ou reaplicação do identificador duplicado |
| **COMP-AD04** | Áudio histórico owner-only; URL assinada prévia não tem revogação instantânea prometida | Política por Storage/recibo/TTL pendente; **reset administrativo desabilitado** |
| **COMP-AD05** | Matriz SQL com comparação **in-place**, **`_v2`** e **híbrido** antes de escolher | Seis novas tabelas e cinco migrações são **propostas não aprovadas** |

**Próxima demanda candidata COM-1B:** fechar alternativas por tabela (PK/FK/grants/rollback), legado, EN e áudio por leitura de código/documentos, com nova autorização. Ver [DECISOES_COM1.md](features/es-a1-composicao/DECISOES_COM1.md), [MATRIZ_ALTERNATIVAS_SQL_COM1.md](features/es-a1-composicao/MATRIZ_ALTERNATIVAS_SQL_COM1.md) e [ROTEIRO_COM1B.md](features/es-a1-composicao/ROTEIRO_COM1B.md). **Nenhuma execução de COM-2 está autorizada.**

## Ideia futura — Língua Viva / Idioma nas Ruas

**Conceito acolhido para estudo, sem implementação aprovada nesta demanda:** ensinar naturalidade, registros, intenções comunicativas e variantes regionais/contextuais; reutilizar particularidades regionais, role-play e missões. A autoria/verificação linguística pertence ao Language Foundry; incluir em U1/U2 somente em recorte editorial posteriormente aprovado. **Não adicioná-la a ESLAB-P0/P1 por inferência.**
