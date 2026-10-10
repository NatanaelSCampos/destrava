# Sistemas de escrita e apresentação multilíngue no Incremento 5C

Implementação local de 2026-10-10. A direção do texto educacional agora tem resolução e apresentação reutilizáveis. A interface permanece em português/LTR, enquanto conteúdo e entradas usam metadados e isolamento sem alterar a ordem lógica, a correção ou as políticas de aprendizagem. Esta entrega não certifica suporte pedagógico completo a idiomas RTL.

## A Diagnóstico inicial

### Preparação e recuperação

Branch `main`, HEAD `a7ec750`, checkpoint dos Incrementos 1–3. Os Incrementos 4, 5A e 5B estavam sem commit e foram preservados. A cópia local ignorada `.tmp/increment-5c-baseline` contém 311 arquivos do projeto, manifesto de hashes e branch/HEAD. Cada cópia foi conferida antes da primeira mudança. Perfis `.env*` e o arquivo pessoal `.code-workspace` não foram copiados nem alterados. O índice Git permaneceu vazio.

### Classificação do comportamento anterior

| Área confirmada no código | Classificação antes de 5C | Evidência e decisão |
| --- | --- | --- |
| Identidade de tokens, reconstrução e medidas do 5A | 1 Independente da direção | Operações sobre valores lógicos. Preservadas, sem inverter strings ou arrays. |
| Preferência e restrição de variante do 5B | 1 Independente da direção | Contexto pedagógico não determina sozinho a direção de cada trecho. Preservado. |
| `LanguagePackage.writingSystem.direction` | 5 Apresentação não implementada | Campo existente, sem consumo consistente nas telas. Agora há resolvedor e requisitos de capacidade. |
| `RootLayout` | 2 Compatível com configuração | `lang="pt-BR"` definia idioma da UI. Agora declara também seu `dir="ltr"`; não acompanha automaticamente a língua do curso. |
| Perguntas e textos com `lang` | 4 Parcialmente compatível | Idioma marcado em parte dos textos, sem direção/isolamento. `lang` não estabelece direção. |
| Input de resposta e editor de escrita | 3 Dependente de LTR | Herdavam direção da UI e Enter não considerava composição. Agora usam entrada nativa com `dir`, isolamento e guarda de composição. |
| Ordenação visual de tokens | 4 Parcialmente compatível | IDs/reconstrução corretos, mas containers herdavam LTR. Agora direção visual é declarada sem alterar a sequência lógica. |
| Conversação e transcrições | 4 Parcialmente compatível | Textos livres, exemplos e correções misturavam direções sem separar as fronteiras. Agora origem/alvo/aluno são tratados separadamente. |
| Quadro, comparações e legendas da aula particular | 4 Parcialmente compatível | Dados eram preservados pelo executor; apresentação não resolvia direção nem a diferença entre exemplo e tradução. Renderizador compartilhado foi extraído. |
| Dicionário, fundamentos, revisão e resultados | 4 Parcialmente compatível | Marcação incompleta, traduções e produção do aluno nem sempre tinham fronteiras próprias. Consumidores centrais receberam contexto. |
| CSS de atividades | 3 Dependente de LTR | `padding-left`, `margin-left` e alinhamentos físicos. Trocados por propriedades/valores lógicos nesse stylesheet. |
| CSS do shell e controles de navegação | 1 Independente do conteúdo | Posicionamento físico pertence à interface LTR. Não foi espelhado para acompanhar o conteúdo. |
| IMEs reais, leitores de tela e algoritmos específicos de escrita | 4 ou 5 | Entrada nativa existe; não havia qualificação de IMEs/dispositivos nem algoritmos de caligrafia ou escrita vertical. Esses limites continuam explícitos. |

Não foi necessária reescrita do executor de aulas ou redesign. As mudanças de consumidores são a aplicação de uma fronteira de apresentação comum.

## B Arquitetura implementada

