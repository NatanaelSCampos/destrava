# Frecuencias A1 — estudo de espanhol

Aplicação pessoal de estudo guiado da Unidade 1, **Nos presentamos**. As 11 lições, 39 atividades e 18 itens de vocabulário são conteúdo original alinhado aos objetivos dos dois livros enviados. Os PDFs não são servidos pela aplicação.

## Executar agora

Requisitos: Node.js 20.9 ou superior e npm.

```powershell
npm.cmd install
npm.cmd run dev
```

Abra <http://localhost:3000>. Sem um projeto Supabase configurado, a aplicação entra em **modo de demonstração**: as atividades, o plano diário, as revisões e o progresso funcionam no navegador e os dados ficam no `localStorage` desse navegador. É possível exportar uma cópia em **Configurações**.

A chave da OpenAI já foi salva em `.env.local` neste workspace. Ela pertence ao projeto da OpenAI Platform **Chatbot Ecommerce**, conforme a escolha feita nesta sessão. Nunca coloque a chave em variáveis `NEXT_PUBLIC_*` nem publique `.env.local`.

## Conectar o Supabase

O schema está em [uma migração versionada](supabase/migrations/20260930000100_initial.sql). Para vincular um projeto existente pelo CLI:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref SEU_PROJECT_REF
npx.cmd supabase db push
```

Depois, preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` em `.env.local`, seguindo [.env.example](.env.example). A chave secreta é usada somente pelo importador, nunca pelo navegador. Importe o conteúdo compartilhado com `npm.cmd run db:seed` e reinicie `npm.cmd run dev`.

A rota `/login` passa a oferecer cadastro e entrada pelo Supabase Auth. O progresso fica associado ao usuário autenticado; o áudio de speaking é enviado para um bucket privado. Configure a URL de redirecionamento do Auth para o endereço em que a aplicação estiver rodando.

Mantenha as próximas mudanças no banco em arquivos de migração. Executar a migração manualmente no SQL Editor remoto não registra seu histórico para `supabase db push`.

## Conteúdo e extensão

O conteúdo fica em [src/content/frecuencias-a1.ts](src/content/frecuencias-a1.ts) e é validado pelos tipos de [src/content/schema.ts](src/content/schema.ts). Para adicionar a Unidade 2, inclua outro registro na lista `units`, com lições e atividades ordenadas, acrescente seu vocabulário e rode:

```powershell
npm.cmd run content:validate
npm.cmd run db:seed
```

O renderizador de atividades, o planejador, a revisão e as tabelas usam os registros de conteúdo, sem lógica exclusiva da Unidade 1. `db:seed` exige o Supabase configurado; no modo local, basta reiniciar o servidor após alterar o conteúdo.

## Recursos e limites atuais

- Exercícios objetivos são corrigidos pela API local; o gabarito não é enviado com o conteúdo público da página.
- O professor e a correção de escrita usam a API da OpenAI no servidor, com respostas estruturadas, limite de requisições por hora e contexto curto. O custo estimado só é calculado quando as tarifas por milhão de tokens são configuradas em `OPENAI_INPUT_USD_PER_MILLION` e `OPENAI_OUTPUT_USD_PER_MILLION`.
- Sem Supabase, as rotas de IA aceitam chamadas somente em desenvolvimento local. Uma publicação exige autenticação configurada.
- Listening usa a síntese de voz do navegador como áudio provisório. Speaking grava até 20 segundos e pede que o aluno digite sua própria transcrição; ainda não há avaliação automática de pronúncia.
- As flags `NEXT_PUBLIC_FEATURE_AI_TUTOR`, `NEXT_PUBLIC_FEATURE_AI_WRITING`, `NEXT_PUBLIC_FEATURE_SPEAKING`, `NEXT_PUBLIC_FEATURE_LISTENING` e `NEXT_PUBLIC_FEATURE_SPACED_REPETITION` aceitam `false` para ocultar ou desativar os recursos correspondentes. Todas vêm ativas por padrão.

## Verificação

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run content:validate
npm.cmd run build
```

Os dois arquivos PDF originais são usados apenas como referência pedagógica e permanecem fora das rotas públicas.
