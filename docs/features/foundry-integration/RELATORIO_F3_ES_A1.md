# F3 — Español a tu paso: duas unidades compiladas

Data: 24/10/2026. **READY_FOR_OWNER_TRIAL — VALIDADO LOCALMENTE COM LIMITES.** A experiência compilada e a conta de estudo estão acessíveis. O aceite prático do proprietário ainda não aconteceu.

## 1. Identidade e destino

Motor: `D:/Documents/destrava-worktrees/destrava-release-clean`, branch `test/release-f2-clean`, HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, com alterações locais identificadas pelo candidato. Foundry: `D:/Documents/Destrva Foundry`, independente e sem Git inicializado.

Mesmo ambiente `destrava-release-clean`: API127.0.0.1:55421, PostgreSQL127.0.0.1:55422, app127.0.0.1:3100. DBID `521adee1991d8a186b31463a19c56ca8fd448a24c95cb0df471fd0d156b5e0af`, SID `7699958133051768869`; rede original `324aba12dfdc45e46931435286590ee7d0c96499925ab059f4c3f60bcdb340c2`, cinco volumes e 21 contêineres retidos. Nenhum ambiente novo, reset, descarte, migração, reparo de histórico, produção, Fly, Supabase remoto, chamada paga ou operação Git de publicação.

O relatório F2 permanece com 126.179 bytes, SHA256 `b14ff4989daab36eed6c43807bb5e55f58498eef5971fe7b321a182dda5b3462`. Esta entrega usa documento próprio. Ambientes antigos não foram inspecionados: a preservação deles é sustentada pelos destinos explícitos dos comandos, sem alegar comparação byte a byte.

## 2. Estrutura estudável

**Español a tu paso**, identidade `espanol-a-tu-paso-a1`, LanguagePackage `es-a-tu-paso`, conteúdo `1.0.0`. Público: adultos falantes de português brasileiro. O estudo pode ser dividido em sessões de 10–15 minutos; isso não é uma promessa de terminar as unidades nesse tempo.

| Unidade | Lições regulares | Aula guiada | Propósitos comunicativos |
| --- | --- | --- | --- |
| 1 — Vamos nos encontrar | Uma mensagem para você; Não entendi essa parte; A que horas?; Combinado | Uma conversa que continua | Localizar uma pessoa, pedir esclarecimento e combinar lugar e horário |
| 2 — Uma pausa no bairro | O que você vai pedir?; Um ou dois?; Aqui ou para levar?; Seu pedido, do seu jeito | Um pedido confirmado | Fazer e confirmar pedidos, quantidades, preços e condições de consumo |

**129 atividades:** oito lições regulares ×11=88, duas guiadas ×5=10, cinco avaliações com31 itens: diagnóstico7, duas finais8 cada e duas recuperações4 cada. São15 percursos contando separadamente os bancos avaliativos.

A progressão inclui compreensão, reconhecimento, recuperação, produção apoiada, aplicação em situações diferentes e revisão. As avaliações são distintas do treino. A autoria não usa os pilotos ou a minilição como matriz curricular; contratos técnicos e fatos com proveniência válida foram reutilizados.

Cada unidade exige49 participações de prática e entrega da final de oito itens. O critério objetivo da final é75%. Participação, conclusão, acerto fechado e produção linguística são medidas diferentes. As contas automáticas satisfizeram os critérios definidos, mas não demonstram aprendizagem humana. O contador geral de atividades também inclui itens opcionais: na auditoria U1 estava em89,7% (SQL90), U2 em100%; ambas tinham prática49/49 e final8/8, com conclusão e critério objetivo satisfeitos. Não se chama esse resultado de A1 completo.

## 3. Edição, fontes e compilação

Fonte: `Foundry/runs/f3-es-a1-001/full-c9/external-package`. Pesquisa, fontes, direitos e decisões estão nos arquivos research/knowledge/coverage e no handoff C9 do mesmo run.

