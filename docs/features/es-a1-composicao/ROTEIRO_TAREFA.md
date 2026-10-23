# Roteiro de handoff — COM-0, levantamento de schema e histórico

**Não autorizado para execução por esta PR.** Este roteiro é para o Codex Lead **após**: (1) o proprietário aprovar o merge da PR documental de composição; (2) autorizar expressamente **consulta somente leitura ao ambiente identificado**. Não iniciar se qualquer condição faltar.

## Briefing mínimo

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

## Resultado

Entregar `COM-0: SCHEMA CONFERIDO` ou `COM-0: BLOQUEADO`, com evidência. **Nunca usar GO PARA DEPLOY.** A análise de integração COM-1 e alterações SQL/código exigem autorização posterior.
