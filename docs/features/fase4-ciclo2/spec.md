# Fase 4 — Ciclo 2: A2 + B2

**Estado: PROPOSTA PARA REVISÃO — IMPLEMENTAÇÃO NÃO AUTORIZADA.**

Baseline: `dccbdec2242b09dee0b37cd765f49c41cfaf185d`, árvore `24b31199507e901bc9cacb9058756244bf4fa0c6`, main após a PR #2. Origem preservada: seção G de [Fase 4 Ciclo 1](../../../DESTRAVA_FASE4_CICLO1.md). Este é o escopo canônico; [plano](plan.md), [tarefas](tasks.md) e [roteiro](ROTEIRO_TAREFA.md) o detalham sem criar outra metodologia.

## Estado observado e objetivo

| Frente | Comprovado por código/evidência anterior | Parcial ou não comprovado |
| --- | --- | --- |
| A2 | Instalação imutável, sessão de versão, progresso com CAS, avaliador canônico e guards | Jornada completa de sessão pedagógica instalada, pausa explícita, cursor após reload e diagnóstico real no harness de navegador |
| B2 | Timeline/mídia HTML, âncoras, provas B1, seleção de voz por locale, apresentação source/target | Narração bilíngue integrada, lifecycle TTS coordenado com mídia e tratamento de falas sem idioma definido |

Investigação estática; esta preparação não executou testes de produto. A2 deve integrar/homologar mecanismos existentes. B2 deve adaptar seletivamente os recursos atuais sem copiar o componente inteiro dos pilotos.

## Invariantes compartilhados

1. Conta/curso/instalação/versão/hash/sessão permanecem identificáveis. Resposta obsoleta nunca altera contexto posterior.
2. Configuração ausente bloqueia; configuração completa com saúde desconhecida é condicional. Incompatibilidade ou permissão ausente bloqueiam. Preservar A1/R1P2.
3. Leitura falha não autoriza escrita. Falha de gravação conserva pendência; retry mantém identidade, sem duplicação.
4. Conteúdo declara políticas/idiomas; motor executa regras gerais. Não inferir língua por palavras ES/EN, título ou formato do ID.
5. Auth/MFA, proprietário, hash, CAS e avaliador privado continuam autoridade. Tempo, narração, clique e entrega de áudio não aprovam aprendizagem.
6. Contrato público versionado, gates instalados e comprovantes B1 permanecem estáveis. Necessidade de mudar contrato público, política pedagógica ou schema exige STOP e aprovação delimitada.

## A2 — sessões e diagnóstico em cursos instalados

### Regras propostas

- Distinguir **sessão de versão** (`VersionSession`, fixa instalação/artefato) de **sessão pedagógica** (`StudySession`, plano/atividades/tempo). Uma não comprova o ciclo de vida da outra.
- Iniciar sessão pedagógica autenticada no curso instalado, respeitando capacidade, plano, modo e versão. Duplo clique/retry não duplicam sessão.
- Pausa/retomada seguem **C2-A01**. Hoje o cronômetro pausa por visibilidade/inatividade; não há pausa explícita persistida.
- Reload recupera identidade/estado confirmados. Etapa, resposta parcial e rascunho de avaliação dependem de **C2-A02**; não prometer campos que o modelo não guarda.
- Encerrar registra tempo ativo/sessão uma vez, sem conceder domínio extra; preservar políticas declaradas.
- Sessão V1 permanece V1 após ativação V2. Próximo início respeita verificação atual da versão ativa e flush/CAS/navegação, sem atualizar sessão antiga silenciosamente.
- Troca de curso confirma pendências, mostra andamento/erro, isola cache e ignora respostas antigas. Falha conserva contexto anterior; sem fallback silencioso instalado→compilado.
- Diagnóstico usa referência/finalidade/método declarados. A fixture principal deverá conter diagnóstico **adaptativo** e final distintos; avaliação final I8 não comprova diagnóstico.
- Sem diagnóstico ou capacidade: limitação explícita, sem selecionar final ou fabricar nota. Cobertura adicional de diagnóstico fixo/rascunho depende de **C2-A02**.

### Critérios verificáveis após autorização

