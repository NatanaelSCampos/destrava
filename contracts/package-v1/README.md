# Contrato público de pacote Destrava v1

Esta pasta é a fronteira disponível para produtores independentes. Os JSON Schemas e o catálogo são gerados dos schemas/implementações do motor. O produtor não precisa importar TypeScript interno, acessar Supabase ou conhecer a estrutura do runtime.

## Versões e validade

- Envelope: `destrava.course-package`, versão **1.0.0**.
- Conteúdo: idioma **1.1**, curso experimental **1.3/1.4/1.5**, conforme `compatibility.json`. Os metadados contextuais continuam exigindo suas versões correspondentes.
- Material: `contentVersion` do curso, independente das versões anteriores. Identidade e versão devem coincidir no manifesto e no documento de curso.

Os schemas representam a entrada, usando JSON Schema draft 2020-12. Refinamentos de referências, políticas, capacidades e integridade precisam do validador semântico; passar por um validador JSON Schema genérico não basta. `compatibility.json` descreve limites e comportamento que não se resumem ao schema.

`capabilities.json` descreve suporte, versões exatas e limitações. Não declara saúde de serviço ou certificação linguística.

## Diretório e documentos

`manifest.json` fica na raiz. As outras pastas/nomes são escolhidos pelo produtor, dentro das regras de caminhos. Uma organização possível:

```text
manifest.json
documents/language.json
documents/course.json
curriculum/unit-0.json
sections/concepts.json
sections/lexicon.json
sections/assessments.json
sections/media.json
resources/phrase.wav
```

O manifesto define:

| Campo | Significado |
| --- | --- |
| `format`, `envelopeVersion` | Identificação e contrato de transporte. |
| `id`, `contentVersion` | Identidade/versão do curso, sem convenção oculta de nomes de atividades ou avaliações. |
| `contracts.language`, `contracts.course` | Seleção exata dos schemas dos documentos. |
| `producer` | Identidade declarada pelo produtor; não é autenticação. |
| `provenance` | Material de teste/produção, origem, referências e estado editorial declarado. |
| `documents` | Referências para idioma, metadados do curso, unidades, conceitos, léxico e avaliações; seções opcionais para missões, roleplays, mídia, aulas interativas e módulos. |
| `assets` | Recursos binários locais declarados, com tipo de mídia. |
| `capabilityRequirements` | Requisitos do pacote; integram a negociação e o contexto do curso preparado. |

Cada referência contém `path`, `bytes` e `sha256` hexadecimal em letras minúsculas, calculados sobre os bytes exatos do arquivo. O manifesto não declara hash de si mesmo. Um arquivo não pode ocupar dois papéis nem permanecer sem declaração.

`course-metadata.schema.json` não contém as coleções externas. Cada unidade contém suas lições/atividades; conceitos, léxico e avaliações ficam em documentos separados. `course-assembled.schema.json` descreve a representação de conteúdo após junção. Missões, roleplays e mídia são arrays; cada aula interativa é um documento próprio.

Um módulo habilitado deve constar em `documents.modules`. Seu `source` no perfil linguístico deve usar o mesmo caminho relativo à raiz do pacote. Não usa diretórios internos da aplicação.

## Referências e semântica

IDs precisam ser únicos em seus escopos e não podem colidir com membros reservados de objetos. Referências precisam existir e respeitar propriedade de unidade/lição, finalidade de avaliação, políticas e variantes. Pré-requisitos devem formar um grafo acíclico. Eles são metadados curriculares preservados, não gates de progresso executados automaticamente; requisitos obrigatórios de aprendizagem usam as políticas implementadas.

Campos desconhecidos não são silenciosamente descartados. `instructions` localizado ainda não possui binding de runtime e é rejeitado na fronteira externa; use `prompt` e metadados de apresentação. `activity.difficulty` permanece descritivo, com aviso; dificuldade adaptativa executável é declarada no banco da avaliação. Não assuma comportamento que o catálogo/diagnóstico não confirma.

Estratégias textuais, direção, variantes e alternativas de resposta seguem os schemas publicados e os validadores existentes. O formato não aceita regras executáveis ou um segundo motor.

## Segurança e recursos

Caminhos são relativos, ASCII, limitados a 240 caracteres, usando `/`. Segmentos vazios, `.`/`..`, nomes especiais do Windows, caminhos absolutos, barras invertidas, URLs e escapes percentuais não são aceitos. Nomes não podem colidir após comparação sem diferença de maiúsculas/minúsculas. Isso é uma regra publicada de portabilidade, não uma convenção de IDs curriculares.

São recusados symlinks, junctions, hard links, arquivos especiais e extensões executáveis. O leitor verifica identidade/estabilidade, containment por caminho real e limites antes de aceitar bytes. O pacote deve permanecer estável durante leitura; não há promessa de defesa contra um invasor privilegiado no sistema operacional.

Limites atuais, também gerados em `compatibility.json`:

- 256 entradas no diretório, 32 MiB no total, 1 MiB por JSON e 16 MiB por binário.
- Profundidade de pastas 16; JSON 64 níveis e 100.000 nós por documento.
- Até 2.000 atividades, 2.000 conceitos e 5.000 itens de léxico.
- Até 100 unidades, 100 recursos binários e 100 documentos de aula interativa por manifesto.

Binários permitidos: PNG/JPEG, WAV/MP3 e MP4/WebM, com extensão e assinatura compatíveis. Integridade/signatura não certifica decodificação, segurança de codec, alinhamento entre áudio/transcrição ou qualidade editorial. SVG/HTML, SQL, scripts e ZIP não integram este formato inicial.