| Identidade | SHA256/digest |
| --- | --- |
| Envelope externo C9 | `0d5c433a4084e678e7a69beedd7b9f2b1dc5dac6f7304774862a9e24e372cd45` |
| Sujeito autoral C9,62 arquivos | `95e6665ffbbd62c62d79347bb61b1afd0536459ad0b1ce2ee30cf2aea7e847ac` |
| CoursePackage | `1e953e1d935f6fe1dfbd645ea2e55f3c28daadaf4f38eb74ae604db7bbb12d38` |
| Pack compilado | `efbf311ece86ca316eb82d20ff38619a53701bceccb82d2ae87cd12a25783461` |
| QA editorial C9 | `e66982285c71392511150b9f7bcf56ce84facbb314d04505ab3a4f1e4763c2de` |

O validador oficial confirmou compatibilidade/preparação técnica. Seus campos trust/readiness não foram convertidos em aprovação editorial; esta está no sidecar `QA_ACCEPTANCE_C9.json`. Language QA, Curriculum QA e Pedagogical QA aceitaram o sujeito; Platform Content QA aceitou o conteúdo estático. São quatro responsabilidades exercidas por um agente independente da autoria, não quatro pessoas.

A edição foi realmente adaptada e compilada em `src/content/generated/packs/espanol-a-tu-paso-a1.json`, conservando os três packs anteriores. Fontes e definições dos rascunhos C6–C8 foram retidas. C8→C9 alterou apresentações guiadas; os129 payloads permaneceram iguais.

## 4. Candidatos revisáveis

- **Fontes F3-ES-A1-C9-SOURCE:**65 caminhos, digest `ee70da95b916f1de82418f3fe2fc80d84784f15cf0d129ead65ffc790d19f54c`; `.tmp/f3/c9/delivery-final/source-candidate.json`.
- **Operação F3-C9-FINAL-LOCAL-C28:**1.537 pinos, digest `e9b84d7b3714b0c547c96707e921fbee4d5abe4e8e0d591750105499767dde2d`; `.tmp/f3/c9/candidate-final-local-c28.json`. Inclui dependências e candidatos anteriores; não representa1.537 arquivos alterados.
- **Patch completo com arquivos novos e mídia:** `.tmp/f3/c9/delivery-final/product.patch`, SHA256 `747e0914eca5a837f0bdce6fe5aac7d2cc5d1df106da81d03e5c00ef379c234f`. Sintaxe validada com `git apply --numstat`, exit0, sem aplicação/staging.
- O patch é relativo à HEAD. `beforeTaskSHA256` e `preservation-c25.json` distinguem alterações anteriores já pendentes das mudanças F3.

## 5. Execuções reais

Todas as jornadas abaixo são do Lead, com Auth/HTTP/SQL locais reais e dados sintéticos. QA conferiu os resultados e executou auditoria própria; não reexecutou as129 atividades.

