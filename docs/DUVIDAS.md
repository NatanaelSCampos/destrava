# Destrava — decisões abertas

Atualização documental: 23/10/2026. Fonte de escopo: [Ciclo 2](features/fase4-ciclo2/spec.md). Recomendações técnicas não substituem escolhas do proprietário.

## Confirmado

- Reconciliação: PR #2 integrada em `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, árvore homologada `24b31199507e901bc9cacb9058756244bf4fa0c6`.
- Metodologia Do Chat ao Commit adotada na PR #1 e confirmada pelo proprietário; não criar processo paralelo.
- Tarefa atual autoriza sincronização e PR exclusivamente documental, não implementação ou merge.
- Execução futura requer decisões/spec aprovadas e autorização expressa apontando para registro versionado. Merge desta proposta não inicia agentes automaticamente.

## Escolhas do proprietário para Ciclo 2

| ID | Questão e alternativas | Recomendação para revisão, ainda não aprovada | Bloqueia |
| --- | --- | --- | --- |
| C2-A01 | Pausa só automática por visibilidade/inatividade ou botão explícito persistido? Retomar conserva plano/tempo ou também etapa? | Pausa/retomada explícitas, etapa/plano/tempo confirmados e tempo inativo congelado; delimitar campos internos antes de implementar | A2-T2 / A2-02 |
| C2-A02 | Diagnóstico recupera respostas em andamento após reload ou somente resultado confirmado? Incluir diagnóstico fixo além do adaptativo principal? | Priorizar adaptativo real e resultado confirmado; decidir rascunho/matriz fixa separadamente, sem prometer persistência inexistente | A2-T3 e parte A2-02/07 |
| C2-B01 | Apoio vem do curso ou aluno poderá sobrescrever? Narração por botão ou automática? | `course.sourceLanguage` e início sob demanda; sem nova preferência global nem dependência de autoplay | B2-T1/T2 / B2-01/03 |
| C2-B02 | Retomar utterance ou reiniciar frase/âncora? TTS pausa mídia/timeline ou só silencia? Velocidade única? | Uma reprodução ativa, mídia pausada ao iniciar TTS e retomada explícita em frase/âncora; sem posição exata por palavra antes de testes | B2-T2/T3 / B2-03 |
| C2-B03 | Fallback de apoio exato ou mesma língua? Tratamento de linha legada/mista e papel de followUp? Ampliar seletor de vozes de apoio? | Texto se idioma indeterminado, sem detecção por string; papel explícito de followUp; fallback mesma língua só se aprovado. Não criar tela nova de vozes por inferência | B2-T1/T4 / B2-02/04/05 |
| C2-O01 | Qual checkout/stack local para integração e como tratar políticas extras do banco conhecido? | Lead comprova labels/workdir/loopback, agenda sequencial e testes retentivos. Bootstrap/schema/dados exigem autorização separada | G1 e SQL/HTTP/browser |

Encerrar sessão mantém políticas declaradas; não se propõe domínio extra por tempo. Aula/IA/voz/SRS instalada continuam fora de escopo. As respostas deverão ser registradas e refletidas no aceite antes das tarefas dependentes; nenhuma recomendação foi aplicada ao runtime.

## Release posterior

Conciliar motor e pilotos ES/EN com cinco pacotes, homologar schema remoto e preparar rollback operacional são demandas próprias. Não bloquear artificialmente revisão documental por release futura nem autorizar deploy automático.
