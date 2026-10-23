# PR 2 — correção delimitada R1P2

## Escopo e baseline

Execução local em 22/10/2026, continuada em UTC em 23/10. Autorização: corrigir R1P2, testar, revisar e, após QA/Revisor, fazer commit e push somente desse escopo. Merge, deploy, migrações remotas, exclusões e A2/B2 não autorizados.

Baseline da [PR 2](https://github.com/NatanaelSCampos/destrava/pull/2): `790ae24597aec7ae96589b6c4e85766ae1284656`; base `main`: `10e426e000b4764102f759656d7406e9529eaedb`. Correção preparada no worktree `D:\Documents\destrava-worktrees\pr2-r1p2`, branch `fix/pr2-r1p2-interactive-readiness`. O checkout principal, originalmente em `93ef6f2`, foi usado temporariamente em detached HEAD na baseline correta para os serviços locais. Não houve atualização indiscriminada da branch original.

## Causa e comportamento corrigido

`serverServiceAvailability()` considerava `learning.session_store` configurado com URL e chave publicável. `lessonWriter()` também exige `SUPABASE_SECRET_KEY`. Isso anunciava uma tentativa condicional que já se sabia impossível: o writer recusaria a gravação com 503.

A única alteração de produção acrescenta a presença da chave privada à condição existente. O registro atual tem um único consumidor dessa dependência: `lesson.interactive`; não foi criado contrato ou capacidade nova.

| Contexto | Antes | Depois |
| --- | --- | --- |
| Público presente, privado ausente | Operação `unknown`, ação elegível | Operação `unavailable`, ação bloqueada |
| Configuração completa | `unknown`, tentativa condicional | Preservado; não promete serviço saudável |
| Configuração pública ausente | Bloqueado | Preservado |
| Curso externo sem integração ou permissão negada/desconhecida | Bloqueado | Preservado |

O DTO contém estados e mensagens genéricas, sem valores de credenciais, endpoints ou nomes de variáveis. A chave continua privada. Autenticação, MFA, escopo, revisão CAS, validações e guards não foram alterados. A leitura normal autorizada da sessão não passou a exigir writer; a recuperação por comprovantes já dependia dele e conserva esse comportamento.

## Arquivos da entrega

- `src/lib/capability-environment.ts`: uma condição de presença adicional.
- `scripts/verify-interactive-availability.tsx`: regressão persistente independente, 13 casos.
- `package.json`: comando `interactive:availability:verify`.
- Este relatório: evidências e limites da correção.

## Reprodução e testes automáticos

O QA criou o teste antes da correção. Na baseline original, **11 controles passaram e dois casos falharam**, exit 1: estado operacional incorreto e CTA elegível sem configuração privada. Após a correção, **13/13 passaram**, exit 0.

O primeiro lint identificou o binding `module`, proibido pela regra do Next. Apenas esse nome e sua referência foram renomeados para `loadedModule`. O QA repetiu o RED no código original: novamente 11 PASS/2 FAIL. As asserções permaneceram intactas. SHA-256 do teste final, usado no RED e GREEN: `0862e20e2d1892341b6fb45e1a90a7384d8f237ab57f77447826ee1b3dd39108`.

Os 13 casos cobrem configuração parcial/completa, ausência de configuração pública, curso instalado incompatível, permissões, vazamento no DTO, GET próprio sem writer, negativa anônima, escopo instalado, gate indisponível, revisão obsoleta, leitura falha e proteção final do writer. Funções reais são extraídas por AST e executadas em VM com fronteiras de I/O simuladas; não se apresenta isso como autenticação HTTP ou banco real.

| Executor e comando | Resultado |
| --- | --- |
| QA: `node --import tsx --test scripts/verify-interactive-availability.tsx` | RED 11/13, exit 1; GREEN 13/13, exit 0 |
| QA: `actions:verify` | 27 verificações, exit 0 |
| QA: `capabilities:verify` | 31 grupos / 44 capacidades, exit 0 |
| QA: `fase4:verify` | 33 verificações, exit 0 |
| QA e Lead: `interactive:segments:verify` | 59 verificações em cada execução, exit 0 |
| Lead: `node --import tsx scripts/check-architecture.ts` | Fronteiras, grafo e bindings aprovados, exit 0 |
| Lead: `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Exit 0; repetido após renomeação |
| Lead: `node node_modules/eslint/bin/eslint.js .` | Exit 0; zero erros e cinco avisos em auxiliares `.tmp` anteriores à correção |
| Lead: `node scripts/run-local-checkpoint.mjs build` | Exit 0; três pacotes compilados, 44 páginas/rotas |
| Lead: `node scripts/run-fase4-local.mjs verify` | 25 casos, Auth/MFA/RLS/SQL reais locais e handlers em VM; exit 0 |
| Lead: `node scripts/run-fase4-local.mjs browser` | Oito verificações HTTP/browser, cookies, persistência/reload e larguras 360/390; exit 0 |

Build, arquitetura e SQL usaram o mesmo código de produção final. A única diferença posterior nesses três arquivos foi o nome local no teste; GREEN, TypeScript e ESLint foram repetidos no teste final. Browser final: zero erros de runtime e zero requisições bloqueadas. SQL cobre isolamento de proprietário, escrita direta/RPC negada, MFA AAL1/AAL2, CAS, retry, escopo e provas por segmento.

## Isolamento, evidências e limites

Os runners protegidos conferiram Docker `desktop-linux`, daemon local e projeto `espanhol-plataform` antes de executar. API `127.0.0.1:54321`, banco `54322`, aplicação `127.0.0.1:3000`. Ambiente sem provedores externos; contas sintéticas retidas. Nenhuma migração, reset ou remoção de dados foi necessária.

Manifestos, RED/GREEN, comandos e saídas do Lead: `.tmp/r1p2/`; entrega independente: `.tmp/r1p2-qa/` no worktree QA. Artefatos ignorados não entram no commit. O relatório histórico `DESTRAVA_HOMOLOGACAO_PR_2.md` permanece preservado; seu parecer se refere ao head anterior.

Não foram repetidos todos os 22 gates da auditoria anterior nem as suítes completas I7/I8: a alteração não muda contratos, banco ou runtime instalado. Esses resultados anteriores não são apresentados como execução nova. Não foram certificados produção, Google/SMTP/Turnstile remotos, microfone, vozes, qualidade acústica, dispositivos físicos ou leitor de tela. O navegador utiliza emulação mobile/CDP. Não há comprovação nova de CI remota.

Pilotos pessoais ES/EN, conteúdo, migrações e contratos não fazem parte desta alteração. O merge Git continua separado de uma futura homologação/publicação operacional com cinco pacotes.

## Revisão e integração

O Lead implementou a condição; QA derivou e executou testes independentemente. Revisor examinou candidato congelado, sem implementar correções. Perfis canônicos explícitos e papéis nativos foram solicitados; leitura do Revisor foi fiscalizada por hashes, sem alegação de sandbox técnico separado.

Candidato de código **R1P2-C2**, digest da lista canônica de caminhos/SHA-256: `7fc6150b202f417f8b01b92972670c838ae6081eaeed9c139e8047eb55802696`. O manifesto final também inclui este relatório; hash do commit e confirmação do push serão informados na entrega Git após aprovação independente. A integração recomendada permanece merge commit pela PR, após aprovação do proprietário; sem rebase ou force-push.
