# Release limpo — tarefas rastreáveis

**Estado inicial em 23/10/2026:** Codex entregou [plano estático](RELATORIO_PLANO.md) com parecer `PRONTO PARA REVISÃO`. O proprietário autorizou apenas uma **PR documental** para preparar o caminho [local → curso novo → Fly](spec.md). **Nenhum ambiente novo, teste SQL, ajuste de código, curso novo ou deploy está autorizado/realizado.** A próxima tarefa funcional será F1 após merge documental + autorização explícita.

| ID | Etapa | Entrega verificável | Estado |
| --- | --- | --- | --- |
| **RL-T00** | Descoberta | Relatório Codex com baseline, gates, riscos e 4 ajustes de produto | **Relatado concluído por leitura; sem teste novo** |
| **RL-T01** | F0 | Consolidar relatório, spec, plano, tarefas, roadmap e primeiro roteiro | **PR documental em revisão; merge não autorizado por esta tarefa** |
| **RL-T02** | F1 | Implementar novo perfil `destrava-release-clean` com IDs/portas/guards exclusivos, sem afetar `espanhol-plataform` | **Futuro — autorização funcional própria** |
| **RL-T03** | F1 | Proteger deploy Fly: perfil explícito, sem fallback para `.env.local`, validação de destinos/segredos/SHA | **Futuro — autorização funcional própria** |
| **RL-T04** | F1 | QA negativo em Fly simulado, projeto/porta incorretos e app/credenciais inválidos | **Não executado; sem chamadas externas** |
| **RL-T05** | F1 | Revisor em candidato isolado + PR funcional de guardas, sem operações de banco | **Não autorizado** |
| **RL-T06** | F2 | Confirmar disponibilidade de projeto/portas e obter autorização para criar Supabase local novo e volumes | **Pendente de autorização operacional** |
| **RL-T07** | F2 | Bootstrap de 20 migrações `main` num banco vazio, sem reset piloto, com fingerprint de schema | **Não executado** |
| **RL-T08** | F2 | Testar Auth/MFA/RLS/`TRUNCATE`, B1/R1P2, I7/I8, A2 instalado, B2 compilado, TypeScript/build/UI | **Não executado; acesso local sintético autorizado separadamente** |
| **RL-T09** | F2 | Corrigir falhas concretas (inclusive `TRUNCATE`, se reproduzido), com SQL/PR e QA próprios | **Condicional; sem DDL autorizado** |
| **RL-T10** | F2 | Testar nova edição de curso U2 com progresso sintético U1 e política segura para hash/versão | **Não executado; gate obrigatório para próximas edições** |
| **RL-T11** | F3 | Aprovar escopo editorial/custo e gerar novo ES-A1 compilado por IA/Foundry; preservar antigas fontes ES/EN | **Futuro; geração paga não autorizada** |
| **RL-T12** | F3 | Revisão humana, contratos, diversidade, explicações, feedback, avaliações e jornada de aluno | **Não executado** |
| **RL-T13** | F4 | Decidir Supabase remoto novo/existente, contas/MFA, app Fly novo/existente, custos e rollback | **Decisão operacional pendente** |
| **RL-T14** | F4 | Migrar/schema/curso apenas no destino remoto autorizado; configurar Auth/Storage, construir imagem/digest final | **Não autorizado** |
| **RL-T15** | F5 | Publicar digest no Fly com autorização própria e smoke remoto de login, curso e evidências | **Não autorizado** |
| **RL-T16** | Recorrente | Manifesto e testes de **instalação limpa + atualização incremental** de schema/curso em releases posteriores | **Diretriz documental; automação futura** |

## STOPs

- **Nunca** confundir `espanhol-plataform` (estudo existente) com `destrava-release-clean` (proposta futura de release), nem copiar env, volumes, credenciais ou conteúdo editorial não revisado.
- `checkpoint:migrate`, `checkpoint:prepare`, `db:seed`, runners F4/C2/I7/I8, `npm ci`, `content:compile` e builds têm efeitos. Não rodar por autorização de leitura.
- Risco de `TRUNCATE` e versão/hash B1 não desaparece por ter banco vazio. Teste independente deve confirmar segurança e comportamento.
- Curso compilado da primeira release não torna runtime instalado disponível em produção nem certifica qualidade de IA/voz.
- Nenhum app Fly, Supabase remoto, delete, custo, reset, migração, PR funcional/merge ou publicação é aprovado automaticamente por esta PR documental.
- **Preservar o progresso experimental antigo fisicamente até decisão operacional sobre destino/escopo.** O novo ambiente pode simplesmente começar sem ele.