### Resolução central

`src/content/text-presentation.ts` é neutro, com schemas Zod. `src/engine/presentation/text.ts` resolve idioma e direção por papel do texto, perfil e declaração do conteúdo. Não compara nomes de idiomas ou inverte caracteres.

| Papel | Idioma padrão | Direção padrão | Declaração específica |
| --- | --- | --- | --- |
| Controles da interface | `pt-BR` | `ltr` | Conteúdo não altera esse contexto. |
| Texto alvo | ID do perfil linguístico | `writingSystem.direction` | Campo específico, seguido de `presentation.content`. |
| Explicação/tradução | `course.sourceLanguage`, com fallback da interface | `auto` | Campo específico pode declarar outro idioma/direção. |
| Produção do aluno | Idioma de aprendizagem | `auto` | Campo de entrada pode exigir direção explícita. |
| Fragmento independente/token misto | Idioma de aprendizagem | `auto` | Metadado específico pode substituir a detecção nativa. |

O padrão de um texto alvo é o perfil, não um palpite pelo nome da língua. `auto` serve para conteúdo cuja primeira direção forte pode variar. Dados numéricos ou neutros seguem o comportamento nativo de fallback do HTML. As opções não alteram a variante pedagógica resolvida em 5B nem o locale de serviços ou das medidas do 5A.

Perguntas, títulos, orientações e corpos explicativos existentes usam o papel de origem. Os exemplos/respostas usam o alvo. Um produtor que use outro papel em um campo deve declará-lo nos metadados; o motor não infere o idioma de uma frase em prosa. A UI não ganhou um sistema completo de localização.

### Contratos e versões

Cursos continuam aceitando **1.3/1.4** e passam a aceitar **1.5**. Os metadados novos exigem 1.5, para que um consumidor anterior não ignore informação de apresentação. `LanguagePackage` permanece **1.1**; seu campo de direção já existia.

```json
{
  "presentation": {
    "content": { "language": "idioma-alvo", "direction": "rtl" },
    "fields": {
      "prompt": { "language": "pt-BR", "direction": "ltr" },
      "example": { "language": "en", "direction": "ltr" },
      "tokens": { "direction": "auto" }
    }
  }
}
```

Os campos são finitos e estritos. Metadados são dados, sem HTML/CSS executável ou regras por idioma. A resolução interpreta a declaração somente no campo em que ela é consumida; não transforma toda a atividade ou aplicação em RTL. O runtime e a projeção pública preservam esses dados públicos; gabaritos permanecem privados.

O quadro recebe `textPresentation`, comparações recebem `leftPresentation`/`rightPresentation`, e linhas de transcrição/ações de legenda podem declarar `textPresentation`. O estado da legenda preserva o metadado durante replay; uma legenda nova sem declaração limpa a anterior. O algoritmo de execução, cues e progressão da aula permanece o mesmo.

### Componentes e CSS

- `LearningText` e `useTextPresentation` aplicam `lang`, `dir` e uma fronteira identificável de texto. Fragmentos inline usam `bdi`; textos estruturais usam elementos próprios com direção declarada.
- `LearningInput` e `LearningTextarea` preservam valor, seleção, cursor e handlers nativos. Composição ativa bloqueia o handler de envio por Enter e a confirmação nos fluxos centrais. O evento de composição não é cancelado para forçar comportamento visual.
- Inputs em `auto` acompanham a entrada; textarea usa `unicode-bidi: plaintext` para seus parágrafos. Quando o autor força RTL, o hint em português sai do placeholder para um elemento LTR associado por `aria-describedby`.
- `learning-text.css` aplica isolamento, alinhamento `start` e quebra de conteúdo longo. O CSS de atividades usa margens/paddings lógicos. O shell LTR e o CSS físico que representa navegação permanecem na orientação da UI.
- `LearningBoard` é usado pela aula particular e pelos testes. Exemplos, comparações, legendas e traduções têm fronteiras separadas, sem duplicar seu executor.
- Botões de ouvir declaram o idioma/direção da UI, mesmo junto de texto RTL. Apresentação de um trecho em outra língua não muda automaticamente a voz do curso; o fluxo operacional do 5B continua separado.

