# Trilha Viva — validação da entrega

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
