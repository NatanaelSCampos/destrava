# Fase 2 — incremento 2: semântica das avaliações

> Atualização: o [checkpoint integrado](DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md)
> aplicou a migração e homologou autenticação, persistência/reload e retry somente
> no Supabase local. Corrigiu também a normalização de timestamps PostgreSQL.
> As notas de banco pendente abaixo registram a entrega original.

Implementação local em 2026-10-10. Schema de curso **1.2**; contrato público
V1 completo e motor de políticas de conclusão ainda não implementados.

## Fluxo confirmado e invariantes

Antes da mudança, `assessmentId` da unidade apontava para o diagnóstico.
O runtime perdia essa referência; a página escolhia a primeira unidade ativa.
Progresso, reconciliação, seed e resumo de lição descobriam uma avaliação final
por `quiz` e derivavam `${unit.id}-final`. O seed fixava sua aprovação em 75.

Invariantes definidos antes da implementação:

1. Finalidade (`diagnostic`, `formative`, `summative`) é distinta do método
   (`adaptive`, `fixed`) e do tipo visual da atividade.
2. Referências declaram os papéis no curso/unidade. Uma somativa só é final
   daquela unidade quando sua referência `final` está declarada e é válida.
3. Nenhuma seleção pedagógica usa a primeira posição, nomes, `quiz` ou IDs gerados.
4. Definições e gabaritos são canônicos no conteúdo privado. O cliente envia
   respostas e identificação, não finalidade, gabarito, nota ou aprovação.
5. Ausência, pendência e resultado histórico não são reprovação nem nota zero.
6. Referências, associações, métodos e atividades incompatíveis são rejeitados
   na validação do pacote, antes da projeção.
7. A projeção pública transporta metadados/referências, sem gabaritos.
8. Histórico experimental permanece legível; dados sem identidade/versionamento
   suficiente não são promovidos silenciosamente a resultado oficial atual.
9. Política geral de domínio, algoritmo adaptativo e avaliação por IA não são
   substituídos neste incremento.

## Decisões de contrato

- Evolução do `CoursePackage` para schema 1.2; perfis de idioma permanecem em 1.0.
- O campo ambíguo `assessmentId` é substituído por `assessmentRefs`; não é
  reinterpretado. Pacotes do novo schema rejeitam o campo antigo.
- `course.assessmentRefs.diagnostic` declara o diagnóstico inicial; a unidade
  pode declarar `diagnostic`, `formative` e `final` independentemente.
- Avaliações têm finalidade, método, título e associações opcionais a unidade,
  lição e objetivos. Métodos referenciam atividades canônicas, sem cópias embutidas.
- O método fixo usa média das questões objetivas. Escrita aberta pode exigir
  entrega, conforme o comportamento anterior; não recebe nota oficial de IA.

## Antes e depois: exemplo real

Antes, a unidade espanhola declarava o diagnóstico em um campo genérico:

```json
{ "assessmentId": "frecuencias-a1.nos-presentamos.diagnostic" }
```

A prova final era inferida pelo bloco visual `quiz`, recebia o ID derivado
`nos-presentamos-final` e uma meta de 75 no seed. O diagnóstico era uma
definição com `type: "adaptive_diagnostic"`, misturando finalidade e execução.

Agora a unidade declara os papéis explicitamente:

```json
{
  "assessmentRefs": {
    "diagnostic": "frecuencias-a1.nos-presentamos.diagnostic",
    "formative": [],
    "final": "nos-presentamos-final"
  }
}
```

Sua definição somativa é independente da forma do ID:

```json
{
  "id": "nos-presentamos-final",
  "title": "Avaliação final da unidade",
  "purpose": "summative",
  "method": "fixed",
  "unitId": "nos-presentamos",
  "lessonId": "l-assessment",
  "gradingStrategy": "objective_mean",
  "activityIds": [
    "assessment-1", "assessment-2", "assessment-3",
    "assessment-4", "assessment-5", "assessment-6", "assessment-writing"
  ],
  "passingPolicy": { "overall": 0.75 }
}
```

O ID antigo foi mantido como dado estável desta fixture. O motor não o gera
nem o interpreta. Um produtor pode escolher `result-89` e obter a mesma execução.

`purpose` responde **por que avaliar**: diagnóstico de entrada, acompanhamento
ou verificação de resultados. `method` responde **como executar**: seleção
adaptativa ou sequência fixa. `activity.type` responde **como apresentar uma
atividade**: múltipla escolha, escrita, quiz etc. Um quiz continua sendo um
bloco de apresentação, sem produzir automaticamente uma nota ou finalidade.

Uma somativa só conta como final de unidade se aquela unidade declarar
`assessmentRefs.final`. Outras somativas podem ser executadas pelo ID sem
participar dessa regra de conclusão. Associações a curso, unidade, lição e
objetivos são independentes da ordem das definições.

## Caminho único de execução e resultado

1. `contracts.ts` valida finalidade, método, política, atividades e associações.
   Referências inexistentes, repetidas ou com finalidade/escopo incompatíveis
   falham antes da compilação.
