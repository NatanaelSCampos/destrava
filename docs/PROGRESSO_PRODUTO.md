# Destrava — progresso do produto e desenvolvimento

**Atualizado em 23/10/2026. Distinguir Git verificado, evidência histórica e proposta.**

## Baseline oficial

- **`origin/main` verificada em 23/10/2026:** `df17c5d8adeb337ac886876183194e946b446a8a`, merge **PR #8 (P0 documental)**, após PR #7 (auditoria/acervo ES-A1), PR #5 (política) e PR #6 (A2/B2). A árvore funcional A2/B2 foi homologada localmente no candidato `e780e56e95d4462aac556b17f5039af3dde70a9f`; os merges documentais não equivalem a deploy.
- O Ciclo 2 tem **QA/Revisor GO e homologação local** relatados em [implementação](features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md). CI remoto, vozes reais, dispositivos físicos, produção e bootstrap limpo não foram certificados por esse merge.
- Pilotos pessoais ES/EN, worktrees e pendências históricas permanecem separados. [Relatório de preparação](features/fase4-ciclo2/RELATORIO_EXECUCAO.md). Esta reconciliação de GitHub **não inspecionou os worktrees Windows**.

## Concluído conforme commits/relatórios

- Incrementos 1–8: contratos, avaliações, políticas, capacidades, texto/variantes, importação, instalações/versionamento e interoperabilidade básica.
- Estrutura multiagente canônica e [Do Chat ao Commit](DO_CHAT_AO_COMMIT.md), sem outra plataforma.
- Fase 4 Ciclo 1 A1: disponibilidade contextual; B1: evidências/checkpoints por segmento e mobile. Evidência histórica QA 33, SQL 25 e browser oito, com limites no [relatório F4](../DESTRAVA_FASE4_CICLO1.md).
- R1P2 em `18a67c5`, incorporado pela PR #2: ausência de chave privada bloqueia aula; configuração completa continua condicional. [Relatório](features/pr2-r1p2/RELATORIO_EXECUCAO.md).
- Merge integrou código na main, sem homologar Fly/banco remoto/bootstrap exato/pilotos. Release de cinco pacotes continua separada.

## Ciclo 2 — implementação e homologação local

[Spec](features/fase4-ciclo2/spec.md), [plan](features/fase4-ciclo2/plan.md), [tasks](features/fase4-ciclo2/tasks.md) e [roteiro](features/fase4-ciclo2/ROTEIRO_TAREFA.md): **seis decisões aprovadas e execução autorizada expressamente em 23/10/2026:**

- A2: sessões pedagógicas e diagnóstico adaptativo real, pausa explícita+automática, recuperação de sessão/plano/etapa/tempo confirmados e respostas submetidas. Sem rascunhos incompletos ou novo diagnóstico fixo.
- B2: apoio/alvo pelo curso, TTS por ação do aluno, uma reprodução ativa, mídia pausada e retomada por frase/âncora, fallback textual e provas B1 preservadas; sem realtime/avatar/avaliação acústica.
- A2/B2 implementados e testes locais concluídos: [relatório funcional](features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md), QA/Revisor GO no recorte local; **PR funcional #6 integrada na main**, sem publicação operacional.

## Laboratório ES-A1 — descoberta concluída e decisão editorial

- **Auditoria estática Codex recebida** em 23/10/2026: [relatório de descoberta](features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md); curso compilado pessoal `espanhol-a1-pessoal` `0.1.0`/`1.5`, 703 atividades, 119 lições, 21 roteiros de Aula Particular. A U2 tem 78 múltiplas escolhas antes da primeira lacuna. **Esses números vêm do relatório local, não foram recontados na `main`.**
- **Decisão ESLAB-D01 aprovada:** evoluir o acervo existente e reorganizar profundamente o percurso, **U2 primeiro**; preservar exemplos/gabaritos válidos e melhorar explicação recuperável, feedback específico e avaliação.
- **STOPs relatados para integrar piloto e motor:** duas migrações diferentes compartilham `20261022000100`; proteção de geração/reset do piloto pode divergir do escritor privado B1. São riscos de composição **não homologados em banco**.
- A versão atualmente selecionada pelo aluno no Fly/Supabase remoto, as vozes físicas e o resultado no navegador **não foram verificados na auditoria**. Nenhuma implementação/alteração de curso decorre do registro.

## P0 — Reconciliação técnica de leitura concluída

- O **Codex Lead entregou o [relatório P0](features/piloto-es-a1-pos-ciclo2/RELATORIO_P0.md)** sobre composição do curso pessoal compilado ES/EN com motor atual: parecer **PLANO SUFICIENTE** para **desenhar** integração, QA/Revisor favoráveis à lógica. **Nenhum SQL, login, browser, build, acesso Fly/Supabase ou teste funcional da composição foi executado**.
- **Migração `20261022000100` duplicada:** arquivos distintos de geração/reset e B1. O P0 **não** acessou SQL; a inspeção **COM-0 posterior** examinou metadados do banco local e encontrou os dois conjuntos de objetos presentes, somente B1 registrado no histórico, constraint divergente; sem verificar origem da geração.
- **Geração e B1:** writer privilegiado e atalho HTTP de recibo devem respeitar a mesma trava de usuário, geração e escopo versionado; leitura/replay/cache e dados privados I8 também. Hash B1 inclui pacote inteiro: editar U2 pode mudar o hash de aula U1.
- Preservação relatada pelo Codex de **20 worktrees / 249 pendências** e ES/EN, sem escrita; arquivos ignorados não integralmente inventariados. É fotografia histórica, não garantia automática no próximo ciclo.
- **Registro documental em revisão:** [spec de composição](features/es-a1-composicao/spec.md), [plano](features/es-a1-composicao/plan.md), [tarefas](features/es-a1-composicao/tasks.md) e [roteiro](features/es-a1-composicao/ROTEIRO_TAREFA.md). **Nenhuma implementação, inspeção operacional de banco ou migração autorizada por esta PR.**