Os consumidores ajustados incluem exercícios, escrita, fala, avaliações adaptativas, conversação, imagem, tutor, fundamentos, vocabulário, revisão, erros/resultados e aula particular. Alguns textos opacos que misturam termo e tradução continuam usando isolamento/detecção da frase inteira; não foi criado um contrato geral de rich text com marcação interna arbitrária.

### Segurança e suporte anunciado

React continua escapando strings. O novo componente não expõe `dangerouslySetInnerHTML` como prop pública. `inspectBidiControls()` identifica marcas, isolates, embeddings e overrides, sem remover ZWJ/ZWNJ ou caracteres linguísticos legítimos. Overrides/embeddings e isolates desequilibrados recebem aviso explícito nos componentes que inspecionam o texto.

Isolamento evita interferência com vizinhos; não torna uma sequência interna enganosa automaticamente segura. O aviso não substitui políticas de moderação, revisão editorial ou inspeção de todos os campos de identidade/URL da plataforma. Textos que ainda usam apenas atributos recebem isolamento, sem inspeção individual completa de seus caracteres. Nada é apagado ou adicionado ao texto armazenado para ajustar a aparência.

Catálogo **1.3.0**, com **44 capacidades**: 43 implementadas, uma parcial. Novas entradas:

| Capacidade | Execução e limite |
| --- | --- |
| `presentation.direction@1.0.0` | Resolução horizontal LTR/RTL/auto. Não implementa tipografia vertical. |
| `presentation.bidi@1.0.0` | HTML semântico, isolamento e CSS lógico para texto simples/fronteiras independentes. Não certifica idioma ou rich text arbitrário. |
| `text.input@1.0.0` | Entrada nativa com direção e guarda de composição. Sistema operacional/IME/leitor de tela dependem de homologação real. |

Requisitos nativos são inferidos pelo motor atual. O produtor deve também declarar capacidades obrigatórias no contrato quando precisar proteger a negociação com outros consumidores. Capacidade ausente/indisponível bloqueia atividade; não gera nota, erro do aluno ou conclusão fictícia. Caligrafia permanece desconhecida/não suportada; números continuam com a capacidade parcial já existente.

## C Exemplos e diferenças

Antes, `<span lang={course.languageCode}>` identificava uma língua mas herdava LTR. Agora o mesmo conteúdo recebe direção do perfil e isolamento. Uma explicação em português permanece em sua fronteira de origem, enquanto o exemplo RTL ao lado recebe a direção apropriada.

```tsx
<LearningText text="שלום ABC-12 (42)" />
<LearningText
  presentation={{ content: { language: "en", direction: "ltr" } }}
  text="ABC 12 (34)"
/>
<LearningTextarea value={text} onChange={(event) => setText(event.target.value)} />
```

Essas strings são fixtures de caracteres, não material pedagógico aprovado. O navegador calcula a ordem visual, inclusive a dos números e sinais. `text` continua na sequência original.

Ordenação usa três ocorrências independentes: `שלום`, `ABC-12`, `שלום`. O container RTL posiciona a primeira seleção à direita; os IDs continuam `[atividade, 0]`, `[atividade, 1]`, `[atividade, 2]`. A resposta continua `parts.join(" / ")`. Não há `row-reverse`, `.reverse()` de dados, alteração do gabarito ou caracteres direcionais inseridos pelo motor.

Na entrada, o teste seleciona os índices lógicos de `שלום`, substitui o trecho com inserção nativa por `مرحبا`, move o cursor com uma tecla real do browser e salva exatamente:

```text
مرحبا ABC-12 (42)
é你好
```

