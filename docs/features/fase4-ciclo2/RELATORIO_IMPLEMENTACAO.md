# Ciclo 2 — implementação e homologação local

Data: 23/10/2026. Baseline `b2e94ce89e9bbaf964e4738b8464dc49f049cb2d`, confirmada em `origin/main` antes da execução. Primeiro candidato: branch `feat/fase4-cycle2`, worktree `D:/Documents/destrava-worktrees/f4-c2-integracao`. Entrega final: `feat/fase4-cycle2-validated`, worktree `D:/Documents/destrava-worktrees/f4-c2-validado`, da base documental `4a9a5e918d345cf7a8d37d176068ea8ae4892810`.

**Estado: IMPLEMENTADO E HOMOLOGADO LOCALMENTE — QA e Revisor: GO.** Este relatório registra a execução funcional; o [relatório de preparação documental](RELATORIO_EXECUCAO.md) permanece histórico. Critérios e decisões aprovados estão na [spec](spec.md) e em [DUVIDAS](../../DUVIDAS.md).

## Escopo e funcionamento

### A2 — sessões e diagnóstico instalados

- `StudySession` recebe `cursor` e `paused` opcionais. Início/controle/fim aguardam o flush; início repetido compartilha a operação pendente. Relógio usa somente tempo ativo, pausa explicitamente, por visibilidade e após inatividade; reload parte do último checkpoint confirmado.
- `session-lifecycle.ts` aplica checkpoints imutáveis à sessão ativa correspondente, com limites de cursor/tempo. Navegação e duração não concedem domínio.
- `adaptive-progress.ts` representa somente respostas submetidas. O servidor reconstrói a sequência e a correção a partir da definição privada e da instalação fixada; notas enviadas pelo cliente são descartadas. Prefixo vazio é rejeitado. A tentativa começa localmente e passa a ser persistida com a primeira resposta confirmada.
- O runner confirma o prefixo por flush e nova leitura, verifica usuário/geração/versionSession/referência e permite repetir a confirmação. Somente o endpoint canônico de avaliações cria o resultado oficial completo. Rascunho de resposta não submetida não é persistido.
- Cursor, pausa e prefixos usam o JSON de progresso existente. Não há migração, política de banco nova ou alteração do contrato público. O serializador compilado já conserva o estado inteiro em `user_course_state`; sua projeção normalizada não é a fonte de retomada.

### B2 — narração bilíngue controlada

- `narration-controller.ts` organiza frases com idioma, papel, locale e âncora; não usa palavras/IDs para identificar língua. Apoio vem de `course.sourceLanguage`; alvo usa o `languageCode` público derivado do alvo declarado e sua variante efetiva.
- O aluno inicia a narração. Pausar, cancelar e retomar operam na frase/âncora; callbacks têm geração e proprietário. O árbitro de reprodução coordena TTS, mídia da apresentação, áudio transitório, áudio HTML nas atividades e botões aninhados.
- Falta de API/voz compatível, catálogo vazio/tardio ou falha gera texto e aviso. Linha legada/mista sem declaração e `followUp` sem papel/idioma explícitos permanecem textuais. Exemplo/tradução usam os campos semânticos existentes; não há detecção heurística nem seletor novo de vozes.
- O quadro recebe callback interno opcional de narração. Fim do áudio não produz aprovação B1. Não habilitamos Aula Particular/IA/voz em cursos instalados sem integração existente.

## Aceites e evidências

Todos os 15 critérios têm evidências locais no recorte e limites descritos. `Puro` significa portas simuladas ou execução de funções reais em VM; não equivale a SQL/HTTP.

