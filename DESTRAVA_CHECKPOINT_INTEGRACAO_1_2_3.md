# Checkpoint de integração — Incrementos 1, 2 e 3

## Resultado

**APROVADO para avançar ao Incremento 4**, após aprovação do desenvolvedor.
Baseline dos três incrementos validada com banco local real e navegador.
O Incremento 4 não foi implementado. Nenhum commit foi realizado.

Esta aprovação refere-se à integração local e ao escopo do motor atual; não
representa homologação de produção, certificação pedagógica ou garantia de
segurança de todos os provedores externos.

## Ambiente e evidências de isolamento

| Operação | Destino comprovado e proteção |
| --- | --- |
| Preparação | Docker `desktop-linux`, pipe local; labels `com.supabase.cli.project=espanhol-plataform` e workdir deste repositório. Status do CLI capturado sem imprimir chaves. |
| Migração | `db push --local --workdir <workspace> --skip-vault`; projeto fixo e porta PostgreSQL 54322 associados ao container verificado. |
| Seed | SDK administrativo com chaves somente do stack local e API fixa `http://127.0.0.1:54321`. |
| Testes integrados | Fetch restrito às origens `127.0.0.1:54321` e `127.0.0.1:3000`, sem seguir redirecionamentos externos. |
| Navegador | Perfil descartável; interceptação de requests rejeita destinos externos. Somente as duas origens locais apareceram; zero requests bloqueados e zero exceções de runtime na rodada final. |
| Dev/build | Ambiente carregado do perfil local validado; credenciais herdadas de Supabase/IA e variáveis de banco/proxy são removidas antes de iniciar o processo. |

O CLI continua vinculado a um projeto remoto em `supabase/.temp/project-ref`.
Isso foi identificado antes das operações. Não houve unlink ou uso de `--linked`;
somente os comandos protegidos deste checkpoint foram usados para escrever.

`supabase/config.toml` é conferido contra projeto e portas fixas. Overrides de
Docker/CLI são rejeitados. Host remoto, alias não previsto, credenciais no URL
ou perfil incompleto fazem o processo falhar antes de qualquer operação.

Arquivos locais de ambiente, todos ignorados:

- `.env.remote.backup.local`: cópia preservada do ambiente remoto original.
- `.env.integration.local`: URL/chaves locais e flags do checkpoint.
- `.env.local`: aplicação agora aponta para o mesmo ambiente local.

OpenAI/Azure não têm chaves neste perfil; Google e Turnstile ficam desabilitados.
Não houve chamada paga nem alteração em produção. O isolamento aqui comprovado
é dos destinos das operações em relação ao remoto; o stack de desenvolvimento
Docker mantém seus bindings padrão e não constitui um ambiente de produção.

## Banco local preparado

Antes do checkpoint, apenas `20260930000100_initial` estava aplicada. Foram
aplicadas as **16 migrações pendentes**, incluindo as dependências de estado por
curso, MFA, perfil, vocabulário, eventos, onboarding e aulas interativas, além de:

- `20261010000100_assessment_semantics.sql`.
- `20261010000200_learning_policies.sql`.

O banco possui **17 migrações** no histórico. O reinício do stack preservou os
volumes; nova execução de `checkpoint:migrate` retornou `upToDate=true` e lista
vazia de migrações. Não houve reset ou exclusão de dados existentes.

Foram instaladas as fixtures ES, EN e xx-Test, em schema de curso 1.3 e versão
de conteúdo 1.2.0. Os seeds confirmaram 18, 16 e 5 itens de vocabulário associados
às lições, respectivamente. Os 24 itens lexicais totais do ES incluem itens
sem associação a lição; não são todos registros de `vocabulary_items`.

Cada rodada integrada usa somente duas contas sintéticas próprias e um objeto
de storage próprio. O cleanup remove esses recursos, inclusive após falhas;
nenhuma conta preexistente é selecionada para exclusão.

## Inconsistências encontradas e correções