O `é` desse teste é uma sequência de dois code points e um grafema. O 5A continua contando e validando a mesma representação, sem normalizar o valor somente para exibição.

## D Validação

### Resultados automáticos

| Verificador | Evidência |
| --- | --- |
| `presentation:verify` | 12 grupos; direção, metadados/versão, Unicode, ordem lógica, controles, replay do quadro, indisponibilidade, privacidade, capacidades e compatibilidade dos pacotes atuais. |
| Propriedades 5C | 12.000 verificações geradas, seed `0x5c17`: direção não altera partes, IDs, reconstrução ou declarações. |
| `presentation:verify:ui` | Chromium/React reais, CSS do projeto e fonte do sistema; isolamento, RTL, LTR aninhado, texto misto, HTML escapado, controles sinalizados, hints/foco, composição, seleção, cursor, escrita salva e teclado na ordenação. Duas correções reais no grader simulado; zero chamadas pagas. |
| Viewports | Larguras reais de `innerWidth`, `visualViewport` e `scrollWidth` iguais a 360, 390 e 768 px; sem expansão silenciosa do viewport. |
| `text:verify` e UI | 11 grupos e 12.232 verificações do 5A; interação real com tokens repetidos e medidas textuais preservada. |
| `variants:verify` e UI | 20 grupos e 7.000 verificações do 5B; preferências/restrições, transporte simulado e fallback de voz preservados. |
| Contratos/capacidades/arquitetura | 24 regressões de dependência, oito módulos neutros, sem ciclos; 31 casos de capacidades e 44 bindings/entradas coerentes. |
| Avaliações/políticas | 23 cenários de semântica, 24 de políticas; caminhos adaptativos ES/EN/sintético preservados. |
| Outros gates | Multilíngua, aprendizagem, sincronização, onboarding, interatividade, tempo de sessão, validação e triagem pedagógica passaram. |
| TypeScript, ESLint e build | Passaram localmente; avisos novos de imports não usados foram removidos. |
| Integração local | 14 cenários com autenticação, progressos, avaliações, políticas e browser, exclusivamente no Supabase local. A apresentação RTL nova usa fixtures, sem instalar curso novo no banco. |

O wrapper comprovou projeto Docker `espanhol-plataform`, daemon local e API `http://127.0.0.1:54321`. O navegador de integração permitiu apenas essa API e `http://127.0.0.1:3000`, com zero erros de runtime e requests externos/bloqueados. As duas contas e o arquivo sintéticos foram removidos ao finalizar. Não foi executada migração ou seed neste incremento.

O helper do navegador ganhou eventos nativos de teclado/inserção. Uma primeira falha de ativação por Enter revelou que o simulador emitia um evento incompleto; foi corrigido o helper, preservando os botões nativos. Os screenshots desativam apenas a animação de rolagem da fixture para registrar posições estáveis. A fonte do sistema é usada para evitar chamadas externas; tipografia de dispositivos reais continua pendente.

### Cobertura dos 27 cenários solicitados

| Cenários | Cobertura |
| --- | --- |
| 1–6 Direcionalidade | Resolvedor puro e DOM real: LTR/RTL, UI LTR, LTR dentro de RTL, números/pontuação, atributos e fallback documentado. |
| 7–12 Escrita | Entrada/seleção/inserção nativas, ArrowLeft, índices lógicos, texto composto e sem espaços, medida e valor salvo sem reversão. |
| 13 IME | Eventos sintéticos de composição e Enter, guarda/retomada no input real. Não é certificação do IME do sistema operacional. |
| 14–18 Atividades | Tokens repetidos, geometria RTL em ordem lógica, sequência corrigida pelo grader e fronteiras separadas de respostas/feedback/quadro. |
| 19 Indisponibilidade | Capacidade mandatória bloqueada em teste negativo; não há evidência fictícia. |
| 20–22 Regressões | ES/EN/xx-Test, variantes, avaliações e políticas verificadas. |
| 23–25 Acessibilidade/layout | Tab/Enter reais, foco em controle nativo, labels/hints associados e sem overflow nas larguras testadas. Leitura por assistiva real permanece manual. |
| 26–27 Privacidade/suporte | Projeção/seed sem answer/answerOrder/answerPolicy; catálogo distingue capacidades implementadas, limitações e algoritmos desconhecidos. |

