# U1 e U2 — entrega integrada de experiência

Data: 25/10/2026. **READY_FOR_OWNER_TRIAL — COMPILADO LOCAL.** Implementação, jornadas, auditoria independente e acesso novo concluídos. O aceite prático do proprietário é posterior.

## Identidade e escopo

- Motor: `D:/Documents/destrava-worktrees/destrava-release-clean`, branch `test/release-f2-clean`, HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, sem commit desta tarefa.
- Foundry: `D:/Documents/Destrva Foundry`, projeto independente. A autoria fornece dados e políticas pelo contrato público; o Motor representa capacidades genéricas.
- Curso: **Español a tu paso**, `espanol-a-tu-paso-a1`, edição **1.4.0**, CoursePackage **1.8**, destino **compilado local**.
- Referências: primeira lição 1.3.0 aprovada pelo proprietário e HTML `destrava_cafe_experiencia.html`. Foram examinados os cards, cenas, hierarquia, tipografia, ajuda e controles, sem importar a avaliação ou a persistência demonstrativa do HTML.
- Escopo: oito lições comuns, duas aulas guiadas e cinco bancos de avaliação nas unidades 1 e 2. Sem geração da unidade 3 ou publicação.

## Conteúdo e experiência

O Foundry reconstruiu o percurso inteiro: cenas comunicativas, ilustrações, itens em cards, explicações em destaque, trechos espanhóis tipograficamente distintos, traduções junto à expressão, áudio alinhado e recuperação antes dos modelos. Instruções em português permanecem orientações; só falas recebidas reais aparecem como mensagem de outra pessoa. As práticas de escrita e fala usam o contexto da conversa, sem nota linguística inventada.

| Percurso comum | Etapas |
| --- | ---: |
| U1 — Uma mensagem para você | 10 |
| U1 — Não entendi essa parte | 15 |
| U1 — A que horas? | 15 |
| U1 — Combinado | 13 |
| U2 — O que você vai pedir? | 14 |
| U2 — Um ou dois? | 15 |
| U2 — Aqui ou para levar? | 12 |
| U2 — Seu pedido do seu jeito | 12 |
| Total comum | **106** |

As guiadas têm seis e sete segmentos, respectivamente (13 no total). Os cinco bancos mantêm 31 questões: diagnóstico adaptativo 7, finais 8+8 e recuperações 4+4. O pacote totaliza 176 atividades: 173 principais, incluindo apoios, e três recuperações diferidas. Os 128 IDs/tipos/gabaritos principais anteriores foram preservados; há 45 atividades principais novas. O catálogo local recebeu somente as 45 referências ausentes, conservando as linhas existentes; não houve limpeza de progresso.

Há 54 conteúdos de ensino com 163/163 linhas de áudio alinhadas, nove retomadas, oito revisões e 81 WAVs no pacote. As correções editoriais incluem pré-requisitos dos finais, contraste entre instrução e fala, equivalentes, feedback por alternativa e alinhamento entre frase e gravação. Aprovação técnica e revisão editorial não demonstram aquisição ou domínio de A1.

## Capacidades reutilizáveis

A especificação está em [spec.md](spec.md). O Motor oferece `payload.scene`, seis famílias de ilustração, relógio com hora/minuto declarados, cards de itens e ícones, fala recebida `cue`, revisão com tentativa antes dos exemplos e áudio alinhado aos modelos. O Foundry escolhe os dados por atividade. Não há condição de courseId, detecção de palavras espanholas ou dependência operacional do diretório Foundry.

A apresentação declara idioma e trechos exatos; alternativas em português não recebem voz espanhola. Ajuda abre em modal ilustrado e preserva o rascunho. Na avaliação formal, apoios e explicações só ficam disponíveis depois do resultado autoritativo. Os guardas anteriores à tentativa continuam sem gabaritos privados. Versões anteriores recusam os campos novos e seguem compatíveis com seus próprios formatos.

A capacidade nova `presentation.scene` continua sem qualificação no caminho instalado. Esta entrega é do caminho compilado; não se anuncia paridade instalada.

## Candidatos e execução

