# Arquitetura multilíngua do Destrava

Atualizado em 2026-10-10. Este documento registra a implementação incremental de [Contratos Multilíngua v1](DESTRAVA_CONTRATOS_MULTILINGUA_V1.md), conforme o [direcionamento atual](DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md). ES e EN são materiais experimentais; `xx-Test` é uma fixture sintética. O Incremento 6 acrescentou a [fronteira pública de pacote v1](contracts/package-v1/README.md) e validação externa local. Instalação, ativação e consolidação editorial permanecem pendentes.

## Fluxo de runtime

```text
cookie do curso ativo → CourseRegistry → CoursePackage + LanguagePackage
                                         ↓
                             projeções do runtime + Destrava Core
                                         ↓
                              estado por usuário e curso
```

- `src/content/contracts.ts` define os contratos Zod. O curso aceita schemas experimentais 1.3/1.4/1.5; o idioma usa schema 1.1. `contract-vocabulary.ts` fornece os enums compartilhados, sem importar preferências do domínio. `content/languages/<id>` declara identidade, variantes, normalização, características linguísticas, cobertura/mapeamentos de voz, requisitos e módulos. `content/courses/<id>` declara unidades, lições, atividades, conceitos, léxico, missões, role-plays, mídia e avaliações.
- `scripts/content-loader.ts` valida schemas, IDs globais, referências, avaliações e mídia. `runtimeBundle()` negocia capacidades antes de criar o runtime; configuração/locale de provedor é uma condição operacional do ambiente. `scripts/content-pedagogy.ts` aplica regras editoriais determinísticas e informa avisos. `scripts/compile-content.ts` gera `src/content/generated`, usado pelo `CourseRegistry`. `scripts/content-preview.ts` mostra o roteiro compilável sem iniciar a aplicação.
- `src/content/runtime-package.ts` projeta o contrato de autoria nos tipos usados pela UI e pelos motores existentes. Atividades preservam `skills: []`; tentativas objetivas alimentam todas as habilidades declaradas no perfil, além da habilidade principal usada na navegação. O léxico do curso alimenta vocabulário, dicionário, revisão e contexto do tutor. Missões e role-plays alimentam conversas. Avaliações preservam finalidade, método, atividades, política e referências de curso/unidade; o runtime não as descobre por `quiz`, posição ou IDs derivados.
- `src/content/course-registry.ts` é a fronteira de resolução. O layout seleciona um pacote pelo cookie; o curso inicial é declarado por `isDefault` no conteúdo, sem depender da ordem dos arquivos. Rotas de IA e avaliação exigem `courseId`, resolvem o pacote e usam a variante do aluno. Reconhecimento e avaliação de pronúncia dependem da capacidade e do locale Azure do pacote; TTS do navegador aceita qualquer provedor com locale declarado.
- `StudyProvider` é recriado ao trocar o curso. Estado local e persistido, perfil, revisão, erros, domínio, histórico e preferências pedagógicas ficam sob `userId + courseId`. IDs de conteúdo são únicos globalmente; a migração mantém os dados legados de espanhol.

## Avaliações explícitas — incremento 2

`purpose` declara diagnóstico, acompanhamento ou verificação somativa. `method`
declara execução adaptativa ou fixa. `assessmentRefs` escolhe papéis; uma
somativa só é final da unidade quando existe sua referência `final`.
`/assessment?assessmentId=<id>` executa a avaliação indicada. Sem esse parâmetro,
a tela usa exclusivamente o diagnóstico inicial declarado pelo curso.

A correção formal usa o conteúdo privado no servidor e persiste respostas,
identidade e versão. O repositório confirma os resultados por leitura canônica;
snapshots e históricos não determinam notas oficiais. Ausência/insuficiência
têm nota null. Veja [decisões, exemplos e testes](DESTRAVA_AVALIACOES_INCREMENTO_2.md).
O [Incremento 3](DESTRAVA_POLITICAS_INCREMENTO_3.md) executa `unit.learningPolicy` com critérios independentes de conclusão e domínio. A participação continua separada, e requisitos indisponíveis não são descartados. A interface e a projeção relacional usam o mesmo avaliador. O [checkpoint integrado](DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md) homologou essas integrações no banco local e no navegador; não houve instalação remota nesta entrega.

## Adicionar conteúdo