| ID | Evidência exigida |
| --- | --- |
| A2-01 | Browser inicia sessão instalada; nova leitura confirma proprietário, plano, versionSession e versão/hash; duplo clique conta uma sessão |
| A2-02 | Pausa/retomada/reload obedecem A01/A02; tempo oculto/inativo/pausado não cresce; cursor/rascunho só no recorte aprovado |
| A2-03 | Finalizar/repetir/recarregar conservam um encerramento, sem eventos/resultados duplicados; efeitos pedagógicos seguem políticas |
| A2-04 | Ativar V2 localmente não altera sessão V1; próximo início segue política atual com referência conferida |
| A2-05 | GET falho: zero gravações. POST falho/ACK perdido: erro visível, pendência preservada, retry idempotente e evidência recuperada |
| A2-06 | Troca de conta/curso durante operações não aplica resposta antiga; falha de flush mantém contexto; B não lê/grava dados de A |
| A2-07 | Diagnóstico adaptativo real no browser, correção no servidor, resultado canônico recuperado; final distinta e controles sem diagnóstico/incompatível sem resultado |
| A2-08 | Jornada desktop/mobile 360/390 px sem overflow, controles alcançáveis e feedback; emulação não certifica aparelho físico |

## B2 — ensino bilíngue e narração controlada

### Regras propostas

- Apoio vem de `course.sourceLanguage`; alvo de `course.targetLanguage` e configuração/variante efetiva (**C2-B01**). PT-BR é um caso de apoio, não regra fixa do motor.
- Reusar `textPresentation.language`, source/target, transcrições por linha e campos semânticos de apoio/exemplo. Determinar idioma efetivo antes de enfileirar fala.
- Linha anotada tem idioma conhecido; campos separados podem receber idioma no adaptador interno. Texto legado/misto indeterminado permanece visível e sem TTS automático até anotação editorial (**C2-B03**). Sem detectar por regex ou ler frase mista inteira com voz alvo.
- Reusar seletor/preferência por locale. Respeitar fallback alvo existente; fallback de apoio depende de B03. Sem voz/API/locale confiável: texto e mensagem honesta, sem voz aleatória.
- Início manual/automático aguarda **C2-B01**; pausa/cancel/retomada por utterance/frase/âncora aguarda **C2-B02**. Não prometer posição acústica exata por palavra.
- Uma reprodução ativa: coordenar TTS, mídia principal, áudio transitório e timeline. Interrupção, seek, troca de segmento/curso/conta e unmount cancelam proprietário anterior. Callbacks antigos não avançam/retomam outra aula.
- Retomada reconstrói quadro/âncora e conserva provas B1. Fim de narração não satisfaz checkpoint nem entrega de fala/escrita.
- Professor contextual: explicação/tradução em apoio, exemplo/prática em alvo, por campos explícitos; definir papel de `followUp` antes de narrar. Locale/estrutura não certificam correção linguística de texto gerado. Preservar fallback curado sem serviço.

### Critérios verificáveis após autorização

| ID | Evidência exigida |
| --- | --- |
| B2-01 | PT-BR→ES, PT-BR→EN e alvo sintético usam declaração; apoio não PT-BR em fixture sintética funciona sem alterar lógica |
| B2-02 | Fila registra idioma por fala; voz ausente/incompatível, catálogo inicialmente vazio/tardio ou falha levam a fallback textual |
| B2-03 | Iniciar/pausar/cancelar/retomar/interromper/trocar seguem B01/B02, sem sobreposição mídia/TTS ou efeito de callback antigo |
| B2-04 | Linha legada/mista indeterminada não recebe voz alvo por padrão; texto acessível; anotada usa locale permitido |
| B2-05 | Professor contextual e fallback curado respeitam papel/idioma por campo; testes estruturais sem chamadas pagas |
| B2-06 | Checkpoints A/B e falas A/B continuam independentes; reprodução não aprova etapa; regressões B1/R1P2 preservadas |
| B2-07 | Browser verifica controles/foco/feedback/fallback desktop/mobile; relatório separa mocks, emulação e voz/aparelho físico pendentes |

## Decisões e autorização

[DUVIDAS.md](../../DUVIDAS.md) é o registro canônico de C2-A01/A02/B01/B02/B03/O01. Recomendações não são escolhas aprovadas; tarefas dependentes ficam bloqueadas até resposta do proprietário e ajuste do aceite.

Aprovar/mesclar esta PR **documental** não autoriza iniciar A2/B2 automaticamente. Exigir decisões registradas e autorização expressa da execução, apontando para spec/commit.

## Fora de escopo

- Aula Particular/IA/voz/SRS instalada por consequência; gates continuam explícitos.
- Voz realtime, avatar, novo serviço/modelo, avaliação acústica, nota inventada ou arquitetura nova de plugins/contratos.
- Admin/edição dos pilotos ES/EN, reescrita do motor ou nova regra de conclusão/domínio.
- Deploy, migração local/remota, exclusão/reset, chamadas pagas, dependências e merge de PRs nesta preparação.
