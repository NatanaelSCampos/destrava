# Destrava — decisões aprovadas e questões futuras

Atualização documental: 23/10/2026. Fonte de escopo: [Ciclo 2](features/fase4-ciclo2/spec.md). As seis recomendações C2 foram aprovadas expressamente pelo proprietário. A autorização funcional posterior, em 23/10/2026, permite executar A2/B2 sobre `b2e94ce`, testar localmente sem destruição e publicar PR funcional após QA/Revisor. Merge, migração e publicação em produção permanecem proibidos.

## Confirmado

- Reconciliação: PR #2 integrada em `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, árvore homologada `24b31199507e901bc9cacb9058756244bf4fa0c6`.
- Metodologia Do Chat ao Commit adotada na PR #1 e confirmada pelo proprietário; não criar processo paralelo.
- PR #3 integrada; as decisões aprovadas constam na baseline `b2e94ce`. O proprietário autorizou depois a implementação no escopo do Ciclo 2.
- Os requisitos de spec integrada e autorização funcional expressa foram satisfeitos. Isso não autoriza merge da PR funcional nem operações sensíveis fora do escopo.

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
