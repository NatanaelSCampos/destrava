# Destrava — Incremento 6: contrato público e importação local

Data: 2026-10-10. Baseline de partida: `2e0ace4` (Incrementos 4–5C). Entrega local, sem commit, instalação ou publicação de cursos. O Incremento 7 não foi iniciado.

## A. Diagnóstico inicial

O pipeline existente era `content/languages` + `content/courses` → `scripts/content-loader.ts` → schemas/validações → `runtimeBundle()` → compilação em `src/content/generated` → registro estático. Seed e persistência eram operações separadas. A importação externa não deve chamar compilação, seed ou alterar o registro.

O carregador exigia pastas internas com nomes iguais aos IDs e verificava mídia em `public/`. A validação de referências estava misturada à leitura do disco e interrompia no primeiro erro. Esses acoplamentos impediam reutilizar o carregamento como contrato de um produtor independente.

O estado confirmado no código diferia da descrição inicial: idioma **1.1**, curso experimental **1.3/1.4/1.5**, catálogo **1.3.0 com 44 capacidades**. Não foram inventadas capacidades para aceitar o pacote.

Componentes reutilizados:

| Componente existente | Uso na fronteira externa |
| --- | --- |
| Schemas Zod de idioma, curso, unidades, módulos e atividades | Validação dos documentos e geração dos artefatos públicos. |
| Refinamentos de avaliações e políticas | Coerência do curso montado, propriedade e finalidade das evidências. |
| Registro/negociação de capacidades | Requisitos conhecidos, versões, suporte parcial, alternativas e condições operacionais. |
| `runtimeBundle()` | Conversão para o runtime já utilizado pela aplicação. |
| `publicCourse()` | Projeção sem gabaritos e dados privados de correção. |
| Grader e avaliador de avaliações | Execução temporária do conteúdo externo nos testes. |
| Representação textual, variantes e apresentação de 5A–5C | Identidades por ocorrência, medidas, contexto e direção preservados. |

As referências foram extraídas para `src/content/package-references.ts`, função pura utilizada tanto pelo carregador interno quanto pelo importador. As verificações específicas de pastas, IDs globais entre cursos instalados e arquivos em `public/` continuam pertencendo ao adaptador interno. O importador valida um pacote, não decide conflitos com versões instaladas.

Lacunas confirmadas: `activity.instructions` localizado não possui binding de runtime; agora é rejeitado na fronteira externa. `activity.difficulty` e pré-requisitos de conceitos são preservados como metadados, com aviso; não viram dificuldade adaptativa ou gates de aprendizagem. A dificuldade adaptativa e os gates executáveis usam as declarações já implementadas em avaliações/políticas.

## B. Contrato de pacote

A especificação de autoria é [contracts/package-v1/README.md](contracts/package-v1/README.md). Essa é a referência canônica para layout, manifesto, versões, limites, recursos e reprodução. Este relatório registra decisões e evidências, sem substituir a especificação.

O transporte inicial é um diretório com `manifest.json`, documentos JSON separados e binários declarados. Os caminhos pertencem ao pacote, sem dependência das pastas da aplicação. São distintas:

1. Versão do envelope: `destrava.course-package` **1.0.0**.
2. Versões dos contratos de conteúdo: idioma **1.1**, curso **1.3/1.4/1.5**.
3. `contentVersion`: versão específica do material, consistente entre manifesto e curso.

`package:contracts` gera **16 JSON Schemas, `compatibility.json` e `capabilities.json`** a partir dos schemas/registro existentes. `example-source.json` e o guia são artefatos públicos de autoria. O teste compara os artefatos gerados com sua fonte canônica: mudanças sem regeneração falham.

