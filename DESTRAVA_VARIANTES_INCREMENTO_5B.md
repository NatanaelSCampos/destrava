# Variantes linguísticas e avaliação contextual no Incremento 5B

Implementação local de 2026-10-10. O motor resolve o contexto pedagógico antes de avaliar ou escolher um serviço. As equivalências pertencem ao conteúdo; a disponibilidade de um provedor não redefine a variante. A Parte 5C depende de aprovação posterior.

## A Diagnóstico do comportamento anterior

Os três problemas da demanda foram confirmados no código preservado em `.tmp/increment-5b-baseline`:

- `runtime-package.ts` descartava `CoursePackage.defaultVariant`. `resolveVariant()` e `userCourseVariant()` usavam o padrão de fala do perfil linguístico.
- `correctWriting()` recebia `variantId`, mas enviava somente curso, unidade, lição e prompt ao modelo. O contexto construído com a variante era parcialmente descartado.
- `speakText()` escolhia uma voz do mesmo idioma após falhar na correspondência de locale. Retornava apenas um booleano e podia deixar o navegador selecionar uma voz desconhecida quando a lista estava vazia.

Também foram confirmados: preferência por curso em `profile.variantId`, cópia em `user_course_profiles.variant_id`, leitura legada de `spanishRegion`, tratamento de ausência como `general`, ausência de restrições por atividade e correção objetiva sem contexto de variante. A API de avaliações reconstruía resultados usando as respostas persistidas, sem guardar o contexto de variante utilizado originalmente.

## B Modelo de resolução de variantes

`src/engine/variants/resolution.ts` é a fonte única da precedência. O modelo aproveita a preferência por curso e o padrão já existentes; adiciona as restrições que os contratos antigos não expressavam.

| Situação | Resultado |
| --- | --- |
| Atividade declara `requiredVariant` válida | Usa essa variante e informa conflito com uma preferência diferente. Não modifica a preferência. |
| Preferência válida e aceita pelo curso e atividade | Usa a preferência. |
| Preferência ausente | Usa `course.defaultVariant`; se ausente, `language.speech.defaultVariant`. |
| Preferência desconhecida ou não aceita pelo curso | Usa o padrão e retorna `INVALID_PREFERENCE` ou `UNSUPPORTED_PREFERENCE`. A preferência salva é preservada para correção pelo aluno. |
| Atividade aceita apenas algumas variantes e a seleção não pertence ao conjunto | Retorna configuração/contexto inválido e impede avaliação. Não escolhe arbitrariamente outro membro da lista. |
| Padrão ou referências declaradas pelo autor são inválidos | Retorna `INVALID_CONFIGURATION`; ativação do pacote falha. |
| Serviço indisponível | Mantém a variante pedagógica. A operação fica indisponível. |

`selectedBy`, `variantId`, `diagnostics` e `speechFallback` tornam a decisão observável. `sourceLanguage`, idioma de aprendizagem, nível, padrão do curso, preferência, restrição e locale têm campos distintos. A ordem da lista de variantes não altera a resolução pedagógica.

Invariantes preservados:

1. Restrição obrigatória não é anulada por preferência nem disponibilidade.
2. Preferência válida pode substituir o padrão do curso.
3. Falha de leitura de preferência impede avaliação; não simula ausência.
4. Equivalência declarada não é inferida pela normalização ou pelo modelo.
5. Indisponibilidade não gera erro, nota ou conclusão do aluno.
6. Uma tentativa persistida é recuperada com sua variante original.
7. Gabaritos e políticas privadas não atravessam a projeção pública.
8. Junção, Unicode, unidades de medida e limites do 5A permanecem independentes da variante.

## C Implementação

### Contratos e runtime

`src/content/variant-contracts.ts` contém somente Zod e dados declarativos. Curso recebe `acceptedVariants`; atividade recebe `variant`; `evaluation.answerPolicy` descreve alternativas privadas e formas completas obrigatórias. O runtime preserva esses campos e valida referências contra as variantes do idioma e do curso.

