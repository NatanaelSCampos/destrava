# P0 — Reconciliação motor + laboratório ES-A1

> **Relatório de leitura do Codex recebido pelo proprietário em 23/10/2026.** Fonte de descoberta para a [especificação de composição](../es-a1-composicao/spec.md) e [plano](../es-a1-composicao/plan.md).
>
> **Confiabilidade:** análise de código e worktrees locais conforme relato do Codex. Não houve SQL, browser, build, autenticação, teste operacional, acesso ao Fly/Supabase remoto ou implementação nesta etapa. "PLANO SUFICIENTE" **não** é "GO para executar migração/deploy".
>
> **Privacidade/documentação pública:** hyperlinks com caminhos absolutos do Windows foram convertidos em referências lógicas às worktrees; nenhuma fonte pessoal foi incorporada ao GitHub por este registro. Conteúdo substantivo, limitações e conclusões foram preservados.
>
> **Baseline histórica auditada:** `cacbacb6b6c2e5308885f6174e660f8c9c23bd19` (PR #7 integrada). Revisar a `main` antes de qualquer futuro trabalho.


## Parecer: **PLANO SUFICIENTE**

É possível compor o motor atual com o piloto preservando geração, evidências B1, A2/B2 e inglês. **A composição exige adaptações de protocolo e banco; copiar os arquivos do piloto sobre a `main` não é seguro.**

Este parecer encerra o planejamento. **Não autoriza implementação, migração, reset ou publicação.**

## 1. Pré-requisito, baselines e preservação

A [PR #7](https://github.com/NatanaelSCampos/destrava/pull/7) está fechada e integrada. A `main` foi confirmada no início e no encerramento em:

**`cacbacb6b6c2e5308885f6174e660f8c9c23bd19`**

A decisão ESLAB-D01 consta dos documentos integrados. A consulta de revisões formais retornou lista vazia: não apresento isso como uma revisão `APPROVED` registrada.

Foram lidos os seis documentos obrigatórios na referência integrada. O código da baseline permanece equivalente ao candidato local `e780e56`: os sete commits posteriores alteram somente onze documentos.

### Worktrees relevantes

| Local | Branch | HEAD | Pendências |
|---|---|---|---:|
| `checkout principal (Windows)` | `feat/fase4-first-parallel-cycle` | `93ef6f2` | 6 |
| `worktrees do motor (Windows)/f4-c2-validado` | `feat/fase4-cycle2-validated` | `e780e56` | 1 |
| `worktrees pessoais (Windows)/personal-es-a1` | `feat/personal-es-a1-u1-u2-v2` | `8cf0557` | 0 |
| `…/personal-es-a1-content` | `agents/personal-es-a1-content` | `bccb67e` | 61 |
| `…/personal-es-a1-qa` | `agents/personal-es-a1-qa` | `bccb67e` | 4 |
| `…/personal-en-a1` | `feat/personal-en-a1-u1-u2-v1` | `b0ce81f` | 1 |
| `…/personal-en-a1-content` | `agents/personal-en-a1-content` | `8cf0557` | 61 |
| `…/personal-en-a1-qa` | `agents/personal-en-a1-qa` | `8cf0557` | 4 |

**Conferência antes/depois:** os 20 worktrees, 249 pendências, arquivos rastreados e referências locais permaneceram iguais. Arquivos ignorados não foram integralmente inventariados.

Os 30 arquivos do curso ES presentes no checkout EN continuam semanticamente iguais aos do checkout ES. Os mecanismos de geração comparados também coincidem.

Nenhum checkout foi atualizado. Consultas remotas limitaram-se ao GitHub para conferir o pré-requisito e os documentos; Fly, Supabase e provedores não foram acessados.

## 2. Migrações duplicadas

### Objetos e efeitos encontrados

| Origem | Arquivo | Objetos e efeitos principais |
|---|---|---|
| Piloto | learning_reset_generation.sql (`worktree personal-es-a1/supabase/migrations/20261022000100_learning_reset_generation.sql`) | `user_learning_generations`; funções `learning_generation()` e `learning_write_allowed(uuid)`; políticas restritivas de escrita nas tabelas existentes listadas e no Storage de fala. |
| Motor | interactive_segment_evidence.sql (`worktree f4-c2-validado/supabase/migrations/20261022000100_interactive_segment_evidence.sql`) | `definition_hash` nas sessões; revogação de DML direto; `interactive_lesson_receipts`; RPC privilegiada `save_interactive_lesson_session(...)`; gravação transacional de sessão, tentativa/submissão e evento. |

Ambos usam **`20261022000100`**, mas representam mudanças diferentes.

Não há colisão direta dos nomes dos novos objetos criados. Há sobreposição de efeitos em `interactive_lesson_sessions`: o reset acrescenta restrições de geração e B1 retira a escrita direta do cliente.

Nenhum dos dois arquivos cria triggers próprios. Ambos contêm operações que impedem reaplicação cega.

### Dependências relevantes

- Reset: Auth, tabelas de aprendizagem existentes e Storage.
- B1: sessão interativa base, usuários, curso/lição, tentativas, submissões, eventos e políticas MFA.
- I8: tabelas e comprovantes privados de seleção/progresso, que não aparecem na lista pública do reset antigo.

Aplicar os dois textos não protege automaticamente o escritor privilegiado B1: as políticas de geração do piloto destinam-se ao papel `authenticated`.

### Estratégia proposta

**Manter a história existente e convergir por versões novas e únicas.** Não juntar os arquivos sob o mesmo identificador, renomear uma migração aplicada ou marcar versões automaticamente.

| Estado efetivamente encontrado no futuro | Tratamento proposto |
|---|---|
| Somente reset | Preservar seu histórico; introduzir os objetos B1 ausentes e a composição de geração por migração nova. |
| Somente B1 | Preservar seu histórico; introduzir geração e adaptar os escritores por versões novas. |
| Ambos completos | Não reaplicar os originais; aplicar apenas a adaptação de composição necessária. |
| Banco novo com cadeia canônica | Aplicar a cadeia revisada, com identificadores únicos e convergência validada. |
| Objetos parciais, modificados ou histórico contraditório | **STOP:** aprovar reparo específico antes de qualquer aplicação. |

**Cuidado central:** num banco do piloto, o identificador pode representar reset e não B1. A nova convergência precisa verificar os objetos B1; não pode presumir sua existência pelo número registrado.

### Verificações futuras obrigatórias

Sob autorização separada, conferir:

- Histórico de migrações, nomes e evidências disponíveis do SQL aplicado.
- Colunas, índices, unicidade, FKs e cascatas.
- RLS, políticas, ACLs e privilégios efetivos.
- Assinaturas, corpos, proprietários, `SECURITY DEFINER`, `search_path` e overloads.
- Dependências de sessões, submissões, eventos, Storage e dados privados I8.
- Comportamento da ferramenta diante do histórico divergente.

`IF NOT EXISTS` isoladamente não comprova equivalência. Se a ferramenta exigir reparo do histórico, isso precisa de análise e autorização próprias.

## 3. Geração, CAS e evidências B1

### Incompatibilidade confirmada no código

O piloto usa uma geração persistida por usuário e trava por usuário com seed `731984`. A função lê a geração **depois de adquirir a trava**.

B1 usa uma trava diferente, por usuário/curso/lição, e sua RPC não recebe a geração de aprendizagem. Além disso, existe retorno rápido de comprovante na rota HTTP, antes dessa RPC.

Fontes principais:

- Controller de geração (`worktree personal-es-a1/src/lib/learning-generation-client.ts`)
- Escritor e recuperação B1 (`worktree f4-c2-validado/src/domain/interactive-lesson/server.ts:63`)
- Retorno rápido de comprovante (`worktree f4-c2-validado/src/app/api/interactive-lessons/segment/route.ts:52`)

**Adicionar somente o proxy do piloto não fecha a corrida entre sua verificação e a escrita privilegiada.**

### Identidades que devem continuar separadas

| Identidade | Responsabilidade |
|---|---|
| Geração persistida `G` | Invalidar operações anteriores ao reset. |
| Época local do provider | Descartar filas e callbacks de contextos substituídos. |
| Revisão CAS | Ordenar alterações concorrentes da mesma entidade. |
| Versão/hash | Fixar conteúdo e critérios de avaliação. |
| Sessão, tentativa e operação | Identificar execução e repetição idempotente. |

Nenhuma delas substitui as demais.

### Protocolo proposto para estudo

1. Capturar o escopo antes da fila ou operação assíncrona: usuário, geração, época local, curso, origem e sessão/referência de versão.
2. Preservar esse escopo em toda repetição. Uma operação antiga não recebe automaticamente a geração do contexto novo.
3. Autenticar proprietário e MFA no servidor.
4. Na mesma transação do escritor privilegiado:
   - adquirir a trava comum do usuário;
   - verificar geração e `resetting`;
   - validar o escopo;
   - recuperar um comprovante idêntico, se existir;
   - aplicar CAS somente para operação nova;
   - gravar efeitos e emitir confirmação.
5. Aplicar a resposta no cliente somente se o contexto capturado continuar atual.

**Não colocar CAS antes da recuperação de um comprovante idêntico:** isso quebraria a recuperação de ACK perdido.

O helper privilegiado deve ter autoridade explícita e restrita. Não basta chamar diretamente a função RLS atual, cuja validação depende de `auth.uid()` do usuário autenticado.

Todos os caminhos antigos ou overloads que contornem o protocolo precisam ser revisados e ter sua execução revogada quando substituídos.

### Leitura e replay também precisam de geração

Atualmente os comprovantes B1 são recuperados por usuário/curso e filtrados por versão/hash, sem geração persistida.

A composição deve alcançar:

- Leitura de sessões e comprovantes.
- Retornos rápidos de retry.
- Paginação e reconciliação de comprovantes.
- Cache, pendências e recovery.
- Projeções normalizadas.
- Progresso, seleção e evidências pessoais I8 em `destrava_private`.

**Catálogo, instalações e ponteiros globais I7 não são progresso pessoal a ser reiniciado. O ledger de consumo/cotas também deve ser preservado.**

### Reset administrativo: definição necessária no código futuro

Não foi localizada fonte canônica do procedimento administrativo completo. Há descrição histórica, mas isso não comprova sua implementação atual.

Proponho um protocolo versionado mínimo com:

- `operationId`, comando/escopo, geração esperada, geração resultante e fase.
- Freeze e incremento de geração atômicos.
- Geração monotônica, sem redução por rollback.
- Invalidação dos dados definida explicitamente.
- Storage confirmado antes de reabrir escrita.
- Falha ou confirmação ambígua mantendo o bloqueio.

**Exceção importante:** retry do mesmo reset após ACK perdido deve reconhecer seu registro administrativo e recuperar a geração resultante, sem incrementá-la novamente. Essa exceção não permite replay pedagógico de geração antiga.

Uma conclusão atrasada do reset A também não pode liberar o bloqueio pertencente ao reset B.

## 4. Sessões B1 e evolução editorial

Foi confirmado um impacto adicional: o hash B1 (`worktree f4-c2-validado/src/domain/interactive-lesson/server.ts:21`) inclui **definição, pacote completo do curso e idioma**.

Assim, editar um exercício U2 muda também o hash das aulas U1. Porém a sessão atual tem unicidade somente por usuário/curso/lição e retorna conflito quando versão/hash divergem.

### Adaptação proposta

Usar o escopo privado:

`usuário + G + curso + lição + contentVersion + definitionHash`

- Novo escopo abre sessão com UUID nova.
- Sessões anteriores ficam preservadas e inativas.
- Leitores, índices, RPCs e `ON CONFLICT` usam o mesmo escopo.
- Comprovantes antigos não são reaplicados ao novo.
- Dados sem geração não recebem a geração atual por conveniência.
- Flags legadas não viram comprovantes B1.

Isso exige alteração autorizada de banco e contratos internos. Apenas mudar a interface não resolve.

**Editar U2 deve incrementar a versão do conteúdo ES, não a geração administrativa global.** Não deve apagar ou invalidar o inglês. Não proponho outro curso pessoal nem execução histórica de versões compiladas antigas.

## 5. Composição por módulo e responsabilidade

A base comum entre as linhas examinadas é `bccb67e`. Há três commits exclusivos no piloto EN que também carrega ES.

Dos 19 caminhos alterados nas duas linhas, **cinco são equivalentes após normalizar finais de linha e 14 possuem diferenças reais**. Os 160 caminhos alterados no lado do piloto desde a base comum não significam 160 alterações a copiar para a `main`.

### Estratégia de integração

| Módulo | Tratamento |
|---|---|
| Conteúdo ES e autoria | Usar a versão integrada `8cf0557`, incluindo overrides e mapeamento. Rascunhos antigos não substituem correções posteriores. |
| Provider, sincronização e cache | Partir da `main`; incorporar a geração preservando pausa/cursor A2, prefixos adaptativos, leitura antes de escrita e replay B1. |
| Cliente/servidor Supabase e proxy | Compor o transporte de geração com Auth/MFA atuais. Proxy é defesa adicional, não autoridade transacional. |
| Repositórios e APIs | Preservar o código novo de B1/I8; adaptar escopo e geração. Não substituir pelo repositório antigo. |
| Exercícios, escrita e fala | Preservar callbacks B1 e incorporar transporte/validação de contexto. Manter correção canônica. |
| Aula Particular e áudio | Preservar runtime B1, controlador B2 e árbitro de reprodução. Reutilizar os 21 roteiros anotados. |
| Seleção/onboarding/progresso | Manter CAS instalado e correções de persistência/percentuais já existentes; não restaurar requests antigos simplificados. |
| Professor bilíngue | Manter a separação atual por campos: mensagem/tradução no apoio, exemplo no alvo e follow-up não anotado textual. |
| Scripts, catálogo e testes | Incorporar seletivamente aliases/verificadores; regenerar artefatos no candidato autorizado. Não copiar outputs antigos sobre a base nova. |
| Inglês | Preservar fontes, overrides, avaliações e política de escuta; regressão no candidato conjunto, sem escrever nos worktrees EN. |

### Pontos específicos de compatibilidade

- **44 escutas ES:** roteiro declarado público para TTS; não tratar como avaliação com roteiro secreto.
- **52 roteiros EN:** política privada e suspensão preservadas.
- Há instruções de fala de 30–45 segundos, mas o recorder do piloto **já limita vinte segundos**. É inconsistência editorial preexistente, não regressão B1.
- Não habilitar IA, speaking avançado, SRS ou Aula Particular instalada por transportar DTO compatível.

### Ownership futuro

- **Lead:** interfaces, manifesto, composição e gates.
- **Implementador:** módulos delimitados de protocolo, banco e runtime, sem edição concorrente dos mesmos arquivos.
- **QA:** testes independentes e cenários negativos.
- **Revisor:** candidato congelado, arquitetura e segurança, sem correções.

Worktrees novos somente após autorização funcional. Banco, navegador e build coordenados sequencialmente pelo Lead.

## 6. Riscos e grau de comprovação

| Risco | Estado |
|---|---|
| Mesmo identificador para migrações diferentes | **Confirmado por arquivos.** Aplicação real desconhecida. |
| B1 fora da trava/verificação de geração | **Confirmado por código.** Corrida modelada, não executada. |
| Replay de comprovantes sem geração | **Ausência de escopo confirmada.** Restauração indevida não reproduzida. |
| Edição U2 conflitar com sessões U1/U2 | **Derivado de hash, lookup e unicidade atuais.** Não exercitado. |
| Cópia de arquivos antigos remover A2/B2/CAS | **Diferenças concretas identificadas.** Nenhuma composição aplicada. |
| Reset antigo não cobrir dados privados I8 | **Lista de tabelas insuficiente no arquivo.** Procedimento administrativo atual desconhecido. |
| Contradição de duração da fala | **Confirmada no conteúdo e recorder.** |
| Schema remoto, versão publicada e provedores | **Não comprovados; fora do acesso autorizado.** |

## 7. Plano de testes — **não executados**

| Grupo | Cenários e resultado exigido |
|---|---|
| Migrações | Reset-only, B1-only, ambos, banco novo e schema parcial; convergência correta ou falha explícita, nunca sucesso aparente. |
| Papéis | Anônimo, outro usuário, AAL1/AAL2, DML direto e RPC privilegiada; nenhuma ampliação de autoridade. |
| Reset concorrente | Writer primeiro/reset primeiro; verificação após espera e nenhum efeito atravessando a geração invalidada. |
| Retry administrativo | ACK perdido após freeze; mesmo `operationId` não incrementa novamente; conclusão antiga não reabre reset posterior. |
| Retry pedagógico | ACK perdido A2/B1; mesmo comando gera um efeito. Mesmo ID com payload divergente conflita. |
| ABA/contexto | Usuário A→B→A, curso C→D→C, troca de origem e remount; callback antigo não se torna atual por coincidência de valores. |
| CAS | Duas operações distintas com a mesma revisão: um vencedor, conflito preservando pendência. |
| Leitura/replay | Falha de GET, geração não confirmada, reset entre páginas e recibo antigo: zero gravação liberada e nenhuma mistura de gerações. |
| Conteúdo | Edição somente U2 abre novo escopo B1 nas aulas afetadas; prova antiga não aprova nova sessão; EN permanece intacto. |
| Legado | Flags sem comprovantes não aprovam etapas; dados sem geração não são promovidos automaticamente. |
| Storage | Upload tardio, falha parcial e retomada; separar bucket tradicional do áudio privado nos comprovantes. |
| Projeções | Falha depois do snapshot não produz ACK falso nem revive pendência em geração posterior. |
| Regressões | Gates de A2/B2/B1, geração, sync, avaliações, políticas, arquitetura, pacotes, conteúdo, TypeScript, ESLint e build. |
| Jornada real | Auth/MFA, curso pessoal, persistência/reload, ajuda e áudio em 360/390; mocks separados de SQL/HTTP/browser reais. |

A autorização futura dos testes deve especificar dados sintéticos, retenção e operações permitidas. Runners que excluem dados não podem ser executados automaticamente.

## 8. Autorizações e sequência recomendada

| Mudança proposta | Autorização necessária |
|---|---|
| Compor provider, transportes, callbacks, leitores e writers | Implementação funcional delimitada. |
| Evoluir envelopes internos com geração/escopo | Aprovação do protocolo interno e compatibilidade. |
| Alterar unicidade, índices, funções, grants e convergência SQL | Aprovação explícita do desenho de banco. |
| Consultar schema/histórico efetivos | Acesso operacional de leitura ao destino identificado. |
| Aplicar migrações, reset ou tratar Storage | Autorizações operacionais concretas e separadas. |
| Feedback por alternativa que exija contrato público novo | STOP e aprovação própria. Não é necessário para concluir P0. |

### Ordem para chegar à fatia U2

1. Aprovar a reconciliação técnica descrita.
2. Autorizar o inventário de schema/histórico do destino.
3. Implementar e homologar a composição em candidato isolado, mantendo o ES inicialmente sem remodelagem.
4. Comprovar geração + B1 + A2/B2 e preservação EN.
5. Autorizar P1: pequeno bloco U2 de quantificadores/concordância.
6. Implementar ajuda pública recuperável e feedback editorial após submissão.
7. Validar esse bloco antes de expandir U2 e depois U1.

Rollback deve manter geração e proteção de escrita. **Não baixar geração, reabrir DML ou voltar automaticamente ao cliente antigo.** Diante de incompatibilidade, manter escrita bloqueada e corrigir adiante.

## Parecer final

**QA e Revisor consideraram o plano logicamente suficiente**, com as condições acima. Não identificaram decisão de produto irredutível pendente para encerrar P0.

Não houve SQL, testes de produto, build, serviços, credenciais, alterações de arquivos, operações Git de escrita ou implementação da U2. O relatório foi entregue nesta resposta.

**P0: PLANO SUFICIENTE. A implementação permanece não autorizada.**