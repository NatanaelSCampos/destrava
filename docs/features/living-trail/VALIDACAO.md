# Validação da Trilha Viva

## Revisão atual — etapas visíveis e aula em tela cheia (28/10/2026)

Baseline: `8ce285251bbc3e8109d27ab2bdac3a94d0e4691d`. Candidato final `VISIBLE-STAGES-C3`, digest `75fa7d6375ca48376afc441f27bbe02ee33613b3b93a931c79a2b5b40ed8f672`, 18 arquivos congelados. O parecer do Revisor é favorável, sem achados abertos, e o QA independente aprovou seu escopo. Perfis V1 foram reaplicados explicitamente; worktrees separaram escritas. O Lead integrou e operou serviços/navegador. O modo read-only do Revisor foi procedimental, sem alegar sandbox técnico.

### O que mudou

- Cada etapa ordinária aparece como um ponto consecutivo. O espanhol mostra 114 pontos, preservando os 24 agrupamentos editoriais apenas como contexto; inglês usa a mesma regra genérica. Guiadas e avaliações continuam atômicas.
- Uma lista e uma curva atravessam todo o percurso; divisórias narrativas menores substituem grupos de dois pontos, cartões repetidos e contagens de atividades/momentos. Ilustrações nativas aparecem junto ao caminho.
- A entrada posiciona a continuação; âncoras explícitas têm prioridade. Setas flutuantes funcionam nos dois sentidos e respeitam redução de movimento. O refinamento inicial não interrompe exploração após wheel, toque, teclado ou pointer.
- O executor real ocupa 100vw × 100dvh, sem abas de etapas ou card Parte X de X. A barra interna acompanha as atividades do ponto. Anterior não sai da etapa; concluir volta à âncora correta.
- Identidades por namespace curricular impedem colisão entre etapas, guiadas e avaliações. Aliases antigos mantêm navegação, mas nunca prevalecem sobre uma identidade canônica existente.

### Evidências finais

| Verificação | Resultado |
| --- | --- |
| Regressão focada final | 171 PASS, zero falhas/skips |
| QA independente de etapas/SSR + lifecycle do hook | 56 + 7 = 63 PASS, zero falhas/skips |
| Lint dos arquivos alterados | exit 0, sem erros/warnings |
| Build local de produção, incluindo TypeScript | exit 0; `es8JP6T2SfY0C36xEwHj5` |
| Navegador local ES no C3 | 21 checks PASS |
| Navegador local EN no C2 (mesma UI/hook; C3 ajusta só precedência de alias) | 20 checks PASS |
| Regressões reais de áudio/histórico/guardas no C2 | 6 checks PASS |
| Preservação curricular, políticas, mídias e sidecar contra baseline | diff vazio |

As verificações de navegador incluem entrada sem hash, lista/curva únicas, pontos separados, tela cheia real e ausência de overflow em 320/390/768, Escape da ajuda sem fechar a aula, foco exato ao retornar, reload em uma etapa pendente, seta para baixo ao explorar acima e seta para cima ao explorar abaixo. Áudio gravado reproduziu e parou ao fechar; teclado permaneceu no modal; Back/Forward, executor guiado e guarda real de rota bloqueada foram exercitados. Não houve chamada paga de IA.

O Revisor encontrou e o Lead corrigiu: âncora ignorada em curso sem continuação; colisões de identidades arbitrárias; e alias legado que capturava checkpoint canônico. O QA adicionou regressões independentes para esses casos e carregamento tardio/gesto de exploração. C1/C2 e seus pareceres não aprovados permanecem preservados.

Nos roteiros iniciais houve erros de serialização de elementos DOM e uma fixture que revisitou etapa concluída, mas exigia retomada como pendente. Foram corrigidos apenas os roteiros/seleção da fixture e preservados os registros. Os testes antigos do núcleo que exigiam grupos/24 pontos foram atualizados ao requisito vigente, mantendo verificações oficiais de provas, progresso e acesso. O antigo verificador winding-v1 continua preservado; `trail:qa` agora executa os verificadores de etapas visíveis e lifecycle.

### Reproduzir

`npm.cmd run trail:verify` executa núcleo, expansão e SSR. `npm.cmd run trail:qa` executa QA independente e lifecycle simulado. O build local usa a identidade release-clean e loopback; o modo dev continua com o ciclo de Fast Refresh já documentado na entrega anterior. Preview local: http://127.0.0.1:3100/course/espanol-a-tu-paso-a1.

Evidências operacionais sanitizadas: `.tmp/trilha-visible-stages-20261028/`. O run Foundry `runs/trilha-visible-stages-20261028` registra o padrão reutilizável e o schema, sem produção curricular, reaproveitamento de credenciais ou nova aprovação linguística.

A publicação autorizada usa o wrapper IPv4, um perfil de produção público pinado ao commit, e validações autenticadas ES/EN após o deploy. SHA, imagem, saúde e comparação da evidência da própria conta sintética ficam no recibo final operacional. Não há migração nem reset.

### Capturas atuais