| Aceite | Evidência |
| --- | --- |
| A2-01 | Jornada real: início instalado, referência/plano e duas tentativas; contagem total de sessões. **PASSOU:** oito cenários da rodada reforçada, exit0. |
| A2-02 | Pausa explícita e visibilidade, relógio visível congelado e nova leitura após reload. **PASSOU:** oito cenários da rodada reforçada, exit0. |
| A2-03 | Encerramento único, evento exato e nenhuma evidência pedagógica fabricada. **PASSOU:** oito cenários da rodada reforçada, exit0. |
| A2-04 | Ativação V2 preserva V1; início seguinte usa nova versionSession. Já exercitado no I8 real. |
| A2-05 | GET falho/zero POST, ACK perdido depois do commit real e recuperação; falha de POST bloqueia troca. **PASSOU:** oito cenários da rodada reforçada, exit0. |
| A2-06 | Troca com flush falho, recuperação, novo contexto e proprietário negado por 403/404. Respostas obsoletas também em testes puros de sync/prefixo. |
| A2-07 | Diagnóstico adaptativo real distinto do final; prefixo após reload, três respostas e resultado canônico com referência completa. **PASSOU:** oito cenários da rodada reforçada, exit0. |
| A2-08 | Jornada instalada em 1280/360/390; largura exata e controles alcançáveis. **PASSOU:** oito cenários da rodada reforçada, exit0. |
| B2-01 | Testes estruturais de apoio PT-BR e não PT-BR, alvos ES/EN/sintético, sem mudança da lógica. Browser real utiliza fixture compilada ES. |
| B2-02 | Testes puros e navegador: catálogo vazio, disponibilização posterior por nova tentativa, falha e fallback textual. |
| B2-03 | Navegador: ação manual, pausa/retomada/frase, cancelamento, visibilidade e HTMLAudio real com TTS simulado; ownership/seek/dispose/contextos em testes puros. |
| B2-04 | Adaptador: sem idioma confiável não seleciona voz alvo; transcrição textual acessível e anotação declarada testadas. |
| B2-05 | Professor por campos semânticos/fallback curado; followUp indeterminado textual. Testes estruturais, sem chamada paga. |
| B2-06 | 59 verificações B1, 33 independentes F4, 13 R1P2 e oito casos HTTP/browser B1 preservados. SQL final: **25/25**, exit0. |
| B2-07 | 10 novos checks de narração + oito existentes, desktop1280/mobile360/390, foco/feedback/fallback; zero erro de runtime ou requisição externa bloqueada. |

## Testes desta execução

| Executor / comando | Resultado efetivamente observado |
| --- | --- |
| QA, `ciclo2:verify` | Baseline final: 26 PASS/13 FAIL; integrado inicial: 38 PASS/1 FAIL; integrado C2: **39/39**, exit0, mesmas asserções. |
| Implementadores e QA, verificadores A2/B2 | A2 passou; B2 **18 checks**, exit0. |
| QA, `fase4:verify`, `sync:verify`, `assessment:semantics:verify`, `interactive:segments:verify` | **33 / 13 / 23 / 59**, todos exit0 no candidato integrado C2. |
| QA/Implementador B2, variantes/interativo/R1P2/tempo | Variantes: **20 grupos/7.000 asserções**; interativo, disponibilidade **13** e tempo passaram. Não representam voz física. |
| Lead, contratos/políticas/instalações/runtime/conteúdo | Todos exit0; **24** regressões de dependência rejeitadas, políticas **24**, instalações **69**, runtime **56**, três pacotes validados. |
| Lead, `actions:verify`, `capabilities:verify` | **27 / 31 grupos**, 44 capacidades, exit0. |
| Lead, arquitetura | Fronteiras/registro e grafo sem ciclos, exit0. |
| Lead, TypeScript e ESLint | Exit0; TypeScript sem incremental. Lint de todo `src`, `scripts` e configurações, zero erros. Harnesses finais novamente verificados, exit0; a varredura inclui todos os fontes e scripts, excluindo artefatos ignorados de auditorias. |
| Lead, `build:local` | Exit0; Next16.3.8, três pacotes e 44 páginas/rotas. Produção não mudou após o build. |
| Lead, I8 real | **13 cenários**, exit0: Auth, instalação/versões/CAS, grade/final, reload, owner, rollback, produtor indisponível e gates de IA/voz sem cota/chamada externa. |
| Lead, `ciclo2:verify:local narration` | **18 checks**, exit0: 10 novos + oito B1; cookies/HTTP, checkpoint aprovado pelo servidor/reload e 360/390 sem overflow. |
| Lead, `node scripts/run-ciclo2-local.mjs journey` / `b1` | **8 cenários A2 / 25 SQL B1**, exit0 em cada etapa; 304 hashes iguais antes/depois. |
| Lead, `node --import tsx scripts/verify-variants-ui.tsx` | Exit0, React real/390 px, Speech mock, zero erros/requisições externas/gravações. |

O build/TS/lint e verificadores puros não são execução de banco. O I8 e a jornada usam Auth/Storage/PostgreSQL/HTTP e Chrome reais locais. O SQL B1 executa handlers reais em VM com Auth/MFA/SQL locais; não equivale ao caminho de cookies, coberto separadamente no navegador. A Web Speech API é simulada de forma determinística no navegador; o WAV silencioso usa HTMLAudio real servido em loopback. Isso não certifica qualidade acústica ou disponibilidade de vozes em aparelhos físicos.

## Achados, negativos e retrabalho

