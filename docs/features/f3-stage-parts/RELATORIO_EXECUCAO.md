# Etapas com várias partes — piloto integrado

25/10/2026. **Piloto compilado local pronto para revisão do proprietário; revisão final registrada no encerramento.**

## Pedido e aplicação

O proprietário pediu exemplos, explicações e práticas distribuídos em partes internas da mesma etapa, evitando uma tela longa e explicações sobre um exemplo ainda não apresentado. A capacidade é geral do Motor; o Foundry escolhe e escreve cada parte.

Primeira aplicação: Español a tu paso, edição **1.5.0**, Unidade1, lição “Não entendi essa parte”, **etapa13 — O pedido em outro atendimento**. O percurso mantém15 etapas externas e a etapa13 possui três partes:

1. Pedido no atendimento: modelo com áudio e explicação direta do que significa usted.
2. Informação de preço: frase com el precio e sua explicação na mesma parte.
3. Dois jeitos de pedir: modelos e explicação de usted/puede e tú/puedes, com limites contextuais.

“Próxima parte” continua dentro da etapa; na última, “Continuar percurso” segue para a etapa14. Há acesso direto às partes, botão de voltar e contador próprio. Somente a parte ativa é montada. Modelos aparecem antes das explicações que os mencionam. Termos espanhóis conservam apresentação distinta do português.

**Acesso:** http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1/lesson/nao-entendi-essa-parte?activity=atp-u1-l2-usted . A conta existente continua válida; nenhuma senha integra a entrega.

## Contrato e responsabilidades

CoursePackage1.9 acrescenta opcionalmente `lesson.stages: [{id,title,activityIds}]`. Os IDs formam uma partição completa e ordenada das atividades normais da lição. Limites:100 etapas/12 partes por etapa. Versões anteriores recusam o campo; pacotes sem o recurso mantêm uma atividade por etapa.

Uma etapa pode combinar escolha, escrita, ordenação e outros tipos já executados. Cada parte mantém activityId, correção, rascunho, apoio, idioma e persistência próprios. A composição não contém respostas aninhadas, HTML ou código. A capacidade `lesson.stages` é requerida por inferência; indisponibilidade bloqueia os membros correspondentes. O caminho instalado continua explicitamente sem integração desta capacidade. Avaliações formais e aulas guiadas conservam seus fluxos anteriores e não aceitam esse agrupamento.

Visitar uma parte não conclui seus membros. O indicador externo deriva da conclusão individual de todos os IDs. Os mecanismos anteriores distinguem participação, erro/acerto e domínio; o agrupamento não muda esses critérios. O footer de ensino mantém a ação de marcar o conteúdo atual como estudado. Não há tabela ou estado persistente novo para etapas.

O Motor implementou contrato, validação, projeção, capacidades e navegação reutilizáveis. O Foundry produziu a composição e os textos, sem importar componentes ou tipos internos. Seu padrão e briefing foram atualizados para futuras autorias.

## Identidade

- HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`; branch `test/release-f2-clean`; workspace `D:/Documents/destrava-worktrees/destrava-release-clean`.
- Código congelado **F3-STAGE-PARTS-CODE-C1**,21 arquivos, digest `97afece660cd5bf1f7a0a4f96b51dc0b2ae7db3995104a1c528f9fe9227cc715`.
- Integrado final **F3-STAGE-PARTS-C2**,1144 pinos, digest `f6f26add228a89e62c0abbb70efaded00a25d76308a00492e02c4b2d763dde82`.
- Foundry final **FOUNDRY-STAGE-PARTS-C2**,95 arquivos, digest `38117445af7165c3e524a5b4f7adf693256d63c9b2789d5bb47ca39755f68bf1`, Language1.1/Course1.9/envelope1.0.0.
- Build final `RQOxSf4KiXbhoJM3g__5F`, appPID106560, exclusivamente127.0.0.1:3100.

## Comandos e resultados

| Gate | Resultado e alcance |
| --- | --- |
| `node --import tsx --test scripts/lesson-stages.test.mjs scripts/u12-experience-contract.test.mjs scripts/teaching-contract.test.mjs` |74/74 PASS; contratos novos e regressões afetadas |
| TypeScript sem incremental, ESLint pertinente, arquitetura |Exit0; tipos novamente após importaçãoC1, fonte de código inalterada noC2; ambos builds executaram sua checagem |
| Exportação oficial de contratos e perfil instalado |18 artefatos/48 capacidades; a integração instalada nova permanece negada |
| CLI oficial de pacote, C1 e C2 separadamente |prepared/technicallyValid/compatible; zero erro |
| Importação e `compile-content.ts`/`validate-content.ts` |4 pacotes compilados/válidos; edição1.5.0 possui175 atividades principais e3 recuperações, sem alterar os outros3 packs |
| Build Next, C1 e C2 separadamente |Exit0; stdout/stderr próprios preservados; build local não qualifica publicação |
| Browser C1 |PASS:9 capturas, áudio das3 primeiras frases, tabs sem conclusão nova, progresso parcial real,3 ACKs individuais, reload e rascunho de escrita em lição sem grupos |
| Browser C2 |PASS:9 capturas finais em1600/360/390px,4 modelos sonoros reproduzidos, textos/spans exatos, uma parte montada, etapa13/15, reload na parte2, footer dentro da etapa até a terceira parte |
| Rede/JS nos dois ensaios |Zero erro JS, bloqueio inesperado ou falha de continuação pendente |

NoC2 as três conclusões já existiam do ensaioC1; não se anuncia essa releitura como teste de primeira gravação. A prova de progresso parcial/ACKs pertence aoC1, com os mesmos21 fontes de execução. C2 revisou somente o conteúdo explicativo.

## QA independente

Perfil canônico QA_V1 explicitamente reaplicado. Execução `/root/u12_qa`, somente leitura e puros por Node/tsx stdin; não escreveu arquivos nem operou serviços, banco ou navegador.

- 123/123 controles independentes de contrato/UI isolada PASS, incluindo sequência sintética MC/escrita/ordenação, lição sem objectiveLabels, partição, conclusão parcial, privacidade, indisponibilidade, installed deny e callback antigo após troca de parte.
- 3/3 controles na função real TeachingCard confirmaram modelos antes do apoio.
- 496 controles editoriaisC1 passaram na preservação, com P2 pedagógico aberto: usted/tú ainda eram rótulos sem definição direta.
- C2 fechouP2;845/845 controles focais PASS. Language, Curriculum, Pedagogical e Platform foram examinados independentemente.95 arquivos autorais e21 pinos de código conferidos antes/depois.

Controles por stdin constam do parecer, sem inventar arquivo TAP. Hooks controlados não são navegador. Os grupos pertencem a execuções diferentes e não foram somados como testes únicos. O autor verificou403 controlesC1 e537C2; essa verificação própria não é QA independente.

## Preservação e operação

Antes de editar,888 pinos anteriores e959 arquivos de entrada foram inventariados.936 desses959 permanecem idênticos;23 mudaram no escopo. Três novos fontes compõem contrato/resolvedor/teste. Conteúdo só mudou editorialmente na lição alvo; os demais changes de mídia/unidades compiladas são rebasing dos mesmos81 áudios pelo novo digest do pacote. Candidatos externosC5/C1/C2, suas evidências e assets anteriores foram retidos. AssetsC1 ficam retidos, sem serem os ativos da edição final.

Mesmo DBID/volume/daemon/rede dos recibos F2-R. SID `7699958133051768869`, histórico21 conferido antes da operação,21 SQL preservados e nenhuma migração invocada. Inseridos somente dois registros de referência lesson_content e feita CAS do catálogo de1.4.0 para1.5.0 pela API local. Nenhum schema, ACL, Auth ou progresso foi resetado. QA reutilizou conta sintética; o proprietário não recebeu respostas preenchidas por estes testes.

Gate pós-browser em READ ONLY: enabled=false/nonceNULL.21 contêineres retidos, dez substitutos ativos; cinco volumes fixados preservados, sem alegação de que só existem cinco no projeto. App e serviços mantidos para estudo. Sete listeners em loopback; CDP9447 fechado, PID/comando do app conferidos.

## Falhas e limites

As primeiras preparações detectaram uma âncora de refinement não aplicada e um envelope de capability data em array, incompatível com o record existente; corrigidos antes da operação. Um teste confundia campo interno de indisponibilidade da lição com a projeção pública, corrigido para verificar os IDs/reasons existentes. Uma execução do harness QA falhou por conversão de acentos no stdin; os mesmos controles passaram com escapes Unicode. Esses resultados não foram chamados de verde.

C1 browser PASS não é aceite editorial: a lacuna de significado de usted/tú foi reconhecida e corrigida no candidatoC2, com nova CLI, importação, build e navegador. Evidências C1 ficam em attempt-c1; não foram rebatizadas comoC2. A edição1.5.0 foi trabalhada por candidatos antes da entrega ao proprietário, com hashes distintos.

O piloto não reescreve todas as etapas do curso. A capacidade geral e os controles sintéticos demonstram composição heterogênea; o browser final deste pedido cobre três partes de ensino da etapa13. Não se declara eficácia pedagógica, domínio A1, migração transparente de edições, escuta acústica especializada ou aprovação instalada/Linux/produção. As estimativas históricas de duração não foram recalibradas.

Sem novo ambiente, reset, seed, limpeza, SQL/ACL/Auth de produto, produção, Supabase remoto, Fly, chamadas pagas, commit, push, PR, merge ou deploy. Autoria, QA e Revisor tiveram responsabilidades distintas na mesma máquina/filesystem; isso não constitui sandbox técnico exclusivo.

Artefatos ignorados: `.tmp/f3/stage-parts-001/`, incluindo candidatos, recibos, importações, comparação, ensaios, preservação e patch com arquivos novos. Documentos Foundry atualizados: docs/LESSON_EXPERIENCE_STANDARD.md e docs/NEW_COURSE_BRIEF.md.
## Encerramento

**Revisor `/root/u12_revisor`: GO técnico final / READY_FOR_OWNER_REVIEW no piloto compilado local.** Conferiu1144/1144 pinos antes/depois, sem divergência, e95/95 arquivos Foundry; os21 fontes de execução permaneceram iguais ao pré-operacional. Comparou176 atividades anteriores com178 atuais: nenhum ID perdido, nenhum tipo/gabarito/avaliação/feedback anterior alterado e somente dois novos conteúdos. Políticas de unidade preservadas. Não executou testes, Docker, SQL ou serviços nem escreveu arquivos.

Digest integrado final `f6f26add228a89e62c0abbb70efaded00a25d76308a00492e02c4b2d763dde82`; SHA do candidato `bfad4dccb1302a3c8693234b1cae22ae4d2f5cd1c29be56d2e594b972ad6d168`. A revisão é limitada ao candidato/evidências, sem transformar o piloto em aceite pedagógico do proprietário.

As operações de consulta factual e os limites de uso estão no run Foundry, com base em [DPD — usted](https://www.rae.es/dpd/usted) e [DLE — poder](https://dle.rae.es/poder). Os exemplos e explicações foram redigidos pelo Foundry e revistos independentemente.

**Disponível para teste do proprietário na etapa13.** Recurso geral documentado para futuras sequências; nenhuma expansão automática para o restante do curso.