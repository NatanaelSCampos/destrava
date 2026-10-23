# Ciclo 2 — tarefas propostas

**Implementação não iniciada.** Aceite canônico: [spec](spec.md). Abordagem/ownership: [plan](plan.md). Todos os itens futuros permanecem abertos até autorização expressa. Referências de decisões: [DUVIDAS](../../DUVIDAS.md).

## Pré-condições sequenciais

| ID | Dono futuro | Entrega | Conclusão exigida |
| --- | --- | --- | --- |
| G0 | Proprietário + Lead | Confirmar seis decisões de produto já aprovadas, integrar documentação mediante autorização e aprovar escopo executável | Decisões registradas; **tarefa só concluída após spec integrada e autorização separada de implementação** |
| G1 | Lead | Baseline, preservação, worktrees A2/B2/QA e stack local conforme C2-O01 | Após G0; comprovar workdir/labels/loopback/portas e preservar pilotos, sem migrar/resetar/alterar políticas sem autorização |
| G2 | Lead + QA | Congelar interfaces/ownership/negativos; fixture instalada sintética com diagnóstico adaptativo e final distintos | Após G1; contrato existente validado, produtor independente do motor/Foundry operacional |

## A2

| ID | Dono futuro | Tarefa e arquivos/áreas prováveis | Aceite / testes / evidência |
| --- | --- | --- | --- |
| A2-T1 | Implementador A2 + QA | Jornada início/encerramento; `scripts/verify-installed-runtime*`, fixture/produtor independente | G2; A2-01/03; contagem de sessões/eventos, plano e leitura nova; reproduzir negativo antes de corrigir lacuna |
| A2-T2 | Implementador A2 | Botão de pausa+pausa automática; retomar plano/etapa/tempo confirmados após reload nos componentes existentes | A2-02; tempo inativo congelado, sem persistência de rascunhos incompletos; `session:verify`, `sync:verify` |
| A2-T3 | Implementador A2 + QA | Fixture/jornada de diagnóstico adaptativo; produtor independente e runners/API apenas para lacunas comprovadas | A2-07; respostas submetidas/resultados confirmados persistem, final distinta, sem rascunhos ou novo diagnóstico fixo |
| A2-T4 | Implementador A2 + QA | V1→V2, conta/curso, GET/POST/ACK perdido e retry; provider/repositório/installed-study apenas se necessário | A2-04/05/06; zero escrita após GET falho, pendência preservada e resposta antiga ignorada |
| A2-T5 | QA + Lead | Jornada desktop/mobile browser/HTTP/SQL local autorizado | A2-01…08; evidência lida do banco e contagens; declarar emulação vs físico |

## B2

| ID | Dono futuro | Tarefa e arquivos/áreas prováveis | Aceite / testes / evidência |
| --- | --- | --- | --- |
| B2-T1 | Implementador B2 + QA | Idioma/papel por metadados source/target/textPresentation; fixture não pessoal | G2; B2-01/04; apoio não PT-BR, alvo ES/EN/sintético, linha mista sem anotação textual |
| B2-T2 | Implementador B2 | Narração manual (sem autoplay), uma voz ativa, pausar mídia conflitante e fallback textual nos componentes existentes | B2-02/03; locais compatíveis, catálogo vazio/tardio/falhas, sem escolher voz errada |
| B2-T3 | Implementador B2 + QA | Corridas pausa/cancel/retomada por início de frase/âncora, interrupção/seek/troca/unmount | B2-03/06; callbacks antigos não avançam etapa, mídia/TTS exclusivos |
| B2-T4 | Implementador B2 | Professor contextual por campos semânticos, `followUp` com papel/idioma explícitos e fallback curado | B2-05; sem TTS de idioma indeterminado ou chamada paga; preservar contratos/guards |
| B2-T5 | QA + Lead | Browser narração e regressões variantes/B1/R1 | B2-01…07; `variants:verify`, `variants:verify:ui`, `interactive:verify`, `interactive:segments:verify`, `interactive:availability:verify`, harness F4; resultados separados por ambiente |

## Integração sequencial

| ID | Dono futuro | Entrega | Critério |
| --- | --- | --- | --- |
| I1 | Lead | Patches completos A2/B2 + manifesto integrado | Novos arquivos incluídos, ownership conferido, sem alteração incidental de piloto/schema/contrato público |
| I2 | QA + Lead | Gates por impacto, TS/ESLint/arquitetura/build e SQL/HTTP/browser necessários | Mesmo candidato, isolamento comprovado, sem script destrutivo por inferência |
| I3 | Revisor | Revisão independente congelada | GO/AJUSTES/NO-GO com local/impacto, sem corrigir seus achados |
| I4 | Lead | Relatório e proposta de checkpoint/PR funcional | Pareceres no mesmo candidato; proprietário decide merge/release, sem iniciar ciclo seguinte |

A2-T1…T4 e B2-T1…T4 podem avançar em worktrees distintas após G2, dentro do limite do plano; dependências internas são sequenciais conforme necessário. A2-T5/B2-T5/I1…I4 compartilham serviços e são agendadas pelo Lead.

Cada entrega liga tarefa→aceite→candidato→comando/exits→artefato/hash. Flag sem comprovante ou sucesso visual sem persistência não encerram tarefa. Distinguir testes puros, VM, SQL real, HTTP, browser emulado e pendências físicas. Não marcar execução como concluída nesta PR documental.