`media.src` e áudio inline usam caminhos de binários declarados. Não use caminhos de `public/`, endereços do app, `data:`/`file:` ou downloads remotos. Referências informacionais de origem não são baixadas. Links de fontes regionais que serão apresentados na UI precisam ser HTTPS sem credenciais.

## Resultado e aprovação

`report.schema.json` define o resultado público:

- `technicallyValid`: estrutura, referências, integridade e semântica técnica passaram.
- `compatible`: capacidades mandatórias e alternativas satisfazem as versões/suporte do motor.
- `preparation`: `prepared` ou `rejected`; preparação é uma representação temporária em memória.
- `readiness`: disponibilidade operacional `ready`, `unknown` ou `unavailable`.
- `activation`: sempre `not_performed` nesta versão.
- `editorial`: aprovação declarada, confiança `unverified`, administrador `not_reviewed`, publicação/eligibilidade falsas.

Uma capacidade implementada mas indisponível pode ser tecnicamente compatível e preparada para inspeção; sua operação permanece bloqueada. Um requisito desconhecido/incompatível ou uma alternativa insuficiente impede preparação. Não interprete `prepared` como autorização para servir o curso aos alunos.

`approved` precisa declarar revisor e referência, mas esses textos não autenticam produtor/revisor. Material sintético usa `material: "test"` e não é elegível para publicação. Assinatura/confiança, homologação administrativa e publicação ficam para o fluxo posterior.

Diagnósticos contêm código, severidade, categoria, documento relativo, campo, descrição e orientação; versões esperadas/recebidas aparecem quando seguras. Dados de respostas, buffers e caminhos absolutos do host não são enviados na CLI. O objeto privado `prepared` da biblioteca é não enumerável para evitar vazamento em serialização acidental.

## Interface local do consumidor

```powershell
npm.cmd run package:validate -- C:\caminho\pacote --dry-run
```

Código de saída 0 significa preparado para inspeção/teste; 1 significa rejeitado. A CLI é sempre read-only, com ou sem `--dry-run`. Não possui operações de instalação, publicação ou alteração do curso ativo.

A API local do consumidor é `validateExternalPackageDirectory(path, { environment? })`. `validateExternalPackageFiles(snapshot, options)` recebe um snapshot de bytes. `environment` é configuração confiável do consumidor, nunca um campo operacional aceito do produtor. O relatório é público; o DTO de runtime é interno ao consumidor e não é a interface de autoria do DLF.

## Produtor simulado e experimento

`example-source.json` é conteúdo sintético de autoria, com gabaritos de exemplo; não é projeção destinada aos alunos. O produtor simulado usa Node e somente estes artefatos, sem executar validadores internos para montar seu pacote. A validação posterior é feita pelo consumidor.

No repositório, gere os artefatos e produza um diretório novo:

```powershell
npm.cmd run package:contracts
$externalCoursePath = Join-Path $env:TEMP ('destrava-course-' + [guid]::NewGuid())
npm.cmd run package:example -- contracts/package-v1 $externalCoursePath
npm.cmd run package:validate -- $externalCoursePath --dry-run
```

Para provocar incompatibilidade:

```powershell
$incompatibleCoursePath = Join-Path $env:TEMP ('destrava-incompatible-' + [guid]::NewGuid())
npm.cmd run package:example -- contracts/package-v1 $incompatibleCoursePath --unsupported
npm.cmd run package:validate -- $incompatibleCoursePath --dry-run
```

O modo `--unsupported` muda a versão requerida de `presentation.bidi` para `99.0.0` e recalcula hashes/tamanhos. O relatório deve conter `CAPABILITY_VERSION_INCOMPATIBLE`, apontando `documents/course.json`, sem criar curso no catálogo. Se editar um documento manualmente, atualize seu hash/tamanho no manifesto; caso contrário, também haverá `INTEGRITY_MISMATCH`.

Para reproduzir independência real, copie esta pasta e `scripts/produce-external-course.mjs` para outro diretório e execute o produtor lá. Seus únicos imports são built-ins do Node; o pacote gerado contém dados, nunca o script produtor. Um DLF futuro pode usar outra linguagem e outro validador estrutural, conservando estes artefatos e as regras semânticas documentadas.

## Perfil de execução instalada e experimento I8

[installed-runtime.json](installed-runtime.json) complementa o catálogo: implementação do motor, integração instalada e disponibilidade operacional são estados distintos. É gerado por `npm.cmd run runtime:profile` da mesma fonte usada para bloquear ativação incompatível. Não concede autorização de publicação nem comprova saúde de provedores/browser. O perfil atual é exclusivamente de homologação local; requisitos obrigatórios não integrados rejeitam ativação e rollback.

O produtor `scripts/produce-independent-learning-course.mjs` gera um percurso completo sintético: conteúdo, ordenação, escrita manual, avaliação final e políticas. Copie esta distribuição pública e o script para fora do repositório; execute com Node, sem instalar dependências:

```powershell
$independentCoursePath = Join-Path $env:TEMP ('destrava-independent-' + [guid]::NewGuid())
node scripts/produce-independent-learning-course.mjs contracts/package-v1 $independentCoursePath --version=1.0.0
```

Use outro diretório novo com `--version=2.0.0` e o mesmo `--course-id=<id>` para manter as identidades curriculares e trocar o gabarito. O verificador `runtime:verify` reproduz a distribuição isolada com permissões de filesystem e zero imports privados/rede. `runtime:verify:local` pertence ao consumidor: instala, autoriza por mecanismo restrito de teste e percorre a interface normal. Esses scripts não pertencem ao contrato público do produtor. [Matriz por caminho e evidências](../../DESTRAVA_RUNTIME_INCREMENTO_8.md).
