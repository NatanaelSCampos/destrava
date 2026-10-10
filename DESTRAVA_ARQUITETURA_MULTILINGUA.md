# Arquitetura multilíngua do Destrava

Atualizado em 2026-10-10. Este documento registra a implementação incremental de [Contratos Multilíngua v1](DESTRAVA_CONTRATOS_MULTILINGUA_V1.md), conforme o [direcionamento atual](DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md). ES e EN são materiais experimentais; `xx-Test` é uma fixture sintética. O contrato público V1 completo e o importador externo permanecem pendentes.

## Fluxo de runtime

```text
cookie do curso ativo → CourseRegistry → CoursePackage + LanguagePackage
                                         ↓
                             projeções do runtime + Destrava Core
                                         ↓
                              estado por usuário e curso
```

- `src/content/contracts.ts` define os contratos Zod. O curso usa schema 1.3; o idioma mantém schema 1.0. `contract-vocabulary.ts` fornece os enums compartilhados, sem importar preferências do domínio. `content/languages/<id>` declara identidade, variantes, normalização, capacidades, provedores de voz e módulos. `content/courses/<id>` declara unidades, lições, atividades, conceitos, léxico, missões, role-plays, mídia e avaliações.
- `scripts/content-loader.ts` valida schemas, IDs globais, referências, avaliações, mídia e configuração dos provedores. `scripts/content-pedagogy.ts` aplica regras editoriais determinísticas e informa avisos. `scripts/compile-content.ts` gera `src/content/generated`, usado pelo `CourseRegistry`. `scripts/content-preview.ts` mostra o roteiro compilável sem iniciar a aplicação.
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