- O QA derivou os negativos antes da implementação. As 13 falhas da baseline incluem APIs ainda inexistentes e três exceções síncronas TTS (`getVoices`, `speak`, `cancel`); não são apresentadas como 13 defeitos preexistentes de produto.
- No integrado, o QA reproduziu persistência de prefixo sem respostas. Schema e início do runner foram corrigidos conjuntamente; teste QA manteve SHA256 `291de7bbd1e1b941b0fc693bf2048dc527c83999db89ba8000198f7dd8f78d43`, passando 39/39. Revisor fechou o achado.
- O mock React F4 não exportava `useRef`, agora usado pelo provider. Lead acrescentou o hook persistente ao mock; asserções de replay B1 não foram alteradas e passaram.
- QA encontrou sete lacunas dos harnesses: sessão duplicada com ID distinto, relógio não comparado, encerramento sem contagem/evidência, mídia não exercitada, owner aceitando qualquer erro, vínculo incompleto do diagnóstico e manifesto parcial. As asserções foram reforçadas; As versões finais passaram; QA fechou os sete apontamentos pelos logs e hashes.
- Falhas de harness/ambiente foram separadas: EOL no apply (bytes finais conferidos), produtor propositalmente desligado pelo teste I8 reutilizado por C2, import browser fora de ordem, guias/scroll/foco, expectativa incorreta de onboarding do destino, mock Speech sem eventos e espera antecipada em `paused=false` antes de `playing`. Não foram corrigidas como defeitos da implementação.
- A varredura inicial `eslint .` foi interrompida ao percorrer grandes artefatos ignorados de auditorias; não conta como PASS. O lint de todos os fontes/scripts/configurações passou. Falhas e tentativas não são contadas como gates verdes.

## Isolamento, preservação e rastreabilidade

- Antes de banco/browser: Docker `desktop-linux`, daemon local por named pipe, projeto `espanhol-plataform`, labels com workdir do checkout principal; API127.0.0.1:54321, DB54322, app3000. Perfil sem OpenAI/Azure/Turnstile e allowlist de loopback.
- As 20 versões de migração já estavam aplicadas. Nenhuma migração/seed/reset ou alteração de RLS/grants foi executada. O banco contém políticas DML adicionais históricas na sessão interativa; não se alega bootstrap idêntico às migrações do Git.
- O helper existente emite nonce da autoridade local para instalar fixtures. O runner preserva/restaura o valor anterior dessa configuração de teste e compara todas as políticas antes/depois. Isso é dado de controle local existente, não alteração de política SQL.
- Só contas/cursos/evidências sintéticos são criados e retidos. WAV de teste é movido de `public` para `.tmp` ao terminar. Perfis descartáveis do navegador usam a limpeza existente; dados de aprendizagem não são excluídos.
- Antes da preparação: 15 worktrees e 195 arquivos pendentes inventariados. Criadas quatro worktrees de implementação/QA e uma quinta de reconciliação documental, com dependências próprias e sem env remoto/caches/dependências compartilhados. Pilotos ES/EN e pendências anteriores não entram na PR.
- Serviços exigem o checkout principal por seus guards: usado temporariamente sobre a baseline, com pendências/collisão documental preservadas por hashes. O código da PR é integrado na worktree funcional. Principal restaurado à branch `feat/fase4-first-parallel-cycle`, HEAD `93ef6f2`. A conferência final preservou HEAD/status/diff e bytes dos **195 arquivos pendentes das 15 worktrees anteriores**, além das refs locais antigas. O código funcional permanece na worktree/branch de integração.
- Artefatos ignorados Lead: `.tmp/fase4-ciclo2/` e `.tmp/ciclo2/` no principal. QA: `.tmp/ciclo2-qa/` na worktree QA. Manifestos por etapa incluem todos os arquivos de `src`, `scripts` e configurações selecionadas, antes/depois. O relatório não é log bruto SQL nem contém credenciais.

## Equipe e independência

Lead coordenou A2 `/root/c2_motor`, B2 `/root/c2_aula`, QA `/root/c2_qa` e Revisor `/root/c2_revisor`. Dois implementadores e QA avançaram em worktrees próprias; máximo quatro agentes ativos contando Lead. Revisor entrou após liberação de vagas. Especialistas não subdelegaram. Só Lead aplicou patches e integrou; banco, browser e build sequenciais.

Perfis canônicos fornecidos explicitamente e papéis nativos solicitados. Worktrees isolam arquivos/índices, mas compartilham máquina e filesystem; não há alegação de sandbox técnico read-only. Revisor só leu, com hashes fiscalizados. QA definiu critérios próprios e auditou os harnesses do Lead, além de executar seus testes.

Desvio registrado: B2 executou `variants:verify:ui` intermediário sem reserva prévia do Lead, julgando-o puro. Não houve outro browser reservado naquele momento; porta3001/processos foram confirmados encerrados. Esse resultado intermediário não substitui a execução final coordenada.

