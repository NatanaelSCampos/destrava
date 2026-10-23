# Handoff proposto — F1: proteger ambientes e deploy (SEM OPERAÇÃO DE BANCO)

> **NÃO EXECUTAR POR MERGE DOCUMENTAL.** Este roteiro será enviado ao Codex Lead **após** a PR do Release Limpo ser integrada e o proprietário **autorizar separadamente** código, worktree isolado, testes simulados e criação de PR funcional. Não inclui criação/inicialização de Docker, Supabase ou deploy real.

## Briefing curto para Codex Lead

Leia `AGENTS.md`, `DESTRAVA_MULTIAGENTE.md`, `docs/features/release-limpo/spec.md`, `plan.md`, `tasks.md` e os arquivos `scripts/local-environment.mjs`, `scripts/run-local-checkpoint.mjs`, `scripts/deploy-fly.ps1`, além dos runners atingidos. Reconfirme a `main` e os caminhos modificáveis antes de criar candidato.

**Escopo F1:** implementar em worktree nova, se autorizado, somente um perfil explícito para `destrava-release-clean` (portas/labels/projeto novos, guards negativos, sem tocar `espanhol-plataform`) e uma guarda de release Fly que rejeita destino ambíguo/`.env.local`, loopback em produção, SHA/app/URL incorretos e configuração pública com segredo. Não modificar o contrato público de curso, o runtime pedagógico ou os pilotos pessoais.

**QA independente:** simular comando Fly sem realizá-lo, testar inputs inválidos, validar que projeto/portas antigos ou remotos são recusados, nenhuma alteração de dados e configuração de build explicitamente identificada. **Revisor:** conferir candidato congelado, preservação dos guards antigos, scripts tocados e manifesto mínimo; reportar PASS/FAIL/STOP com SHA dos arquivos e evidências.

**Proibido nesta entrega:** conectar ou iniciar Supabase/Docker, executar migração, seed ou testes que escrevam no banco, ler/alterar credenciais remotas, gerar curso, consumir APIs pagas, acessar Fly real, executar deploy, modificar produção, limpar worktrees antigos, alterar esquema ou descartar histórico. Compilação/build/cache e `npm ci` também exigem autorização de escrita local quando usados em F1.

**Entrega se for autorizada:** código e testes negativos locais de guardas, relatório QA/Revisor, PR funcional **separada** para revisão; sem merge automático. F2 (bootstrap local) exigirá autorização operacional própria.

**Se faltarem instruções/permissões para executar, responda F1: BLOQUEADO, sem tentar atalhos.**
