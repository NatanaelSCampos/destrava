# ES-A1 — Plano de composição segura motor + piloto pessoal

**Estado: proposta documental, sem autorização de execução ou banco.** Fonte: [relatório P0](../piloto-es-a1-pos-ciclo2/RELATORIO_P0.md), [spec](spec.md), [tarefas](tasks.md). O Codex encerrou P0 com **PLANO SUFICIENTE** por leitura; nenhum teste de integração nem SQL foi executado. Baseline auditada: `cacbacb6b6c2e5308885f6174e660f8c9c23bd19`; reconfirmar Git no início de qualquer tarefa.

## O que preservar

- Motor da `main` é fonte do runtime A1/B1/A2/B2, I8, Auth/MFA/CAS, TTS e repositórios. **Não copiar** implementações antigas do piloto sobre esse motor.
- ES compilado pessoal é fonte editorial do curso `espanhol-a1-pessoal`: HEAD `8cf0557` no P0. EN pessoal HEAD `b0ce81f` e variantes/editoriais do EN devem permanecer intactos. A duplicação semântica de 30 arquivos ES no checkout EN não dá permissão de sobrescrever nenhum deles.
- 20 worktrees/249 pendências foram preservados segundo relatório local P0. Inventário novo deve ser **somente leitura**, sem `git clean`, reset, stash, rebase ou checkout dos branches existentes; worktrees funcionais novos exigem autorização.
- Versão pessoal no Fly/Supabase remoto, schema efetivamente aplicado, dispositivos e vozes não foram verificados; não alegar produção pronta.

## COM-0 — Próximo gate proposto: inventário de banco SOMENTE LEITURA

**Requer autorização própria do proprietário para acessar um ambiente identificado.** Recomenda-se Supabase **local** primeiro; remoto/Fly ficam fora por padrão.

1. Confirmar ambiente, host/porta, papéis e identidade do banco antes de qualquer consulta, sem revelar credenciais e sem iniciar serviços que apliquem migrações/seeds ou modifiquem banco.
2. Com acesso de leitura explicitamente autorizado, inspecionar por `SELECT`/catálogos `pg_catalog`/`information_schema`: histórico de migrações, nomes e estado de `user_learning_generations`, sessões e recibos B1, dados I8 privados, Storage, índices/constraints/FKs/cascatas, RLS/ACL/grants, assinaturas e corpos de RPC `SECURITY DEFINER`, proprietários e `search_path`.
3. Classificar estado real: **reset-only**, **B1-only**, **ambos**, **novo** ou **parcial/divergente**. Identificador `20261022000100` por si só **não comprova** nenhum objeto. `IF NOT EXISTS` não é teste de equivalência.
4. Entregar relatório de consulta sem PII: ambiente, data, comandos efetivos, hashes, diferenças e bloqueios. **Não realizar correção**; caso haja divergência ou falta de permissão, STOP e decisão própria.
5. Nenhum `supabase db push/pull` escritor, `migration repair`, reset, `ALTER`, `UPDATE`, `INSERT`, `DELETE`, `GRANT`, alteração de Storage ou migração em COM-0.

## COM-1 — Protocolo detalhado e autorização de SQL/código (futuro)

