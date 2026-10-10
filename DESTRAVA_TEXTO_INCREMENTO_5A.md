# Incremento 5A — Representação textual e propriedades

Entrega local de 2026-10-10. Apenas a Parte 5A foi implementada.
Sem commit, push, deploy, migração, seed ou API paga.

## 1. Baseline e diagnóstico confirmado

Branch `main`, checkpoint Git `a7ec750` dos Incrementos 1–3. O Incremento 4
estava presente, validado, mas ainda sem commit. Seu estado foi preservado antes
das alterações em `.tmp/increment-5a-baseline`: 68 arquivos e um manifesto com
hashes SHA-256, sem ambientes/chaves. É uma cópia local ignorada, não um novo
checkpoint Git. O [relatório do Incremento 4](DESTRAVA_CAPACIDADES_INCREMENTO_4.md)
permanece como registro daquela entrega.

| Comportamento encontrado | Classificação | Decisão |
| --- | --- | --- |
| `ordered.includes(word)` e seleção guardada como texto em `ExerciseCard` | Acoplamento indevido: valor confundido com identidade | IDs por ocorrência, seleção por IDs e texto resolvido da fonte. |
| `ordered.join(" ")` | Estratégia legítima para os exemplos atuais, indevida como regra universal | Padrão legado preservado; novo separador literal declarado. |
| Contagem por `trim().split(/\s+/)` no editor e avaliação | Estratégia que precisa ser identificada | Preservar como unidades por espaços; acrescentar medidas explícitas. |
| `minWords` e rótulo “palavras” | Compatibilidade pedagógica dos conteúdos atuais | Alias legado continua; novos limites têm medida, mínimo e máximo próprios. |
| `.normalize("NFC")`, case/whitespace e flags de correção | Normalização configurável legítima, com alcance limitado | Mantida; corrigida a interação que quebrava idempotência. |
| Multiset de tokens do registro usando `split(/\s+/)` | Limitação da validação antiga | Novas reconstruções usam prova canônica por posições, sem inferir segmentação. |
| Máximo do textarea e limite de caracteres da rota de IA | Limite de transporte, separado da medida pedagógica | Preservados; não apresentados como contagem linguística. |
| Triagem editorial por comprimento e `number-practice.ts` | Heurística editorial / módulo específico fora de 5A | Não convertidos em segmentadores universais nem reformulados. |

Arquivos investigados: `exercise-card.tsx`, `writing-editor.tsx`, `grader.ts`,
`assessment-engine.ts`, contratos/payloads, registry/negociação, runtime,
projeções públicas/seed e os verificadores anteriores.

## 2. Identidade individual e reconstrução

`src/engine/text/representation.ts` define `orderingTokens`, `selectedTokens`,
`orderingAnswer` e `reconstructText`.

Cada ocorrência possui `id`, `text` e `position`. O ID deriva de
`JSON.stringify([activityId, sourcePosition])`; não depende de texto único,
UUID aleatório ou objeto React. Duas ocorrências iguais têm IDs diferentes.
Recriar a mesma fonte em outro render produz os mesmos IDs. A fonte é imutável
durante a atividade; editar/reordenar o conteúdo é uma revisão da fonte, não
uma promessa de identidade entre versões editoriais.

Antes:

```ts
const selected = ["que"];
["que", "que"].map(word => selected.includes(word)); // [true, true]
```

Depois:

```ts
const tokens = orderingTokens("q1", ["que", "que"]);
selectedTokens(tokens, [tokens[0].id]); // só a primeira ocorrência
orderingAnswer(tokens, [tokens[0].id, tokens[1].id]); // "que que"
```

O chip escolhido pode ser removido e sua ocorrência volta a ficar disponível,
sem afetar a outra. A ordem da resposta é a ordem dos IDs selecionados.
IDs desconhecidos, duplicados ou dados inválidos são recusados. O critério de
correção continua sendo o texto canônico normalizado; identidade controla a
interação, não cria uma exigência nova de pontuação por ID.

### Estratégia mínima de junção

Uma única estratégia satisfaz os casos comprovados:

```json
{ "strategy": "separator", "separator": "" }
```

Espaço, vazio e outro separador literal são valores da mesma operação. Não
existe expressão, regex ou script do produtor. Sem declaração, o comportamento
legado continua usando um espaço. Não foi implementado um segmentador/reconstrutor
específico para uma língua.

Para declarar reconstrução nova, a atividade fornece também `answerOrder`, uma
permutação privada das posições de origem. Exemplo:

