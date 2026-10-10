<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Fluxo de desenvolvimento

- Desenvolva e valide as mudanças no ambiente local. Use `npm.cmd run dev` e informe a rota local para revisão.
- Publique no Fly.io somente quando o usuário pedir explicitamente. Não inclua deploy automático como etapa padrão de uma tarefa.
- Para homologação dos Incrementos 1–3, use `checkpoint:*`, `dev:local` e `build:local`: verificam o projeto Docker e fixam os destinos em loopback. Não execute `supabase db push` genérico; o CLI permanece vinculado ao remoto.
- `.env.local` agora é local. O ambiente remoto está preservado em `.env.remote.backup.local`, ignorado pelo Git. Antes de qualquer publicação explicitamente autorizada, prepare e confira o ambiente de produção; não publique uma URL Supabase de loopback.

## Direcionamento arquitetural do Destrava

- Leia [DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md](DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md) antes de análises ou mudanças arquiteturais. Suas premissas atualizadas orientam a interpretação dos documentos anteriores.
- O produto é experimental: não há alunos reais; contas e conteúdo ES/EN são materiais de teste. Reinicializações controladas são aceitáveis quando fizerem parte da tarefa, sem presumir necessidade de manter legado indefinidamente.
- Destrava executa aprendizagem e valida/importa pacotes. O projeto independente Language Foundry pesquisa, produz e aprova editorialmente o conteúdo. A integração deve usar um contrato público versionado, sem dependência operacional do banco, da UI ou dos tipos internos do motor.
- Regras gerais pertencem ao motor; políticas curriculares/correção/conclusão e dados linguísticos devem ser declarados no pacote apropriado. Novas necessidades devem virar capacidades reutilizáveis, comprovadas com testes sintéticos.
- Não presumir reescrita, terceiro repositório de contratos ou plugins genéricos. Investigar alternativas e reutilizar a base adequada. A proteção de integridade já implementada permanece um requisito, mesmo com dados descartáveis.

## Fly.io neste projeto

- Nesta máquina, o `flyctl` tenta alcançar `api.machines.dev` por IPv6 e retorna `EOF`. Não faça uma primeira tentativa direta: use IPv4 desde o início.
- Para qualquer comando Fly, execute `powershell -ExecutionPolicy Bypass -File scripts/fly-ipv4.ps1 <comando>`. O script inicia um proxy HTTPS local que resolve os destinos por IPv4, configura `HTTP_PROXY` e `HTTPS_PROXY` só para o processo e encerra o proxy ao terminar.
- Para publicar, execute `powershell -ExecutionPolicy Bypass -File scripts/deploy-fly.ps1`. A URL e a chave **publicável** do Supabase vêm de `.env.local`; nunca imprima nem transfira chaves privadas. Não interprete o `EOF` da API como falha do app.

## Coordenação multiagente

- O agente principal atua como Lead e é o único interlocutor principal com o usuário. Delegue quando houver benefício concreto; não é obrigatório acionar todos os especialistas.
- Leia [DESTRAVA_MULTIAGENTE.md](DESTRAVA_MULTIAGENTE.md) para perfis, briefing, entrega, integração, evidências e limites reais. Os perfis reutilizáveis ficam em `.codex/agents/`.
- Use no máximo Lead + Implementador + QA + Revisor. Especialistas não subdelegam. Use contexto delimitado e forneça explicitamente as restrições da tarefa.
- Escrita paralela exige worktrees separadas e `workdir` explícito. Só o Lead integra no checkout principal. Não altere arquivos de outro agente nem critérios sem coordenação.
- QA deriva testes dos requisitos; Revisor examina candidato congelado e não escreve ou implementa correções. Um perfil não comprova isolamento de sandbox: registre o modo de carregamento e permissões efetivas.
- Banco, navegador, portas e processos compartilhados são coordenados sequencialmente pelo Lead. Worktrees não recebem credenciais remotas. Não use comandos remotos ou destrutivos sem autorização específica.
- Toda entrega identifica baseline, candidato, arquivos, decisões, comandos/resultados, limitações, patch com arquivos novos, impedimentos e recomendações. Revalide após mudanças.
- Commits exigem autorização da tarefa. Aprovação da estrutura multiagente não autoriza automaticamente push, deploy, publicação, migrações remotas, chamadas pagas ou o próximo incremento.
