# Destrava — Aprenda. Pratique. Destrave.

Aplicação pessoal de estudo guiado da Unidade 1, **Nos presentamos**. As 11 lições, 40 atividades e 18 itens de vocabulário são conteúdo original alinhado aos objetivos dos dois livros enviados. Os PDFs não são servidos pela aplicação.

## Executar agora

Requisitos: Node.js 20.9 ou superior e npm.

```powershell
npm.cmd install
npm.cmd run dev
```

Abra <http://localhost:3000>. Sem um projeto Supabase configurado, a aplicação entra em **modo de demonstração**: as atividades, o plano diário, as revisões e o progresso funcionam no navegador e os dados ficam no `localStorage` desse navegador. É possível exportar uma cópia em **Configurações**.

A chave da OpenAI já foi salva em `.env.local` neste workspace. Ela pertence ao projeto da OpenAI Platform **Chatbot Ecommerce**, conforme a escolha feita nesta sessão. Nunca coloque a chave em variáveis `NEXT_PUBLIC_*` nem publique `.env.local`.

## Prévia pública

A aplicação está disponível em <https://frecuencias-a1-natanael.fly.dev>, na organização Fly.io **plataforma-de-idioma**, região de São Paulo. A prévia usa uma máquina compartilhada de 512 MB, configurada para parar quando não há tráfego e iniciar novamente ao receber uma visita. A hospedagem pode gerar cobranças conforme o uso.

O cadastro da prévia é imediato, sem confirmação de e-mail, para que convidados possam acessar. O Supabase remoto guarda contas e progresso. A chave da OpenAI foi cadastrada como segredo de execução no Fly.io; o `Dockerfile` recebe apenas a URL e a chave **publicável** do Supabase durante a compilação. `.env.local` fica fora da imagem e do Git.

Para publicar uma nova versão, configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no terminal e execute:

```powershell
flyctl deploy --ha=false `
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$env:NEXT_PUBLIC_SUPABASE_URL" `
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

O nome do app, a região, a porta, a checagem de saúde e o desligamento automático estão em [fly.toml](fly.toml). O segredo `OPENAI_API_KEY` deve permanecer configurado no Fly.io, fora do repositório.

## Avaliação de pronúncia com Azure Speech