## COM-0 — banco local conferido, estado parcial/divergente

- [**Relatório COM-0**](features/es-a1-composicao/RELATORIO_COM0.md), recebido em 23/10/2026: Codex confirmou o projeto local `espanhol-plataform`, PostgreSQL 17.11, porta 54322/contêiner guardado, em **21 SELECT de metadados, 5 transações `REPEATABLE READ READ ONLY` finalizadas com `ROLLBACK`**. Nenhum dado pessoal consultado, nenhuma alteração executada; resultados SQL brutos não foram anexados e não foram reproduzidos pelo ChatGPT.
- **Classificação `parcial/divergente`:** 20 registros históricos; `20261022000100` consta como `interactive_segment_evidence` (B1) com 12 statements, mas **objetos de geração/reset também existem sem versão correspondente no histórico**. Proveniência e ordem de aplicação permanecem indeterminadas.
- **Constraint de geração diferente:** banco só exige `generation >= 0`; migração piloto também exige teto `9007199254740991`. A distribuição de valores não foi consultada e exige autorização **separada** para leitura agregada.
- **Segurança prioritária:** `anon`/`authenticated` têm privilégio `TRUNCATE` em sessões interativas; RLS não governa esse privilégio. Planejar revogação/testes, **sem alegar exploração HTTP**. Writers privilegiados B1/I7/I8 não verificam geração; precisam de lock/escopo transacional compatível antes da composição.
- **Rede:** binding Docker da porta em `0.0.0.0` e `::`; a inspeção foi local e **não** testou exposição externa. Avaliar restrição em autorização operacional futura.
- **Conclusão:** COM-0 foi encerrado sob autorização de leitura **já consumida**, sem implementação, SQL modificador, testes autenticados/browser nem verificação Fly/Supabase remoto. A U2 pessoal não foi alterada.

## Próximos marcos

1. **PR documental COM-0:** registrar o [relatório](features/es-a1-composicao/RELATORIO_COM0.md) e atualizar [spec](features/es-a1-composicao/spec.md), [plano](features/es-a1-composicao/plan.md) e [tarefas](features/es-a1-composicao/tasks.md). Merge exige aprovação separada; **sem código/migração**.
2. **COM-1 recomendado, ainda não autorizado:** projeto técnico **estático, sem banco** da convergência `parcial/divergente`, geração/lock B1, versão de sessões, grants `TRUNCATE`, história e dados legados. Novas consultas agregadas exigem permissão própria, não herdada do COM-0.
3. **COM-2/3 futuros:** após especificação/revisão/autorizações individuais, implementação isolada, QA/Revisor e PR funcional distinta; alterações de SQL, Storage, grants, Docker, redes, worktrees e testes escritores requerem permissão delimitada.
4. **P1 pedagógica:** somente após integração segura, fatia U2 de quantificadores/ajuda recuperável/feedback contextual, depois U2 e U1; publicar em Fly/Supabase somente com autorização operacional específica.

## Norte estratégico registrado

- **Política decidida pelo proprietário (23/10/2026):** o curso pessoal ES-A1 de duas unidades é o [laboratório vivo do Destrava](produto/CURSO_LABORATORIO_ES_A1.md). O melhor conjunto realmente disponível e pertinente deve ser oferecido; limitações e ausências, justificadas. Não exigir segundo curso pessoal para preservar histórico experimental.
- **Decisão de direção aprovada:** [evoluir acervo após a auditoria](features/piloto-es-a1-pos-ciclo2/spec.md), com [plano por fases](features/piloto-es-a1-pos-ciclo2/plan.md). Implementação, SQL e deploy não foram autorizados.


- [Roadmap até piloto/lançamento](produto/ROADMAP_ESTRATEGICO.md): consolidação pedagógica instalada, IA/voz, Aula Particular aprofundada, Foundry/Admin, UI/UX e piloto.
- [Matriz de maturidade](produto/MATRIZ_MATURIDADE_RECURSOS.md): 33 recursos pedagógicos (auditoria histórica) versus 44 capacidades técnicas do perfil instalado. O status desta matriz é **baseline documental para revisão**, não homologação nova.
- **Decisão de priorização visual:** corrigir UX bloqueante/essencial a cada ciclo; reservar redesign completo e design system consolidado para o marco pré-lançamento, com auditoria por telas antes de implementar.

## Restrições persistentes

Foundry produz/aprova conteúdo; motor valida/importa/executa contrato público. Preservar pilotos ES/EN e pendências. Não ampliar suporte instalado de IA/voz/SRS/aula por inferência. Auth/MFA, identidade/versão, segredos e leitura antes de escrita são obrigatórios. Serviços são coordenados; migrações/exclusões/pago/release dependem de autorização própria.
