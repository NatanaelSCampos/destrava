# ES-A1 laboratório vivo — plano de evolução e gates técnicos

**Estado 23/10/2026:** planejamento documental baseado no [relatório de auditoria estática](RELATORIO_AUDITORIA.md), com decisão de produto ESLAB-D01 **aprovada** (evoluir o acervo e reorganizar U2 antes de U1). **Nenhuma fase de implementação, migração, merge ou publicação está autorizada por este plano.**

**Baseline documental:** `main` `6bdd26c336ce50d59569a74581044fe3ddc89284`; confirmar SHA novamente no início de toda tarefa. **Curso alvo:** `espanhol-a1-pessoal`, conteúdo `0.1.0`, contrato `1.5`, caminho compilado encontrado estaticamente. **Não inferir que a versão remota é a mesma.**

## Por que a alternativa A

O acervo contém 703 atividades, 159 flashcards, 21 roteiros e contrastes pedagógicos reutilizáveis. A concentração de 78 múltiplas escolhas consecutivas na U2, 119 objetivos idênticos a títulos e feedbacks genéricos justificam reorganização profunda, não descarte indiscriminado. Reaproveitar o material corrigido e revisar objetivos/gabaritos/feedbacks dá uma forma mais segura de medir aprendizagem real.

## Sequência e fronteiras de autorização

| Fase | Resultado e gate | Permissões que ainda faltam |
| --- | --- | --- |
| **P0 — Reconciliação técnica (PRÓXIMA)** | Inventário por leitura das divergências motor/piloto, migrações `20261022000100` e protocolos geração/B1; proposta de composição, plano de testes e ordem de alterações | Autorização para investigação no Codex. **Sem escrita no repo ou banco** |
| **P1 — Fatia vertical U2** | Mapa curricular revisado; um bloco curto de explicação → reconhecimento → recuperação → aplicação → revisão; ajuda pública acessível e feedback editorial contextual | Aprovação de escopo de código/conteúdo, necessidade de contrato e acesso de QA |
| **P2 — U2 completa** | Reorganizar sequência das 71 lições usando o acervo útil; prática de reforço opcional, diagnóstico e avaliações sem vazamento de itens quando viável | PR funcional/editorial própria e QA |
| **P3 — U1 completa** | Reaplicar padrão aos cumprimentos, apresentação, números/alfabeto, comunicação A1, variedade e avaliações | Nova aprovação de escopo e QA |
| **P4 — Dogfooding e operação** | Homologar com o proprietário no **mesmo curso pessoal**, registrar limitações e decidir publicação | Autorização separada de banco/remoto/deploy e validação de ambiente/rollback |

A execução de P1–P4 **não começa** por merge do planejamento. Auditoria estática P0 também não é autorização para alterar codebase local nem schema.

## P0 — investigação somente de leitura (próximo handoff)

O Lead deve usar `git worktree list --porcelain`, `git status --short`, `git log`, `git show` e diffs **sem modificar os checkouts**. Reconfirmar a linha de base e hashes nos worktrees reais. Não copiar `.env`, não mudar de branch, não executar scripts potencialmente escritores.

### P0-A — Identificador de migração duplicado

Comparar o conteúdo e os efeitos dos dois arquivos distintos:

- Piloto local: `supabase/migrations/20261022000100_learning_reset_generation.sql`.
- Motor `main`: `supabase/migrations/20261022000100_interactive_segment_evidence.sql`.

Entregar tabela de DDL/RLS/trigger/grant/função/objeto tocado, dependências, ordenação possível e compatibilidade. Separar **histórico declarado do Git**, **schema local demonstrado (se houver relatório)** e **estado de banco realmente não verificado**. Não assumir que mudar nome de arquivo ou marcar uma versão no histórico é solução suficiente. Propor migração corretiva/versionada **somente em documento**, com pré-condições de verificação, plano de rollback e STOP para autorização operacional.

### P0-B — Autoridade de geração versus evidências B1

