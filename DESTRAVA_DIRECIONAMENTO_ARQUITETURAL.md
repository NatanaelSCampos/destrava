# Destrava — direcionamento arquitetural

Premissas registradas em 2026-10-09; evidências atualizadas em 2026-10-10.
Este documento orienta a interpretação dos contratos e relatórios anteriores.
Propostas e lacunas permanecem distintas dos incrementos locais implementados.

## 1. Premissas atuais

- O produto está em desenvolvimento experimental. Não há alunos reais; as
  contas existentes pertencem ao desenvolvedor e servem para testes.
- Histórico e progresso experimental não exigem compatibilidade permanente.
  Reinicializações controladas são aceitáveis em tarefas que as requeiram.
  Esta atualização não realiza nenhuma reinicialização.
- Espanhol e inglês são conteúdo provisório de teste, não referências normativas
  de currículo, avaliação, estrutura de curso ou capacidades do motor.
- O objetivo atual é consolidar o motor extensível de aprendizagem. Produzir
  cursos completos não é a prioridade desta fase.
- Integridade e persistência continuam sendo requisitos do motor definitivo,
  mesmo quando os dados de desenvolvimento são descartáveis.

## 2. Fronteiras dos projetos

### Destrava — Learning Engine

Executa cursos, atividades, avaliações e sessões; gerencia evidências, revisão,
personalização, habilidades e progresso. Integra IA e serviços necessários à
experiência do aluno. Valida e importa pacotes e verifica capacidades exigidas.

Implementa algoritmos gerais e executa políticas declaradas pelos cursos. Não
pesquisa, produz nem aprova editorialmente o catálogo de cursos.

### Destrava Language Foundry

Pesquisa idiomas, define currículos e sequências, produz materiais, valida
correção linguística e pedagógica e exporta pacotes com proveniência e aprovação.
Sua integração usa o contrato público; não usa banco, componentes ou tipos
internos do Learning Engine como interface operacional.

### Interface entre os projetos

O pacote versionado transporta conteúdo, políticas, recursos e requisitos.
O motor verifica estrutura, referências, recursos, compatibilidade, requisitos
e metadados de aprovação. A presença desses metadados não prova por si só a
correção linguística; a política de confiança no produtor precisa ser definida.

Conteúdo gerado durante a prática no motor é distinto do conteúdo canônico
publicado pelo Foundry. Seus resultados precisam de avaliações próprias antes
de serem tratados como evidência pedagógica confiável.

## 3. Conclusões da auditoria que mudam

| Conclusão anterior | Direcionamento atualizado |
| --- | --- |
| Prioridade de preservação dos históricos existentes | Menor custo de migração: são dados experimentais; preservar a correção do mecanismo, sem manter legado indefinidamente. |
| Aprovação editorial acoplada à publicação no motor | Aprovação pertence ao Foundry. O motor exige e verifica o contrato e a política de importação apropriada. |
| Conteúdo ES/EN como base das regras | ES/EN são fixtures. Regras gerais precisam ser demonstradas com estruturas sintéticas variadas. |
| Ampliar a qualidade dos cursos atuais | Priorizar independência do motor, contrato e interoperabilidade. |
| Evals de conteúdo e IA em um único fluxo | Separar avaliações editoriais do Foundry das avaliações da IA usada na experiência do aluno. |
| Compatibilidade extensa com formatos de teste antigos | Manter apenas quando houver justificativa; transições controladas podem substituir adaptações permanentes. |

Continuam válidas as lacunas de observabilidade, qualidade da IA, cotas financeiras,
testes reproduzíveis e integridade. A implantação de SMTP e a preparação para
alunos reais não são o próximo passo arquitetural.

## 4. Evidências do código atual

- `src/content/contracts.ts:27` e `:249`: pacotes de idioma e curso já oferecem
  identidade, versões, normalização, currículo, avaliações e recursos.
- `src/content/contracts.ts:2`: a dependência original dos enums do domínio
  foi removida na Fase 2.2, incremento 1. Contrato e preferências usam agora
  `src/content/contract-vocabulary.ts`; ver `DESTRAVA_DESACOPLAMENTO_CONTRATOS_INCREMENTO_1.md`.