`requiredForms` restringe respostas completas de atividades objetivas. As formas precisam estar no gabarito ou nas alternativas declaradas; deve existir uma resposta permitida em cada variante executável da atividade. Isso não implementa regras gerais sobre construções gramaticais nem exige uma substring em escrita aberta.

### Correção e persistência

`declaredAnswers()` filtra alternativas pelo contexto antes de `normalizeAnswer()`. A normalização técnica continua com as mesmas opções do 5A. `gradeActivity()`, avaliação fixa/adaptativa e as APIs recebem o contexto resolvido no servidor. `variantId` acompanha o resultado e as evidências objetivas.

Avaliações guardam a variante no JSON existente de `assessment_attempts.result`; não há coluna ou migração nova. A recuperação usa essa variante, nunca a preferência atual. Tentativas antigas sem variante continuam legíveis nos cursos antigos sem políticas contextuais; resultados sem contexto em cursos com essas políticas são tratados conservadoramente como não comprováveis.

Nova preferência ausente usa string vazia no estado, interpretada como ausência. Preferências existentes, inclusive `general`, permanecem intactas. A leitura server-side também considera progresso legado e bloqueia erros de leitura ou dados ilegíveis. O controle de integridade da sincronização permanece ativo.

### IA

`buildLinguisticAIContext()` projeta origem, língua alvo, nível, variante resolvida, restrições e estratégias de texto. Escrita e tutor constroem o contexto na camada de domínio; conversa, imagem, microlição e apoio interativo o recebem das rotas.

As equivalências são verificadas localmente. A nova projeção envia ao modelo `authorized`, `other_variant`, `restricted_form`, `not_declared` ou `not_checked`, sem exportar o conjunto privado de respostas. `not_declared` não significa erro linguístico em escrita aberta. Os prompts distinguem autorização, restrição e incerteza, e proíbem alterar respostas canônicas. Uma correção escrita que acusa erro em uma resposta completa autorizada é rejeitada pelo adaptador, sem fabricar feedback ou nota substituta.

A revisão automática rejeitou a proposta inicial de incluir alternativas privadas no novo contexto enviado à OpenAI. A solução aplicada classifica localmente a resposta e envia somente o status e as restrições públicas. Nenhuma chamada real ao provedor foi executada. Os dados já presentes nos contextos antigos do tutor e da microlição não foram ampliados por essa projeção.

Schemas de saída, autenticação, limites, cotas e validações existentes continuam. A injeção de transporte no adaptador permite testar a serialização real sem criar cliente conectado a um serviço.

### Voz e interface

`resolveSpeechOperation()` distingue variante solicitada e locale do mapeamento declarado. Reconhecimento e pronúncia não buscam automaticamente outro locale. `declared_mapping` descreve configuração do pacote, sem afirmar fidelidade acústica comprovada.

`selectBrowserVoice()` distingue correspondência exata de locale, fallback para outro locale do mesmo idioma e ausência. Sem voz compatível, não delega uma seleção desconhecida ao navegador. Exigência de variante ou `speechFallback: "exact"` proíbe fallback. O aluno vê aviso quando um áudio de apoio usa outra variante.

Todos os botões de áudio das atividades recebem sua restrição. O dispositivo recalcula disponibilidade quando a preferência ou as vozes mudam. Escuta sem voz compatível fica indisponível; pronúncia sem mapeamento apresenta aviso, preservando a gravação manual. Configurações oferece somente variantes aceitas pelo curso e sinaliza preferência inválida.

## D Exemplos antes e depois

### Padrão e restrição

Antes, um curso com padrão `en-GB` podia usar `general`, cujo mapeamento operacional é `en-US`. Agora:

```ts
resolveLearningVariant(language, { defaultVariant: "en-GB" });
// variantId: en-GB; selectedBy: course

resolveLearningVariant(language, { defaultVariant: "en-GB" }, "en-US");
// variantId: en-US; selectedBy: preference

resolveLearningVariant(language, { defaultVariant: "en-GB" }, "en-US",
  { requiredVariant: "en-GB" });
// variantId: en-GB; selectedBy: activity; PREFERENCE_CONFLICT
// preference remains en-US; cross-variant speech fallback prohibited
```