1. Para uma nova unidade, crie um arquivo JSON em `content/courses/<courseId>/units`, com IDs estáveis, lições, atividades e referências a conceitos/léxico já declarados ou adicionados ao mesmo curso.
2. Para um novo idioma, crie `content/languages/<languageId>/manifest.json` e os arquivos dos módulos habilitados. Em seguida, crie um curso com `targetLanguage` igual ao ID da língua. Recursos que exigem voz só devem ser declarados quando o provedor e o locale necessários existirem. Novas capacidades ainda não suportadas exigem implementação genérica.
3. Execute `npm run content:validate`, `npm run content:pedagogy`, `npm run content:preview -- --course <courseId>` e `npm run content:compile`. Depois execute typecheck, lint, build e os verificadores. A compilação roda automaticamente antes de `dev` e `build`.
4. A instalação relacional é uma operação separada e requer autorização para o ambiente de destino. Após revisar/aplicar as migrações pendentes, execute `npm run db:seed` com `.env.local` configurado e confira com `npm run db:verify:remote`. O seed faz upsert de conteúdo e sincroniza os vínculos em `assessment_items`, removendo vínculos que saíram da definição. Não apaga tentativas nem contas. Esses comandos remotos não foram executados no Incremento 2.

## Migrações desta refatoração

- **Aplicada somente localmente no checkpoint:** `20261010000200_learning_policies.sql` registra políticas em unidades e estados/versionamento nas projeções derivadas. Depende da instalação das avaliações explícitas. O app usa o perfil local protegido; nenhuma migração remota foi executada nesta entrega.

- **Aplicada somente localmente no checkpoint:** `20261010000100_assessment_semantics.sql` adiciona metadados/referências de avaliação e permite resultado sem nota e avaliação fora de uma unidade. Seed, API autenticada e leitura de resultados foram homologados localmente. Ver [checkpoint](DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md).

- `20261003000700_pedagogical_onboarding.sql`: preferências pedagógicas, nível percebido e passo de onboarding por usuário e curso. O fluxo e seus consumidores estão descritos em [Onboarding pedagógico v1](DESTRAVA_ONBOARDING_PEDAGOGICO_V1.md).

- `20261003000400_course_profiles.sql`: perfil por usuário e curso, com cópia da preferência legada de região.
- `20261003000500_generic_vocabulary.sql`: coluna `term` independente do espanhol, preenchida a partir da coluna antiga; `spanish` permanece para compatibilidade dos dados históricos.
- `20261003000600_study_events_course.sql`: `course_id` em eventos novos e preenchimento dos eventos antigos identificáveis; registros sem curso recuperável permanecem intactos.

O registro da etapa de 2026-10-03 informa aplicação das três migrações de perfil/vocabulário/eventos e publicação de espanhol e `xx-Test`. Isso descreve aquela verificação; o schema e o conteúdo novos do Incremento 2 não foram instalados nem verificados remotamente.

## Teste de fronteira

`xx-Test` declara uma variante, um módulo de fundamentos, cinco termos, dois conceitos, uma unidade, duas lições, atividades, missão, role-play e avaliação. Não declara voz. A UI oculta ações dependentes de speech. `scripts/verify-multilingual.ts` verifica normalização com acentos, avaliação por pacote e isolamento: alterar o estado do espanhol não muda progresso, erros, vocabulário ou perfil do outro curso. `scripts/check-architecture.ts` falha se imports e marcadores espanhóis reaparecerem no Core, nas APIs ou em componentes genéricos.

`assessment:semantics:verify` cobre referências e finalidades com IDs sintéticos,
sem depender da ordem ou da existência de quiz, além de correção/API simulada,
histórico e projeção pública sem gabaritos. `contracts:verify` e
`architecture:check` protegem a direção das dependências do contrato.

## Legado e limites

`src/content/frecuencias-a1.ts`, `spanish-resources.ts` e arquivos relacionados existem apenas como fixtures do verificador antigo; o runtime importa exclusivamente os pacotes compilados. `course-state-storage.ts` conserva uma leitura do formato pré-migração e da preferência `spanishRegion` para não perder dados existentes. Esses pontos podem ser removidos quando o verificador antigo migrar e os dados históricos forem consolidados.

A validação pedagógica é uma triagem determinística. No conteúdo espanhol atual, dois avisos de resposta alternativa equivalente à principal seguem para revisão editorial. A prova sintética e o isolamento são verificados por script; a experiência completa de um segundo idioma real e a qualidade das respostas de IA ainda precisam de teste humano. A reprodução de voz depende das vozes instaladas no dispositivo, e `xx-Test` não usa avaliação oral.

## Registro de capacidades — incremento 4

O [relatório do Incremento 4](DESTRAVA_CAPACIDADES_INCREMENTO_4.md) contém inventário, decisões, testes e exemplos. O registro estático está em `src/engine/capabilities`; contratos/requisitos e payloads compartilhados permanecem neutros em `src/content`. Versões são negociadas por lista exata, suporte parcial não satisfaz requisito obrigatório e condições do servidor/dispositivo são separadas do suporte implementado.

