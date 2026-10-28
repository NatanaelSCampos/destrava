# Contrato de apresentação Trilha Viva 1.0.0

Este sidecar é uma entrega editorial independente. Não altera o CoursePackage, seus IDs, versões, hashes, políticas, gabaritos ou evidências. O Motor executa o currículo e decide acesso e disponibilidade; o Foundry descreve títulos, situações e aparência. O contrato executável é `src/content/journey-presentation.ts`.

## Envelope e compatibilidade

Campos obrigatórios: `schemaVersion: "1.0.0"`, `presentationVersion`, `courseId`, `contentVersion`, `chapters`. `structureFingerprint` é um detector opcional de metadados obsoletos, calculado por `journeyCourseFingerprint` sobre identidade pública de unidades, lições, atividades, etapas e referências de avaliação. Não é assinatura criptográfica, hash do pacote ou autorização. Disponibilidade operacional e evidência do aluno não participam desse valor.

O Motor valida todos os campos e referências. Identidade, versão, estrutura ou conteúdo editorial inválidos descartam o sidecar inteiro e exibem a apresentação padrão. Nenhuma atividade curricular desaparece. Cada capítulo deve cobrir uma unidade ativa, na ordem curricular; cada etapa e banco de avaliação devem ser representados exatamente uma vez. IDs de capítulos e momentos são únicos no sidecar. Reordenar referências, omitir etapas e sobrepor momentos é inválido.

O loader de conteúdo compilado está em `src/content/journey-registry.ts`. Cursos instalados não herdam sidecars compilados pelo nome do curso. Atualmente usam a projeção genérica. A futura instalação de sidecars exige transporte e pino próprios; este incremento não modifica o protocolo de instalação ou os hashes curriculares.

## Capítulos e momentos

Capítulo: `id`, `unitId`, `title`, `moments`; aceita os metadados opcionais abaixo. Um momento contém `id`, `title` e um dos targets:

```json
{ "kind": "lesson", "lessonId": "lesson-real", "stageIds": ["stage-real-1", "stage-real-2"] }
```

As etapas devem ser contíguas e manter a ordem declarada na lição. Sem `stageIds`, o momento apresenta a lição inteira. Etapas sintéticas por atividade continuam internas ao fallback; a autoria só pode selecionar etapas declaradas no currículo. Aulas guiadas usam a lição inteira e a referência interativa já existente.

```json
{ "kind": "assessment", "assessmentId": "assessment-real" }
```

Bancos de diagnóstico, recuperação e prova mantêm as rotas oficiais de avaliação. Não podem virar targets de lição para abrir itens isolados. O contrato atual exige uma lição proprietária; avaliações globais sem banco de lição não são convertidas em momentos por esta versão.

## Metadados declarativos opcionais

- `description`, `objective`, `character`, `setting`: texto simples legível, até 600 caracteres. Não usar códigos internos como objetivos apresentados ao aluno.
- `icon`: `book-open`, `message-circle`, `map-pin`, `headphones`, `brain`, `clock`, `handshake`, `coffee`, `shopping-bag`, `target`, `flag`, `trophy`, `sparkles`, `compass`, `play`, `lightbulb`.
- `tone`: `forest`, `sage`, `amber`, `sky`, `rose`. As cores e os componentes pertencem ao Motor.
- `illustration`: `{ "src": "/journeys/scene.webp", "alt": "Descrição da cena" }`. Apenas imagens raster locais sob `/journeys/`, sem URL externa, SVG, caminho relativo ou travessia de diretório. A autoria entrega o arquivo com direitos/proveniência; o Lead integra e confere sua existência. O schema valida o caminho, sem fazer I/O ou carregar a imagem.
- `audioActivityIds`: referências às atividades do próprio momento; não define URL, reprodução automática ou serviço de áudio. O áudio permanece no recurso curricular existente e no renderizador da aula.

Os campos são opcionais; suporte no contrato não implica que cada metadado tenha uma região visível em todas as telas. O Motor escolhe a exposição progressiva. Não são aceitos HTML, JavaScript, CSS, handlers, URLs arbitrárias, regras de desbloqueio, notas ou campos desconhecidos.

## Progresso, acesso e memória

`buildLivingTrail` é uma projeção pura de `PublicCourse`, `StudyState` e do snapshot oficial de acesso. O provider fornece estado já escopado por usuário e versão imutável instalada. A projeção descarta evidência de outro courseId e exige identidade/versão exatas do snapshot. StudyState não contém installationId/contentVersion próprios; sua proveniência é verificada pelo provider/repositório, antes desta função.