| Recorte | Resultado / evidência em .tmp/f3/c9/evidence/ |
| --- | --- |
| Regulares |88 atividades +8 verificações de reload/RLS; onboarding real; `compiled-normal-c9/journey.json` |
| Avaliações |5 resultados canônicos/31 itens, feedback, reload; `official-assessments-c9/assessments.json` |
| Guiadas |10 atividades:4 participações manuais+6 B1 (2 objetivas,2 escritas,2 falas); última rodada C12 em `guided-c9/guided.json` |
| Fundamentos/vocabulário |27 letras,10 referências numéricas,20 itens de vocabulário, busca e statuses; `global-basics-c3`, `global-vocabulary-c3` |
| Revisão/erros/regiões |Virada, rating, agenda/reload, erro/correção/histórico e dois tópicos regionais; `global-review-c4`, `global-mistakes-c4`, `global-regions-c3` |
| Preferências/exportação |5/15 minutos, variante restaurada, dois flushes14POSTs e exportação própria conferida; `global-preferences-c8` |
| Falha/retry |ConnectionReset exato, aviso/pending, mesmo snapshot em um retry com ACK real, reload/restauração; `save-failure-c1` |
| Login |Logout204/login200 reais, browser Auth/RLS e estado completo igual; `reconnect-c3` |
| Sessões |Dois ciclos novos: guiado15 e Dificuldades5, pausa/flush/reload/retomada/encerramento e histórico; `global-study-c10`, `global-study-difficulties-c10` |
| Recuperação retida |Encerramento por UI da sessão específica pausada na tentativa anterior, sem reset/DML direto; `study-recovery-b8b25eca` |
| Mobile |Tab/Enter e navegação360px; ajuda/rascunhos em ambas unidades nos testes regulares; `global-mobile-c10` |
| Consulta/créditos |Eva→E/V/A e agua→A/G/U/A com retorno às cenas; quatro créditos completos visíveis; `coverage-consultation-c1` |
| Variantes contextualizadas |Duas cenas, outra/original preferência, textos autorais iguais conforme ausência de overrides C9; `coverage-variants-c1` |
| Feedback U2 |Erro, explicação autoral integral, retry correto, attempts/mistake completos iguais após reload; `coverage-feedback-u2-c1` |
| Flashcards corrigidos |8 cartões: verso ausente, Enter/Espaço, ajuda, ocultação, conclusão bloqueada antes da revelação, reload; U1desktop/U2 360; `coverage-flashcards-c2` |
| Observações finais |Dificuldades, checklists das duas unidades, perfil6habilidades, recomendação real+destino; quatro passos PASS; `final-observations-c5` |

Os relatórios globais por fase conservam status PARTIAL por desenho; seu passo específico PASS é a evidência. As jornadas regulares/avaliativas iniciais usaram dev; os recursos globais e complementos finais usaram standalone dos mesmos fontes pertinentes. A correção de flashcard/navegação foi testada na compilação final. Não foram repetidas129 atividades por alterações sem relação com elas.

O harness das avaliações ainda contém comentário histórico C8; o escopo e os hashes efetivos são C9. Replay do banco restaura cinco resultados oficiais e seis recibos aceitos, com vínculos de owner/sessão/versão/hash.

## 6. Matriz e gates

A matriz `.tmp/f3/c9/RESOURCE_COVERAGE_C9.json` preserva **35 linhas e sete exclusões** congeladas antes da operação:26 recortes validados e nove com limites declarados. QA conferiu20 hashes de journals e303 locators. Locators se sobrepõem; não são303 testes únicos nem aprovação incondicional de todas as capacidades.

Limites por linha: R08/R32 gravação técnica sintética; R09 escuta lexical conhecida; R14 agenda sem prova longitudinal; R16 diagnóstico parcial; R22 sem ditado ES por TTS; R28 sem qualidade acústica certificada; R31 sem TTS espanhol; R34 UI no mesmo owner mais controles atuais de isolamento em VM.

Comandos pertinentes: TypeScript `--noEmit --incremental false`, ESLint completo de src/scripts/configurações `--max-warnings 0`, `check-architecture.ts`, `validate-content.ts`: exit0. A suíte anterior de92 controles UI **inclui** os dois de projeção; não são94. Na versão final,20 testes passaram (14 scope+6 flashcards). O primeiro comando final omitiu a variável de dependências por allowlist do executor e falhou antes dos seis testes; a repetição configurada passou, sem mudança no produto.

R34 foi ligado ao page.tsx atual e ao helper real:37 testes do implementador (14+18+5), depois19 controles independentes QA. Não somar sobreposições como testes inéditos; a nova boundary usa React/hooks em VM. Isso não é troca de duas contas/edições no browser nem distingue artefatos publicados indevidamente com mesmo id/version.

Build final Next16.3.8: `node node_modules/next/dist/bin/next build`, exit0,44 páginas; BuildID `yqs4WFNiWmcTHQn5qK0rv`. Sem content:compile adicional ou migrações. Helper de prova incluído e66 assets próprios conferidos. Nenhum ENOENT nesse build. Os604 arquivos pinados do build anterior foram arquivados antes da substituição. **Não há homologação de imagem Linux ou autorização de publicação.**