| Problema observado | Correção estritamente necessária |
| --- | --- |
| PostgreSQL devolve `finished_at` com offset `+00:00`; Zod exigia UTC `Z`. Retry devolvia 503 e GET descartava silenciosamente o resultado salvo. | Normalizar o timestamp em `assessment-api.ts` antes de validar/devolver. Regressão isolada usa o formato real com offset. |
| Rótulos de políticas continham `?` no lugar de acentos. O navegador não encontrava o texto esperado. | Corrigir somente os rótulos dos três JSON de unidade e recompilar/reinstalar as fixtures locais. Materiais e gabaritos não foram alterados. |
| TOTP desabilitado na configuração local impedia homologar MFA. | Habilitar enroll/verify em `[auth.mfa.totp]` e reiniciar somente o projeto local, preservando volumes. Nenhuma configuração remota foi alterada. |
| Verificador local anterior esperava um curso e 39 atividades. | Substituir sua entrada pelo checkpoint protegido e pelos três pacotes atuais. |
| Espera do navegador podia acessar `document.body` durante troca de documento. | Espera com acesso seguro e retry limitado para contexto de navegação destruído. Não altera a aplicação. |

JSONB pode reordenar chaves e JSON não preserva campos `undefined`. As comparações
da projeção são feitas sobre a forma serializada, preservando arrays, null,
valores e estados, sem tratar ordem de chaves como mudança semântica.

## Testes automáticos e resultados

### Integração real — 13 cenários aprovados

Comando: `npm.cmd run checkpoint:verify`.

1. Guard de isolamento, autenticação real com senha e API anônima recusada.
2. Contratos/políticas instalados acessíveis e gabaritos privados negados.
3. Ausência confirmada, inicialização válida e leitura após primeira gravação.
4. Correção objetiva autenticada e tentativa de enviar nota/finalidade recusada.
5. Diagnóstica/somativa e resultado insuficiente persistidos e recuperados;
   retry idempotente mantém o horário original.
6. Evidências recuperadas produzem os mesmos estados e valores da projeção
   `unit_progress`; SSR apresenta esses estados.
7. Isolamento entre usuários/cursos e escrita cruzada recusada por RLS.
8. TOTP verificado eleva para AAL2; token AAL1 anterior fica sem acesso ao
   progresso e à API de avaliações.
9. Falha de leitura injetada na fronteira HTTP do repositório real, cache antigo,
   zero writes e recuperação com estado do servidor restaurado antes de salvar.
10. Falha real de CHECK no banco durante a projeção conserva dirty/error;
    correção e retry completam a gravação e nova leitura confirma o perfil.
11. Resposta real atrasada da conta anterior não altera sessão posterior.
12. Upload sintético privado permitido ao dono e download de outro usuário negado.
13. Chrome real hidrata progresso e resultado, troca EN → xx-Test e mostra
    **100% de conclusão com 5/7 atividades realizadas**. Sem overflow horizontal
    em 390×844 e 360×800; zero exceções de runtime e nenhum destino externo.

Em cada rodada, as duas contas e o objeto de storage criado foram removidos.
Screenshot de evidência: `.tmp/checkpoint-mobile-smoke.png`, ignorado pelo Git.

### Regressão local

| Verificação | Resultado |
| --- | --- |
| Contratos/vocabulário e dependências | 24 regressões negativas aprovadas; três módulos neutros, somente Zod externo, sem ciclos. |
| Integridade do progresso | 13 cenários isolados aprovados. |
| Semântica de avaliações | 23 cenários aprovados, incluindo timestamp do PostgreSQL. |
| Políticas | 24 cenários aprovados. |
| Diagnóstico adaptativo | 1.024 caminhos ES, 1.024 EN, 8 xx-Test aprovados. |
| Aprendizagem, multilíngua, onboarding, aulas interativas, sessões | Todos passaram. |
| Conteúdo | Três pacotes válidos; 46 atividades ES, 23 EN e 7 xx-Test. Compilação passou. |
| Revisão pedagógica | Zero erros; dois avisos preexistentes de alternativas equivalentes em `grammar-5` e `review-4`. |
| TypeScript, ESLint completo, arquitetura | Passaram; lint com zero warnings. |
| `build:local` | Passou com Next.js 16.3.8, sem credenciais de serviços pagos. |

Ambiente observado: Node v24.18.0, Next 16.3.8, Supabase CLI 2.118.0,
TypeScript 5.9.3; dependências continuam fixadas pelo lockfile existente.