```json
{
  "words": ["que", "a", "que"],
  "reconstruction": { "strategy": "separator", "separator": "|" },
  "answerOrder": [2, 1, 0],
  "answer": "que|a|que"
}
```

Isso permite verificar se a resposta é obtida dos elementos declarados, mesmo
sem espaços, com tokens de várias letras ou repetidos. A prova não tenta dividir
o gabarito por caracteres nem descobrir uma segmentação linguística. É um
gabarito canônico, não uma exclusão de outras permutações que gerem o mesmo texto.

`answerOrder` fica fora do payload público e das tabelas públicas. O seed
preparado conserva o campo somente no JSON de respostas privadas, sem migração
ou execução de seed nesta tarefa. A resposta enviada pelo aluno permanece texto;
não se modifica o formato de progresso persistido para guardar IDs de chips.

## 3. Medidas e limites de escrita

Schemas neutros em `src/content/text-strategies.ts`:

| Estratégia | Medida exata |
| --- | --- |
| `whitespace_units` | Blocos não vazios separados por whitespace. É o comportamento legado, não uma definição universal de palavra. |
| `code_points` | Elementos do iterador de pontos de código, em texto UTF-16 bem formado. |
| `graphemes` | Clusters de grafemas de `Intl.Segmenter`, sem confundir isso com pixels, letras ou palavras linguísticas. Espaços/controles também podem formar clusters. |
| `intl_words` | Segmentos `isWordLike` de `Intl.Segmenter`, com locale BCP 47 explícito e suportado. |

Antes, `e` + acento combinante e uma família com ZWJ eram apenas parte de um
bloco sem espaços. Agora a medida é explícita: `e\u0301` tem dois pontos de código
e um grafema; uma família com ZWJ tem vários pontos de código e um grafema.
O texto original não é normalizado para medir nem alterado para exibir.

Escrita nova:

```json
{
  "guidance": [],
  "textRequirement": {
    "measure": { "strategy": "graphemes" },
    "minimum": 2,
    "maximum": 10
  }
}
```

`textRequirement` e `minWords` são mutuamente exclusivos. Sem a declaração nova,
`minWords` mantém o mínimo anterior por unidades separadas por espaços, inclusive
valores antigos não negativos. Novos mínimos/máximos são inteiros. Os limites
valem inclusive nas bordas; máximo abaixo do mínimo é inválido.

Editor e avaliação no servidor usam `evaluateWritingText`. O editor apresenta
a unidade real e impede salvar/corrigir abaixo ou acima do limite. A avaliação
fixa continua registrando entrega de escrita com `correct: null`, sem inventar
nota objetiva. A rota de feedback por IA também verifica a medida antes de
chamar o provedor; nenhuma chamada paga foi feita.

As estratégias Intl exigem a API nativa. `intl_words` verifica sintaxe e
`supportedLocalesOf` antes de segmentar: não recorre silenciosamente a outro
locale ou à separação por espaços. A checagem no cliente também marca a atividade
e sua política como indisponíveis quando o navegador não oferece a medida. Falta de runtime/locale é indisponibilidade,
não incompatibilidade estrutural nem reprovação do aluno. Surrogates UTF-16
isolados e estratégias desconhecidas são rejeitados de forma controlada.

## 4. Normalização e propriedade descoberta

Os testes revelaram uma falha que os exemplos anteriores não cobriam:

```text
"value? . " → normalização antiga: "value?"
"value?"   → segunda normalização: "value"
```

Remover pontuação podia revelar espaços; trim podia revelar mais pontuação.
Remover diacríticos também podia revelar pontuação ou juntar whitespace.
O normalizador agora limpa essas fronteiras em passes lineares conforme as
flags existentes, produzindo um ponto fixo. Não foi usado um laço quadrático
por caractere nem ampliado o conjunto de pontuação/diacríticos suportados.

NFC, case insensitivity, colapso de whitespace e as regras declaradas continuam
aplicados. Com flags desligadas, espaços/case/pontuação são preservados. Os
exemplos ES/EN continuam aprovados. O parâmetro original é uma string imutável;
normalização não altera o texto armazenado, digitado ou usado para contagem.

## 5. Contratos e registro de capacidades

Não houve mudança de schema de língua (1.1) nem de curso experimental (1.3).
A estratégia pertence à atividade: atividades do mesmo idioma podem exigir
medidas diferentes. Não se criou uma configuração global que imponha uma única
noção de palavra a toda a língua.

- `activity.ordering` e `activity.writing` aceitam **1.0.0 e 1.1.0** por lista exata.
- Cada versão tem seu schema; 1.0.0 rejeita campos novos e conserva seus dados
  antigos. A inferência nativa escolhe 1.1.0 apenas quando campos novos são usados.
