# Fase 4 — Ciclo 2: A2 + B2

**Estado: DECISÕES E ESCOPO INTEGRADOS PELA PR #3; HOUVE AUTORIZAÇÃO POSTERIOR DO PROPRIETÁRIO PARA A2/B2 EM CONVERSA, SEM RESULTADO FUNCIONAL AINDA COMPROVADO.**

Baseline: `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, árvore `24b31199507e901bc9cacb9058756244bf4fa0c6`, main após a PR #2. Origem preservada: seção G de [Fase 4 Ciclo 1](../../../DESTRAVA_FASE4_CICLO1.md). Este é o escopo canônico; [plano](plan.md), [tarefas](tasks.md) e [roteiro](ROTEIRO_TAREFA.md) o detalham sem criar outra metodologia.

## Estado observado e objetivo

| Frente | Comprovado por código/evidência anterior | Parcial ou não comprovado |
| --- | --- | --- |
| A2 | Instalação imutável, sessão de versão, progresso com CAS, avaliador canônico e guards | Jornada completa de sessão pedagógica instalada, pausa explícita, cursor após reload e diagnóstico real no harness de navegador |
| B2 | Timeline/mídia HTML, âncoras, provas B1, seleção de voz por locale, apresentação source/target | Narração bilíngue integrada, lifecycle TTS coordenado com mídia e tratamento de falas sem idioma definido |

Investigação estática; esta preparação não executou testes de produto. A2 deve integrar/homologar mecanismos existentes. B2 deve adaptar seletivamente os recursos atuais sem copiar o componente inteiro dos pilotos.

## Decisões aprovadas e seu efeito no aceite

**C2-A01:** pausa explícita + automática; recuperar plano, etapa e tempo ativo confirmados sem contar inatividade. **C2-A02:** diagnóstico adaptativo real com respostas submetidas e resultados confirmados; sem rascunhos incompletos ou novo diagnóstico fixo.

**C2-B01:** apoio e alvo vêm do curso/variante; narração manual, sem autoplay. **C2-B02:** uma reprodução ativa; pausar mídia conflitante; retomada desde início de frase/âncora, sem precisão por palavra. **C2-B03:** texto se voz/idioma não estiver confiável; não detectar idioma por string; `followUp` tem papel/idioma explícito antes de falar. **C2-O01:** Lead comprova isolamento local; nenhuma permissão para migração, reset ou alteração de políticas.

A fonte detalhada das seis escolhas é [DUVIDAS.md](../../DUVIDAS.md). Elas são **requisitos de produto aprovados e versionados**, integrados na PR #3. Uma autorização de execução posterior foi dada pelo proprietário em conversa com handoff ao Codex; **esta especificação isoladamente não ordena trabalho nem certifica execução**.


## Invariantes compartilhados

1. Conta/curso/instalação/versão/hash/sessão permanecem identificáveis. Resposta obsoleta nunca altera contexto posterior.
2. Configuração ausente bloqueia; configuração completa com saúde desconhecida é condicional. Incompatibilidade ou permissão ausente bloqueiam. Preservar A1/R1P2.
3. Leitura falha não autoriza escrita. Falha de gravação conserva pendência; retry mantém identidade, sem duplicação.
4. Conteúdo declara políticas/idiomas; motor executa regras gerais. Não inferir língua por palavras ES/EN, título ou formato do ID.
5. Auth/MFA, proprietário, hash, CAS e avaliador privado continuam autoridade. Tempo, narração, clique e entrega de áudio não aprovam aprendizagem.
6. Contrato público versionado, gates instalados e comprovantes B1 permanecem estáveis. Necessidade de mudar contrato público, política pedagógica ou schema exige STOP e aprovação delimitada.

## A2 — sessões e diagnóstico em cursos instalados

### Regras para execução futura (decisões aprovadas)

- Distinguir **sessão de versão** (`VersionSession`, fixa instalação/artefato) de **sessão pedagógica** (`StudySession`, plano/atividades/tempo). Uma não comprova o ciclo de vida da outra.
- Iniciar sessão pedagógica autenticada no curso instalado, respeitando capacidade, plano, modo e versão. Duplo clique/retry não duplicam sessão.
- Pausa/retomada **C2-A01 aprovada:** botão explícito, pausa automática, tempo inativo congelado e retomada da sessão/plano/etapa confirmados inclusive após reload. Hoje não há pausa explícita persistida.
- Reload recupera sessão/plano/etapa e respostas efetivamente submetidas/resultados confirmados, conforme **C2-A02 aprovada**. Não persistir resposta parcial ou rascunho de avaliação; não presumir campos que o modelo ainda não guarda.
- Encerrar registra tempo ativo/sessão uma vez, sem conceder domínio extra; preservar políticas declaradas.
- Sessão V1 permanece V1 após ativação V2. Próximo início respeita verificação atual da versão ativa e flush/CAS/navegação, sem atualizar sessão antiga silenciosamente.
- Troca de curso confirma pendências, mostra andamento/erro, isola cache e ignora respostas antigas. Falha conserva contexto anterior; sem fallback silencioso instalado→compilado.
- Diagnóstico usa referência/finalidade/método declarados. A fixture principal deverá conter diagnóstico **adaptativo** e final distintos; avaliação final I8 não comprova diagnóstico.
- Sem diagnóstico ou capacidade: limitação explícita, sem selecionar final nem fabricar nota. Não criar diagnóstico fixo adicional nem persistência de rascunhos neste ciclo.

### Critérios verificáveis após autorização

| ID | Evidência exigida |
| --- | --- |
| A2-01 | Browser inicia sessão instalada; nova leitura confirma proprietário, plano, versionSession e versão/hash; duplo clique conta uma sessão |
| A2-02 | Botão de pausa e pausa automática; tempo pausado/inativo congelado; reload recupera plano, etapa e tempo ativo confirmados, sem rascunho incompleto persistido |
| A2-03 | Finalizar/repetir/recarregar conservam um encerramento, sem eventos/resultados duplicados; efeitos pedagógicos seguem políticas |
| A2-04 | Ativar V2 localmente não altera sessão V1; próximo início segue política atual com referência conferida |
| A2-05 | GET falho: zero gravações. POST falho/ACK perdido: erro visível, pendência preservada, retry idempotente e evidência recuperada |
| A2-06 | Troca de conta/curso durante operações não aplica resposta antiga; falha de flush mantém contexto; B não lê/grava dados de A |
| A2-07 | Diagnóstico adaptativo real no browser; respostas submetidas e resultados confirmados recuperados; correção no servidor, final distinta; controles sem diagnóstico/incompatível sem nota inventada; não implementar novo diagnóstico fixo |
| A2-08 | Jornada desktop/mobile 360/390 px sem overflow, controles alcançáveis e feedback; emulação não certifica aparelho físico |

## B2 — ensino bilíngue e narração controlada

### Regras para execução futura (decisões aprovadas)

- Apoio vem de `course.sourceLanguage`; alvo de `course.targetLanguage` e configuração/variante efetiva (**C2-B01**). PT-BR é um caso de apoio, não regra fixa do motor.
- Reusar `textPresentation.language`, source/target, transcrições por linha e campos semânticos de apoio/exemplo. Determinar idioma efetivo antes de enfileirar fala.
- Linha anotada tem idioma conhecido; campos separados podem receber idioma no adaptador interno. Texto legado/misto indeterminado permanece visível e sem TTS automático até anotação editorial (**C2-B03**). Sem detectar por regex ou ler frase mista inteira com voz alvo.
- Reusar seletor/preferência por locale. **C2-B03 aprovada:** sem voz/API/locale compatível usar texto acessível e aviso honesto; jamais escolher voz de idioma incompatível ou criar seletor novo por inferência.
- **C2-B01/B02 aprovadas:** narração inicia por ação do aluno, sem autoplay; apenas uma reprodução ativa, TTS pausa mídia conflitante e retoma do início da frase/âncora. Não prometer posição acústica exata por palavra.
- Uma reprodução ativa: coordenar TTS, mídia principal, áudio transitório e timeline. Interrupção, seek, troca de segmento/curso/conta e unmount cancelam proprietário anterior. Callbacks antigos não avançam/retomam outra aula.
- Retomada reconstrói quadro/âncora e conserva provas B1. Fim de narração não satisfaz checkpoint nem entrega de fala/escrita.
- Professor contextual: explicação/tradução em apoio, exemplo/prática em alvo, por campos explícitos; `followUp` deve declarar papel/idioma antes de narrar, senão permanece em texto. Locale não certifica correção linguística; preservar fallback curado.

### Critérios verificáveis após autorização

| ID | Evidência exigida |
| --- | --- |
| B2-01 | PT-BR→ES, PT-BR→EN e alvo sintético usam declaração; apoio não PT-BR em fixture sintética funciona sem alterar lógica |
| B2-02 | Fila registra idioma por fala; voz ausente/incompatível, catálogo inicialmente vazio/tardio ou falha levam a fallback textual |
| B2-03 | Início manual e pausa/cancelamento/interrupção/troca; retomada desde início da frase/âncora; uma reprodução ativa sem sobreposição TTS/mídia ou callback antigo |
| B2-04 | Linha legada/mista indeterminada não recebe voz alvo por padrão; texto acessível; anotada usa locale permitido |
| B2-05 | Professor contextual, `followUp` e fallback curado respeitam papel/idioma explícitos por campo; indeterminado fica texto; testes estruturais sem chamadas pagas |
| B2-06 | Checkpoints A/B e falas A/B continuam independentes; reprodução não aprova etapa; regressões B1/R1P2 preservadas |
| B2-07 | Browser verifica controles/foco/feedback/fallback desktop/mobile; relatório separa mocks, emulação e voz/aparelho físico pendentes |

## Decisões e autorização

[DUVIDAS.md](../../DUVIDAS.md) registra C2-A01/A02/B01/B02/B03/O01 como **decisões aprovadas**. A PR documental #3 foi mesclada e houve autorização separada em conversa para o Ciclo 2. A entrega funcional depende do Lead e da revisão de candidato real; **merge/deploy/migração/remoção de dados não foram autorizados**. Mudança nova de produto/schema/contrato exige STOP.

## Fora de escopo

- Aula Particular/IA/voz/SRS instalada por consequência; gates continuam explícitos.
- Voz realtime, avatar, novo serviço/modelo, avaliação acústica, nota inventada ou arquitetura nova de plugins/contratos.
- Admin/edição dos pilotos ES/EN, reescrita do motor ou nova regra de conclusão/domínio.
- Deploy, migração local/remota, exclusão/reset, chamadas pagas, dependências e merge de PRs nesta preparação.