- `src/content/contracts.ts:218`: payload genérico e estratégia opcional exigem
  contratos específicos de atividade e uma política para estratégias desconhecidas.
- `src/content/runtime-package.ts`: ainda usa um segundo modelo de runtime,
  mas no Incremento 2 passou a preservar definições, finalidades, métodos,
  políticas de avaliação e referências do curso/unidades.
- `src/domain/study/progress.ts`: finais agora usam `assessmentRefs.final`,
  resultados canônicos versionados e política da avaliação. A descoberta por
  `quiz` e ID derivado foi removida. Exigências fixas de escrita, fala e notas
  de exercícios/revisão foram substituídas no Incremento 3 por critérios explícitos de `unit.learningPolicy`. Os algoritmos de revisão e heurísticas de recomendação permanecem no motor.
- `src/content/contracts.ts`, `assessment-references.ts` e
  `src/domain/assessments/assessment-engine.ts`: a evolução 1.2, preservada no schema 1.3, distingue finalidade,
  método e papel curricular; valida associações e executa a definição privada.
  Ver `DESTRAVA_AVALIACOES_INCREMENTO_2.md`. A instalação relacional foi apenas
  preparada; não houve migração/seed remoto ou publicação deste incremento.
- `src/domain/numbers/number-practice.ts:16`: números usam dígitos ASCII,
  convenções de moeda e sufixos ordinais particulares; não comprovam suporte universal.
- `src/domain/activities/grader.ts:12`: normalização é configurável, mas o
  conjunto de pontuação e a remoção de diacríticos têm alcance específico.
- `src/content/contracts.ts:37`, `:43`, `:58`: direção, traços linguísticos,
  capacidades e estratégias estão declarados. Nem todos têm execução correspondente.
- `scripts/content-loader.ts:19`, `:178`: carregamento depende de pastas do
  repositório e mídias em `public`; não é ainda um importador externo completo.
- `scripts/content-loader.ts:182`: reconhecimento e pronúncia exigem configuração
  Azure. Capacidade educacional e configuração operacional de provedor devem
  ter fronteiras explícitas.
- `scripts/check-architecture.ts`: a verificação por marcadores de idioma é
  útil, mas não detecta todos os pressupostos de escrita e estrutura curricular.

Essas evidências justificam adaptação da base existente, sem concluir que uma
reescrita ou arquitetura de plugins seja necessária.

## 5. Roadmap revisado

| Etapa | Entrega e dependências | Risco principal | Aprendizado de engenharia |
| --- | --- | --- | --- |
| 1. Fronteiras e proposta do contrato V1 | Inventariar pressupostos; classificar regras entre motor, curso, idioma e infraestrutura; propor contrato e fixtures. Usa os contratos existentes. | Congelar os pressupostos de ES/EN em um contrato supostamente universal. | Context Engineering, análise de dependências, invariantes e decisões arquiteturais rastreáveis. |
| 2. Consolidar núcleo e capacidades | Executar políticas declaradas, separar traços linguísticos de capacidades implementadas e registrar suporte explícito. Depende da proposta da etapa 1. | Declarar suporte que o runtime não executa; misturar indisponibilidade temporária com incompatibilidade. | Engenharia de contratos, máquinas de estado, testes por comportamento e limites da IA. |
| 3. Consolidar contrato público V1 | Schema portável, versões, IDs, estratégias, referências, mídias e aprovação; exemplos válidos/inválidos e relatórios técnicos. Depende do inventário e da prova do núcleo. | Duas fontes de verdade divergentes ou perda de validações semânticas ao exportar schemas. | Schema design, versionamento, validação estrutural versus semântica e geração assistida verificável. |
| 4. Exportação, importação e interoperabilidade | Exportador independente simulado, importação preparada antes da ativação, instalação repetível e comparação do conteúdo. Depende do contrato V1 e capacidades. | Instalação parcial, recursos ausentes, conflito de versões e acoplamento ao banco. | Testes de contrato, isolamento de produtor/consumidor e automação reproduzível. |
| 5. Evals editoriais e de runtime | Foundry avalia materiais; motor avalia tutor, escrita, conversa e fala, com datasets e critérios próprios. Depende de conteúdo/contrato rastreáveis. | Confundir aprovação editorial com acerto de uma resposta probabilística; premiar o próprio modelo como juiz único. | Evals, baselines, revisão humana, evidências com origem e confiança. |
| 6. Operação e integridade ampliadas | Traces, custo, timeout/retries, concorrência, transação das projeções e ciclo de vida de dados. Depende de versões e resultados identificáveis. | Observabilidade enganosa, dados pessoais em logs e gravações concorrentes. | Observabilidade de IA, orçamentos, recuperação de falhas e consistência de dados. |