A exportação usa a representação de entrada de Zod, preservando campos opcionais antes de seus defaults. JSON Schema não expressa todos os refinamentos e relacionamentos do motor; por isso o contrato exige a validação semântica do consumidor. Essa distinção segue a [documentação de conversão de Zod](https://zod.dev/json-schema).

## C. Implementação

```text
Produtor independente — artefatos públicos → diretório declarativo
                                              ↓
Adaptador de disco — snapshot limitado de bytes, sem escritas
                                              ↓
Validador — estrutura → integridade → referências → capacidades
                                              ↓
runtimeBundle existente → DTO privado temporário + projeção pública
                                              ↓
Relatório público / CLI; nenhuma instalação ou alteração de catálogo
```

Interfaces:

- Biblioteca: `validateExternalPackageDirectory(directory, { environment? })`.
- Porta de bytes: `validateExternalPackageFiles(snapshot, options)`.
- CLI: `npm.cmd run package:validate -- <diretório> --dry-run`.
- Testes: `npm.cmd run package:verify`.

A CLI é somente leitura também sem `--dry-run`. Saída 0 significa preparado para inspeção/teste; saída 1 significa rejeitado. Ela emite apenas o relatório. Não devolve buffers, gabaritos ou o runtime privado. O atributo `prepared` da biblioteca é não enumerável para proteger serialização acidental; acesso explícito continua sendo uma operação privada do consumidor.

O núcleo recebe dados e configuração operacional fornecida pelo consumidor; não lê credenciais nem aceita configuração de infraestrutura do produtor. O adaptador contém a dependência de filesystem. Isso permite futuros transportes usando a mesma validação sem criar um segundo executor.

O relatório diferencia estrutura/semântica/integridade de compatibilidade. `prepared` não significa que todas as operações estão disponíveis: a disponibilidade é `ready`, `unknown` ou `unavailable`. Sem informação confiável sobre serviços/mídia, permanece desconhecida. A projeção pública usa a mesma configuração para bloquear operações indisponíveis.

Os diagnósticos acumulam erros independentes, com código, categoria, severidade, documento relativo, campo, descrição e correção. Versões esperadas/recebidas aparecem quando seguras. Erros em conteúdo composto são mapeados de volta ao documento de origem. Falhas residuais da preparação do runtime podem aparecer no documento de curso, em vez de um campo mais específico; esse limite é explícito.

## D. Segurança e invariantes

Os controles são definidos no guia público e em `package-contract.ts`. Incluem caminhos portáveis relativos; bloqueio de traversal, URLs e caminhos absolutos; rejeição de links simbólicos/junctions/hard links; limites de arquivos, bytes, profundidade e complexidade; extensões permitidas; colisões de nomes; arquivos não declarados; SHA-256/tamanho; assinatura inicial de mídia; UTF-8/Unicode válidos; chaves JSON duplicadas e chaves perigosas.

O adaptador usa `lstat`, caminho real, abertura somente para leitura e comparação da identidade/tamanho do arquivo antes/depois. `O_NOFOLLOW` é usado onde disponível; os demais controles não dependem exclusivamente dele. A distinção entre examinar o link e resolver o caminho é documentada na [API filesystem do Node](https://nodejs.org/api/fs.html).

Invariantes comprovados nos testes:

1. Nenhum código recebido é importado ou executado; nenhum recurso é baixado.
2. Rejeição não produz runtime preparado, seed, instalação ou alteração do catálogo.
3. O relatório e a projeção pública não contêm gabaritos, políticas privadas de resposta ou snippets de JSON inválido. Mensagens nativas de `JSON.parse` são suprimidas porque podem incluir conteúdo privado.
4. Capacidade desconhecida/incompatível ou alternativa insuficiente bloqueia preparação.
5. Disponibilidade operacional não altera a definição de suporte técnico.
6. Aprovação declarada não autentica produtor ou revisor: confiança fica `unverified`, administrador `not_reviewed`, publicação/eligibilidade falsas, ativação `not_performed`.
7. Campos desconhecidos/comportamento não executado não desaparecem silenciosamente como suporte aceito.
8. A preparação usa o executor existente e preserva semântica textual, variantes, avaliações e políticas.

Limites: hash prova integridade em relação ao manifesto, **não autenticidade do produtor**. Assinatura inicial de mídia não prova decodificação, qualidade editorial ou alinhamento áudio/transcrição. O leitor detecta várias alterações durante leitura, mas não é um sandbox contra um invasor privilegiado que controle o filesystem. Não há assinatura criptográfica de autoria, scanner de codecs ou aprovação humana nesta etapa.

## E. Testes e resultados

### Execução automática

`package:verify` passou: **33 grupos, 3.500 asserções geradas de caminhos**, seed `0x617`. O produtor e seus artefatos são copiados para diretório temporário fora do repositório, executados em outro processo e entregues à biblioteca/CLI. Seus imports são apenas built-ins do Node. `fetch` é bloqueado no consumidor de teste. Não há chamadas pagas ou operações de banco/publicação.

Cobertura dos 24 cenários solicitados:

| # | Cenário | Evidência automática |
| --- | --- | --- |
| 1 | Pacote externo válido | Diretório independente prepara bundle; catálogo permanece com três cursos. |
| 2 | Manifesto inválido | Erro estrutural com campo localizado. |
| 3 | Versões incompatíveis | Envelope e schemas desconhecidos recusados. |
| 4 | Documento ausente | Documento obrigatório e referência não encontrada recusados. |
| 5 | IDs duplicados | Duplicidade curricular rejeitada. |
| 6 | Referências curriculares | Conceito inexistente e léxico em lição desconhecida geram erros separados. |
| 7 | Avaliação inválida | Referência inválida localizada no documento de avaliações. |
| 8 | Política inválida | Evidência ausente/sem propriedade correta rejeitada. |
| 9 | Capacidade desconhecida | Requisito obrigatório impede preparação. |
| 10 | Capacidade incompatível | Versão incompatível e implementação parcial não viram suporte completo. |
| 11 | Alternativa insuficiente | Fallback inválido rejeitado; válido preservado. |
| 12 | Variante inválida | Variante do curso/atividade rejeitada. |
| 13 | Estratégia incompatível | Estratégia textual desconhecida não é descartada. |
| 14 | RTL | Texto lógico, direção e isolamento preservados no runtime. |
| 15 | Mídia ausente | Ausência, hash alterado e tipo/assinatura incompatíveis rejeitados. |
| 16 | Caminho malicioso | Traversal, absolutos, URLs e caminhos codificados recusados. |
| 17 | Inconsistência semântica | Identidades divergentes e ciclos de pré-requisitos rejeitados. |
| 18 | Fixture sem aprovação | Material `test`/`draft` prepara tecnicamente sem elegibilidade editorial. |
| 19 | Projeção pública | Ausência de respostas, ordem canônica e políticas privadas; serialização segura. |
| 20 | Semântica preservada | Tokens repetidos, separador literal, medidas, variantes, avaliações e políticas conservados. |
| 21 | Sem efeitos persistentes | Registro/IDs e hashes dos quatro artefatos compilados permanecem iguais. |
| 22 | Diagnóstico localizado | Códigos, campos/documentos e erros independentes verificados. |
| 23 | Executor existente | Grader corrige ordenação; avaliador somativo produz 100 e variante `variant-b`. |
| 24 | Produtor independente | Processo externo usa apenas schemas/exemplo/catálogo, sem TS privado ou banco. |

Casos adicionais: artefatos públicos divergentes; falsa aprovação; operação indisponível versus incompatibilidade; módulos e URLs informacionais; scripts/links; colisões de nomes; limites; Unicode malformado; chaves JSON perigosas/duplicadas; vazamento de snippet em erro de parsing; campos ignorados.

Regressões executadas, todas aprovadas:

| Verificadores | Resultado |
| --- | --- |
| `contracts:verify`, `capabilities:verify`, `architecture:check` | Enums/consumidores, registro e bindings, fronteira de contratos sem ciclos; nove módulos neutros na verificação arquitetural. |
| `content:validate`, `content:pedagogy`, `interactive:verify` | Conteúdo interno continua válido; zero erros e dois avisos editoriais anteriores de respostas equivalentes em `grammar-5`/`review-4`, sem alteração fora do escopo. |
| `assessment:semantics:verify`, `assessment:verify`, `policies:verify` | Avaliações/referências/políticas; 1.024 caminhos ES, 1.024 EN e oito da fixture. |
| `text:verify`, `variants:verify`, `presentation:verify` | 12.232, 7.000 e 12.000 asserções geradas, respectivamente. |
| Verificadores de UI de texto, variantes e apresentação | Passaram; preservam a cobertura existente de navegador, não certificam novas línguas. |
| `multilingual:verify`, `learning:verify`, `sync:verify`, `onboarding:verify`, `session:verify` | Compatibilidade do motor e regressões pertinentes aprovadas. |
| `typecheck`, `lint`, `build:local`, `git diff --check` | Validação final local; build com 39 rotas, sem rota administrativa nova. |

O build protegido comprovou Docker `desktop-linux`, daemon local, projeto `espanhol-plataform` e API `http://127.0.0.1:54321`. Não foram necessárias migrações nem testes novos de persistência: o importador não possui escrita ou dependência de Supabase. Os testes de banco de checkpoints anteriores não são apresentados como nova evidência deste incremento.

### Validação manual e limites de evidência

- Reprodução da CLI pelo usuário está documentada no guia público; não exige login ou serviços externos.
- Não existe tela nova de importação. A aplicação local continua em `http://127.0.0.1:3000` para revisão normal.
- Reprodução de áudio do pacote em tela, instalação e troca de curso não foram homologadas: dependem do resolver/armazenamento e ciclo de instalação do Incremento 7.
- IMEs, leitores de tela, fontes reais e qualidade linguística/pedagógica continuam exigindo validação humana. A fixture RTL não certifica um curso de idioma real; o WAV sintético é material técnico de teste.

## F. Aprendizado e experimento

1. **Independência de implementação.** Antes, um produtor teria de imitar pastas internas e conhecer o compilador. Agora entrega documentos descritos por artefatos públicos. Mudanças de Supabase ou de UI não obrigam o Foundry a reescrever sua autoria. Essa é integração dirigida por contrato.
2. **Dados versus transporte.** `coursePackageSchema` define dados pedagógicos. O envelope declara em quais arquivos estão esses dados e seus hashes. A CLI transporta uma entrada pelo disco; uma API futura pode entregar o mesmo snapshot sem redefinir o curso.
3. **Estrutura versus semântica.** Um `assessmentId` pode ser uma string válida e apontar para uma avaliação inexistente ou de outra unidade. Zod valida a forma; refinamentos/referências validam as relações. Os testes alteram ambas as classes separadamente.
4. **Fronteira de confiança.** Antes da leitura, arquivos e metadados são alegações externas. Hashes, schemas e referências permitem inspeção técnica; `approved` continua sendo uma alegação. Nenhuma dessas etapas autoriza servir conteúdo a alunos.
5. **Conteúdo de agentes também é externo.** Um agente pode produzir JSON formalmente correto com variante impossível, rubrica contraditória ou origem inventada. A fronteira valida dados independentemente de terem sido escritos por humano ou IA; revisão editorial continua separada.
6. **Importador desacoplado.** O núcleo recebe `ReadonlyMap<string, Uint8Array>` e ambiente confiável do consumidor. Não conhece conta, banco, framework ou ferramentas do produtor. O filesystem está em um adaptador. Isso aplica Ports & Adapters e inversão de dependências.
7. **Anti-Corruption Layer.** Montagem, validação e `runtimeBundle()` traduzem o contrato externo para os tipos internos. O Foundry não precisa conhecer `answerOrder` projetado no runtime ou modelos de persistência; o motor conserva seu executor e rejeita semântica não suportada.
8. **Integração sem serviço real.** Copiamos o produtor e artefatos para outro diretório e executamos um processo Node independente. Depois exercitamos o grader/avaliador reais em memória. Isso comprova o contrato entre produtor e consumidor sem Supabase, DLF, Azure ou OpenAI.
9. **Validação separada de publicação.** Um pacote pode ser válido e conter conteúdo de teste ou depender de serviço indisponível. Instalar exige confiança, homologação, armazenamento, versões e rollback. O relatório registra essas dimensões separadamente, evitando transformar um check técnico em publicação.
10. **Aplicação em outros sistemas.** Em marketplace, valide referências de produto/variante além do JSON; em ERP, propriedade de pedido/cliente; em pagamentos, assinatura/idempotência além da forma do webhook. Adaptadores, contratos versionados e testes de consumidor/produtor são reutilizáveis; autoridade para executar a operação continua sendo uma decisão separada.

Experimento reproduzível: siga [Produtor simulado e experimento](contracts/package-v1/README.md#produtor-simulado-e-experimento). O modo `--unsupported` exige `presentation.bidi` **99.0.0** e recalcula integridade. O diagnóstico esperado é `CAPABILITY_VERSION_INCOMPATIBLE` em `documents/course.json`; `preparation` muda para `rejected`. Isso demonstra incompatibilidade de contrato, sem confundir o resultado com hash desatualizado ou indisponibilidade operacional.

## G. Próximos passos e arquivos

Para o Incremento 7, investigar somente após autorização:

- Artefato de staging imutável, identidade/versionamento instalado e isolamento da leitura de diretórios mutáveis.
- Políticas de autenticação/confiança de produtores, assinatura e homologação administrativa, sem confiar no manifesto isoladamente.
- Armazenamento/resolução segura dos binários; verificação de codecs e estratégia de publicação de mídias.
- Instalação transacional, conflitos de IDs/versões, repetibilidade, ativação e rollback.
- Compatibilidade/migração de progresso entre versões, preservando os invariantes de integridade já implementados.
- Granularidade adicional de diagnósticos de refinamentos de runtime e evolução compatível do contrato experimental.

O objeto preparado e seus buffers/mapas **não são um artefato de instalação imutável**. Seu escopo é o teste temporário desta etapa. Hashes e metadados não constituem prova de autenticidade ou revisão editorial.

Arquivos desta entrega:

| Grupo | Arquivos |
| --- | --- |
| Contratos e referências | `src/content/package-contract.ts`, `src/content/package-references.ts`, `src/content/contracts.ts`, `src/content/validate-interactive-lessons.ts`. |
| Núcleo de importação | `src/engine/import/validate-package.ts`, `json-data.ts`, `diagnostics.ts`, `public-artifacts.ts`. |
| Adaptador e interface | `src/repositories/external-package-directory.ts`, `src/lib/external-package-validation.ts`. |
| Integração existente | `scripts/content-loader.ts`, `scripts/check-architecture.ts`, `src/engine/capabilities/registry.ts`. |
| Comandos e testes | `scripts/export-package-contracts.ts`, `scripts/validate-external-package.ts`, `scripts/produce-external-course.mjs`, `scripts/verify-external-packages.tsx`, `package.json`. |
| Fronteira pública | `contracts/package-v1/`: 18 artefatos gerados, `example-source.json` e `README.md`. |
| Documentação | Este relatório, `README.md`, `DESTRAVA_ARQUITETURA_MULTILINGUA.md`, `DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md`, `DESTRAVA_CONTRATOS_MULTILINGUA_V1.md`. |

Mudanças locais anteriores em `next-env.d.ts` e `espanholPlataform.code-workspace` são externas ao escopo. Arquivos temporários e ambientes permanecem ignorados. Nenhuma nova dependência foi adicionada.

Revisão final: 43 arquivos da entrega, branch `main`, HEAD preservado em `2e0ace4b14f2fc8dc89799d7ea592df4f2e02c39` e index vazio. A comparação com valores privados de três perfis de ambiente não encontrou correspondências; a busca por chaves privadas/credenciais no diff também não encontrou padrões suspeitos. `git diff --check` passou. A aplicação local foi reiniciada após o build e `/login` respondeu HTTP 200. Essa revisão específica não constitui uma auditoria de segurança de todo o produto.

**Conclusão:** a interoperabilidade técnica solicitada foi comprovada localmente. Aprovação editorial, homologação administrativa, publicação e instalação não foram realizadas. Aguardar revisão e autorização para a próxima etapa.