Congelar contratos internos e plano de convergência **com base em COM-0**:
- Identidades distintas `G`, época local, owner/curso/origem, `contentVersion`/`definitionHash`, sessão, tentativa/`operationId`, revisão CAS.
- Writer B1 e reset usam mesma trava **por usuário**; validação da geração `G` e `resetting` na transação privilegiada. Helper `SECURITY DEFINER` com autoridade explícita e restrita, não confiar em `auth.uid()` do service_role.
- Antes do CAS, recuperar recibo **idêntico e válido** sob geração/versão/owner; ACK perdido não cria novo efeito. Mesmo ID/payload divergente conflita.
- Incluir checagem de geração/escopo em retorno antecipado de recibo, leituras/paginação, caches, recovery, projeções privadas I8 e callbacks. Nunca tornar registros sem geração prova da geração atual.
- Reset administrativo **ainda não identificado como código canônico** precisa de definição versionada `operationId`/freeze/geração/Storage; retry administrativo idêntico recupera mesmo resultado, e falha mantém escrita bloqueada. Não mexer no ledger/catálogo I7/EN.
- Escopo B1 proposto `usuário + G + curso + lição + contentVersion + definitionHash`. Índices, unicidade, `ON CONFLICT`, RPC, leitura e respostas devem ser consistentes. Editar U2 modifica hash de sessão U1: criar novo escopo sem promover comprovantes antigos; `contentVersion` ES muda, **não** a geração global.
- Convergência SQL por **migrações novas e únicas** para cada estado verificado; nunca renomear/marcar aplicadas as originais ou aplicar os dois textos sob o mesmo número. Estado parcial/divergente = STOP.

Contratos públicos, DDL, RLS/grants, migrações locais e mudanças reais de código exigem escopo e permissão futuros específicos; plano não equivale a aprovação desses comandos.

## COM-2 — Composição controlada (futura autorização)

1. Inventariar worktrees e criar candidato isolado **só após autorização**; Lead fixa interfaces, arquivos/owners e hashes, QA e Revisor independentes.
2. Tratar schema/geração/escritor sob gates e permissões separados para banco local, com rollback que não reduz `G` nem reabre DML direto.
3. Integrar provider, repositórios, APIs, leitura/replay, A2 e I8 sem regressão. Exigir negativo de reset concorrente, ACK perdido, corrida ABA, versão, Auth/MFA e Storage.
4. Incorporar curso ES e 21 roteiros anotados **se compatíveis**, preservando B1/B2 e os 52 roteiros EN privados. Não confundir 44 escutas ES com transcrição secreta; não habilitar IA/voz/SRS/aula instalada por inferência.
5. Sem remodelar a U2 nesta fase; a melhoria editorial começa em P1 **depois da composição comprovada**.

## COM-3 — QA, Revisor e PR funcional (futuros)

QA deriva COMP-01…COMP-16 da [spec](spec.md); prova casos de auth/roles/RLS, reset x writer, retries e payload divergente, CAS, replay/leitura com geração, paginação, Storage, efeito no hash U1 quando U2 muda, EN intacto, A1/B1/A2/B2 e idioma sintético. Separar testes puros, SQL/Auth local, HTTP/browser real, 360/390, lint, TypeScript e build, anotando **PASSOU/FALHOU/PARCIAL/BLOQUEADO/NÃO EXECUTADO**.

Revisor verifica candidato congelado, privilégios, hashes, SQL e negativos. Só após autorização própria: PR funcional, merge e **eventual** operação de banco/deploy em marcos independentes.

## COM-4 — Retorno ao curso pedagógico (futuro)

Depois da composição tecnicamente homologada, iniciar a **fatia vertical U2**: `En mi calle hay ___ tiendas`, explicação pública recuperável, feedback editorial específico **após submissão**, variedade progressiva e sem gabarito público. Resposta digitada não submetida permanece somente no estado temporário do exercício.

Continuar com o **mesmo curso pessoal**, sem duplicação de ambiente estável por histórico experimental. Não publicar ou resetar sem autorização operacional.

## Gates de passagem

| Passagem | Condição exigida |
| --- | --- |
| P0 → COM-0 | PR documental revisada/mesclada **e** permissão de leitura para ambiente nomeado |
| COM-0 → COM-1 | Histórico/schema real levantado, com gaps explicitados |
| COM-1 → COM-2 | Protocolo/SQL aprovados e permissões delimitadas para trabalho isolado/teste local |
| COM-2 → COM-3 | Candidato reproduzível e negativos executáveis |
| COM-3 → COM-4 | QA/Revisor e decisões de PR/merge/ambiente aprovadas independentemente |
| COM-4 → P1 | Caminho pessoal ES validado e autorização editorial funcional específica |

**Nenhuma etapa futura é automaticamente autorizada pela integração desta documentação.**