## Estado dos incrementos

| Incremento | Estado no checkpoint |
| --- | --- |
| 1 — contratos neutros | Validado com consumers, tipos e verificação da direção das dependências. |
| 2 — avaliações explícitas | Homologado localmente com API autenticada, MFA, persistência, retry e recálculo após nova leitura. |
| 3 — políticas declarativas | Homologado localmente com evidências, projeção relacional e estado efetivamente hidratado no navegador. |

## Pendências manuais e limites

- Revisar jornada com toque, teclado virtual e leitor de tela em aparelhos reais.
  Os testes de largura e hidratação não substituem essa avaliação de usabilidade.
- Validar todas as telas/exercícios e fluxos de início/fim de sessão manualmente.
- Google, Turnstile, SMTP, passkeys e serviços de IA/fala não foram homologados
  neste perfil: não há credenciais externas e chamadas pagas são proibidas.
- Falha de leitura é injetada no transporte; não foi necessário parar o banco
  durante a gravação para simular queda física. A falha de CHECK e RLS é real.
- Snapshot e projeções não são uma transação única. O teste comprova erro
  visível, preservação de pendência e recuperação; não promete atomicidade.
- Evidências próprias continuam mutáveis e não são um ledger certificado;
  concorrência entre dispositivos e calibração pedagógica permanecem fora do escopo.
- Não houve migração/seed remoto, deploy, commit ou implementação do Incremento 4.

Não há inconsistência bloqueante remanescente para o Incremento 4 no escopo
integrado verificado. As pendências acima permanecem explícitas e não devem ser
interpretadas como funcionalidades ou garantias já homologadas em produção.

## Auditoria do diff e proposta de checkpoint Git

Base do diff: branch `main`, HEAD anterior `632c404`.

O diff acumulado reúne os incrementos 1–3 e sua fundação de integridade de
progresso, anteriormente ainda sem commit. A notice de sincronização, seu CSS
e a alteração no AppShell pertencem a essa fundação; não são redesign incidental.
Os ajustes de `learning-preferences.ts`/`language-resources.ts` são consumidores
do vocabulário neutro. `AGENTS.md` e os relatórios registram o direcionamento.

Escopo proposto:

- Contratos, modelos e projeções de runtime/públicas.
- Execução de avaliações, API, histórico, políticas e progresso.
- Repositório, proteção de sincronização/cache e apresentação de estados.
- Fixtures ES/EN/xx-Test e packs compilados correspondentes.
- Verificadores, configuração TOTP local, guards e recipes do checkpoint.
- Migrações preparadas/aplicadas localmente e documentação dos incrementos.

Excluir do commit:

- `espanholPlataform.code-workspace`: arquivo pessoal de workspace com referência
  ao repositório vizinho; preservado, sem relação com este checkpoint.
- `next-env.d.ts` quando houver apenas variação automática dev/build.
- Todos os ambientes/chaves, caches `.next`, `.tmp`, profiles do navegador,
  screenshots e `supabase/.temp` (incluindo o vínculo remoto).

Scanner comparou os arquivos candidatos com as três classes de segredo privado
presentes no backup original (OpenAI, Azure Speech e Supabase): **zero ocorrências**.
Também foi conferido que ambientes locais/backup são ignorados e somente
`.env.example` é rastreado. Gabaritos dos pacotes são conteúdo privado do servidor,
não credenciais; a projeção pública continua sem esses campos.

Lista concreta proposta: `DESTRAVA_CHECKPOINT_GIT_FILES.txt`. Ela permite revisar
o escopo sem usar `git add .`. Não houve staging ou commit automático.

Mensagem sugerida:

```text
feat: checkpoint universal engine increments 1-3 with local integration

- isolate shared content contracts and vocabulary
- execute explicit assessments and declarative learning policies
- preserve progress integrity and recover failed synchronization
- verify local Supabase persistence, MFA, RLS and browser hydration
- normalize PostgreSQL timestamps and document the integrated baseline
```

O checkpoint está pronto para revisão e autorização do commit. Avançar ao
Incremento 4 exige uma instrução posterior do desenvolvedor.