- Foundry final **FOUNDRY-U12-EXPERIENCE-C5**: 95 arquivos, digest `dffaa3f41a0fa2bbec28c234d5862b8d560c507b1a3ee7672ba56a7e8c48e735`, pacote externo preservado em `runs/f3-u12-experience-001/external-package-c5`.
- Produto compilado **F3-U12-EXPERIENCE-C3**: 845 arquivos, digest `c4fb38e3f6384c6199b159614371213942bd5ea7d70adac15df529d26aee43fc`. Candidato operacional final **F3-U12-EXPERIENCE-C12**: 850 arquivos, digest `5e64a64666fcc228f94b9332344ad14ca930072d64c7b49069f3ebecb2301bcd`, manifesto `.tmp/f3/u12-experience-001/candidate-c12.json`; deltas posteriores ao C3 s?o somente harness/or?culos, sem alterar o build.
- Build final: `kpNjmCLTJ5yc-P_xfkUvW`, exit 0; pack compilado SHA256 `21ea131737d9b932d7e9e65fdb7448b40b33fedb6590f4140dc4a263fc4fc28c`. Assets próprios copiados e conferidos por hash. Esse resultado local não aprova imagem Linux ou produção.
- QA puro/editorial independente: 1.802 controles C5 aprovados; tipos, lint sem avisos, arquitetura, vocabulário, conteúdo e compatibilidade oficial aprovados. Contratos 73 testes; UI 13 testes. Deltas C3: ajuda 138 controles e guarda de feedback 15, além de tipos/lint/UI novamente aprovados.
- Serviços, banco, navegador e portas operados sequencialmente pelo Lead. Os wrappers conferem/abrem os arquivos congelados e verificam hashes antes/depois. Destinos fixos em loopback, browser próprio e bloqueio de requisições externas.

### Falha anterior preservada

O candidato C2 percorreu as 106 etapas e passou os controles visuais, mas falhou na leitura final de conclusão: **83/106**, exit 1. Os 23 IDs ausentes e a leitura posterior permanecem em `normal-after-failure-read.json`. O JSON bruto original de `evidence-normal/result.json` foi sobrescrito por um erro posterior de despacho do harness; seus bytes não foram recuperados. O FAIL 83/106 continua registrado, sem reconstruir ou reclassificar a saída perdida. Screenshots e oito fontes/executores C2 permanecem preservados. A navegação rígida do driver ocorria sem confirmar os writes com debounce; isso é hipótese compatível, não causalidade demonstrada. O C3 usa conta nova e aguarda a leitura RLS de todos os IDs antes de navegar/recarregar. **Não houve correção do motor de sincronização e não se certifica recarga anterior ao ACK.** A falha C2 não foi reclassificada. Oito fontes/executores alterados do C2 foram arquivados com hashes exatos.

## Resultado funcional final

Normal C3: 106/106 etapas em oito lições, 360/390 e desktop, servidor 106 conclusões/49 tentativas/sete escritas/sete falas; recarga das conclusões aprovada, zero erro JS ou bloqueio inesperado. A confirmação adicional exercita a recarga de escrita/fala.

| Verifica??o real | Resultado e limite |
| --- | --- |
| Oito li??es comuns | 106/106 etapas; desktop/360/390; ?udio nas escutas, corre??o real, rascunho/ajuda e recall antes do modelo |
| Cinco avalia??es | 31 respostas reais pela UI, resultados can?nicos e RLS, cards abertos ES/PT, ajuda depois do resultado e recarga; a rodada inicial FAIL por policy ? preservada |
| Confirma??o C10 | PASS; cinco IDs formais na proje??o RLS e ap?s recarga, 106 conclus?es e os sete IDs normais de escrita/fala preservados, incluindo reload; entregas adicionais das guiadas n?o s?o confundidas com as normais |
| Duas guiadas | PASS consolidado; 13 segmentos, duas conclus?es com ACK e seis recibos aceitos vinculados a owner/curso/li??o/sess?o/segmento/atividade/edi??o/hash. Nove segmentos reutilizados est?o identificados; C9 executou os quatro finais U2 |
| Recupera??es diferidas | 3/3 PASS; erro inicial mantido, tr?s atividades distintas antes da retomada, nova resposta separada, ?udio/ajuda, duas recargas sem loop e resultados formais intactos |
| 81 m?dias | HTTP200 e SHA iguais aos arquivos locais; metadados e dura??o decodificados no navegador. N?o ? reprodu??o completa das 81 nem audi??o qualitativa |