2. `runtime-package.ts` preserva definições, versão do conteúdo e referências.
   `publicCourse` remove gabaritos das atividades; as definições de avaliação
   contêm somente metadados, políticas e IDs de atividades.
3. `assessment-references.ts` resolve um ID solicitado ou o diagnóstico inicial
   declarado pelo curso. Sem diagnóstico declarado, a tela pede uma seleção;
   nunca escolhe a primeira avaliação ou unidade como fallback.
4. `/assessment` despacha por método e apresenta a finalidade do contrato.
   Os dois executores reutilizam correção/atividades existentes.
5. `POST /api/assessments` recebe identificação e respostas. Rejeita campos
   extras como `purpose`, `correct`, nota e aprovação. Autenticação/MFA continuam
   usando o guard existente; não há chave administrativa nesta rota.
6. `assessment-engine.ts` resolve a definição privada. No método adaptativo,
   reproduz a seleção a partir das respostas corrigidas, usando o algoritmo
   existente. No fixo, exige o conjunto declarado e aplica sua política.
7. O registro contém curso, ID da avaliação, finalidade, método, versão,
   respostas de entrada e timestamps. Uma tentativa repetida conserva o
   timestamp salvo; comparação normaliza a ordem de chaves de objetos JSONB,
   mantendo significativa a ordem das respostas.
8. `GET /api/assessments` consulta somente tentativas do usuário autenticado e
   recalcula resultados da versão atual. Nota e finalidade gravadas em caches
   não são a autoridade. Versões antigas não são recalculadas como atuais.
9. `StudyProvider` verifica se conta/geração/curso continuam atuais antes de
   incorporar o retorno. Falha de envio mantém respostas para nova tentativa.
   A recarga via repositório exige leitura válida também dos resultados;
   falha de consulta não libera gravação de um snapshot vazio ou antigo.

Os arrays existentes de resultados fixos e adaptativos foram conservados como
formatos de armazenamento. Ambos usam uma definição canônica em
`course.assessments`; não há um catálogo paralelo fornecido ao provider.

## Compatibilidade e integridade do histórico

- `reconcileAssessments` foi removido. Fazer exercícios soltos ou marcar um
  quiz como estudado não fabrica uma tentativa oficial.
- Resultados antigos permanecem visíveis como histórico, sem inferir finalidade
  pelo ID. Na recarga, snapshots com `source: server` são tratados como histórico
  até serem confirmados pela consulta canônica.
- Progresso distingue `not_defined`, `not_taken`, `historical`, `insufficient`,
  `passed` e `failed`. Nas quatro primeiras situações a nota/classificação é
  `null`; zero continua válido quando houve respostas realmente incorretas.
- Os limites de amostra do algoritmo adaptativo foram preservados. Uma fixture
  com apenas uma pergunta por habilidade não passa a ter evidência suficiente.
- Recuperação sem snapshot restaura resultados oficiais e os IDs concluídos
  de atividades fixas. Ainda não reconstrói todas as evidências secundárias
  de exercícios, revisão, escrita e eventos ausentes do snapshot.

## Fixtures alteradas

| Pacote | Alteração |
| --- | --- |
| `frecuencias-a1` | Diagnóstico explícito; somativa fixa declarada com o ID estável `nos-presentamos-final`, atividades existentes e meta 0.75 fornecida pelo conteúdo. |
| `pt-BR.en.a1.general` | Diagnóstico explícito; nenhuma final inventada. |
| `pt-BR.xx-Test.a1.general` | Diagnóstico explícito; o quiz de apresentação permanece, sem avaliação final inferida. |

Nos três pacotes foram atualizados `course.json`, `assessments.json` e
`units/u01.json`: schema 1.2 e versão de conteúdo 1.1.0. Atividades e gabaritos
pedagógicos não foram reescritos. Arquivos gerados foram recompilados localmente.
Fixtures sintéticas no novo verificador incluem finais sem quiz, IDs sem
convenções, várias finalidades, ausência de final e associação a curso.
O teste multilíngua que clona uma unidade agora limpa suas referências, pois
copiar a referência de outra unidade seria uma associação inválida.

## Banco: alteração preparada, não aplicada

Arquivo: `supabase/migrations/20261010000100_assessment_semantics.sql`.

- Curso: `content_version` e `assessment_refs`; unidade: `assessment_refs`.
- Avaliação: `course_id`, `lesson_id`, `purpose`, `method`, `definition`.
- `unit_id` passa a aceitar null para avaliações de escopo de curso/ lição.
- `objective_score` passa a aceitar null quando a evidência é insuficiente.
- O backfill de `course_id` usa a FK existente para unidade; não adivinha
  finalidade nem recalcula históricos. Finalidade/método antigos ficam sem
  atribuição até a instalação explícita do conteúdo correspondente.

`seed-supabase.ts` projeta definições declaradas e sincroniza os vínculos em
`assessment_items`. Pode remover vínculos de itens que saíram da definição;
não remove tentativas, conteúdo de atividades ou contas. Não foi executado.
`verify-content-remote.ts` foi adaptado para conferir essas projeções, mas também
não foi executado. O schema remoto precisa ser revisado/aplicado antes do seed;
caso existam avaliações antigas sem unidade recuperável, o `SET NOT NULL`
de `course_id` falha e exige decisão explícita, sem descarte automático.