- `text.reconstruction@1.0.0` e `text.measurement@1.0.0` foram registrados após
  implementação e testes. O registro passa a **39 capacidades: 38 implementadas
  e uma parcial**; não anuncia suporte completo a uma língua.
- Catálogo **1.1.0** acrescenta `dataSchemasByVersion`. Um produtor deve consultar
  o schema da versão solicitada, não assumir que a versão mais nova seja compatível.
- Requisitos textuais derivados e suas estratégias permanecem na conversão para
  o runtime. API/renderer não podem ignorar uma medida ou junção declarada.
- A verificação arquitetural cobre o motor textual, seus executores e contratos
  neutros; estes não importam UI, banco, infraestrutura ou provedores.

## 6. Testes e resultados

| Verificação | Resultado |
| --- | --- |
| `text:verify` | 11 grupos; **12.232 assertions geradas/metamórficas**, seed reproduzível `0x5a17`. |
| Identidades e reconstrução | 500 fontes/permutação, duplicatas, seis separadores, seleção única, retorno da ocorrência e ausência de mutação. |
| Unicode e normalização | 300 composições e 32 combinações de flags; NFC, idempotência, code points/grafemas, limites e casos inválidos. |
| Runtime/privacidade/avaliação | Estratégias preservadas, permutação inválida recusada, gabarito removido das fronteiras públicas, escrita continua sem nota objetiva. |
| `text:verify:ui` | Chrome real, React real, viewport 390px: duplicatas, remoção, reuso, correção por texto reconstruído e mínimo/máximo por grafemas. Zero exceções de runtime ou requests externos. |
| Contratos/capacidades | 24 regressões de fronteira e 31 cenários de capacidades aprovados; seis módulos neutros e schemas compartilhados. |
| Avaliações/políticas/integridade | 23, 24 e 13 cenários respectivamente aprovados. |
| Adaptativo/multilíngua/aprendizagem/onboarding/aulas/tempo | Aprovados; caminhos 1.024 ES, 1.024 EN e oito sintéticos. |
| Conteúdo | Três pacotes válidos, sem alteração de currículo. |
| TypeScript/ESLint/arquitetura | Aprovados. |
| `build:local` | Aprovado — Next.js 16.3.8 e TypeScript. |

O browser test usa um servidor de fixture efêmero em `127.0.0.1:3001`, não cria
rota do produto nem modifica conteúdo canônico. Esbuild já existe como dependência
do tsx; foi reutilizado para empacotar os componentes reais, sem nova biblioteca
de teste ou framework de property-based testing. Supabase e IA ficam desconfigurados
no bundle de teste. A única correção HTTP usa o executor real com dados sintéticos.
O servidor e o perfil do browser são encerrados; artefatos ficam somente em `.tmp`.

Não foi necessária persistência real para estes casos: não houve conta, migração,
seed ou atualização de banco. Ambiente observado: Node v24.18.0, ICU 78.3,
Unicode 17.0. O app/build usam o perfil local protegido do checkpoint.

### Invariantes comprovados

1. Texto igual não implica identidade igual.
2. Cada ocorrência é usada uma vez; remover uma não remove/desabilita a outra.
3. Ordem de IDs determina a sequência; nenhuma duplicata se perde.
4. Reconstrução obedece ao separador literal e não modifica os elementos de origem.
5. Medida e limites são explícitos e compartilhados por UI/servidor.
6. Normalização é idempotente sob as flags e preserva a entrada original.
7. Runtime/locale ausente não produz fallback linguístico ou nota fictícia.
8. Gabarito e permutação canônica continuam privados.

## 7. Limitações e validação manual

- ICU/Unicode e dados de locale podem variar entre browser e servidor. Não se
  provou segmentação linguística correta em todos os idiomas nem identidade de
  resultados entre versões diferentes. Essa compatibilidade exige validação
  própria antes de usar limiares muito próximos em ambientes distintos.
- `intl_words` conta `isWordLike`; não é análise morfológica. O texto sem espaços
  pode ter resultados diferentes conforme a medida/locale escolhido.
- Identidades derivadas de posições pertencem à fonte da atividade/revisão.
  Não se guardam seleções parciais de tokens para reconciliar revisões editoriais.
- Textarea mantém seu teto de 3.000 unidades UTF-16; a rota de IA mantém os limites
  anteriores de caracteres e seu tratamento de entrada. Esses limites de transporte
  não foram transformados em medidas linguísticas. Texto salvo/avaliado e feedback
  por IA são caminhos distintos, com pré-condições distintas.