As jornadas finais normal, guiada, recupera??es e confirma??o terminaram com zero Runtime.exceptionThrown, bloqueios inesperados e respostas HTTP>=400. O POST exato de an?ncios permanece bloqueado intencionalmente; RPCs e escritas fora do escopo continuam proibidas. Os negativos independentes da policy incluem 151 controles de spans e 106 de vers?o/WAV; Lead219 testes PASS. Nenhuma resposta HTTP foi fabricada para obter verde.

### Retrabalho do harness após as avaliações

A rodada das cinco avaliações concluiu as 31 respostas, resultados canônicos/RLS, cards ES/PT, ajuda e recargas. Terminou FAIL por cinco POST de user_course_state bloqueados pelo harness: a regra lexical de feedback tratava os spans de apresentação pós-avaliação como feedback de IA. A correção admite somente os caminhos estruturais assessmentAttempts/adaptiveAssessments -> answers -> presentation -> annotations -> feedback, com os limites reais dos spans; nenhum outro feedback, owner, endpoint ou método foi liberado. Testes do Lead218 e QA151 passaram. A primeira proposta teve dois caminhos forjados aceitos (149/151); tokens de caminho corrigiram a falha antes da operação.

C4 falhou antes de abrir navegador: um despacho incorreto selecionou o driver antigo e o pin de pendência recusou os dois arquivos de harness autorizados. O coletor antigo sobrescreveu o JSON bruto C2 citado acima. O incidente está em attempt-c4-preflight/incident.json; não houve mutação de aprendizagem nessa tentativa. C5 usa mapeamento explícito e exige os hashes atuais mesmo para os dois caminhos cujo hash histórico deixou de ser critério de preservação.

A primeira confirmação pós-resultado C5 expirou esperando cinco cópias na projeção user_course_state, sem nenhum POST recusado ou erro JS. O loader restaura o resultado canônico sem marcar estado como alterado, portanto reload isolado não exige regravar essa projeção. O resultado formal continua nos cinco recibos canônicos/RLS. Após as mutações normais das recuperações/guiadas, a confirmação C10 passou, sem repetir as perguntas nem alterar o Motor.

## Limites

Escrita, fala livre, comparação com modelo e prática apoiada não recebem nota de competência. Gravações técnicas usam sinal sintético; não demonstram microfone físico, pronúncia ou fluência. A voz local foi aceita pelo proprietário para o primeiro teste; ferramentas verificam mídia/reprodução, sem fingir avaliação acústica. Os três WAVs históricos com tamanho RIFF divergente permanecem iguais; a reprodução real desses assets é verificada separadamente do inventário binário.

Pacote válido não equivale a aprovação prática do proprietário. O aceite de estudo permanece posterior à entrega técnica. A nova edição usa conta nova; não se promete migração transparente do estado antigo.

## Preservação e limites operacionais

Mesmo projeto `destrava-release-clean`, API55421, DB55422, app3100, rede, cinco volumes fixados (seis rotulados observados) e 21 contêineres retidos. Os dez substitutos locais são mantidos para o estudo; originais/helper permanecem parados. Gate false/nonce NULL. Nenhuma migração, reset, seed genérico, mudança de schema/configuração Auth/ACL, remoto, produção, API paga, Fly, deploy ou operação Git de entrega. Contas e logins locais sintéticos integram a verificação autorizada. O residual Storage continua documentado no F2-ACL; não houve modificação interna forçada.

Artefatos ignorados: `.tmp/f3/u12-experience-001/`. Segredos ficam somente nos arquivos privados ignorados. O manifesto de encerramento identificará evidências, patch completo, estado real e acesso atual.

### Retomadas guiadas preservadas