Screenshots locais, inspecionados: `.tmp/presentation-rtl-390.png`, `.tmp/presentation-ordering-390.png` e `.tmp/presentation-writing-390.png`. A fixture roda temporariamente em `127.0.0.1:3001`; o servidor e o perfil de browser são encerrados ao finalizar. A aplicação normal permanece em `127.0.0.1:3000`.

### Precisão das referências

O HTML declara a direção; o CSS adapta alinhamento e espaçamento. A língua não substitui `dir`, e strings desconhecidas podem usar `auto`. Essa separação segue [Structural markup and right-to-left text da W3C](https://www.w3.org/International/questions/qa-html-dir). O isolamento de trechos usa [Inline markup and bidirectional text](https://www.w3.org/International/articles/inline-bidi-markup/). As propriedades usadas estão em [CSS Logical Properties and Values](https://www.w3.org/TR/css-logical-1/).

Metadados de língua e direção não são intercambiáveis; a separação também é descrita em [Strings on the Web da W3C](https://www.w3.org/TR/string-meta/). Esses padrões orientam a renderização, sem validar currículo, significados ou qualidade linguística.

## E Aprendizado de engenharia

1. **Idioma, escrita e direção:** o idioma identifica a língua; o sistema de escrita descreve características; `dir` define a base de apresentação. Uma frase inglesa pode aparecer dentro de um curso RTL e precisar de sua própria fronteira LTR.
2. **RTL além do alinhamento:** alinhar à direita muda a posição do bloco, sem informar como números, sinais e palavras se organizam. A implementação usa HTML semântico e CSS lógico.
3. **Ordem lógica e visual:** a lógica é a sequência de caracteres/IDs armazenada. A visual é calculada no browser. Na ordenação, os três IDs não são invertidos para acompanhar a tela.
4. **Processamento bidirecional:** o navegador combina direção base, propriedades dos caracteres e fronteiras isoladas para apresentar os trechos. O motor deixa esse trabalho ao navegador e fornece as informações declaradas.
5. **Características declaradas:** `writingSystem.direction` e os metadados substituem testes de nomes de idiomas. Uma fixture nova usa o mesmo componente e algoritmo.
6. **Componentes reutilizáveis:** `LearningText`, inputs e `LearningBoard` recebem contexto, mantendo os controles e a política da aula separados. O mesmo editor serve a entrada LTR, RTL e mista.
7. **Limite da internacionalização:** apresentar caracteres corretamente não prova que uma tradução, construção ou avaliação está certa. Essa validação continua com conteúdo aprovado e Evals próprios.
8. **Testes com características diferentes:** usamos letras RTL, Latin, números, pontuação, Unicode composto, texto sem espaços e repetição; verificamos valores e geometria, em vez de mudar só a aparência de uma fixture ES.
9. **Conteúdo externo:** HTML pode tentar executar código; controles de direção podem enganar dentro de uma string. Escapar HTML, isolar trechos e expor controles são proteções diferentes. Não apagar indiscriminadamente caracteres legítimos.
10. **Reutilização em outros produtos:** nomes, endereços e mensagens em e-commerce, atendimento ou dashboards podem ter direção distinta dos botões. Preserve o identificador lógico, isole seu texto e use o contexto apropriado para cada campo.

### Desafio prático

Em uma interface portuguesa, um curso tem direção RTL. O aluno seleciona tokens `שלום`, `ABC-12`, `שלום`, com separador ` / `. Para exibir corretamente, você deve inverter o array ou declarar a direção do container? Como apresentar uma tradução portuguesa ao lado?

Resposta esperada: manter os IDs e o array na ordem lógica; declarar RTL no container e isolar os tokens. A tradução recebe sua própria fronteira de origem/auto ou LTR explícito. O grader compara a reconstrução original; o navegador resolve a ordem visual.

## F Próximas etapas e limites

**Base de apresentação aprovada tecnicamente no escopo testado.** O Incremento 6 não foi iniciado. Seu planejamento deve consolidar o contrato público/compatibilidade e a qualificação das capacidades, usando essa base declarativa.

Pendências de homologação:

- IMEs reais em Android/iOS/desktop, teclado virtual, cursor visual, seleção entre scripts e caracteres complexos.
- Leitores de tela e fontes/fallbacks reais. A semântica HTML foi verificada, sem afirmar a leitura correta de um idioma sintético.
- Conteúdo editorial legítimo com direção por fragmento, especialmente campos opacos que concatenam termo/tradução. Um contrato geral de rich text permanece fora da entrega.
- Mapeamentos de voz por trecho em outra língua, se forem necessários; esta apresentação não reconfigura os provedores do 5B.
- Políticas de conteúdo externo e revisão editorial de controles bidirecionais. Os avisos não eliminam toda possibilidade de spoofing.
- Cursos RTL reais e suporte pedagógico, tipografia vertical, transliteração, tons, caligrafia e algoritmos específicos de escrita. Não foram implementados nem anunciados como suporte completo.

Nenhum curso real novo, dependência, framework, importador ou interface administrativa foi adicionado. Não houve commit, push, deploy, migrações ou acesso a APIs pagas.

## Arquivos alterados

O delta abaixo considera a baseline imediatamente posterior ao 5B; mudanças anteriores permanecem preservadas. Perfis de ambiente, artefatos temporários e o arquivo pessoal de workspace não integram a entrega.

<!-- 5C delta -->

```text
DESTRAVA_APRESENTACAO_INCREMENTO_5C.md
DESTRAVA_ARQUITETURA_MULTILINGUA.md
DESTRAVA_CONTRATOS_MULTILINGUA_V1.md
DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md
README.md
contracts/engine-capabilities-v1.json
package.json
scripts/checkpoint-browser.d.mts
scripts/checkpoint-browser.mjs
scripts/content-loader.ts
scripts/verify-text-presentation-ui.tsx
scripts/verify-text-presentation.tsx
src/app/activities.css
src/app/conversation/page.tsx
src/app/describe/page.tsx
src/app/layout.tsx
src/app/learning-text.css
src/app/mistakes/page.tsx
src/app/progress/page.tsx
src/app/settings/page.tsx
src/app/speaking/page.tsx
src/app/vocabulary/page.tsx
src/components/activities/activity-renderer.tsx
src/components/activities/adaptive-assessment-runner.tsx
src/components/activities/exercise-card.tsx
src/components/activities/speaking-recorder.tsx
src/components/activities/writing-editor.tsx
src/components/audio/speak-button.tsx
src/components/basics/alphabet-guide.tsx
src/components/basics/number-guide.tsx
src/components/basics/regional-guide.tsx
src/components/interactive-lesson/interactive-classroom.tsx
src/components/interactive-lesson/learning-board.tsx
src/components/learning/text-presentation.tsx
src/components/micro-lesson/micro-lesson-practice.tsx
src/components/numbers/number-practice.tsx
src/components/review/review-queue.tsx
src/components/tutor/tutor-drawer.tsx
src/content/contracts.ts
src/content/runtime-package.ts
src/content/schema.ts
src/content/text-presentation.ts
src/content/validate-interactive-lessons.ts
src/domain/interactive-lesson/runtime.ts
src/engine/capabilities/availability-projection.ts
src/engine/capabilities/package-compatibility.ts
src/engine/capabilities/registry.ts
src/engine/presentation/text.ts
```