[Trilha no desktop](images/trilha-desktop.png) · [Trilha no celular](images/trilha-celular.png) · [Aula em tela cheia no desktop](images/aula-desktop.png) · [Aula em tela cheia no celular](images/aula-celular.png) · [Seta para voltar acima](images/voltar-acima.png) · [Seta para voltar abaixo](images/voltar-abaixo.png) · [Inglês](images/ingles.png).

### Limites

Sem teste em dispositivo físico ou certificação completa de acessibilidade. Cursos instalados mantêm fallback genérico, mas transporte de sidecars e uma jornada instalada no navegador não foram homologados. As falhas amplas preexistentes, explicitadas abaixo, não foram mascaradas ou apresentadas como verdes. O currículo e o histórico de aprendizagem permaneceram intactos; o checkpoint guarda somente navegação.

---

## Histórico da entrega anterior


Data: 28/10/2026. Baseline: `731045e47a96fc1231baacd4deda675a569b987b`. Candidato: **TRILHA-VIVA-C4-WINDING**, 42 arquivos de código, contrato, testes e desenho. Digest: `0314af4269afecf93ef124388b007e53941be91c299a81440666f17b12926526`. Capturas e este relatório são evidências complementares, externas ao conjunto de fontes congelado.

## Resultado local e revisão

| Verificação | Resultado observado |
| --- | --- |
| Regressões pertinentes de navegação, progresso, áudio, escrita e sync | 144/144 PASS |
| QA independente: contrato, rotas, popup, limites, cancelamento, nota insuficiente e rótulos | 61/61 PASS; 42/42 hashes íntegros antes/depois |
| TypeScript | exit 0 |
| ESLint, excluindo artefatos .tmp | exit 0; três avisos antigos em live-conversation-independent.test.mjs |
| Validador oficial de apresentação | PASS, schema1.0.0, apresentação1.1.0, 24 momentos |
| Build de produção local | exit 0; FagSclYiwXRL21teyLuau |
| Foundry validate / testes / policy verify | PASS / 169 de 169 / 382 arquivos preservados |
| Navegador C4 | 29 checks PASS, sem runtimeErrors, em contas existente/aprovada e cursos ES/EN |
| Conta nova, navegador C3 | 5 checks PASS: conclusão real e continuação da atividade exata; alterações C4 são de apresentação |
| Revisão independente C4 | Favorável, sem achado estático aberto |
| Inspeção independente das capturas C4 | Favorável; referências organizacionais de unidade removidas do inglês e das avaliações |

O Lead operou serviços e navegador sequencialmente. QA e Revisor tiveram perfis V1 lidos e reaplicados explicitamente, sem subdelegação. O Implementador escreveu em worktree própria; o Lead integrou. Papéis não constituem sandbox técnico. O QA derivou expectativas próprias; o Revisor apenas leu. Nenhuma revisão é apresentada como aceite prático do proprietário.

## O que foi exercitado

- Todas as referências do espanhol permanecem representadas em 24 momentos; inglês funciona pela apresentação genérica em suas cinco unidades internas.
- Caminho inteiro sem seletor de unidade, nós e curvas recalculados no resize.
- Aula real, aula guiada e avaliação abrem no card modal sobre o caminho; nenhum segundo executável pedagógico.
- Larguras 320, 360, 390, 768 e 1280 sem rolagem horizontal da página; popup também verificado em320/390/768.
- Escape interno fecha apenas apoio; Escape externo volta ao nó, com âncora e foco. Teclado permanece no modal. Reload e Back/Forward mantêm atividade/momento. Redução de movimento respeitada.
- O início do segundo momento impede voltar ao momento anterior por seu botão interno. O fim não avança automaticamente para outro momento.
- URL forçada da lição bloqueada mantém o guarda real, sem conteúdo nem nota.
- Conta sintética nova fez uma atividade real e retomou a seguinte. Nenhum histórico existente foi apagado.
- Evidência oficial da regra de prova:64/81 bloqueia,65/81 libera;0% reprova e mantém próximo trecho bloqueado;100% aprova e libera. Duas tentativas guardadas. O exame seguinte conserva seu próprio bloqueio.

## Correções encontradas pela revisão

R1: marco sem prova não anuncia exame. R2: ícone editorial brain não inventa revisão. R3: cancelamento de um apoio não fecha a aula; a captura DOM nativa é removida no cleanup. R4: resultado insuficiente continua em andamento e aparece Sem nota. R5: corrigido o artigo do texto de bloqueio. QA visual encontrou também referências numéricas a unidades em EN e no catálogo de avaliações; agora o helper reutilizável de apresentação trata essas referências, preservando quantidades como duas unidades. A avaliação dentro da trilha usa diretamente seu executor, com os mesmos guardas.

Nos ensaios, a automação precisou distinguir clique com ativação de usuário de abertura programática de múltiplos dialogs no mesmo grupo CloseWatcher do Chrome. A interação com ativação de usuário foi verificada. Uma rota antiga de lição no ensaio foi substituída pela rota curricular real; o bloqueio permaneceu ativo nas duas.