C5 aguardava autoplay no segundo segmento, mas NEXT do runtime intencionalmente entra pausado. C6 retomou a sessão e comprovou quatro segmentos; a fala foi bloqueada pelo harness multipart ainda fixado em1.0.0. A policy passou a receber a edição do bundle congelado; 219 testes e106 controles independentes mantiveram limites de WAV/owner/sessão. C7 não chegou ao POST: a gravação sintética foi recusada pelo guard de duração. Uma tentativa de captura diagnóstica não produziu request justamente por essa recusa anterior ao fetch. C8 usou3s e conferiu a duração decodificada antes de salvar, sem mudar o guard. Concluiu U1 e três segmentos U2; falhou ao exigir span espanhol em feedback que era integralmente português. C9 derivou a expectativa da autoria, aproveitou o erro canônico já registrado e concluiu os quatro segmentos restantes. Nenhuma dessas falhas foi promovida a PASS, não houve reset/repetição dos segmentos concluídos ou alteração de critérios linguísticos para contorná-las.

## Parecer independente e preservação final

**QA `/root/u12_qa` — evidências funcionais e persistência conferidas**, janela READ ONLY devolvida em25/10/2026 às18:50:22UTC. Inspeção própria: mesmo SID7699958133051768869/histórico21/gatefalse/nonceNULL; 176/176 IDs C5 no catálogo (187 linhas totais); 106/106 normais em state e user_activity_progress; sete escritas/sete falas normais em state e tabelas, sem notas de fala. Cinco resultados/31 itens canônicos alinhados, cinco IDs na projeção; duas guiadas/13 segmentos, oito recibos (seis aceitos/dois rejeitados), zero divergências de owner/curso/lição/sessão/tentativa/edição/hash. As três retomadas mantêm os erros originais e respostas corretas distintas. Os dois textos/áudios adicionais das guiadas estão projetados sem notas.

QA executou consultas READ ONLY/ROLLBACK com exit0 e1.729/1.729 asserções independentes sobre evidências/pins. Docker/CIM inicialmente negados pelo sandbox passaram com escalonamento somente leitura. Não executou a jornada browser, revisão visual, teste acústico ou um novo teste independente de isolamento entre contas. Os resultados SQL/Docker desta QA constam em stdout/parecer, sem inventar arquivo bruto ou digest desses streams. Os grupos editoriais1802, policy151/106 e encerramento1729 são conjuntos distintos; não são somados como testes únicos.

**Inventário corrigido:** 21 IDs de contêiner coincidem com o ledger; dez substitutos ativos e11 originais/helper retidos parados. Os cinco volumes fixados passaram. A asserção de cinco volumes totais permaneceu FAIL: existem seis volumes rotulados do projeto. O adicional supabase_edge_runtime_destrava-release-clean foi criado em23/10/2026 às20:10:24Z, está sem contêiner associado e foi preservado, sem ler conteúdo. A coleta anterior listava cinco nomes, portanto não sustenta uma comparação da contagem total. Esta tarefa não criou/iniciou contêineres ou volumes. Sete listeners nas12 portas examinadas, todos em127.0.0.1; appPID2500 e CDP9447 fechado.

Os agentes atuaram como autoria/implementação, QA e Revisor com perfis explícitos e sem subdelegação. Implementação Motor em worktree própria; Foundry em run separado; somente o Lead integrou no consumidor e operou os recursos compartilhados. A independência é de responsabilidade/análise e das consultas QA, em máquina/filesystem compartilhados; não se presume sandbox técnico por papel. A conta nova foi criada pelo Lead depois de devolvida a janela QA e tem smoke próprio, distinto da auditoria da conta de QA.

Dos471 arquivos inventariados antes desta tarefa,430 permaneceram iguais antes do acréscimo documental final e41 mudaram no escopo:29 fontes Motor, dois scripts de harness, seis JSONs do curso e quatro artefatos de contrato. O relatório histórico recebe acréscimo posterior. As fontes de sincronização study-provider, study-progress-sync e supabase-study-repository mantiveram exatamente os hashes de entrada. Três packs anteriores e21 SQL foram preservados. O bootstrap e as homologações anteriores não foram repetidos nem recontados.

