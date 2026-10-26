# Integração operacional Destrava + Language Foundry

Data: 24/10/2026. Execução autorizada pelo proprietário após reconciliação. **INTEGRAÇÃO LOCAL VALIDADA; PRONTO PARA O PRÓXIMO PEDIDO DE AUTORIA ORIGINAL.**

## Objetivo e aceite

Preparar a coordenação única e ensaiar a mesma minilição “Um primeiro contato”, sem gerar outro curso nesta tarefa. Ao final, oferecer uma entrada clara para autoria original de um curso espanhol e um fluxo de melhoria do motor por evidências.

Referência Motor `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, candidato anterior F2-FINAL-C3/digest `49634482399518ac4acc09473f1c5367226a8128e7677b001c7be77f1b8cbfb3`. Os arquivos locais pendentes são preservados; HEAD não representa sozinho o candidato em execução.

## Responsabilidades

| Assunto | Responsável |
| --- | --- |
| Entrada do proprietário, prioridade, autorização e integração | Destrava Lead |
| Conhecimento, currículo, explicações, distratores, rubricas, roteiros e mídia educacional | Foundry, com autoria e QA independentes |
| Renderização, navegação, correção técnica, persistência, segurança e provedores | Motor |
| Texto genérico de interface | Internacionalização do Motor |
| Problema cruzado | Duas contribuições ligadas à mesma ocorrência e teste integrado |

Foundry Lead é coordenador editorial interno. Sem subdelegação nem autoaprovação. A política de QA autônomo V2 substitui o gate editorial humano individual. O proprietário estuda e relata a experiência; isso não é certificação de eficácia, licença ou autorização de publicar.

## Tarefa local autorizada

1. Sucessor imutável da mesma lição, com prática sem nota linguística, autocheck, três modelos na guidance e labels honestos; contrato interno sucessor, sem alterar contratos históricos.
2. Validar novo pacote pela CLI oficial e revisar editorialmente todas as cinco atividades.
3. Reutilizar exatamente o ambiente release-clean e histórico21. Novo run com pinos, instalação/aprovação administrativa/ativação do pacote exato, gate restaurado e conta local de ensaio.
4. Jornada real de identidade/versão, modelos, alternativas/retry, ordenação, Unicode/limites, persistência/reload/login, rascunho ao consultar apoio, conclusão versus domínio, teclado/360px e erros de salvamento.
5. Ajuste Motor somente quando o defeito for demonstrado, com regressões e reteste integrado. Registrar limites; não inventar correção humana ou IA.

Não criar ambiente, reinstalar migrações, resetar, limpar fixtures, tocar pilotos pessoais/ambientes antigos, acessar Supabase remoto/Fly ou usar APIs pagas. Sem commit/push/PR/merge/deploy. Serviços próprios encerrados ao final; estudo manual depende de janela local de serviço explicitamente indicada.

## Próximo curso: autoria original e aprendizagem observável

A futura instrução deve informar público, nível de partida, tempo disponível, situações de uso, variantes e objetivo. Foundry pesquisa e propõe currículo novo; não usar os pilotos como molde ou fonte editorial. Contratos/capacidades podem ser reutilizados.

Exigir ciclos de compreensão → prática apoiada → recuperação sem modelo → transferência para contexto novo → revisão espaçada. Distinguir progresso por participação de aprendizagem demonstrada; explicitar modalidades/evidências não avaliadas. Feedback deve explicar o erro específico e permitir nova tentativa, com apoio recuperável sem perder escrita.

O curso é também um laboratório: registrar dificuldades por curso/versão/lição/atividade, observado/esperado e evidência; classificar FOUNDRY/MOTOR/SHARED/UNKNOWN. Priorizar problemas que impedem aprendizagem ou confiança dos dados. Não acrescentar capacidades fictícias para caber no currículo; apontar lacuna e propor ajuste geral do Motor.

## Auditoria inicial de propriedade

Prioridade1: feedback por alternativa e explicações recuperáveis. Prioridade2: imagens/áudios/vídeos, transcrições, direitos e correspondência pedagógica. Inventariar antes de mover dados.

Conteúdo em `content/courses/*`, `content/languages/*`, `src/content/frecuencias-a1.ts`, `review-structures.ts`, `conversation-scenarios.ts`, `spanish-*.ts`, cenas e manifests de mídia é material a classificar. Arquivos generated são derivações, não nova fonte editorial. Prompts técnicos de segurança/provedor continuam Motor; contexto/rubricas/exemplos de curso pertencem ao Foundry. Não migrar tudo nesta tarefa.

## Estado e evidências

Inventário anterior: `.tmp/foundry-integration/before.json`; recursos/portas anteriores: `resources-before.json`, `listeners-before.json`. Foundry usa seu run `runs/integrated-readiness-001/`. O relatório final e o manifesto desta execução completarão esta seção com resultados efetivos, pareceres e limites.

## Resultado final — integração local pronta (24/10/2026)

**READY_FOR_ORIGINAL_COURSE_AUTHORING.** A minilição instalada também está **READY_FOR_OWNER_TRIAL**, mediante reabertura local controlada pelo Lead. **OWNER_TRIAL_NOT_RUN:** o proprietário ainda não realizou o estudo. Não houve geração do curso novo nesta preparação.

### Estrutura de entrada

| Local | Função |
| --- | --- |
| Motor: `D:/Documents/destrava-worktrees/destrava-release-clean` | Consumidor e release local, com os arquivos pendentes preservados |
| Foundry: `D:/Documents/Destrva Foundry` | Projeto editorial independente; sem Git inicializado |
| `AGENTS.md` e `DESTRAVA_MULTIAGENTE.md` | Entrada única pelo Destrava Lead e responsabilidades persistentes |
| Foundry `docs/NEW_COURSE_BRIEF.md` | Guia e texto copiável para pedir o curso original |
| Foundry `runs/integrated-readiness-001/CURRENT.json` e `RESULTS.md` | Resultado atual aditivo; autoria C1 congelada permanece histórica |
| `.tmp/foundry-integration/delivery-manifest.json` | Candidatos, hashes, patch e evidências locais da entrega |

O Foundry usa o contrato interno aditivo `supported-practice-v2`; a entrada explícita é `node scripts/integrated-readiness.mjs verify`. O dispatcher antigo de QA não foi apresentado como suporte automático dessa família. O pacote público continua Language1.1/Course1.5/envelope1.0.0.

### Candidato e mudanças

Autoria **FOUNDRY-INTEGRATED-C1**, 18 caminhos, digest `fc7508916264817b43f481a9c0a6046ab267151304b85a7a5c0f79e74cbd45a8`. Mesma minilição, cinco atividades, edição **2.1.0**. Explicações, três modelos, autocheck e NOT_ASSESSED substituem a promessa de correção humana. Nomes livres e limites de 12–180 grafemas foram preservados. Os contratos e pacotes anteriores não foram sobrescritos.

Código e ensaio final **INTEGRATED-TRIAL-C9**, 56 caminhos, digest `3cf4eeea2528c72c8d290a163143775c6a52d3dd588f68f6354ba0bafcb55a98`. O manifesto de entrega diferencia esses bytes testados do fechamento documental posterior.

Defeito MOTOR reproduzido: rascunho de 36 caracteres desaparecia ao consultar outra atividade. A correção mantém um Map em memória da lição, com boundary React síncrona por conta, curso/edição, caminho compilado/instalado, instalação/hash/sessão, unidade e lição. O renderer e o editor recebem prop opcional; os demais usos mantêm o fallback anterior. String vazia permanece vazia. Nenhum rascunho é enviado ao backend, marcado como conclusão ou persistido automaticamente.

Fontes de produto afetadas: página de lição, `activity-renderer.tsx`, `writing-editor.tsx` e novo `src/lib/lesson-writing-scope.ts`. Regressões em `scripts/lesson-writing-scope.test.mjs`. A política e seus testes em `scripts/foundry-trial-policy.*` pertencem ao harness local.

### Verificações executadas

| Camada | Resultado efetivo |
| --- | --- |
| Foundry autoria | 20 testes novos e 169 no conjunto completo PASS; validate/policy migration/verificador aditivo exit0 |
| QA editorial independente | Cinco atividades examinadas integralmente; 27 controles, incluindo 12 negativos, PASS |
| CLI oficial do Motor | Dry-run exit0: válido, compatível, preparado; nenhuma ativação pelo dry-run |
| Instalação real | Pacote2.1.0 instalado/preparado/aprovado localmente/ativado, revisão1, no banco existente |
| Política do harness | 37 testes do Lead PASS; negativos independentes de URL/método/headers/contexto e autoridade nas rodadas identificadas |
| Rascunho | 14 regressões do Lead PASS; QA: 19 controles de escopo/editor/wiring e oito da página transpilada com hooks simulados PASS |
| Browser r4 | 11 checks individuais PASS; suíte FAIL pela perda reproduzida de rascunho; alternativas e ordenações são evidência dessa rodada |
| Browser r5, C9 | **13 checks PASS**, exit0: rascunho novo diferente do backend, vazio, ausência de autosave, erro/retry, reload, novo login, limites, identidade, teclado e 360px |
| Rede/browser r5 | Zero bloqueios inesperados e zero erros de runtime; dois POSTs de anúncios bloqueados intencionalmente |
| Código C9 | TypeScript sem incremental, ESLint sem avisos e checker completo de arquitetura exit0 |
| Build local C9 | Next16.3.8, 44 páginas geradas, exit0 e stderr vazio; sem content:compile |
| QA SQL independente | Sete chamadas READ ONLY/ROLLBACK exit0: identidade, histórico21, instalação/progresso/gate, preservação e oito grupos ACL |

Os grupos de rodadas distintas não são somados como testes únicos. Testes com I/O simulado são diferentes de browser/SQL reais. O QA não executou a jornada de navegador do Lead; corroborou artefatos e persistência de forma independente.

Comandos relevantes: `node --test scripts/foundry-trial-policy.test.mjs`; `node --import tsx --test scripts/lesson-writing-scope.test.mjs`; `node --import tsx scripts/check-architecture.ts`; `node node_modules/typescript/bin/tsc --noEmit --incremental false`; ESLint dos arquivos afetados. Operação protegida por `.tmp/foundry-integration/run/pinned.ps1`, fases identity/install/build/dev/verify/stop, com pinos e locks. Os marcadores impedem repetição cega de instalação ou ensaio.

### Persistência, preservação e encerramento

Instalação `da3ae761-2397-40f2-a5c1-8baad34030e1`; artifactHash `0b1a71720a41603d298e6a256ff47fac9ec5ef299c09c1fc9243bcf0a315873a`; sessão `4b8a8a5d-6966-48e3-8739-e8f75bca8355`. QA confirmou progresso revisão13, sete tentativas fechadas/sete evidências, cinco atividades realizadas e quatro escritas retidas sem feedback/score linguístico. A outra conta sintética não possui sessão/progresso nessa instalação. Nenhuma StudySession foi criada por esse ensaio.

Mesmo DBID/volume/SID `7699958133051768869`, mesma rede e histórico21. As seis projeções compiladas conferem com F2 FINAL; os metadados instalados anteriores e suas quatro evidências permanecem iguais. A conferência dos 448 arquivos anteriores identificou somente as três alterações de componentes e as duas instruções autorizadas; os 991 artefatos F2 anteriores permanecem iguais. Relatório F2 preservado: SHA256 `b14ff4989daab36eed6c43807bb5e55f58498eef5971fe7b321a182dda5b3462`.

Final observado: **21 contêineres parados/restart no, cinco volumes retidos, rede com zero endpoints e zero listeners nas 12 portas**. App e navegador próprios encerrados. Gate restaurado por CAS, com filho e supervisor, e conferido diretamente pelo QA: **enabled=false, nonce=NULL**. Nenhuma remoção, reset, seed, aplicação de migração, acesso remoto, chamada paga ou operação Git de publicação.

Falhas conservadas: preflight com expectativa histórica desatualizada; transformação CJS antes da instalação; r1 sem lease de runtime; r2 header Auth bloqueado; r3 chave canônica adaptiveProgress omitida no harness; r4 perda do rascunho; C8 props não capturadas, detectadas por TypeScript/QA antes de operação. Correções foram recongeladas e revistas. Não se apresentam essas falhas como PASS. A recusa automática inicial de iniciar a app foi atendida com recibo e consulta real do gate antes da retomada.

### Pareceres e limites

**QA independente: GO para a integração local e QA editorial integral.** SQL focal SHA256 `9326d7994bd4e367e18b39182beb5412dbb438e051e13366453790e0f78bd693`; Docker estrutural `24faafd3c81cce9bd494ea92fcf25b7459560e1564f7302e7a3b9603ae476825`. Execuções por stdin constam no parecer, sem inventar arquivos TAP. Aviso libpq sobre /dev/null foi registrado; consultas exit0.

**Revisor: favorável à correção e evidência local C9, sem achado aberto no recorte.** Leitura de candidato congelado, hashes e artefatos; sem SQL/Docker/testes/escrita. Perfis canônicos V1 carregados explicitamente. Lead único operador Motor; Implementador escreveu exclusivamente no Foundry independente; especialistas não subdelegaram. Janela QA somente leitura coordenada sequencialmente. Compartilhamento de máquina/filesystem não constitui sandbox técnico por papel.

Rascunho em memória cobre consulta a atividades da mesma lição; para recuperar após reload ou novo login, é necessário salvar. Escrita livre continua sem avaliação linguística contextual. Não foram testadas voz física, compreensão oral ou eficácia/retensão do proprietário. O estudo do proprietário permanece posterior.

O próximo curso exige identidade/edição/currículo originais, pesquisa e QA próprios e validação do seu caminho **compilado**. O ensaio instalado desta minilição e o build do Motor não certificam uma nova release compilada de conteúdo ou publicação. Linux/imagem de release, produção e os grants internos residuais de Storage conservam os limites documentados no F2; nenhuma modificação interna foi forçada.

Para estudar a minilição ou gerar o curso, o próximo pedido deve voltar ao Destrava Lead usando o guia do Foundry. O Lead reconfirma o ambiente e abre uma janela local controlada; nenhuma URL foi deixada ativa nesta entrega.


## Atualização local — 25/10/2026

A experiência 1.1.0 do início da Unidade 1 está disponível para experimento. Testes locais passaram; parecer final independente permanece pendente pelo limite da sessão. [Relatório UX/Pedagogia](../f3-ux-u1/RELATORIO_EXECUCAO.md) · [Guia de teste e novo acesso](../f3-ux-u1/GUIA_DE_TESTE.md). Sem publicação ou expansão do restante do curso.


## Atualização U1/U2 — 25/10/2026

A edição local1.4.0 está pronta para estudo do proprietário, com capacidades reutilizáveis CoursePackage1.8, QA e Revisor favoráveis no compilado local. Veja o [relatório atual](../f3-u12-experience/RELATORIO_EXECUCAO.md) e o [guia de teste](../f3-u12-experience/GUIA_DE_TESTE.md). Os PIDs, acessos e critérios acima pertencem às execuções históricas. Não há publicação por consequência.
