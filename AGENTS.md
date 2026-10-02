<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Fly.io neste projeto

- Nesta máquina, o `flyctl` tenta alcançar `api.machines.dev` por IPv6 e retorna `EOF`. Não faça uma primeira tentativa direta: use IPv4 desde o início.
- Para qualquer comando Fly, execute `powershell -ExecutionPolicy Bypass -File scripts/fly-ipv4.ps1 <comando>`. O script inicia um proxy HTTPS local que resolve os destinos por IPv4, configura `HTTP_PROXY` e `HTTPS_PROXY` só para o processo e encerra o proxy ao terminar.
- Para publicar, execute `powershell -ExecutionPolicy Bypass -File scripts/deploy-fly.ps1`. A URL e a chave **publicável** do Supabase vêm de `.env.local`; nunca imprima nem transfira chaves privadas. Não interprete o `EOF` da API como falha do app.