A revisão final, a conta nova e o fechamento estão registrados a seguir. O servidor é mantido para estudo local; não se anuncia publicação.
## Encerramento — 25/10/2026

**Revisor `/root/u12_revisor`: GO FINAL TÉCNICO / READY_FOR_OWNER_REVIEW no compilado local**, sem achado bloqueante aberto; R1–R3 encerrados. Examinou850/850 hashes antes/depois, zero divergências, fontes e evidências finais/parecer QA, sem executar testes/SQL/serviços ou escrever. Digest C12 acima; SHA do manifesto312d01c2786ec94721be8e7068810fdb658e62edfa90599525289a3698004987. O parecer cobre o candidato e as evidências; esta seção factual de encerramento foi integrada pelo Lead depois, sem alterar o código congelado.

Conta de estudo nova `37805af8-2344-4c80-9aaf-bbd547b4d298`, distinta de QA: criação/login próprios, seleção compilada1.4.0 e smoke PASS, zero conclusões/tentativas/escritas/falas, onboarding passo0. O proprietário escolhe suas preferências. O guard que exige onboarding antes da lição funcionou; C11 falhou porque o driver esperava a cena antes disso, preservado em owner/smoke-fail-c11.json. C12 verificou o guard correto, sem completar preferências ou atividades pelo proprietário.

Capturas complementares estáveis:14 telas/7 rotas nas larguras360/390, após terminar a transição0,2s do menu; PASS, sem overflow, erro JS ou bloqueio inesperado. Lead examinou imagens de cena, revisão, guiada e resultados. Os primeiros screenshots imediatos ao resize podiam capturar o menu durante a animação; não se apresentou isso como defeito permanente de layout. A primeira tentativa complementar falhou somente ao gravar screenshot antes de existir o diretório; result-fail-directory.json foi retido, e o mesmo script passou com o diretório existente. O perfil QA conserva cópias de recuperação das tentativas interrompidas, com aviso correspondente; elas não foram apagadas ou confundidas com o acesso novo.

**Acesso:** http://127.0.0.1:3100/login. Credenciais somente em `.tmp/f3/u12-experience-001/owner/ACCESS_LOCAL_PRIVATE.txt`, ignorado pelo Git; não integram patch ou manifesto público de fontes. Use a conta nova para começar do zero. [Guia de teste](GUIA_DE_TESTE.md).

AppPID2500 / build kpNjmCLTJ5yc-P_xfkUvW continua em127.0.0.1:3100. Conferência final própria depois do browser: sete listeners em loopback, CDP9447 fechado e identidade/comando do app conferidos; listeners-final.json. Serviços locais mantidos intencionalmente para estudo. Gate false/NULL confirmado pelo QA; nenhuma operação posterior do Lead altera esse gate. Dados sintéticos e ambientes anteriores não foram limpos.

O Foundry tem padrão atualizado em docs/LESSON_EXPERIENCE_STANDARD.md e briefing atual em docs/NEW_COURSE_BRIEF.md com CoursePackage1.8. O handoff desta entrega distingue o pacoteC5, a compilação do Motor e o aceite prático. Novas etapas podem declarar os mesmos recursos sem condicionais de curso no Motor.

Artefatos finais: `.tmp/f3/u12-experience-001/delivery-manifest.json`, `delivery.patch`, `delivery-paths.json`, `preservation-final.json`; fontes executadas por candidato e resultados separados, incluindo FAILs. O patch é contra HEAD nos caminhos selecionados e inclui modificações anteriores nesses mesmos caminhos; não é um diff entre commits exclusivos desta tarefa. Inclui arquivos novos, JSONs importados, contratos e81 assets da edição. Foundry externoC5 permanece no seu run, com95 arquivos e manifesto próprio. O manifesto final vincula também os relatórios/documentos e evidências por SHA, sem autorreferência.

**Pronto para o estudo local do proprietário.** Sem certificação de A1, migração transparente de progresso, qualificação instalada, imagem Linux ou publicação. Sem curso/unidade adicional, produção/remoto, API paga, alteração de schema/Auth/ACL, reset, seed, limpeza, commit, push, PR, merge ou deploy por consequência desta entrega.