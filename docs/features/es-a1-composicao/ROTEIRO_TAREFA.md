# Roteiro histórico de handoff — COM-0, schema local conferido

**HISTÓRICO CONCLUÍDO — NÃO REEXECUTAR AUTOMATICAMENTE.** Após a PR #8 integrada, o proprietário autorizou expressamente **COM-0 somente leitura ao PostgreSQL local identificado**. O Codex entregou [RELATORIO_COM0.md](RELATORIO_COM0.md) com **21 SELECT em cinco transações READ ONLY**, classificação **`parcial/divergente`**. A autorização foi usada e encerrada; ela **não se estende** a novas consultas ou outros bancos. Este roteiro conserva os critérios daquele handoff, mas **o próximo passo é COM-1, desenho estático**, conforme [plano](plan.md).

## Briefing mínimo — histórico, não reenviar como tarefa nova

> Leia `AGENTS.md`, `DESTRAVA_MULTIAGENTE.md`, `docs/features/es-a1-composicao/spec.md`, `plan.md`, `tasks.md` e `docs/features/piloto-es-a1-pos-ciclo2/RELATORIO_P0.md`. Confirme baseline da `main`. Execute **somente COM-0**, inspeção do histórico e schema do **Supabase local identificado/autorizado**, sem escrita.
>
> Compare as migrações de identificador `20261022000100` do motor e do piloto, e confira por metadados de leitura o estado real de tabelas, índices/FKs, RLS/grants/roles/MFA, RPCs `SECURITY DEFINER`, `search_path`, proprietários, histórico das migrações, Storage e tabelas privadas I8. Classifique o destino (`reset-only`, `B1-only`, `ambos`, `novo`, `parcial/divergente`).
>
> Entregue relatório com comandos de leitura executados, ambiente sem segredos, diferenças, evidências, lacunas e recomendação do próximo plano SQL para aprovação. Se não houver acesso de leitura autorizado, responda **BLOQUEADO**, sem tentar conectividade por vias alternativas.
>
> **Proibido**: migrar, renomear, `repair`, reset, alterar DML/políticas/Storage/dados, executar scripts escritores, subir/reiniciar serviços que modifiquem dados, editar arquivos, criar worktrees, commit/PR, conectar Fly/Supabase remoto, consumir IA paga, acessar/expor `.env`. Pare após relatório COM-0.

## Checagens antes de qualquer comando

1. A `main` está no SHA aprovado ou foi reconciliada.
2. O ambiente de destino e os papéis foram **confirmados pelo proprietário**; se não, STOP.
3. O comando não aplica SQL modificador nem inicializa serviço escritor (não tratar CLI `db pull` ou `migration list` como somente leitura sem verificar seu comportamento).
4. Dados retornados não incluem emails, IDs de alunos, tokens nem conteúdo privado; registrar apenas estrutura ou agregados permitidos.
5. Worktrees ES/EN e pendências permanecem byte a byte intactos.

## Resultado encerrado

**COM-0: SCHEMA CONFERIDO — `parcial/divergente`**, conforme [relatório](RELATORIO_COM0.md); **nenhuma alteração realizada**. Próximo possível handoff: **COM-1 somente desenho de convergência**, com autorização explícita posterior do proprietário; não executar banco, exploração de rede, migração ou implementação por esta PR.