Identificar o mecanismo de `learning_reset_generation`, seus locks e leitura/escrita por geração. Comparar com fluxo B1 de evidências privadas por segmento/checkpoint, endpoints e `CAS`. Definir invariantes e negativos para: aba antiga, reset concorrente, replay de recibo, ACK perdido, mudança de curso/versão/conta, callback tardio e idempotência. **Não** declarar compatibilidade com base em teste antigo do motor isolado; propor candidato conjunto e testes independentes posteriores.

### P0-C — Composição editorial e técnica

Mapear mudanças do piloto ES em relação a `main` e base do curso compilado. Identificar que 30 arquivos ES também aparecem no checkout EN semanticamente iguais sem escrever sobre o EN. Registrar roteiros B2 anotados, 21 aulas, 44 listenings TTS ES (transcrição pública), 52 roteiros privados suspensos do EN e o papel das flags legadas. O ES não passa a curso instalado por inferência.

### P0 — entregas e critério GO/STOP

1. Relatório por arquivo/objeto afetado, commits, divergências e risco de perda de mudanças.
2. Diagrama de composição sugerida com **ownership por módulo**, checkpoints, autorizações e reversão.
3. Lista de testes a executar mais tarde: regressão B1 geração/persistência, Auth/MFA/RLS, integridade de provas, UI local 360/390, lint/typecheck/build e validação declarativa.
4. Parecer `P0: PLANO SUFICIENTE` ou `P0: BLOQUEADO — DECISÃO NECESSÁRIA`; não emitir `GO PARA DEPLOY`.
5. STOP antes de qualquer `supabase db push`, `migration repair`, `db reset`, importador, mudança de política, delete, chamada paga, `git clean`, `reset --hard`, `stash`, commit/push ou execução de ferramenta que possa escrever dados.

## P1 — vertical pedagógica proposta (não implementar sem autorização)

Selecionar um **bloco curto da U2** que inclua `En mi calle hay ___ tiendas` e conceito de gênero/número/quantificadores, com benefício ao aluno observável. Preservar o componente montado enquanto a regra pública é consultada; não persistir rascunho de atividade não submetida. Validar `concept.description/examples` do contrato e a lacuna da projeção `runtime-package.ts` (hoje só preserva id/rótulo). Não expor respostas esperadas ou mapa de distratores na projeção pública antes da correção.

O corretor canônico decide nota; explicação específica por opção incorreta será editorial, entregue **após a submissão**. Se exigir mudança de contrato/schema público, STOP para aprovação própria. Primeiro testar com espanhol e idioma sintético; não acrescentar regra gramatical específica no motor. Avaliação oral oficial não é parte desta fase.

## P2–P3 — remodelagem curricular proposta

Reespecificar objetivos observáveis, organizar prática essencial e reforços opcionais, diversificar modalidades por **pertinência**, preservar exemplos bons e corrigir ambiguidade (`El metro ___ cerca` pode exigir restrição do objetivo para distinguir `está` e `queda`). Revisar itens finais e diagnóstico sobrepostos, sem afirmar que escrita/fala formativas compõem notas objetivas. Limitações de voice/IA/SRS e Aula Particular instalada permanecem explícitas.

O futuro **“Língua Viva / Idioma nas Ruas”** é uma ideia de produto separada, não requisito nem entrega implícita nesta PR. Possível enriquecimento de cumprimentos/variações da U1 dependerá de decisão editorial futura.

## P4 — qualidade/uso real e publicação

QA e Revisor testam candidato **congelado**, versão/caminho/ambiente identificados, negativação de acesso, mobile e compatibilidade com curso sintético. O proprietário estuda a mesma experiência pessoal (sem curso pessoal duplicado apenas para preservar histórico). O levantamento estático **não prova** o que está no Fly/Supabase remoto, uso da voz em dispositivo, qualidade de IA ou eficácia pedagógica.

Qualquer merge de código, migração de banco, operação em ambiente remoto, alteração de pilotos, custos ou publicação requer autorização explícita separada. Este plano não concede essas permissões.
