# U1/U2 — aprofundamento editorial e provas de unidade

Atualização: 26/10/2026, America/Sao_Paulo. **READY_FOR_OWNER_TRIAL — edição compilada local; aceite prático do proprietário pendente.**

## Identidade e escopo

**Español a tu paso**, courseId `espanol-a-tu-paso-a1`, edição **1.7.0**, caminho **compilado local**. CoursePackage 1.10, LanguagePackage 1.1, envelope 1.0.0. HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`. O SHA Git não representa sozinho o candidato local; os manifestos efetivos estão em `.tmp/f3/u12-enrichment-001/`.

| Sujeito | Identidade |
| --- | --- |
| Baseline integrada | F3-DASHBOARD-STATS-C2; 1.363 pinos; digest `c4d5e93f62f222dcfafee0ded66de7a5a04ee6990a0701c0456430068d82a835` |
| Motor final | C7; 48 pinos; digest `c30fb9af2ea6b79056345ff3e089abb26461fcc85944e38ed0a8e3fa1f325a28` |
| Foundry final | C3; 96 arquivos; digest `4fd068cb55a5dcaa16b8ca183fb2447505bb01fae051b5bb1f5fd6aa20908b0d` |
| Build em execução | `RIgtOQQteqHgV1pSLcA_D`; Next 16.3.8; standalone local em 127.0.0.1:3100 |

O curso foi ampliado dentro da estrutura atual. Não houve reconstrução curricular a partir dos livros nem descarte das melhorias anteriores.

## Enriquecimento das duas unidades

As oito lições passam de **110 para 245 atividades**, mantendo os 110 IDs anteriores e **106 etapas principais**. São **135 partes novas dentro das etapas**, com 1–8 partes conforme o objetivo. As 36 questões finais são adicionais a essas 245 atividades.

| Unidade / lição | Antes → agora | Aprofundamento |
| --- | ---: | --- |
| U1 — Uma mensagem para você | 10 → 24 | Informar/perguntar lugar, papéis na conversa, recombinação e recuperação de duas ações |
| U1 — Não entendi essa parte | 19 → 34 | Compreensão, repetição versus velocidade, pedidos combinados e tratamento contextual |
| U1 — A que horas? | 15 → 33 | Hora atual versus compromisso, uma/duas horas, meia hora, escuta e combinação de lugar/horário |
| U1 — Combinado | 13 → 30 | Confirmar, distinguir intenções, combinar lugar/hora e retomar a conversa |
| U2 — O que você vai pedir? | 14 → 34 | Pedido educado, bebida/condição, com/sem, papéis e recuperação posterior |
| U2 — Um ou dois? | 15 → 35 | Singular/plural, quantidade/preço unitário/total, perguntas e números escritos/ouvidos |
| U2 — Aqui ou para levar? | 12 → 27 | Consumo no local/para levar, condições independentes e correção de um pedido |
| U2 — Seu pedido, do seu jeito | 12 → 28 | Pedido, quantidade, condição, preço e esclarecimento em nova situação |

U1: **121 atividades**; U2: **124**. Explicações ficam junto dos exemplos pertinentes, com espanhol destacado, traduções separadas, ilustrações, cartões, falas identificadas, instrução de ação e ajuda em modal. Recuperações pedem tentativa antes do modelo; a ajuda preserva o texto. Foram retirados avisos imersivos sobre situações fictícias e corrigidos equivalentes válidos, distratores ambíguos e pontuação.

## Aproveitamento dos livros

Consulta seletiva dos PDFs locais **Frecuencias A1 — Libro del estudiante** e **Libro de ejercicios**, com hashes/localizadores em `book-provenance.json` e no run Foundry `source-consultation.json`. Não se afirma leitura integral.

| Referência consultada | Valor incorporado em autoria original |
| --- | --- |
| Estudante, págs. 8–9 e 13 (PDF 27–28/32) | Pergunta/resposta, formas pessoais, esclarecimento e tratamento |
| Estudante, págs. 25 e 76, 78–79 (PDF 44/95,97–98) | Lugares, hora atual/compromisso, contrastes e recombinação |
| Estudante, págs. 95 e 100–101 (PDF 114/119–120) | Pedido, itens/condições, escolhas e integração comunicativa |
| Exercícios, págs. 6–7/13/16–17 (PDF 7–8/14/17–18) | Relacionar função e resposta, completar, reconhecer papéis e ler em contexto |
| Exercícios, págs. 28–29/34/38 (PDF 29–30/35/39) | Números/horas, ordenar frases, distinguir informação e retomar em outra situação |

Foram aproveitados conceitos, contrastes e princípios de prática. Diálogos, exemplos, questões, distratores e sequência desta edição são autorais. Páginas, imagens, exercícios e áudios dos livros não foram transportados para o curso; condições do Registry preservadas. Conferências linguísticas adicionais: [hora](https://www.rae.es/dpd/hora), [usted](https://www.rae.es/dpd/usted) e [plural](https://www.rae.es/dpd/plural).

## Navegação e recursos reutilizáveis

Cada etapa mantém seu lugar no percurso e mostra **Parte atual de total**, seletor de partes e botão **Próxima parte**. Ao terminar essa sequência, o botão continua o percurso. Voltar e consultar apoios continua disponível. A jornada real confirmou o avanço dentro da etapa, incluindo 26 transições nativas em partes de ensino na U2 e cinco ciclos focalizados de seleção.

A capacidade de etapas existente foi reutilizada. A extensão pública **1.10** acrescenta `assessment.exam` e `learning.access`: entrada declarada, resultado mínimo, feedback após envio e liberação por prova anterior. Não há ramificação por este courseId. Foundry declara currículo, equivalentes e critérios; Motor valida, apresenta, corrige e preserva evidências.

Fontes: `src/content/learning-access.ts`, `src/domain/study/learning-access.ts`, `src/lib/learning-access-server.ts` e contratos oficiais exportados em `contracts/package-v1/`. Padrões Foundry em `docs/LESSON_EXPERIENCE_STANDARD.md` e `runs/f3-u12-enrichment-001/REUSABLE_PATTERNS.md`.

Esta integração está comprovada no caminho **compilado**. O consumidor instalado rejeita explicitamente os novos requisitos; não há fallback que execute outra edição.

## Provas de unidade

Cada unidade termina com **18 questões**: quatro de escolha, quatro de ordenação, quatro de lacuna, quatro de resposta curta e duas de escuta. Os oito objetivos têm cobertura explícita na matriz. Bancos/IDs finais anteriores foram preservados e ampliados; a prova ficou como última lição.

**Entrada:** cada unidade declara **81 práticas objetivas elegíveis**. São necessárias **65/81** — 80%, arredondando a quantidade exigida para cima. Explicações, produção livre e prática oral seguem disponíveis, sem crédito objetivo fictício. A tela informa esse contador de práticas separadamente do indicador geral de conteúdo.

**Aprovação:** pelo menos 80% das 18 respostas. **14/18 = 77,8% não aprova; 15/18 = 83,3% aprova.** A comparação usa a razão exata. Aprovar U1 abre U2; uma reprovação posterior não revoga aprovação válida desta edição.

Durante a prova: sem ajuda, repertório ou correção intermediária; envio completo antes do resultado. Depois: porcentagem, aprovado/não aprovado, resumo, respostas da tentativa, histórico com data/hora e opção de refazer. Cada tentativa começa sem o rascunho da anterior.

O servidor confere entrada e acesso, bloqueia correção isolada do banco final e verifica recibos vinculados a pessoa, curso, edição e definições. Flags/notas locais e linhas sem assinatura não concedem aprovação. Recibo comprova envio aceito, não atenção ou competência linguística.

## Evidência de execução

- **245 atividades únicas** percorridas nas oito lições, desktop e largura 390px; progresso integral relido no servidor e após reload.
- Negativos reais: banco final no `/grade`, prática da U2 bloqueada e envio de prova antes da entrada retornaram 403 sem gabaritos.
- Entrada real: **64/81 negada; 65/81 liberada**.
- U1: **14/18 reprovada e preservada**, depois **15/18 aprovada**, duas tentativas relidas, U2 liberada.
- U2: **18/18**, resultado salvo e relido após reload.
- Na rodada final: zero erros de runtime, zero bloqueios inesperados; quatro bloqueios esperados de anúncios pelo harness restrito. Não se alega zero requisições bloqueadas.
- TypeScript, ESLint, arquitetura e build local aprovados. Regressões: 18 testes do núcleo final, 220 de política do browser, 74 de etapas/ensino/experiência, 23 cenários de semântica e 31 de capacidades. Contagens pertencem a seus comandos, sem soma artificial de rodadas repetidas.
- QA independente: C2 editorial 130 controles; C3 focal 20; Motor C5 focal 167; C7 timestamp 80, todos aprovados no escopo final. Revisor aceitou Language/Pedagogical C3 e Motor C7 estaticamente. Leitura visual independente amostral; não equivale a inspeção manual integral de 245 telas.

### Falhas preservadas e correções

C1 editorial foi rejeitado por equivalentes/vírgulas, contexto ambíguo, permutações previsíveis e políticas incoerentes. C2 corrigiu esses achados; C3 removeu oito pontos extras. Na revisão técnica foram corrigidos conflitos de alvo e identificadores multipart duplicados antes da quota.

A primeira jornada passou pelas 121 atividades da U1, mas a releitura da prova falhou: PostgreSQL retornava `+00:00`, enquanto a assinatura usava `Z`. A tentativa ficou retida; C7 normaliza o mesmo instante, valida calendário/timezone e rejeita alterações. A releitura real comprovou a correção. O QA reprovou C6 por datas impossíveis antes desse acabamento; esse FAIL permanece histórico.

A continuação passou por mais 52 atividades e interrompeu na seleção de uma parte. Cinco reproduções aguardando a renderização passaram sem mudança de produto; o roteiro passou a aguardar a etapa antes do clique seguinte. A rodada final percorreu as 72 restantes e revalidou os resultados retidos. Os três resultados permanecem separados em `evidence-normal`, `evidence-continuation` e `evidence-final`. O PASS final incorpora evidências anteriores não afetadas; não se apresenta como uma única rodada sem interrupção.

Retrabalho de ferramentas não foi contado como gate: importador C3 conteve inicialmente caminhos de mídia por hash ainda não previstos; leitura tsx restrita encontrou ENOMEM; um gerador de relatório e a função assíncrona de diagnóstico falharam antes de operar. Backups/recibos preservados; fontes finais e ambiente não foram flexibilizados para obter verde.

## Recursos, limites e pendências

Mesmo projeto `destrava-release-clean`, mesma rede e cinco volumes nomeados no ledger conferidos (não um inventário global); dez substitutos em execução, dez originais e helper retidos/parados. API 127.0.0.1:55421, PostgreSQL externo 127.0.0.1:55422, app 127.0.0.1:3100. SID `7699958133051768869`, histórico21 e gate false/nonce NULL reconfirmados em READ ONLY/ROLLBACK antes da jornada. Conferência de encerramento consta dos recibos finais.

Foram adicionadas **155 referências** ao catálogo local e verificadas321, com versão atualizada por comparação 1.6.0→1.7.0. Sem apagar progresso; operações REST não formam uma transação global. Nenhuma nova migração, seed, reset ou mudança SQL/ACL/Auth de produto.

São **82 áudios**: 81 preservados e um novo WAV local, **Dos panes, por favor.**, com a mesma voz já aceita para primeiro teste. Reprodução real é verificada separadamente; não houve audição qualitativa independente do novo WAV. Microfone automatizado usa sinal sintético, não comprova captação física, pronúncia ou fluência. Escrita livre permanece sem nota linguística automática; respostas curtas usam equivalentes delimitados. Provas fixas e repetíveis não constituem certificação de nível.

**Pendências:** observação do estudo pelo proprietário; audição qualitativa do novo áudio; integração instalada dessas novas capacidades e homologação de publicação, caso sejam solicitadas. Não houve produção/remotos/Fly, API paga, commit, push, PR, merge ou deploy.

Lead foi único escritor/operador no Motor. Implementador escreveu no Foundry; QA/Revisor tiveram responsabilidades independentes e acesso procedimental de leitura. Perfis explicitamente reaplicados; máquina/filesystem compartilhados, sem alegação de sandbox técnico por papel.

## Acesso e capturas

[Curso local](http://127.0.0.1:3100/course/espanol-a-tu-paso-a1). Use o acesso privado local já fornecido. Credenciais não são anexadas.

- [Etapa com partes internas e ilustração](../../../.tmp/f3/u12-enrichment-001/evidence-normal/atp-u1-l1-scene.png)
- [Nova explicação da U2](../../../.tmp/f3/u12-enrichment-001/unit2-new-explanation-1600.png)
- [Parte da etapa no celular](../../../.tmp/f3/u12-enrichment-001/unit2-new-explanation-390.png)
- [Prova em andamento](../../../.tmp/f3/u12-enrichment-001/atp-u2-exam-18-question-8.png)
- [Resultado e aprovação](../../../.tmp/f3/u12-enrichment-001/atp-u1-exam-15-result-1600.png)
- [Resultado no celular](../../../.tmp/f3/u12-enrichment-001/atp-u1-exam-15-result-390.png)
- [Histórico das duas tentativas](../../../.tmp/f3/u12-enrichment-001/unit1-history-1600.png)

A captura `unit-1-exam-14-retained-390.png` tem sidebar em transição e não é usada para comprovar apresentação mobile completa.

Artefatos locais ignorados em `.tmp/f3/u12-enrichment-001/`: candidatos, consultas READ ONLY, catálogo, importações/backups, builds, jornadas, capturas, preservação e patch completo do candidato inventariado com arquivos novos. Pendências Git fora desse inventário ficam excluídas do patch e enumeradas, sem edição. Não são CI ou produção. A URL fica disponível para o estudo do proprietário; aceite prático depende desse uso real.
Manifesto corrente: `.tmp/f3/u12-enrichment-001/delivery-manifest-final.json`; patch corrente: `product-final.patch`. Os anteriores permanecem como registros da conferência anterior ao ajuste de legenda.