### Equivalência declarada

Uma fixture declara `colour` como resposta principal e `color` como alternativa para `en-US`. Esta é uma declaração sintética de teste, não um catálogo de regras criado pelo motor.

```json
{
  "evaluation": {
    "strategy": "exact-normalized",
    "answerPolicy": {
      "alternatives": [
        { "text": "color", "variants": ["en-US"] },
        { "text": "shade" }
      ]
    }
  }
}
```

`color` é aceito apenas no contexto declarado; `shade` foi declarado sem restrição; `hue` continua distinto. Se o autor exige `requiredForms: ["colour"]`, as outras formas ficam excluídas. A normalização pode aceitar caixa/pontuação conforme suas opções; não cria sinônimos.

### Fallback de voz

Antes, uma solicitação `en-GB` podia reproduzir `en-US` sem informação. Agora, `selectBrowserVoice([usVoice], "en-GB", true)` informa `different_locale` e `fallback: true`. Com fallback proibido, retorna `unavailable`, sem executar síntese.

## E Contratos e capacidades afetados

- `LanguagePackage` permanece em schema **1.1**. Os mapeamentos existentes são aproveitados.
- Cursos existentes continuam em **1.3**. Campos contextuais novos exigem **1.4**, para impedir que um consumidor antigo descarte restrições obrigatórias sem saber.
- Catálogo **1.2.0**, com **41 capacidades**, sendo 40 implementadas e uma parcial. `linguistic.variant@1.0.0` e `linguistic.answers@1.0.0` têm schemas e bindings verificados.
- Ordenação/escrita continuam com as versões e estratégias introduzidas em 5A. A variante não substitui o locale explicitamente declarado de `intl_words`.
- Respostas contextuais ficam no pacote/gabarito privado; `publicCourse()` e `activitySeedPayload()` removem `answerPolicy`. O seed foi preparado para a tabela privada, mas não executado neste incremento.

## F Testes e evidências

| Verificação | Resultado e alcance |
| --- | --- |
| `variants:verify` | 20 grupos, incluindo defaults, conflitos, leitura de preferências/legado, falhas, classificação privada, escrita/conversa/imagem/apoio oral com transporte simulado, transcrição simulada, voz e recuperação histórica. |
| Propriedades 5B | 7.000 verificações geradas, seed `0x5b17`; precedência, determinismo sob reordenação e ausência de mutação. |
| `variants:verify:ui` | Chrome/React real em 390 px; voz simulada, aviso de fallback, bloqueio de variante exigida, disponibilidade após mudança de vozes e gravação manual preservada sem pronúncia. Zero erros de runtime ou requests externos. |
| `text:verify` | 11 grupos e 12.232 verificações do 5A preservadas; seed `0x5a17`. |
| `text:verify:ui` | Componentes reais de ordenação com repetições e medidas de escrita. |
| `contracts:verify` | Valores/tipos/consumidores e 24 regressões de dependência; sete módulos neutros, sem ciclos. |
| `capabilities:verify` | 31 cenários e catálogo com 41 entradas. |
| `assessment:semantics:verify` | 23 cenários, com API/SSR simulados. |
| `policies:verify` | 24 cenários isolados. |
| `assessment:verify` | 1.024 caminhos ES, 1.024 EN e oito sintéticos. |
| Demais verificadores | Multilíngua, aprendizagem, sincronização, onboarding, interatividade, tempo de sessão, conteúdo e triagem pedagógica passaram. |
| `architecture:check` | Sem marcadores de idioma no núcleo; contratos e bindings válidos. |
| TypeScript, ESLint, build | Passaram localmente. |
| `checkpoint:verify` | 14 cenários com Supabase e autenticação reais, exclusivamente locais; preferência persistida/recarregada, notas e variantes históricas preservadas. Navegador em 360/390 px, zero erros ou requests bloqueados. |

O wrapper comprovou projeto Docker `espanhol-plataform`, daemon local e API `http://127.0.0.1:54321`. O navegador de integração permitiu apenas essa API e `http://127.0.0.1:3000`. Duas contas sintéticas e um arquivo de teste foram removidos ao finalizar. Não foram executadas migrações, seed, commit, push, deploy ou chamadas pagas.

