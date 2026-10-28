# Um nó por etapa — projeção da Trilha Viva

A mudança é exclusivamente uma projeção de runtime. Cada etapa real de uma lição ordinária é um ponto externo consecutivo; suas atividades continuam internas ao mesmo ponto. Aulas guiadas e avaliações permanecem atômicas. Bancos de diagnóstico, recuperação e prova continuam usando a rota oficial de avaliação e não viram pontos de questões individuais.

`resolveLessonStages` é a fonte canônica da partição. Quando o currículo não declara `stages`, o resolvedor existente usa uma etapa por atividade. Isso também vale para cursos sem sidecar e para cursos instalados, respeitando a disponibilidade já fornecida pelo runtime. Um curso com muitas etapas passa a ter mais pontos; a UI controla a exposição visual sem alterar essa projeção nem marcar etapas como estudadas.

## Identidade e compatibilidade

Todos os nós ordinários, inclusive os de uma única etapa, usam:

```ts
"stage:" + encodeURIComponent(lessonId) + ":" + encodeURIComponent(stageId);
```

Os componentes são escapados separadamente; o delimitador `:` nunca aparece cru dentro deles. Identidades como `["a:b", "c"]` e `["a", "b:c"]` permanecem distintas. O ID depende da identidade curricular, sem depender do título, da posição ou do agrupamento editorial. Assim, fallback, renomeação e reagrupamento do sidecar preservam o nó enquanto a identidade curricular permanecer igual. Cursos/versões/instalações continuam sendo escopos externos de navegação/evidência; o ID do nó não autoriza cruzar esses escopos.

`originMomentId` e `originMomentTitle` registram o agrupamento editorial anterior, ou o agrupamento fallback `lesson-<lessonId>`. São metadados de navegação/contexto. Uma atividade só pertence a seu próprio stage no novo percurso. Para URLs e checkpoints antigos, o Lead resolve primeiro a atividade real e, quando ela não existe no checkpoint, usa a origem para encontrar um nó elegível. Este módulo não altera o parser, o armazenamento, as rotas ou a UI. Os nós guiados e de avaliação também conservam sua identidade canônica com ou sem sidecar; a migração usa a mesma ponte de origem. Identificadores Unicode longos podem gerar IDs de navegação maiores que 180 caracteres; o limite do parser deve acompanhar o payload aceito sem truncar identidades.

As URLs novas usam `URLSearchParams` para escapar o ID completo novamente e conservar o round-trip do parâmetro `moment`. A atividade de entrada é a primeira pendente elegível do próprio stage, ou a primeira disponível do mesmo stage para revisita. Os nós atômicos usam namespaces curriculares próprios: `guided:` + `encodeURIComponent(lessonId)` para aulas guiadas e `assessment:` + `encodeURIComponent(assessmentId)` para avaliações. Todos os tipos preservam `originMomentId` e `originMomentTitle`. IDs editoriais arbitrários nunca se tornam IDs primários dos nós. Os prefixos distintos impedem colisões entre tipos, mesmo que um sidecar válido use como ID editorial a string de um nó de etapa. As identidades reais `lessonId`, `assessmentId`, atividades, evidências e rotas de execução permanecem inalteradas.

## Contexto editorial e apresentação

O Foundry pode continuar entregando os sidecars 1.0.0 atuais. Não é necessário editar conteúdo congelado, versões ou hashes curriculares para obter a expansão. O target que referencia várias etapas é expandido em vários nós no runtime.

Cada nó mostra o `title` da etapa e deriva seu ícone da primeira atividade real: cena/diagrama, conversa, leitura, escuta, retomada, aplicação ou prática. Usa apenas o enum visual já suportado; ordenação usa `target`. O ícone de um agrupamento não substitui o ícone da etapa. Descrição, objetivo, personagem, cenário, ilustração e tom do agrupamento continuam como contexto opcional; referências de áudio são filtradas às atividades do stage correspondente. Não há import de componentes React no domínio.

O contrato público não declara ícones por etapa nesta versão. Uma evolução editorial futura pode fazê-lo por contrato versionado próprio, sem misturar renderização e estado pedagógico. Esta entrega não altera schemas públicos nem sidecars originais.

## Evidência e validação

Conclusão, total e porcentagem de um nó consideram somente seus IDs reais. A expansão não transfere a conclusão de uma etapa para outra nem cria nota, domínio, revisão, prova ou evidência. `unitProgress`, `courseStudySummary`, `learningActionAvailability`, snapshot de acesso e resultado canônico permanecem as fontes oficiais.

O verificador específico é:

```powershell
node --import tsx --test scripts/verify-living-trail-stages.ts
```

Ele cobre expansão dos três primeiros tabs, fallback, identidade estável/injetiva, contexto, título/ícone, conclusão/retomada por etapa, singleton, atomicidade de avaliação/guiada, gates oficiais, indisponibilidade, imutabilidade e os cursos compilados ES/EN. Os testes antigos que exigiam 24 momentos agrupados expressam a apresentação anterior e precisam ser atualizados pelo responsável do candidato coordenado para o requisito vigente; não são alterados por este patch.
