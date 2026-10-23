# Destrava — decisões aprovadas e questões futuras

Atualização documental: 23/10/2026. Fonte de escopo: [Ciclo 2](features/fase4-ciclo2/spec.md). As seis recomendações C2 foram aprovadas expressamente pelo proprietário. Esta aprovação cobre decisões de produto e sua documentação, não a execução, o merge, a migração ou a publicação.

## Confirmado

- Reconciliação: PR #2 integrada em `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, árvore homologada `24b31199507e901bc9cacb9058756244bf4fa0c6`.
- Metodologia Do Chat ao Commit adotada na PR #1 e confirmada pelo proprietário; não criar processo paralelo.
- A aprovação posterior autoriza registrar decisões de produto na PR documental, sem autorizar sua integração ou trabalho funcional.
- A execução futura ainda exige especificação integrada na baseline e autorização expressa separada. Merge documental não inicia agentes.

## Decisões do Ciclo 2 — APROVADAS pelo proprietário em 23/10/2026

| ID | Decisão vinculante | Limite e comportamento não autorizado |
| --- | --- | --- |
| **C2-A01** | Pausa por botão explícito **e** automática por visibilidade/inatividade. Tempo não ativo congelado; retomar, inclusive após reload, a sessão, o plano, a etapa confirmada e o tempo ativo confirmado. | Pausa não comprova domínio; mudança de schema/contrato requer STOP/autorização própria. |
| **C2-A02** | Priorizar diagnóstico adaptativo real. Preservar respostas **submetidas** e resultados **confirmados** após reload, separando diagnóstico e avaliação final. | Não salvar rascunhos/respostas parciais nem desenvolver diagnóstico fixo adicional; preservar o suporte fixo já existente. |
| **C2-B01** | Idioma de apoio de `course.sourceLanguage`, alvo de `course.targetLanguage` e variante efetiva; narração iniciada **somente pelo aluno**. | Sem autoplay, preferência global nova ou condições fixas por idioma. |
| **C2-B02** | Apenas **uma reprodução ativa**. Início de TTS pausa mídia conflitante; pausa, cancelamento, interrupção e retomada controlados; retomada a partir do **início da frase/âncora**. | Não alegar retomada acústica exata por palavra nem introduzir novo controle global de velocidade. |
| **C2-B03** | Sem voz de locale compatível: **texto acessível** e aviso claro. Fala legada/mista não anotada: apenas texto, sem deduzir idioma por string. `followUp` exige papel/idioma explícito antes de TTS. | Não usar voz de idioma incorreto ou criar novo seletor de vozes por inferência. |
| **C2-O01** | O Lead escolhe e comprova ambiente local isolado (workdir, Docker/projeto, labels, loopback, portas), com SQL/browser/build coordenados sequencialmente e diferenças reais de schema documentadas. | Não autoriza reset, bootstrap, migrações, alteração de políticas, deleções nem operações remotas. |

As seis alternativas ficaram decididas; não há autorização implícita para **implementar A2/B2**. Novas decisões de negócio, mudanças de contrato/schema, custos ou operações sensíveis voltam ao proprietário.

## Release posterior

Conciliar motor e pilotos ES/EN com cinco pacotes, homologar schema remoto e preparar rollback operacional são demandas próprias. Não bloquear artificialmente revisão documental por release futura nem autorizar deploy automático.