## 7. Melhorias do Motor e falhas preservadas

Mudanças genéricas: apoio consultável preservando seleção/lacuna/ordem/texto/vazio; feedback pós-tentativa e bancos oficiais no percurso; linguagem natural na aula guiada; escrita/fala sem nota fictícia; apresentação de idioma e bases/variantes; flashcards com tentativa de recuperação antes de revelar; navegação “Aula guiada” com filtros preservados.

Foi corrigido um defeito real de persistência: participação fracionária era enviada para SQL INTEGER. A projeção agora arredonda, sem alterar critérios. A execução guiada anterior teve400; a final teve três ACK200 de unit_progress e zero erro HTTP.

Falhas relevantes permanecem nos diretórios/candidatos anteriores:

- Alvos/foco/timing dos testes, confirmação de avaliação e seleção nativa foram corrigidos; uma tentativa avaliativa anterior chegou a grade200, portanto não se diz que todas pararam antes de respostas.
- O primeiro oráculo guiado exigia writeback artificial do replay B1. Foi substituído pela projeção canônica real, com controles independentes, sem fabricar dirty.
- Flush passou a exigir cadeia normalizada completa/ACKs/pending removido. Logout OPTIONS, identidade do próprio CDP e eventos de sessão receberam limites negativos específicos.
- Reload reordenava campos JSONB e o filtro textual de sessão recusava o binding equivalente. A ordem de construção foi estabilizada. A sessão retida foi encerrada por UI em operação própria, depois dois ciclos novos passaram.
- Flashcards C1 pararam antes das verificações por CDP InvalidInterceptionId em GET de prefetch /vocabulary. O classificador não foi ampliado; C2 repetiu os mesmos critérios em saída nova e passou8.
- C24 foi recusado antes da operação por import apontando ao output antigo. C25 corrigiu só o encadeamento.
- Observações C2 usavam cookies antigos do perfil após renovação da mesma conta; C3 usou o jar atual e manteve Auth independente derivado do browser.
- C3/C4 calculavam UI com Course privado sem disponibilidade de revisão, omitindo “Revisar1item”. C4 registrou esperado/observado. C5 usa publicCourse e capacidades reais do navegador, sem alterar critérios ou produto; seis controles do implementador e14 QA confirmaram a causa/restauração do ambiente. C5 passou os quatro passos.
- Erros de módulo/formato do gerador de matriz/patch, bindings e leitores dos especialistas foram contidos. A matriz final e o patch normalizado foram validados; as primeiras saídas permanecem preservadas.

Nenhuma falha foi reclassificada retroativamente. Contratos públicos, SQL, schema, roles, privilégios e autoridade de avaliação permaneceram inalterados.

## 8. Limites pedagógicos e de mídia

Três WAVs integrais Lingua Libre/Wikimedia Commons: biblioteca (Centenoyespelta, CC0), tres (Rachlel, CC0), agua (Precision27, CC BY4.0). Quatro contextos exibem título, fonte, licença/link e aviso de integridade; carregamento/decodificação/reprodução reais foram exercitados. Como a palavra é identificável no apoio/crédito, não é prova de diálogo inédito.

A edição não oferece TTS espanhol. O navegador tinha21 vozes; isso não muda o contrato. Apoios PT tiveram controles locais observados, sem avaliação acústica. Gravações técnicas usaram AudioContext/MediaRecorder/Storage com sinal sintético: **não comprovam microfone físico, voz, pronúncia ou conversação**.

Escrita e fala livres ficam NOT_ASSESSED. Rascunho não enviado não é salvamento durável após sair/recarregar. Apoio não conta como prova sem ajuda. Duas unidades não certificam A1, retenção ou eficácia causal.

Os seis grants internos TRUNCATE de Storage conservam a ressalva local F2-ACL; não houve modificação interna forçada nem aceite de produção.

## 9. Pareceres e preservação

