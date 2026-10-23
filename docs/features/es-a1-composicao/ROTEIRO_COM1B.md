# Roteiro de handoff — COM-1B (fechamento do desenho; SOMENTE LEITURA)

> **Status: PRÓXIMA TAREFA PROPOSTA, NÃO AUTORIZADA por esta PR documental.** Enviar ao Codex Lead **apenas depois** de a PR COM-1 documental ser revisada e mesclada, e de o proprietário **autorizar separadamente** COM-1B. Não confundir com implementação COM-2.

## Contexto mínimo

Leia `AGENTS.md`, `DESTRAVA_MULTIAGENTE.md` e, na baseline `main` atual, `docs/features/es-a1-composicao/{RELATORIO_COM0,RELATORIO_COM1,DECISOES_COM1,MATRIZ_ALTERNATIVAS_SQL_COM1,spec,plan,tasks}.md`, além das migrations e módulos de código estritamente relevantes.

**Baseline anterior à PR COM-1:** `1b1b27908f3babb89b04dac222ed5bbcee7f1ca1` (merge #9). Reconfirmar o novo SHA integrado antes de começar; a base pode mudar.

## Objetivo

**COM-1B: fechar as decisões técnicas que ficaram pendentes no COM-1, sem executar a solução.** Os cinco princípios [COMP-AD01…05](DECISOES_COM1.md) orientam a análise; **seis tabelas `_v2` e cinco IDs de migração são alternativas NÃO aprovadas**.

Produza:

1. **Matriz SQL por objeto e operação:** para cada tabela/sessão/recibo, listar a autoridade e as colunas/chaves/FKs/uniqueness/grants de que houver evidência no código e no [inventário COM-0](RELATORIO_COM0.md); assinalar expressamente o que **não se sabe**. Comparar **A — in-place**, **B — `_v2`**, **C — híbrida** com custo, EN, legado, rollback, compatibilidade e teste. Escolher **uma proposta justificada por objeto**, não uma arquitetura completa por preferência.
2. **Legado:** política por objeto de `LEGACY_REVIEW_REQUIRED`, histórico preservado, adoção seletiva somente com evidência verificável; nunca `DEFAULT G_atual`, nota inventada ou corrida entre gerações.
3. **Piloto EN:** plano de continuidade **funcional** para o cutover de writer V1→V2, com sequência, responsabilidade por arquivo, cenário de rollback seguro e oráculos de leitura/escrita legítimas. Sem prometer preservação só porque worktrees não mudaram.
4. **Áudio histórico:** política owner-only para Storage/recibos, URLs previamente emitidas e TTL, emissão/download/replay pós-reset; reset administrativo permanece desabilitado até solução comprovável.
5. **Convergência e segurança:** cenários `parcial/divergente` do banco local, proveniência de reset desconhecida, histórico `20261022000100`, geração/lock comum, `TRUNCATE`, MFA/RLS, preflight agregado de teto **somente como esboço não executado**, risco do binding Docker local. Nenhuma alteração de política/ACL/rede.
6. **QA e aprovação:** testes independentes negativos (retry, ABA, CAS, leitura paginada/snapshot/ordinal, 501+ recibos, EN, áudio, Storage e versão), plus lista de decisões não encerradas e permissões concretas exigidas para COM-2.

## Permissões — limite absoluto

**Somente análise estática e relatório em resposta**, sobre conteúdo acessível e versões verificadas. **Não abrir banco local/remoto; não executar SQL, incluindo SELECT/agregados; não executar comandos que escrevam arquivos/dados; não modificar código, migrações, conteúdo, worktrees, Docker, rede ou configs; não fazer commit, PR, merge, reset, deploy, custos, nem usar credenciais.** O histórico local relatado no COM-0 não é acesso vigente.

Entregar `COM-1B: DESENHO PRONTO PARA DECISÃO DO PROPRIETÁRIO` ou `COM-1B: DECISÕES PENDENTES`, separando explicitamente fatos observados, propostas e testes **NÃO EXECUTADOS**. **Pare ao relatar; COM-2 não começa automaticamente.**
