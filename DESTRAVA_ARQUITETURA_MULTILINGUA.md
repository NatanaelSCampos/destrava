# Arquitetura multilíngua do Destrava

Atualizado em 2026-10-03. Este documento registra a implementação de [Contratos Multilíngua v1](DESTRAVA_CONTRATOS_MULTILINGUA_V1.md). O espanhol permanece o primeiro curso real; `xx-Test` é um pacote sintético para testar a fronteira arquitetural, não um idioma para ensino.

## Fluxo em produção

```text
cookie do curso ativo → CourseRegistry → CoursePackage + LanguagePackage
                                         ↓
                             projeções do runtime + Destrava Core
                                         ↓
                              estado por usuário e curso
```

- `src/content/contracts.ts` define os contratos Zod. `content/languages/<id>` declara identidade, variantes, normalização, capacidades, provedores de voz e módulos. `content/courses/<id>` declara unidades, lições, atividades, conceitos, léxico, missões, role-plays, mídia e avaliações.
- `scripts/content-loader.ts` valida schemas, IDs globais, referências, avaliações, mídia e configuração dos provedores. `scripts/content-pedagogy.ts` aplica regras editoriais determinísticas e informa avisos. `scripts/compile-content.ts` gera `src/content/generated`, usado pelo `CourseRegistry`. `scripts/content-preview.ts` mostra o roteiro compilável sem iniciar a aplicação.
- `src/content/runtime-package.ts` projeta o contrato de autoria nos tipos usados pela UI e pelos motores existentes. O léxico do curso alimenta vocabulário, dicionário, revisão e contexto do tutor. Missões e role-plays alimentam conversas; avaliações alimentam o diagnóstico.
- `src/content/course-registry.ts` é a fronteira de resolução. O layout seleciona um pacote pelo cookie; o curso inicial é declarado por `isDefault` no conteúdo, sem depender da ordem dos arquivos. Rotas de IA e avaliação exigem `courseId`, resolvem o pacote e usam a variante do aluno. Reconhecimento e avaliação de pronúncia dependem da capacidade e do locale Azure do pacote; TTS do navegador aceita qualquer provedor com locale declarado.
- `StudyProvider` é recriado ao trocar o curso. Estado local e persistido, perfil, revisão, erros, domínio, histórico e preferências pedagógicas ficam sob `userId + courseId`. IDs de conteúdo são únicos globalmente; a migração mantém os dados legados de espanhol.

## Adicionar conteúdo

1. Para uma nova unidade, crie um arquivo JSON em `content/courses/<courseId>/units`, com IDs estáveis, lições, atividades e referências a conceitos/léxico já declarados ou adicionados ao mesmo curso.
2. Para um novo idioma, crie `content/languages/<languageId>/manifest.json` e os arquivos dos módulos habilitados. Em seguida, crie um curso com `targetLanguage` igual ao ID da língua. Recursos que exigem voz só devem ser declarados quando o provedor e o locale necessários existirem. Novas capacidades ainda não suportadas exigem implementação genérica.
3. Execute `npm run content:validate`, `npm run content:pedagogy`, `npm run content:preview -- --course <courseId>` e `npm run content:compile`. Depois execute typecheck, lint, build e os verificadores. A compilação roda automaticamente antes de `dev` e `build`.
4. Para publicar conteúdo relacional no Supabase, aplique as migrações pendentes, execute `npm run db:seed` com `.env.local` configurado e confira com `npm run db:verify:remote`. O seed faz upsert e não apaga conteúdo ou dados de usuário.

## Migrações desta refatoração

- `20261003000400_course_profiles.sql`: perfil por usuário e curso, com cópia da preferência legada de região.
- `20261003000500_generic_vocabulary.sql`: coluna `term` independente do espanhol, preenchida a partir da coluna antiga; `spanish` permanece para compatibilidade dos dados históricos.
- `20261003000600_study_events_course.sql`: `course_id` em eventos novos e preenchimento dos eventos antigos identificáveis; registros sem curso recuperável permanecem intactos.

As três migrações foram aplicadas no projeto remoto vinculado em 2026-10-03. O seed publicou espanhol e `xx-Test`; o verificador remoto confirma cursos, unidades, termos e disponibilidade das projeções.

## Teste de fronteira

`xx-Test` declara uma variante, um módulo de fundamentos, cinco termos, dois conceitos, uma unidade, duas lições, atividades, missão, role-play e avaliação. Não declara voz. A UI oculta ações dependentes de speech. `scripts/verify-multilingual.ts` verifica normalização com acentos, avaliação por pacote e isolamento: alterar o estado do espanhol não muda progresso, erros, vocabulário ou perfil do outro curso. `scripts/check-architecture.ts` falha se imports e marcadores espanhóis reaparecerem no Core, nas APIs ou em componentes genéricos.

## Legado e limites

`src/content/frecuencias-a1.ts`, `spanish-resources.ts` e arquivos relacionados existem apenas como fixtures do verificador antigo; o runtime importa exclusivamente os pacotes compilados. `course-state-storage.ts` conserva uma leitura do formato pré-migração e da preferência `spanishRegion` para não perder dados existentes. Esses pontos podem ser removidos quando o verificador antigo migrar e os dados históricos forem consolidados.

A validação pedagógica é uma triagem determinística. No conteúdo espanhol atual, dois avisos de resposta alternativa equivalente à principal seguem para revisão editorial. A prova sintética e o isolamento são verificados por script; a experiência completa de um segundo idioma real e a qualidade das respostas de IA ainda precisam de teste humano. A reprodução de voz depende das vozes instaladas no dispositivo, e `xx-Test` não usa avaliação oral.
