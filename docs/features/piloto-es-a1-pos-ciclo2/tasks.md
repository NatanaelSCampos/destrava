# ES-A1 laboratório vivo — tarefas rastreáveis

**Estado:** proposta documental, **nenhuma implementação autorizada**. Os resultados da **auditoria estática** estão em [RELATORIO_AUDITORIA.md](RELATORIO_AUDITORIA.md), o planejamento em [plan.md](plan.md), a spec em [spec.md](spec.md). Tarefas P0 **foram concluídas somente por leitura**, conforme [relatório P0](RELATORIO_P0.md). Nenhum banco ou runtime foi testado; próxima fase [COM-0](../es-a1-composicao/plan.md) requer autorização explícita de leitura do destino.

| ID | Fase | Tarefa e entrega verificável | Situação |
| --- | --- | --- | --- |
| ESLAB-T00 | Descoberta | Inventariar worktrees pessoais, conteúdo e 249 pendências (relato Codex; hashes/arquivos ignorados com limites) | **Auditoria estática concluída, sem reprodução aqui** |
| ESLAB-T01 | Decisão | Escolher **A: evoluir acervo**, U2 primeiro, preservar material válido | **Aprovado pelo proprietário** |
| ESLAB-P0A | P0 | Mapear colisão `20261022000100` e propor reconciliação com condições de STOP | **Concluído em leitura pelo Codex P0; não testado em runtime** |
| ESLAB-P0B | P0 | Comparar guardas de geração/reset com writer B1/CAS, definir negativos e ownership | **Concluído em leitura pelo Codex P0; não testado em runtime** |
| ESLAB-P0C | P0 | Definir estratégia de composição motor/piloto e preservação ES/EN, auditando roteiros/versões | **Concluído em leitura pelo Codex P0; não testado em runtime** |
| ESLAB-P0D | P0 | Entregar plano técnico, matriz de risco, testes, alterações requeridas e decisões do proprietário | **Concluído em leitura pelo Codex P0; não testado em runtime** |
| ESLAB-P1A | P1 | Aprovar objetivos observáveis e mapear percurso vertical U2 + reforços | **Futuro — nova autorização** |
| ESLAB-P1B | P1 | Expor ajuda pública de conceito durante exercício, conservando estado sem gabarito | **Futuro — nova autorização** |
| ESLAB-P1C | P1 | Melhorar correção editorial contextual `muchos/muchas` e alternativas `está/queda`, preservar avaliador privado | **Futuro — nova autorização** |
| ESLAB-P1D | P1 | QA/revisor de bloco U2 com idioma sintético, browser/mobile, auth/versionamento e prova privada | **Futuro — nova autorização** |
| ESLAB-P2 | P2 | Reorganizar toda U2 após piloto vertical, validar avaliações/foco comunicativo | **Futuro — nova autorização** |
| ESLAB-P3 | P3 | Reorganizar U1 após resultados de U2 | **Futuro — nova autorização** |
| ESLAB-P4 | P4 | Dogfooding real no único curso pessoal, métricas qualitativas e aprovação operacional separada | **Futuro — nova autorização** |

## Gates

- **P0 encerra com relatório; não publica PR funcional.** Qualquer divergência que exija mudança de contrato, migração aplicada ou ação destrutiva deve ser levada ao proprietário.
- **P1 não começa antes de P0** ter um plano técnico revisado e autorização explícita da execução apropriada.
- Uma feature só vira `[x]` se houver candidato, comando/teste real e evidência no ambiente identificado; planejamento e estudos locais não são homologação de produção.
- Não habilitar `lesson.interactive`, speaking avançado, revisão SRS ou IA instalados porque existem no motor compilado. Cada compatibilidade é demonstrada separadamente.
- Os critérios **ESLAB-01…10** da [spec](spec.md) continuam aceites-alvo, não testes executados.

## Riscos conhecidos sem execução

1. Migrações distintas compartilham identificador `20261022000100` (relatório Codex).
2. Autoridades divergentes entre reset/geração do piloto e B1 privado.
3. Transcrição ES declarada pública para TTS versus política diferente dos roteiros privados EN.
4. Piloto compilado pessoal ainda separado do motor `main` atualizado e de qualquer comprovação de Fly/Supabase remoto.