- Pontuação e remoção de diacríticos do normalizador continuam com alcance limitado
  descrito no catálogo. Não foi criado suporte universal a variantes, RTL, tons,
  transliteração, escrita manual, números ou voz.
- Revisar em aparelhos reais: teclado virtual, toque, acessibilidade dos chips,
  leitura dos limites e comportamento próximo ao teto de transporte.

Referências primárias: [ECMA-402 / Intl.Segmenter](https://402.ecma-international.org/#sec-intl.segmenter)
define segmentação e suporte de locales; `isWordLike` depende da implementação.
[Unicode UAX #29](https://www.unicode.org/reports/tr29/) define as fronteiras e
clusters Unicode, que não equivalem automaticamente a palavras linguísticas.

## 8. Aprendizado: exemplos versus propriedades

1. **Pressupostos:** texto único, espaço entre todos os elementos e blocos por
   espaços tratados como palavras. Estavam em seleção, junção e contagem.
2. **Por que pareciam funcionar:** as atividades ES/EN geralmente usam palavras
   distintas, espaçamento convencional e mínimos compatíveis com esse formato.
3. **Quando falham:** duas ocorrências iguais, tokens compostos, texto sem espaços,
   separadores diferentes, emoji com ZWJ e marcas combinantes.
4. **Nova modelagem:** identidade é ID/posição; valor é texto; reconstrução é uma
   função declarada; limite é medida + mínimo/máximo, não uma regra global.
5. **Exemplos x propriedades:** um exemplo verifica “que que”. Uma propriedade
   verifica que qualquer seleção válida mantém todas as ocorrências da fonte e
   sua ordem, em muitas combinações de entradas e separadores.
6. **Como descobrem erros:** entradas determinísticas variadas atravessam fronteiras
   não lembradas manualmente. A idempotência revelou a pontuação que uma segunda
   normalização removia. A seed permite reproduzir a falha.
7. **Reuso:** carrinhos com itens iguais, tabelas com rótulos repetidos, editores,
   inventário e conciliação precisam separar identidade de valor. Serializadores,
   filtros e conversores se beneficiam de round-trip, ausência de mutação,
   idempotência e limites inclusivos.
8. **O que resta:** escolher medidas pedagogicamente adequadas, calibrar locale/
   runtime, tratar revisões editoriais e ampliar normalização onde houver prova
   de necessidade. Passar propriedades não certifica a qualidade de todo idioma.
9. **Quando generalizar demais é ruim:** um DSL de reconstrução, plugins de código
   ou segmentação artesanal de línguas sem requisito/teste seriam complexidade
   adicional. Um separador literal e quatro medidas nativas resolveram este escopo.

## 9. Recomendação para 5B

Submeter esta parte à revisão primeiro. Recomenda-se que o planejamento de 5B
defina o alcance de normalização/correção por perfil e um critério verificável
para diferenças de ICU/locale entre runtimes. Priorizar fixtures negativas e
contratos claros antes de anunciar suporte linguístico ampliado.
Não foram iniciadas 5B ou 5C, importador, API DLF ou interface administrativa.

## 10. Arquivos alterados nesta parte

29 arquivos diferentes da baseline local do Incremento 4; esta lista separa 5A do diff acumulado sem realizar commit. Variacoes geradas de next-env.d.ts e workspace pessoal ficam fora do escopo.

```text
DESTRAVA_ARQUITETURA_MULTILINGUA.md
DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md
DESTRAVA_TEXTO_INCREMENTO_5A.md
README.md
contracts/engine-capabilities-v1.json
package.json
scripts/capability-implementation-check.ts
scripts/check-architecture.ts
scripts/checkpoint-browser.d.mts
scripts/checkpoint-browser.mjs
scripts/seed-supabase.ts
scripts/verify-local-checkpoint.tsx
scripts/verify-text-representation.tsx
scripts/verify-text-ui.tsx
src/app/api/ai/writing/route.ts
src/components/activities/exercise-card.tsx
src/components/activities/writing-editor.tsx
src/content/activity-data.ts
src/content/public.ts
src/content/text-strategies.ts
src/domain/activities/grader.ts
src/domain/assessments/assessment-engine.ts
src/engine/capabilities/compatibility.ts
src/engine/capabilities/package-compatibility.ts
src/engine/capabilities/registry.ts
src/engine/text/representation.ts
src/lib/assessment-api.ts
src/lib/client-capabilities.ts
src/repositories/activity-content-projection.ts
```