CI, testes locais e revisão de alterações devem acompanhar cada incremento,
sem aguardar a última etapa. Novas capacidades surgem de necessidades demonstradas;
não implementar agora suporte tonal, caracteres ou plugins apenas como antecipação.

## 6. Próxima etapa recomendada

**Situação da execução incremental:** a auditoria Fase 2.1 e os incrementos
de desacoplamento de vocabulário e semântica de avaliações estão documentados.
A proposta de análise abaixo registra a orientação original. O Incremento 3 de políticas de conclusão/domínio foi homologado no checkpoint local `a7ec750`. Ver `DESTRAVA_POLITICAS_INCREMENTO_3.md` e `DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md`. O Incremento 4 foi implementado localmente com registro, negociação e catálogo de capacidades; ver `DESTRAVA_CAPACIDADES_INCREMENTO_4.md`. As Partes 5A, 5B e 5C foram implementadas localmente; o Incremento 6 depende de autorização.

**Fronteiras do Learning Engine e proposta do contrato de conteúdo V1.**

Escopo: análise e especificação verificável, antes de alterar o núcleo.

Entregas:

1. Inventário das regras atuais, com localização, responsabilidade e destino.
2. Invariantes gerais e políticas configuráveis de conclusão, avaliação e evidência.
3. Proposta do contrato público, aproveitando `LanguagePackage` e `CoursePackage`
   quando adequados, com atividades, recursos, proveniência e compatibilidade.
4. Catálogo inicial de capacidades realmente implementadas e requisitos dos pacotes.
5. Exemplos sintéticos: curso sem escrita/fala, unidades sem avaliação final,
   escrita RTL, escrita sem espaços e capacidade exigida mas indisponível.
6. Decisões propostas, alternativas e critérios de aprovação da implementação seguinte.

Critérios para encerrar essa análise:

- O produtor consegue descrever o pacote sem importar `src/domain`, `src/app`
  ou depender de Supabase.
- Cada regra fixa identificada tem classificação e decisão proposta.
- Requisitos obrigatórios e opcionais têm comportamento de compatibilidade claro.
- Um caso sintético válido não exige alterar a lógica apenas para trocar de língua.
- Recurso ainda não implementado é informado explicitamente; não há simulação de suporte.
- Versão de contrato, versão de conteúdo e compatibilidade do motor são distinguíveis.
- Políticas de fixture experimental e de conteúdo publicado não se confundem.

Os exemplos RTL/sem espaços inicialmente verificam fronteiras e limitações;
não comprovam qualidade pedagógica de árabe, japonês ou outros idiomas reais.

## 7. Alternativas e decisões ainda abertas

### Localização e formato do contrato

- Manter o contrato apenas como módulos TypeScript internos é simples, mas
  obriga o produtor a conhecer o runtime e seu ecossistema.
- Publicar schemas e exemplos como artefatos portáveis, inicialmente versionados
  neste repositório, facilita a independência sem criar um terceiro projeto.
- Criar um pacote/repositório compartilhado pode servir a muitos consumidores,
  mas adiciona coordenação de releases. Não há necessidade demonstrada agora.

Recomendação inicial: investigar um contrato público portável e autocontido,
mantendo Zod como implementação de validação quando adequado. Não fixar ainda
se JSON Schema será a fonte normativa ou um artefato gerado; as regras entre
referências, capacidades e políticas não se resumem à validação de campos.