Concluídos/total de um momento contam IDs reais de atividades, sem transferir conclusão para uma atividade nova. Essa contagem representa estudo/participação e não comprova domínio. Capítulos usam `unitProgress`; o resumo usa `courseStudySummary`. Avaliações mostram somente resultados canônicos do servidor da mesma identidade/versão/método/finalidade. Uma reprovação final continua visível e pode ser retomada; não destrava o próximo capítulo. A apresentação não autoriza requests e não substitui guards do servidor.

Momentos bloqueados explicam os requisitos do snapshot. Com snapshot ausente ou obsoleto, provas protegidas e unidades com pré-requisito ficam fechadas. Capacidades operacionais são consultadas por `learningActionAvailability`. Um trecho indisponível continua pendente, mesmo quando outro trecho do mesmo momento pode ser aberto. Revisões agendadas e recomendações continuam no planner/fila existentes; este módulo não cria calendários, domínio, evidências ou outro motor de memória.

Entrada de lição: URL oficial com `?moment=<id>&activity=<primeira atividade pendente disponível>`. Em revisita, usa a primeira atividade disponível do momento. Aula guiada usa a rota `/guided`, sem query de atividade. Avaliações usam `assessmentLink`. O identificador visual para retorno é `#moment-<id>`. A identidade de runtime usa namespaces curriculares disjuntos para etapa, aula guiada e avaliação; a origem editorial permanece como alias de navegação. Ver [STAGE_NODES.md](STAGE_NODES.md). Checkpoints de navegação são responsabilidade da UI e nunca constituem evidência pedagógica.

## Autoria ES e handoff

`content/journeys/espanol-a-tu-paso-a1.json` é uma composição visual nova para o currículo já existente 1.7.0: 13 momentos na Unidade 1 e 11 na Unidade 2. Esses agrupamentos são metadados de autoria. A partir da revisão de etapas visíveis, cada etapa ordinária é projetada como um ponto próprio, sem limitar a trilha a dois nós por lição. Aulas guiadas e avaliações permanecem pontos atômicos. As etapas, atividades, aulas guiadas, diagnóstico, retomada pré-prova, prova e demonstração interativa existentes permanecem representados. A ordem curricular atual é preservada, inclusive o posicionamento atual do diagnóstico e da demonstração interativa. Isso é uma decisão de apresentação; não reorganiza o ensino nem adiciona conteúdo curricular.

A autoria foi feita no escopo delegado Motor + interlocução Foundry, lendo o currículo existente e o AGENTS do Foundry. Os testes técnicos não equivalem a QA linguístico independente. O Lead deve registrar este sidecar e o contrato em um novo run Foundry, com hashes e avaliação editorial autônoma independente. Nenhum run congelado ou arquivo da raiz Foundry foi modificado por esta entrega.

Antes de publicar uma nova composição: gerar sidecar, validar `parseJourneyPresentation`, executar o verificador sintético e o QA independente, conferir seus hashes e revisar a apresentação desktop/celular sobre o candidato integrado. Metadados opcionais não requerem migração de banco.

## Export público e validação CLI

O schema JSON público está em `docs/contracts/journey-presentation-1.0.0.schema.json`, derivado de `z.toJSONSchema(journeyPresentationSchema, { target: "draft-2020-12" })`. O Foundry pode validá-lo sem importar tipos internos do Motor. Essa validação estrutural não substitui a conferência semântica de referências e partição pelo Motor. Textos são normalizados com trim na ingestão; o validador canônico resolve as restrições semânticas.

O export de apresentação é opcional e independente. Cursos existentes permanecem compatíveis sem sidecar. Mudanças exclusivamente visuais incrementam `presentationVersion`; não exigem mudar a versão do pacote curricular. Quando o currículo realmente muda, `contentVersion` do sidecar deve apontar para a nova versão e suas referências precisam ser revalidadas.

```powershell
node --import tsx scripts/validate-journey-presentation.ts --course espanol-a-tu-paso-a1 --file content/journeys/espanol-a-tu-paso-a1.json
node --import tsx --test scripts/verify-living-trail.ts
```

A CLI usa o curso compilado canônico, valida todos os campos/referências e retorna exit 1 em incompatibilidade. Não instala curso, modifica banco ou publica conteúdo. O módulo não importa o projeto Foundry. O Lead transporta contrato, sidecar e hashes em um novo run independente.