**QA /root/reconcile_foundry — GO local com os limites declarados.** Auditoria própria13 grupos SQL READ ONLY/ROLLBACK, ACL8, Docker fixado e listeners. Mesmo SID/histórico21/gatefalse/nonceNULL; catálogo2unidades/15lições/129atividades/5definições/31vínculos e zero activity_answers;47/47RLS; cinco resultados oficiais, seis B1/duas guiadas e três sessões R19 encerradas.18 escritas/10 falas, zero notas linguísticas ou feedback IA. F2 compilado igual por comparação exata. QA não reexecutou browser e não há baseline SQL histórico confiável para igualdade integral QA1; nesse ponto a prova é escopo/artefatos.

Digests QA: SQL `57c535b9d19c3f9b88298b8b998c2db18939b4ac0127d2a5896f79013fc3b578`; Docker `81792ff1f0fd2626740de4e95deef00b94e1cdeb1403164d736bbeb4bcb79731`; listeners `d0065ec5bebca34c99a34265380b1fb3a9b0262de4a46923ba094020b85a96b9`. Resultados por stdin/parecer, sem inventar arquivos brutos. Acesso negado inicial, Health ausente e statusPointer no leitor foram corrigidos somente no coletor; libpq emitiu aviso, exit0/NOTICE ACL conferidos.

**Revisor /root/reconcile_review — GO FINAL LOCAL, sem achado bloqueante aberto.** Revisão de fontes congelados, pinos e evidências, sem testes/Docker/SQL/escrita. Os achados estáticos anteriores foram encerrados antes da operação. Conferiu os65 fontes, patch, matriz, smoke da conta nova e build final. SQL/Docker independentes são atribuídos ao parecer QA transcrito em QA_FINAL_RECEIPT.json; os digests desses conjuntos não são recomputáveis a partir do resumo. O Revisor leu também o snapshot real de Docker do Lead, sem alegar reprodução própria.

Perfis canônicos V1 explicitamente aplicados; Lead único escritor/operador compartilhado; Implementador em worktree própria; QA com janela sequencial de leitura, já devolvida. Independência de responsabilidade/análise não constitui sandbox técnico separado. Sem subdelegação.

Dos496 arquivos Motor anteriores,475 iguais e21 diferenças:20 intencionais e next-env gerado pelo build, que voltou ao conteúdo rastreado. Todos745 Foundry e5.167 artefatos anteriores foram preservados. Dos58 pinos antigos de integração,56 iguais; página da lição e renderer mudaram no escopo autorizado.21 SQL e três packs antigos preservados; nenhuma limpeza.

## 10. Acesso e continuidade

Conta nova de estudo `c0cf60a8-4843-4953-9bf1-938a90397dd2`, separada de QA. Criação/login próprios e smoke browser passaram: fonte compiled/sem identidades instaladas, cookie/Auth do próprio usuário e curso correto, aprendizagem vazia. Onboarding permanece no passo0; preferências são escolhidas pelo proprietário. Apenas o evento automático próprio de início pode existir. Credenciais não foram impressas e ficam em `.tmp/f3/owner-trial/ACCESS_LOCAL_PRIVATE.txt`, ignorado pelo Git.

App próprio PID95412 continua em127.0.0.1:3100; dez substitutos ativos,11 contêineres retidos parados, cinco volumes, seis bindings Docker em loopback e sete listeners incluindo app; CDP9447 fechado. Gatefalse/nonceNULL. Não encerrar esses serviços por consequência da entrega: eles servem o estudo local.

Leia [F3_GUIA_DE_ESTUDO.md](F3_GUIA_DE_ESTUDO.md). Comece por duas sessões curtas; relate “perdi meu texto”, “não entendi a explicação” ou a situação em que precisou de ajuda. O Lead classifica FOUNDRY/MOTOR/SHARED/UNKNOWN e reproduz o problema; não exige diagnóstico técnico do proprietário.

A edição1.0.0/C9 fica congelada por hashes. Próximas unidades mantêm identidade e IDs existentes; mudanças seguem revisão/versionamento/regressão com progresso anterior. Não sobrescrever silenciosamente a edição nem prometer migração transparente; coexistência/transição pode exigir tarefa própria. Sem geração automática de unidade3, publicação ou deploy.