`capabilityRequirements` é preservado no curso, língua e elementos nativos. O runtime deriva também os requisitos implícitos dos tipos/avaliações/políticas/módulos. A projeção pública e as tabelas públicas recebem somente identidades dos requisitos: seus payloads canônicos podem conter gabaritos e ficam no pacote privado. Gravação manual não depende de reconhecimento de fala.

O catálogo `contracts/engine-capabilities-v1.json` é gerado das definições verificadas por `capabilities:catalog` e conferido por `capabilities:verify`. Esses artefatos preparam o consumo pelo Foundry; comunicação por API, importador completo e contrato público V1 consolidado continuam pendentes. Não há execução de código de pacotes externos.

## Representação textual — Incremento 5A

[Decisões e testes de 5A](DESTRAVA_TEXTO_INCREMENTO_5A.md): estratégias de dados neutras ficam em `src/content/text-strategies.ts`; execução em `src/engine/text/representation.ts`. O texto não serve como identidade de ocorrência. Junção e medida são explícitas por atividade; não há uma noção universal de palavra imposta pelo idioma. UI e avaliação usam os mesmos limites, sem exportar a permutação de gabarito. O registro valida versões 1.0.0/1.1.0 de ordenação/escrita e duas novas capacidades textuais, com suporte operacional de Intl separado da compatibilidade. O catálogo dessa entrega era 1.1.0 com 39 entradas (38 implementadas, uma parcial). O perfil de língua 1.1 e o curso experimental 1.3 não mudaram.

## Variantes e avaliação contextual no Incremento 5B

A resolução pedagógica fica em `src/engine/variants/resolution.ts`. Contratos neutros ficam em `src/content/variant-contracts.ts`; equivalências finitas em `src/engine/variants/answers.ts`; compatibilidade operacional em `src/engine/variants/speech.ts`. Atividade obrigatória prevalece sobre preferência, seguida do padrão do curso/idioma. Erros de configuração impedem execução; preferências inválidas têm diagnósticos e não são regravadas automaticamente.

O runtime preserva origem, padrão, variantes aceitas e restrições. A IA recebe contexto e a classificação local da resposta; a nova projeção não exporta alternativas privadas. Voz de outro locale só serve como apoio com aviso, quando permitido. Escuta/pronúncia indisponíveis não geram nota ou conclusão; gravação manual permanece separada. Resultados persistem sua variante no JSON existente e são recuperados sem usar a preferência atual.

O catálogo da entrega 5B era 1.2.0 com 41 entradas (40 implementadas e uma parcial). Língua permanece 1.1; curso aceita 1.3 e exige 1.4 para restrições/alternativas contextuais. [Diagnóstico, regras, evidências locais e limitações de 5B](DESTRAVA_VARIANTES_INCREMENTO_5B.md). Não há importador novo nem suporte universal certificado; 5C depende de aprovação.

## Apresentação multilíngue no Incremento 5C

Schemas neutros de apresentação estão em `src/content/text-presentation.ts`; resolução e inspeção de controles em `src/engine/presentation/text.ts`; componentes compartilhados em `src/components/learning/text-presentation.tsx`. A UI tem contexto próprio LTR/pt-BR. Alvo, origem, produção do aluno e fragmentos independentes recebem direção/lang específicos, sem transformar conteúdo nem alterar variantes ou correção.

Inputs nativos preservam seleção, cursor e composição; o quadro usa `LearningBoard` sem um executor novo. Metadados de campos e de trechos/legendas/comparações exigem curso 1.5; 1.3/1.4 permanecem aceitos. Idioma permanece 1.1. O catálogo atual é 1.3.0 com 44 entradas (43 implementadas, uma parcial). `presentation.direction`, `presentation.bidi` e `text.input` têm bindings e limites explícitos.

[Entrega e evidências de 5C](DESTRAVA_APRESENTACAO_INCREMENTO_5C.md): 12.000 verificações geradas, browser com CSS real e teclado/seleção nativos, regressões e integração local. O suporte é a texto horizontal e fronteiras simples; não certifica idiomas RTL completos, rich text arbitrário, IMEs reais ou leitores de tela.

## Fronteira externa no Incremento 6

O produtor entrega dados seguindo [o contrato público](contracts/package-v1/README.md). O adaptador `external-package-directory.ts` lê um snapshot limitado; `validateExternalPackageFiles()` valida documentos/referências/integridade e negocia capacidades. `runtimeBundle()` e `publicCourse()` continuam sendo as conversões do consumidor. O registro estático, seed e persistência não recebem escritas desse fluxo.