Crie um recurso **Speech** no [portal Azure](https://portal.azure.com/) com nível de preço **Free (F0)**. Em **Keys and Endpoint** do recurso, copie o **Endpoint** e uma das chaves. Preencha em `.env.local`:

```text
AZURE_SPEECH_ENDPOINT=https://SEU_RECURSO.cognitiveservices.azure.com/
AZURE_SPEECH_KEY=SUA_CHAVE
AZURE_SPEECH_LOCALE=es-ES
```

O portal também pode mostrar um endpoint regional como `https://eastus.api.cognitive.microsoft.com/`; a aplicação aceita esse formato e usa a região correspondente para reconhecer a fala.

Use `es-MX` em `AZURE_SPEECH_LOCALE` se preferir avaliar o espanhol do México. Reinicie o servidor local após editar o arquivo. A chave é lida apenas no servidor; não use prefixo `NEXT_PUBLIC_` nem envie a chave pelo chat ou Git. Para ativar a avaliação no Fly.io, configure `AZURE_SPEECH_ENDPOINT`, `AZURE_SPEECH_KEY` e opcionalmente `AZURE_SPEECH_LOCALE` como segredos do app.

A atividade **Repita uma frase** compara uma gravação de até 20 segundos com a frase exibida e mostra indicadores de clareza, fluência, completude e palavras que merecem outra tentativa. A apresentação livre continua sem nota automática. As chamadas autenticadas compartilham o limite de 20 solicitações por usuário por hora com as outras rotas de IA. Sem a credencial Azure, a gravação ainda pode ser salva, mas a avaliação retorna indisponível.

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

## Perfil de aprendizado e recomendações

O Destrava agora estima domínio por habilidade, tópico, conceito e palavra ou som a partir do histórico já salvo: tentativas corrigidas, avaliações de escrita e pronúncia e revisões de vocabulário. Resultados recentes pesam mais, e a estimativa cai depois de um período longo sem prática. Quando não há evidência, a tela mostra ausência de nota em vez de atribuir zero. Essas pontuações orientam o estudo e não representam aprovação.

O motor em `src/domain/study/learning-recommendation-engine.ts` usa esse perfil para priorizar revisões vencidas, erros recorrentes, baixa pronúncia ou fluência e atividades pendentes. A primeira prioridade aparece na página inicial, o plano de **Aula de hoje** segue a mesma ordem, e **Estatísticas** mostra ações em **O que preciso melhorar?**. Os links abrem a atividade recomendada dentro da lição.

Na página inicial, **Quanto tempo você tem?** abre planos estimados de **5, 15, 30 minutos ou sessão completa**. Em **Aula de hoje**, é possível alternar entre continuar a trilha e **Treinar minhas dificuldades**. O treino focado seleciona apenas erros, palavras difíceis e pontos de fala registrados; quando não há evidência, ele mostra uma orientação para começar pela trilha. Cada sessão inclui somente os cartões planejados, para que a revisão não ultrapasse o tempo estimado por abrir toda a fila. O cronômetro mostra o tempo real e não interrompe o estudo automaticamente.

Depois da sessão, a tela compara resultados avaliados com a tentativa anterior, quando ela existe. **Histórico** mostra a evolução por tentativa de acertos, escrita, pronúncia, fluência e recordação de palavras. Primeiras tentativas aparecem como primeira medida, sem sugerir melhora inexistente. O estado e o resumo da sessão usam o JSON já persistido no Supabase; não há nova migração para este conjunto.

Cada curso informa `languageCode` e conceitos próprios; o motor filtra o histórico pelas atividades e lições desse curso. Para novos idiomas, crie outro curso com IDs exclusivos para atividades, lições e vocabulário. A seleção de vários cursos pelo mesmo usuário e a separação completa do estado persistido por curso ainda precisam ser desenvolvidas.

Para conferir as regras de prioridade e isolamento entre idiomas:

```powershell
npm.cmd run learning:verify
```

## Recursos e limites atuais

- O menu **Alfabeto** apresenta as 27 letras do espanhol com seus nomes, palavras, frases de exemplo e áudio para cada item. É possível buscar e filtrar vogais e consoantes. A ordem e os nomes seguem a [Ortografía da RAE/ASALE](https://www.rae.es/sites/default/files/Principales_novedades_de_la_Ortografia_de_la_lengua_espanola.pdf).
- Exercícios objetivos são corrigidos pela API local; o gabarito não é enviado com o conteúdo público da página.
- O professor e a correção de escrita usam a API da OpenAI no servidor, com respostas estruturadas, limite de requisições por hora e contexto curto. O custo estimado só é calculado quando as tarifas por milhão de tokens são configuradas em `OPENAI_INPUT_USD_PER_MILLION` e `OPENAI_OUTPUT_USD_PER_MILLION`.
- Sem Supabase, as rotas de IA aceitam chamadas somente em desenvolvimento local. Uma publicação exige autenticação configurada.
- Palavras, frases de exemplo, opções em espanhol, flashcards, transcrições e textos escritos têm botão de escuta. Também é possível selecionar qualquer trecho visível para ouvir em espanhol. A voz vem da síntese do navegador e pode variar conforme o dispositivo.
- Speaking grava até 20 segundos. A repetição de frase pode receber avaliação pelo Azure Speech quando configurado; a fala livre pede a transcrição do aluno e não recebe nota automática.
- As flags `NEXT_PUBLIC_FEATURE_AI_TUTOR`, `NEXT_PUBLIC_FEATURE_AI_WRITING`, `NEXT_PUBLIC_FEATURE_SPEAKING`, `NEXT_PUBLIC_FEATURE_LISTENING` e `NEXT_PUBLIC_FEATURE_SPACED_REPETITION` aceitam `false` para ocultar ou desativar os recursos correspondentes. Todas vêm ativas por padrão.

## Verificação

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run content:validate
npm.cmd run learning:verify
npm.cmd run build
```

Os dois arquivos PDF originais são usados apenas como referência pedagógica e permanecem fora das rotas públicas.