O fluxo completo autenticado depende da aplicação autorizada dessa migração e
do seed. O método adaptativo com nota numérica pode usar a tabela antiga,
mas resultados insuficientes exigem a alteração de nulabilidade. A interface
mantém a resposta e informa erro se a persistência não estiver disponível.

## Verificação automática

`npm.cmd run assessment:semantics:verify`: **23 cenários passaram**, sem rede,
usando pacote sintético, persistência/API simuladas e SSR de componentes.
Cobrem os 12 cenários obrigatórios e também identidade canônica no servidor,
spoofing de campos, recálculo de notas adulteradas, erros de leitura/escrita,
repetição de envio, finalidade na interface e projeção do seed. Um caso com
75% e piso declarado de 80% verifica que a aprovação não usa a constante antiga.

Regressão local executada com sucesso:

- `contracts:verify`: 24 casos de vocabulário/dependências.
- `architecture:check`: contrato neutro, somente Zod externo, sem ciclos.
- `content:validate`: três pacotes; 46 atividades ES, 23 EN e 7 xx-Test.
- `content:compile`: três pacotes recompilados.
- `content:pedagogy`: zero erros, dois avisos preexistentes sobre alternativas
  iguais à resposta principal (`grammar-5` e `review-4`).
- `assessment:verify`: 1.024 caminhos ES, 1.024 EN e 8 xx-Test.
- `learning:verify`, `multilingual:verify`, `onboarding:verify`,
  `interactive:verify`, `session:verify`.
- `sync:verify`: 13 cenários de integridade sem serviços externos.

TypeScript e ESLint passaram sem falhas/avisos. `npm.cmd run build` passou
(Next.js 16.3.8), incluindo as rotas `/assessment` e `/api/assessments`.
Nenhum teste automático deste incremento valida um Supabase real.

## Arquivos da implementação

| Responsabilidade | Arquivos principais |
| --- | --- |
| Contrato, projeção e resolução | `src/content/contracts.ts`, `schema.ts`, `runtime-package.ts`, `assessment-references.ts`, `assessment-results.ts` |
| Execução e correção | `src/domain/assessments/assessment-engine.ts`, `src/lib/assessment-api.ts`, `src/app/api/assessments/route.ts` |
| Estado e progresso | `src/domain/study/study-state.ts`, `adaptive-assessment.ts`, `progress.ts`, `src/components/study-provider.tsx`, `src/repositories/supabase-study-repository.ts` |
| Interface | `src/app/assessment/page.tsx`, executores fixo/adaptativo, `assessment-result.tsx`, callbacks de escrita/atividades, páginas de curso, unidade, lição, dashboard e progresso |
| Instalação e verificadores | `src/repositories/assessment-content-projection.ts`, scripts de loader/preview/seed/verificação, migration preparada, `package.json` |
| Fixtures e artefatos locais | Os nove JSON de curso/avaliações/unidade dos três pacotes e seus packs compilados |

Arquivos de integridade de progresso e vocabulário compartilhado já pertenciam
aos incrementos anteriores no workspace. Nenhum commit foi criado para misturar
essas entregas.

## Validação manual pendente

Após autorização e instalação do conteúdo no banco:

1. Abrir o diagnóstico pelo ID explícito, concluir, atualizar e confirmar
   identidade/resultado da mesma tentativa.
2. Abrir a final espanhola, entregar as respostas e escrita, atualizar e
   confirmar persistência e critério declarado.
3. Trocar ES → EN → xx-Test: conferir diagnóstico específico, quiz sem final
   e histórico isolado entre cursos.
4. Interromper o envio, tentar novamente e conferir que a tentativa não duplica.
5. Conferir a jornada mobile dos dois executores e mensagens de indisponibilidade.

## Aprendizado e próximos limites

Referências explícitas substituem conhecimento privado do consumidor por dados
validados do produtor. Isso permite ao Foundry escolher nomes, IDs e escopos
sem conhecer convenções do app. A consistência depende de levar os mesmos
metadados pelo contrato, runtime, correção, resultado e instalação relacional;
não basta acrescentar um enum à autoria.

O Incremento 3 ainda deverá tornar declarativas as demais regras fixas de
conclusão/domínio: notas de exercícios/revisão, obrigatoriedade de escrita/fala,
e tratamento curricular das avaliações. O modelo atual não implementa pesos
ou rubricas novos, avaliação de texto livre por nota, capacidades adicionais,
importador nem o contrato público V1 completo.

A RLS existente permite que o dono edite suas próprias linhas. Recalcular no
servidor impede aceitar uma nota enviada pelo cliente, mas ainda não cria um
livro de tentativas imutável, nem prova autoria das respostas ou ausência de
consulta ao gabarito durante a prática. Esse endurecimento de persistência e
observabilidade exige outro incremento. O snapshot inicial é provisório até
uma leitura remota válida; não deve ser usado como certificação.

Não houve reset, migração/seed remoto, deploy, consumo de API paga ou commit.
O Incremento 3 não foi iniciado.