## 11. Atualização UX/Pedagogia — 25/10/2026

O estudo real reabriu o aceite da edição 1.0.0. A sucessora 1.1.0 reconstrói somente as duas primeiras lições e a abertura guiada. Implementação e testes locais concluídos; encerramento independente pendente pelo limite dos agentes, sem READY formal. O servidor atual oferece 1.1.0 com conta separada, sem migração de progresso. Os acessos/PIDs/status anteriores acima são históricos. Consulte [relatório focalizado](../f3-ux-u1/RELATORIO_EXECUCAO.md) e [guia de teste](../f3-ux-u1/GUIA_DE_TESTE.md).

## 12. Atualização de termos e retomadas — 25/10/2026

A compilação local agora oferece Español a tu paso **1.3.0**. O Foundry declara trechos com idioma distinto nas explicações e nove retomadas em conversa ilustrada; o Motor fornece os recursos genéricos de apresentação. Candidato F3-INLINE-RECALL-C7, com build e oito grupos de navegador aprovados, QA puro e Revisor favoráveis no escopo compilado. A primeira lição foi exercitada no navegador; isso não certifica as duas unidades integralmente.

O acesso privado existente permanece. Servidor atual PID60780 / build zTsJE3kS1TT1MaiaWB51b em127.0.0.1:3100; serviços locais mantidos para estudo. Nenhum histórico pessoal foi limpo. O perfil instalado continua recusando presentation.inline, sem alegação de paridade. Detalhes, candidato, testes, falhas e limites: [relatório focalizado, seção 13](../f3-ux-u1/RELATORIO_EXECUCAO.md).

## 13. Experiência completa U1/U2 — 25/10/2026

**READY_FOR_OWNER_TRIAL — COMPILADO LOCAL.** Español a tu paso1.4.0 aplica o padrão aprovado da primeira lição às oito lições, duas guiadas e cinco avaliações das unidades1/2. Foundry declara cenas, cards, falas, áudio, explicações e recuperações; Motor disponibiliza as capacidades reutilizáveis pelo CoursePackage1.8, sem regras condicionadas ao curso.

Candidato final F3-U12-EXPERIENCE-C12, digest5e64a64666fcc228f94b9332344ad14ca930072d64c7b49069f3ebecb2301bcd; HEAD548a729a33b80fa7dfb8681855cd1e2a71c5174b/branch preservados. Produto/buildC3, kpNjmCLTJ5yc-P_xfkUvW; sucessores somente de harness/oráculos. Foundry finalC5 e artefatos anteriores retidos, com a exceção documentada da perda do JSON bruto C2 por erro de despacho; seu FAIL83/106 continua registrado e não foi reclassificado.

Evidências:106 etapas comuns,5 resultados formais/31 questões,2 guiadas/13 segmentos/6 recibos aceitos,3 recuperações com erro inicial preservado e recargas. Confirmação final de5 resultados RLS e dos7 IDs normais de escrita/fala após recarga;81 áudios HTTP/hash/metadados, sem alegar reprodução integral ou escuta qualitativa. QA independente favorável e Revisor GO FINAL TÉCNICO, sem achado bloqueante aberto; aceite prático posterior. Todos os limites, falhas do harness e segmentos reutilizados estão no [relatório focalizado](../f3-u12-experience/RELATORIO_EXECUCAO.md).

Conta nova sem respostas, onboarding passo0: `.tmp/f3/u12-experience-001/owner/ACCESS_LOCAL_PRIVATE.txt`. AppPID2500 em http://127.0.0.1:3100/login, serviços mantidos para estudo.21 contêineres retidos,5 volumes fixados e6 rotulados observados (extra antigo sem uso preservado),7 listeners loopback/CDP fechado, histórico21 e gatefalse/NULL. Sem reset, limpeza, migração, remoto, custo/API paga, publicação ou operação Git de entrega. [Guia de teste](../f3-u12-experience/GUIA_DE_TESTE.md).