As falhas iniciais foram resolvidas: catálogo desatualizado após novas capacidades; fixture fixa sem `gradingStrategy`; validador interativo ainda limitado ao schema 1.3. O erro `uv_os_get_passwd ENOMEM` vem do sandbox Windows usado pelo tsx; os verificadores locais foram executados com a permissão de execução necessária e cache desativado. Nenhum destes casos foi tratado como acerto do aluno.

## G Limitações e riscos

Os mocks provam transporte e validação; não certificam a qualidade linguística do modelo ou o sotaque de uma voz. Mesmo um locale exato é apenas a correspondência com o mapeamento declarado. Indisponibilidade de serviço, quota e falhas de voz em um aparelho real ainda dependem do ambiente.

Alternativas são respostas completas e finitas. Não foi criado interpretador de gramática, transliteração, tonalidade ou novas regras específicas de idiomas. A classificação de uma redação inteira não reconhece automaticamente todos os trechos ou construções autorizados. Os prompts orientam a IA e o adaptador rejeita contradição explícita de resposta completa autorizada; ambiguidades e sugestões semânticas continuam exigindo Evals.

Um `general` já persistido pode ter vindo da inicialização antiga; não existe evidência para distingui-lo de uma escolha explícita. Ele permanece como preferência válida quando aceito, sem alteração de dados. Ausência nova tem representação explícita.

O replay histórico continua baseado na versão atual do conteúdo correspondente. Autoria deve mudar `contentVersion` ao alterar equivalências/restrições; um pacote diferente que reutilize indevidamente a mesma versão pode reinterpretar evidência. Concorrência entre dispositivos e isolamento da sessão de conversa frente a uma troca de preferência não foram ampliados.

A seleção global de texto para áudio usa a preferência do curso; ela é apoio e não decide evidência oficial. Mídia gravada usa a declaração do pacote, sem análise acústica automática. A cobertura numérica limitada do Incremento 4 continua parcial.

## H Pendências de integração real

1. Testar vozes instaladas em Android, iOS e desktop, sobretudo demora no evento `voiceschanged`, ausência e erros de reprodução.
2. Homologar mapeamentos de reconhecimento/pronúncia com gravações e especialistas para variantes reais, quando houver autorização de serviços pagos.
3. Testar manualmente Configurações, edição da preferência e mensagens de conflito em teclado/toque e leitores de tela.
4. Preparar Evals futuros para alternativa autorizada, forma de outra variante, forma pedagógica obrigatória, idioma desconhecido, ambiguidade, voz incompatível e respostas adversariais. Separar critérios de transporte, validade estrutural e qualidade linguística.
5. Consolidar a publicação do contrato V1 e confiança no conteúdo aprovado pelo Foundry em seus incrementos próprios.

## I Aprendizado de engenharia

1. **Propagação de contexto:** transportar a decisão entre camadas. O route handler resolve a preferência; a escrita envia `linguisticContext.variantId`; o grader e o serviço recebem a mesma restrição.
2. **Preferência e restrição:** a primeira personaliza; a segunda define o que a atividade permite. `PREFERENCE_CONFLICT` informa que a preferência continua salva, embora não governe esta prática.
3. **Precedência:** interpretar semântica antes de escolher uma ordem. O padrão permite personalização; uma exigência obrigatória delimita a execução. Testes verificam os casos combinados.
4. **Fallback seguro:** áudio auxiliar pode usar outro locale com aviso; uma avaliação exigente não pode tratar essa substituição como prova fiel.
5. **Contrato explícito:** `acceptedVariants` e `requiredVariant` impedem cada tela/provedor de decidir regras diferentes.
6. **Mocks:** injetar um transporte que capture a requisição e devolva uma saída estruturada. Os testes exercitam o serializador real sem chave real, rede ou custo.
7. **Outros sistemas:** um cliente pode preferir uma moeda, mas uma fatura exige a moeda contratada. O gateway indisponível não autoriza trocar a moeda da obrigação. A mesma distinção vale para região e políticas de uma empresa em SaaS.
8. **Conteúdo e motor:** o Foundry declara alternativas e variantes; o motor valida referências, resolve políticas e registra evidências. O motor não decide que duas palavras são sinônimos.
9. **Limite técnico:** passar 7.000 verificações demonstra invariantes do algoritmo, não a correção editorial de cada frase ou o sotaque de cada voz.
10. **Complexidade de configuração:** adicionar uma regra para cada provedor/idioma sem necessidade produz combinações difíceis de testar. Este incremento usa um conjunto de variantes, uma exigência e uma política finita de fallback.