`package-references.ts` concentra as verificações semânticas compartilhadas pelos carregadores interno e externo. O envelope neutro está em `package-contract.ts`; artefatos públicos são gerados sem definições paralelas. A CLI devolve relatório público; o runtime preparado é privado e temporário, sem garantia de imutabilidade para instalação. Saúde operacional e confiança editorial não são inferidas de validade estrutural.

[Relatório, controles e testes de interoperabilidade](DESTRAVA_IMPORTACAO_INCREMENTO_6.md). A prova usa um produtor independente fora do repositório e os executores existentes em memória. A persistência dessa fronteira é descrita no Incremento 7 abaixo.

## Instalação versionada — Incremento 7

`src/domain/course-installations` concentra identidade, inventário/hash, estados, ports e serviço. O adapter `supabase-course-installations.ts` usa bucket privado `course-artifacts` para bytes completos e schema privado `destrava_private` para metadados, ponteiro ativo, recibos, histórico, sessões e evidências. As RPCs são exclusivas do servidor; não se faz seed/upsert dessas versões nas tabelas globais dos cursos compilados.

Instalação reserva, envia/verifica recursos e confirma; falhas entre banco e Storage conservam uma preparação recuperável. Preparação, aprovação de teste e seleção ativa são operações separadas. Publicação real permanece negada. O emissor em `scripts/course-installation-local-authority.ts` exige isolamento local positivo; não é dependência das rotas da aplicação.

Ativação/rollback usam CAS de revisão, lock do ponteiro e recibo por operação na mesma transação. Abertura de sessão captura a referência sob esse lock; mudança posterior não modifica sua versão. Avaliações, atividades e políticas registram evidências append-only por sessão/instalação/hash. A resolução revalida o snapshot completo e usa `runtimeBundle`, `publicCourse`, grader e motores existentes. Falha de integridade não troca por conteúdo compilado.

Integração dinâmica é limitada às rotas de sessões, mídia, correção, avaliações e políticas, e à inspeção autenticada `/installed-courses/<sessionId>`. O `StudyProvider`, seletor de cursos, onboarding e progresso legado continuam ligados ao catálogo compilado. Consumidores de IA, voz e aula interativa rejeitam requisições com escopo instalado até sua adaptação. Este incremento não certifica suporte dinâmico completo ou um fluxo administrativo em produção.

As triggers protegem metadados contra mutações comuns do Storage; não são uma garantia física WORM ou isolamento contra owner/root. Upload usa `upsert:false` e cada consumo verifica bytes/hash sem cache. [Relatório do Incremento 7](DESTRAVA_INSTALACOES_INCREMENTO_7.md) registra as provas reais, limites, estados e procedimentos locais. Contratos públicos de autoria não foram duplicados.

## Resolução no fluxo normal — Incremento 8

`application-course-runtime.ts` resolve fonte compilada/instalada/indisponível. Layout autentica e projeta curso/idioma/recursos públicos; seletor e onboarding usam o catálogo elegível instalado. O `StudyProvider` recebe a referência fixada e reutiliza os renderers/planner/avaliadores existentes. Seleção por usuário referencia sessão I7; não redefine o ponteiro ativo.

`domain/installed-study` concentra compatibilidade, seleção/progresso e projeção canônica. `supabase-installed-study` implementa seus ports em RPCs privadas do servidor; `InstalledStudyHttpRepository` liga o provider ao serviço e preserva as invariantes de `StudyProgressSync`. Progresso é separado por usuário/instalação, e avaliações oficiais derivam das evidências I7 dessa versão, independentemente de notas declaradas pelo cliente.

O snapshot mantém dados de estudo/submissão manual válidos, sem escrever FKs do catálogo compilado. Namespace/cache e key do provider incluem usuário/fonte/artefato/sessão. Reload retoma o pin, nova seleção captura active com CAS/recibo e rollback restaura a referência sem reinterpretar evidências. Falha do artefato anterior não impede ler a revisão estrutural da seleção para escolher um destino saudável; executar aquele artefato continua exigindo resolução/integridade/compatibilidade.

Revisão, IA, oral, conversação e aula interativa ainda não possuem caminho instalado completo. Required bloqueia ativação/rollback; caminhos opcionais não geram notas artificiais. O perfil portável é gerado do filtro canônico. [Relatório A–H, matriz e provas integradas](DESTRAVA_RUNTIME_INCREMENTO_8.md). Nenhuma API do Foundry, Admin completo, autoridade editorial de produção ou publicação remota foi adicionada.
