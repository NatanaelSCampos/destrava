# Ciclo 2 — tarefas propostas

**Implementação não iniciada.** Aceite canônico: [spec](spec.md). Abordagem/ownership: [plan](plan.md). Todos os itens futuros permanecem abertos até autorização expressa. Referências de decisões: [DUVIDAS](../../DUVIDAS.md).

## Pré-condições sequenciais

| ID | Dono futuro | Entrega | Conclusão exigida |
| --- | --- | --- | --- |
| G0 | Proprietário + Lead | Resolver C2-A01/A02/B01/B02/B03/O01 e ajustar aceite | Spec identificada por commit e execução expressamente autorizada |
| G1 | Lead | Baseline, preservação, worktrees A2/B2/QA e checkout de integração | Após G0; isolamento de runners comprovado sem copiar env/deps ou alterar pilotos |
| G2 | Lead + QA | Congelar interfaces/ownership/negativos; fixture instalada sintética com diagnóstico adaptativo e final distintos | Após G1; contrato existente validado, produtor independente do motor/Foundry operacional |

## A2

| ID | Dono futuro | Tarefa e arquivos/áreas prováveis | Aceite / testes / evidência |
| --- | --- | --- | --- |
| A2-T1 | Implementador A2 + QA | Jornada início/encerramento; `scripts/verify-installed-runtime*`, fixture/produtor independente | G2; A2-01/03; contagem de sessões/eventos, plano e leitura nova; reproduzir negativo antes de corrigir lacuna |
| A2-T2 | Implementador A2 | Pausa/retomada/reload conforme A01/A02; `src/app/study/page.tsx`, `src/components/study-provider.tsx`, `src/domain/study/study-state.ts` somente se necessário | A2-02; tempo/cursor/rascunho apenas aprovados; `session:verify`, `sync:verify`, visibilidade/inatividade |
| A2-T3 | Implementador A2 + QA | Fixture/jornada de diagnóstico; produtor independente e runners/API somente se houver lacuna | A2-07; finalidade correta, final distinta, resultado canônico persistido; controles sem diagnóstico/incompatível |
| A2-T4 | Implementador A2 + QA | V1→V2, conta/curso, GET/POST/ACK perdido e retry; provider/repositório/installed-study apenas se necessário | A2-04/05/06; zero escrita após GET falho, pendência preservada e resposta antiga ignorada |
| A2-T5 | QA + Lead | Jornada desktop/mobile browser/HTTP/SQL local autorizado | A2-01…08; evidência lida do banco e contagens; declarar emulação vs físico |

## B2

| ID | Dono futuro | Tarefa e arquivos/áreas prováveis | Aceite / testes / evidência |
| --- | --- | --- | --- |
| B2-T1 | Implementador B2 + QA | Idioma/papel por metadados source/target/textPresentation; fixture não pessoal | G2; B2-01/04; apoio não PT-BR, alvo ES/EN/sintético, linha mista sem anotação textual |
| B2-T2 | Implementador B2 | Adaptação de reprodução: `interactive-classroom`, `presentation-controller`, `speak-text`, `speak-button`; reusar seletor/preferências | B2-02/03 e B01/B02/B03; vozes compatíveis, catálogo vazio/tardio/falhas |
| B2-T3 | Implementador B2 + QA | Corridas pausa/cancel/resume/interrupção/seek/troca/unmount | B2-03/06; callbacks velhos não avançam etapa, sem sobrepor áudio transitório/mídia/TTS |
| B2-T4 | Implementador B2 | Professor contextual por campos semânticos no adaptador/UI existentes e fallback curado | B2-05; sem chamada paga/prometer correção linguística; guards/contrato público preservados |
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