### Desafio de entendimento

Um curso permite variantes A/B e tem padrão A. O aluno prefere B. Uma atividade exige A e o dispositivo só possui voz de B. Qual variante deve avaliar a resposta? A preferência salva muda? O áudio pode ser apresentado como fiel à exigência?

Resposta esperada: a atividade usa A, mantém B como preferência, informa conflito e bloqueia a voz incompatível para essa exigência. A falta de voz não é erro do aluno. Em uma atividade sem exigência, a preferência B pode ser usada normalmente.

## J Recomendação para a Parte 5C

**Aprovado tecnicamente para planejar 5C após autorização.** A resolução é central, declarativa e determinística; contexto chega aos adaptadores; equivalências são privadas; fallback é explícito; regressões e persistência local foram verificadas. Essa recomendação não declara qualidade linguística ou compatibilidade acústica real. Os testes externos e humanos listados acima precisam acompanhar a futura homologação, sem iniciar automaticamente novos recursos.

## Arquivos do incremento

A relação completa do delta contra a baseline de 5A é apresentada abaixo. Mudanças anteriores dos Incrementos 4/5A e o arquivo pessoal `.code-workspace` foram preservados.

<!-- 5B file list -->

```text
DESTRAVA_ARQUITETURA_MULTILINGUA.md
DESTRAVA_CONTRATOS_MULTILINGUA_V1.md
DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md
DESTRAVA_VARIANTES_INCREMENTO_5B.md
README.md
contracts/engine-capabilities-v1.json
package.json
scripts/content-loader.ts
scripts/seed-supabase.ts
scripts/verify-local-checkpoint.tsx
scripts/verify-variants-ui.tsx
scripts/verify-variants.tsx
src/app/api/ai/conversation/route.ts
src/app/api/ai/image-description/route.ts
src/app/api/ai/interactive-lesson/route.ts
src/app/api/ai/micro-lesson/route.ts
src/app/api/ai/tutor/route.ts
src/app/api/ai/writing/route.ts
src/app/api/assessments/route.ts
src/app/api/grade/route.ts
src/app/api/pronunciation/route.ts
src/app/settings/page.tsx
src/components/activities/activity-renderer.tsx
src/components/activities/audio-player.tsx
src/components/activities/exercise-card.tsx
src/components/activities/speaking-recorder.tsx
src/components/activities/writing-editor.tsx
src/components/audio/speak-button.tsx
src/components/basics/regional-guide.tsx
src/components/study-provider.tsx
src/content/assessment-results.ts
src/content/contracts.ts
src/content/language-variant.ts
src/content/public.ts
src/content/runtime-package.ts
src/content/schema.ts
src/content/validate-interactive-lessons.ts
src/content/variant-contracts.ts
src/domain/activities/grader.ts
src/domain/activities/pronunciation.ts
src/domain/ai/ai-provider.ts
src/domain/ai/linguistic-context.ts
src/domain/ai/tutor-context-builder.ts
src/domain/assessments/assessment-engine.ts
src/domain/study/course-state-storage.ts
src/domain/study/study-state.ts
src/engine/capabilities/package-compatibility.ts
src/engine/capabilities/registry.ts
src/engine/variants/answers.ts
src/engine/variants/resolution.ts
src/engine/variants/speech.ts
src/lib/assessment-api.ts
src/lib/capability-environment.ts
src/lib/client-capabilities.ts
src/lib/speak-text.ts
src/lib/transcribe-speech.ts
src/lib/user-course-variant.ts
src/repositories/activity-content-projection.ts
```