**Pareceres finais: QA GO; Revisor GO para commit/push/PR deste candidato e ambientes declarados.** QA executou 39/39 e auditou os 8 cenários A2, 18 checks browser, 25 SQL e 13 I8; fechou H1–H7. Auditoria QA: SHA256 `4086d0c585684add693fb0f476541775e05e098c047111a8d5c56d1472df5b53`. Revisor recalculou os 36 hashes antes/depois, conferiu artefatos e não identificou bloqueadores.

Candidato revisado **F4-C2-C3**, 36 caminhos: **14 fontes de produção, 13 scripts/helpers de teste, package.json e oito documentos**. Digest dos 28 caminhos executáveis: `296026b043fc06a68aba0d67a7ae5dd2ac29a863730cba021312acacb3a80e11`. As três etapas reais finais conservam o digest de 304 arquivos `e9f1f2f12e406d45dfadaae46e1441c9dd7934d9ae40b3afa0d2746f7b9cf36a` antes/depois. Na revisão, 303 arquivos da worktree correspondiam byte a byte; um smoke test inalterado tinha somente CRLF/LF diferente. Para evitar marcações locais indevidas, finais de linha de arquivos sem delta Git e fora dos 36 caminhos foram restaurados ao checkout da baseline, após comparação integral normalizada. Não entram no commit nem alteram os 28 hashes do código aprovado. O staging deve usar exclusivamente a allowlist dos 36 caminhos.

O hash do commit e a URL da PR constam da entrega Git, evitando autorreferência neste relatório. Registrar GO não executa merge nem homologa release/banco remoto.

## Avanço documental da main antes do commit

O guard pré-staging detectou a main `4a9a5e918d345cf7a8d37d176068ea8ae4892810`, merge da PR #4, antes de adicionar qualquer arquivo. O diff desde `b2e94ce` contém sete documentos: estados de autorização, README e roadmap/matriz. Nenhum código, contrato, schema, dependência, critério ou decisão mudou. Não foi feito merge/rebase automático: novo worktree da main atual recebeu os mesmos **28 arquivos executáveis**, com digest idêntico ao candidato C4. Os oito documentos de entrega foram reconciliados; README, roadmap e matriz da PR #4 permanecem byte a byte iguais à main atual. QA e Revisor conferem esse novo candidato, sem apresentar as execuções anteriores como testes novos na base documental. O checkout anterior permanece preservado.

## Limites e validação pelo proprietário

- Não houve merge, deploy, migração local/remota, chamada paga, edição dos pilotos ou contrato público. Commit/push/PR foram autorizados para o candidato aprovado; execução Git é registrada na entrega.
- Voz física, microfone, leitores de tela, teclado virtual, toque físico e qualidade editorial/acústica continuam manuais. O teste usa Chrome desktop com emulação360/390 e teclado/CDP.
- Respostas adaptativas em trânsito durante troca de conta, e TTS ativo durante unmount/troca de contexto, têm cobertura de guards/testes puros; não foram todos reproduzidos na jornada HTTP/browser. Concorrência geral entre dispositivos permanece fora deste ciclo.
- Retomar após saída usa o último checkpoint confirmado; não se promete confirmar uma requisição se o navegador encerra o processo antes do ACK. Prefixos não são resultados oficiais; tempo/narração não aprovam domínio.
- Para revisar: `/study` com curso sintético instalado aprovado; pausar/retomar/recarregar e `/assessment?assessmentId=c2-adaptive-diagnostic`. `/live-classes` usa fixture compilada e os controles de narração. Use conta do Supabase local; credenciais/sessão do Fly não autenticam nesse banco.

## Conceitos aplicados

**Contexto e ownership:** interfaces/arquivos delimitados antes de escrever, worktrees próprias e integração central. **Máquinas de estado e autoridade:** cursor/tempo operacional separados de prova pedagógica; somente avaliador privado confirma respostas. **CAS, geração e idempotência:** resposta antiga/retry não cria uma sessão ou resultado novo. **Motor multilíngue:** declarações do pacote ligam idioma e recurso sem condições ES/EN. **Evals e camadas de teste:** negativos independentes e oráculos específicos, distinguindo função/VM, SQL, HTTP, browser e aparelho físico. A revisão do próprio teste evitou falsos verdes.

Métricas verificáveis: duas frentes de implementação, quatro agentes ativos no máximo, 39 testes independentes verdes e sete reforços de oráculo solicitados pelo QA. Tempos dos gates estão nos JSONs locais. Não há medição confiável de tokens/custo ou baseline comparável para alegar ganho percentual.