## Preservação e contrato

Diff curricular, conteúdo gerado e mídias: vazio contra a baseline. Não houve reset, migração, seed, exclusão de progresso, alteração de gabaritos ou troca de versão curricular. O checkpoint visual é isolado por usuário/curso/versão/origem/instalação; não contém respostas ou notas.

O contrato público e o [guia Foundry](FOUNDRY_CONTRACT.md) fazem parte da entrega. O novo run Foundry preserva a composição1.0 e acrescenta a revisão1.1 em arquivo separado. O Foundry continua sem Git e não é dependência operacional da aplicação.

## Limites conhecidos

Sete gates amplos permanecem com falhas reproduzidas na baseline: políticas, semântica de avaliação, interação, multilingual, instalações, runtime e jornada. Os seis primeiros foram comparados independentemente; o Lead confirmou a mesma asserção de progresso truncado da jornada na baseline. Não se afirma aprovação desses gates nem cobertura posterior ao ponto em que pararam. Os logs e a comparação estão nos artefatos desta execução.

O primeiro verificador QA conservou15 falhas de expectativa (cartões de apoio contados como questões e diferençaCRLF/LF), sem alterar critérios oficiais. O novo verificador61 é independente desse arquivo e cobre requisitos válidos com regressões novas. A revisão automática impediu a correção daquele teste antigo; seu resultado original permanece registrado.

Cursos instalados usam fallback genérico. O transporte de sidecars instalados e uma jornada instalada no navegador não foram homologados nesta entrega. Não há alegação de teste em dispositivo físico ou certificação completa de acessibilidade. Em320/360, o primeiro nó aparece abaixo da dobra, com CTA de continuação visível; a aula guiada conserva dois atalhos de retorno. São recomendações de acabamento, sem falha funcional observada.

O modo dev apresentou ciclo de Fast Refresh; a homologação usa o build de produção local em http://127.0.0.1:3100. A publicação autorizada é registrada no recibo final da execução, com SHA, imagem, saúde e comparação do progresso remoto. Esta documentação não equivale, isoladamente, a um recibo de deploy.

## Capturas reais

[Trilha no desktop](images/trilha-desktop.png) · [Trilha no celular](images/trilha-celular.png) · [Aula no desktop](images/aula-desktop.png) · [Aula no celular](images/aula-celular.png) · [Avaliação](images/avaliacao.png) · [Inglês](images/ingles.png) · [Aula guiada](images/aula-guiada.png).

## Reproduzir as verificações específicas

`npm.cmd run trail:verify` e `npm.cmd run trail:qa`. Para conferir uma composição: `npm.cmd run trail:validate -- --course espanol-a-tu-paso-a1 --file content/journeys/espanol-a-tu-paso-a1.json`.

Evidências operacionais sanitizadas ficam em `.tmp/trilha-viva-20261027/`. Arquivos privados de autenticação não fazem parte do Git nem deste relatório.

### Conferência adicional do Lead

Reprodução de arquivo de áudio gravado, parada ao fechar pelo fundo do popup e retorno do foco:3/3 PASS. Auditoria computada de contraste dos textos visíveis da trilha:zero ocorrências abaixo dos limiares verificados; não é certificação de acessibilidade.

## Acabamento final C6 — ferramentas auxiliares e guia

Candidato TRILHA-VIVA-C6-COPY-TOUR,47 arquivos; digest `d403e856020285244aed50ad77530296cd985fa8d24cfa0f6e10198e006e593d`. Ajustes somente de linguagem em10 arquivos, com referências narrativas no vocabulário, conversa, revisão, prática, estatísticas e catálogo de aulas. Filtros, IDs, valores, cálculos e handlers preservados. O domínio exibido nas estatísticas diz deste trecho, respeitando seu escopo real. IDs dos tours foram mantidos, e seus alvos agora existem na trilha contínua.

158/158 regressões pertinentes e61/61 QA independente:PASS. TypeScript e build local exit0 (MltPUX-XpwU8bynE-CR5A). QA e Revisor favoráveis ao C6,47/47 hashes íntegros. O Lead verificou9 casos no navegador: dois passos reais do guia, cinco páginas auxiliares, agrupamento de temas da conversa e ausência de overflow móvel. Nenhuma conversa com modelo foi iniciada.

Na verificação adicional de catálogo,2/4 testes passaram e2 falharam exatamente como na baseline731045e: expectativa de versão0.1 contra1.1 atual e contagem36 contra193 atual. QA repetiu na baseline e conferiu63 inputs curriculares/gerados idênticos. Os testes não foram alterados; essa suíte adicional não é declarada aprovada.

[Guia da trilha](images/guia-da-trilha.png) · [Conversa no celular](images/conversa-celular.png) · [Catálogo de aulas](images/catalogo-aulas.png) · [Progresso](images/progresso.png).

A primeira publicação C4 foi verificada no Fly release68, com14 checks públicos e evidências próprias da conta sintética preservadas. O recibo final desta execução identifica a revisão publicada após este acabamento; não houve alteração de banco por essa revisão.