### Questões a decidir antes de implementar

- Arquivo único ou diretório com manifesto e recursos? Contêiner compactado
  pode ser transporte posterior; não precisa determinar o modelo lógico.
- Perfil de idioma incluído ou dependência externa resolvível e versionada?
- Quais dados pertencem ao perfil linguístico e quais são mapeamento de provedor?
- Instalação no build ou importação em runtime? O build atual é reutilizável,
  mas o destino pretendido precisa orientar a primeira implementação.
- Quais alterações preservam IDs/evidências e quais exigem nova versão ou reset?
- Como separar compatibilidade de contrato, versão de conteúdo e suporte do motor?
- Como distinguir capacidade implementada, configurada e temporariamente indisponível?
- Aprovação por pacote ou por material? Como o motor confia no produtor?
- Quais políticas de conclusão/correção entram no V1 e quais ficam para uma extensão?

O Incremento 4 adotou um registro tipado de implementações internas, com schemas
compartilhados e bindings conferidos por AST. Essa é a base atual das capacidades.
Plugins executáveis externos só devem ser considerados se
um caso concreto exigir distribuição independente de comportamento.

## 8. Etapa de integridade já implementada

A proteção da sincronização é uma entrega separada. Foram aprovados 13 cenários
isolados, nove verificadores existentes, TypeScript e ESLint. Não foi refeita
nesta atualização; validação manual continua pendente. Ver
`DESTRAVA_INTEGRIDADE_PROGRESSO_ETAPA_1.md`.

Nenhuma funcionalidade, conta, conteúdo de teste ou dado foi alterado nesta
atualização documental. Não houve commit nem deploy.

## Incremento 5A implementado localmente

Apenas representação textual, identidade por ocorrência, reconstrução e medidas/limites foram generalizados. [Relatório e exemplos](DESTRAVA_TEXTO_INCREMENTO_5A.md). Novas capacidades foram verificadas e publicadas no catálogo local; requisitos de runtime/locale não viram uma declaração de suporte universal. O Incremento 4 permanece sem commit; seu estado anterior está preservado em cópia local ignorada. Não iniciar 5B/5C sem instrução posterior.

## Incremento 5B implementado localmente

Padrões e variantes aceitas pertencem ao curso; restrições e equivalências pertencem à atividade; preferência é do aluno. O motor aplica precedência e validação determinísticas. Compatibilidade de locale/provedor é operacional e não redefine a variante pedagógica. O novo contexto de IA transporta restrições e classificação local da resposta sem exportar novas listas privadas de gabarito.

[Entrega e aprendizado de 5B](DESTRAVA_VARIANTES_INCREMENTO_5B.md): 20 grupos de variantes, 7.000 verificações geradas, regressões de 5A preservadas e 14 cenários contra Supabase local isolado. A fidelidade acústica e a qualidade linguística não foram certificadas por esses testes. O schema de curso 1.4 sinaliza os novos campos obrigatórios para consumidores; 1.3 continua aceito para o conteúdo existente. Não iniciar 5C sem autorização.

## Incremento 5C implementado localmente

Idioma, variante, direção de conteúdo e contexto da interface são conceitos separados. O perfil/curso declara características; o motor resolve apresentação e mantém sequência lógica e validação. HTML dir/bdi, CSS lógico e entrada nativa são usados em componentes comuns, sem regras por nome de língua. Texto externo é escapado, isolado e tem controles de direção sinalizados nas fronteiras centrais; essa proteção não é uma política completa contra spoofing.

[Entrega, classificações, testes e didática de 5C](DESTRAVA_APRESENTACAO_INCREMENTO_5C.md). O curso 1.5 sinaliza metadados novos; o catálogo 1.3.0 anuncia apresentação horizontal e entrada nativa com limites. Testes técnicos não comprovam qualidade editorial nem qualificação de um teclado/leitor real. Essas pendências acompanham a consolidação do contrato/capacidades no planejamento do Incremento 6, ainda não iniciado.
