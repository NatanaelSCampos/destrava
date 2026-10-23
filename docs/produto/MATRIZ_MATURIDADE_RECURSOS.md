# Destrava — Matriz de maturidade de recursos

> **Baseline documental para revisão, 23/10/2026.** Não é uma reexecução de 33 recursos em navegador/produção. O status do motor foi extraído da auditoria funcional de 04/10/2026; integração instalada foi confrontada com o I8, o perfil gerado de 44 capacidades e o F4-C1. A2/B2 foram autorizados, mas sua conclusão não foi comprovada no GitHub nesta consulta.

## 1. Como interpretar um status

Um único rótulo `implementado` não basta para dizer `pronto para aluno real`. Para cada recurso, controlar separadamente:

1. **Motor / código:** implementação completa no fluxo original, parcial, pendente ou adiada.
2. **Integração no curso instalado:** executa com dados/versão/evidências do pacote externo, bloqueada ou parcialmente integrada.
3. **Homologação:** testes puros/VM, SQL local, HTTP/navegador, dispositivos físicos, provedores reais e revisão editorial/qualidade de IA, cada qual com data/candidato.
4. **Operação real:** dependências configuradas e saudáveis, permissão, cotas, esquema remoto, publicação e suporte efetivo ao usuário.
5. **Cobertura no curso laboratório pessoal ES-A1:** recurso acessível e útil nas duas unidades, disponível com limites, bloqueado com causa explícita, não pertinente com justificativa ou ainda não auditado. A nova [política permanente](CURSO_LABORATORIO_ES_A1.md) estabelece auditoria após marcos relevantes; **não inferir cobertura atual dos arquivos pessoais pela fixture da `main`**.

Nunca promover o status em uma dimensão por evidência de outra. A matriz registra o *melhor estado comprovado nas fontes referidas*, não um SLA nem homologação de produção.

## 2. Recortes quantitativos que não devem ser confundidos

| Fonte | Resultado e interpretação |
| --- | --- |
| Roadmap funcional histórico — 33 itens | **22 implementados** no escopo do fluxo original; **8 parciais**; **1 pendente** (AI Bridge), **1 adiado** (oral oficial), **1 em andamento** (governança). Soma de categorias, **não porcentagem de conclusão do produto**. |
| Registro técnico I8 — 44 capacidades | **29 implementadas e integradas**, **14 implementadas mas não integradas** e **1 parcial e não integrada** no perfil de execução de cursos externos. Inclui capacidades internas e dependências; **não são 44 features de aluno**. |
| Perfil operacional | `productionReady=false`, ambiente de homologação local; saúde dos serviços/voz varia em execução. |
| A2/B2 | Especificação aprovada e implementação autorizada em conversa; **sem evidência de conclusão funcional/PR** neste levantamento. |

### Instalações: capacidades explicitamente não integradas no perfil I8

`activity.speaking`, `review.spaced`, `lesson.interactive`, `speech.recording`, `media.presentation`, `speech.recognition`, `speech.pronunciation`, `ai.writing_feedback`, `ai.conversation`, `ai.conversation_mission`, `ai.micro_lesson`, `ai.tutor`, `ai.image_description`, `ai.interactive_support` e `numbers.dictation` (a única parcial no registro).

Atividade `activity.review` integrada **não significa** `review.spaced` integrado. `assessment.adaptive` aparece integrada tecnicamente, mas a jornada completa de diagnóstico instalado é precisamente lacuna a homologar em A2.

## 3. Inventário dos 33 recursos pedagógicos

| # | Recurso | Status histórico no motor | Caminho externo instalado (baseline I8/F4) | Lacuna ou condição principal |
| ---: | --- | --- | --- | --- |
| 1 | Perfil de domínio | Implementado | Parcial: dados objetivos integrados; sinais avançados não completos | Evidência por usuário/curso e competência; não atribuir nota sem avaliação |
| 2 | Motor adaptativo | Implementado | Parcial: só recomenda ações elegíveis | A1 limita CTAs; SRS/IA/voz instalados ainda ausentes |
| 3 | Treinar minhas dificuldades | Implementado | Parcial: prática básica, sem integrações opcionais bloqueadas | Plano deve oferecer alternativas realmente executáveis |
| 4 | Sessões rápidas por tempo | Implementado | Parcial: ciclo completo/reload instalado em A2 | Validar plano, timer, pausa, idempotência e nova leitura |
| 5 | Caderno automático de erros | Implementado | Parcial: evidências objetivas; ciclo de review completo pendente | Separar histórico projetado de revisão espaçada |
| 6 | Revisão espaçada unificada | Implementado | **Bloqueada no instalado**: `review.spaced` | Depende de evidência privada e agendamento/recuperação de review |
| 7 | Dicionário contextual | Implementado | Consulta lexical integrada; domínio/review parcial | Não igualar consulta à integração de aprendizagem |
| 8 | Números ativos | Implementado no fluxo original; dictation parcial no registro | Catálogo integrado; `numbers.dictation` bloqueado | ASCII/moeda/ordinais têm limitações; fala não integrada |
| 9 | Particularidades regionais | Implementado | Módulo de exibição integrado; cobertura editorial parcial | Idioma/variante configuráveis, não universalmente homologados |
| 10 | Shadowing | Parcial | **Bloqueado no instalado** enquanto speaking/avaliação não integrados | Sem ritmo/prosódia contínuos certificados |
| 11 | Fale sem ler | Implementado no original | Dependente de fala/avaliação, bloqueada no instalado | Produção própria não recebe nota oficial inventada |
| 12 | Flashcards ligados ao domínio | Implementado | Atividade flashcard integrada; SRS privado bloqueado | `activity.flashcard` != `review.spaced` |
| 13 | Explicar imagem | Parcial | IA de descrição bloqueada no instalado | Cenas e fatos curados não são análise geral de pixels |
| 14 | Missões comunicativas | Implementado no original | IA de missão bloqueada no instalado | Objetivo com citação de evidência; requer eval de semântica |
| 15 | Role-play com IA | Implementado no original | Conversação/IA bloqueadas no instalado | Cenários originais; qualidade conversacional requer eval |
| 16 | Conversação livre adaptativa | Implementado no original | `ai.conversation` bloqueada no instalado | Feedback qualitativo; sem nota oficial automática |
| 17 | Tutor persistente | Implementado no original | `ai.tutor` bloqueado no instalado | Contexto curto/persistência existe no fluxo original; falta eval |
| 18 | Microlição a partir dos erros | Implementado no original | `ai.micro_lesson` bloqueada no instalado | Baseada em erro real; não inventar avaliação automática |
| 19 | Memória ativa de comportamento | Implementado | Parcial: sinais de IA/voz instalados não completos | Sinais orientam recomendações, não substituem provas |
| 20 | Evolução por tentativa | Parcial | Parcial: tentativas objetivas; fala livre não integrada | Séries numéricas exigem evidência comparável |
| 21 | Três modos de conversa | Parcial | Fluxos de conversação instalados bloqueados | Avaliação oral oficial é decisão separada |
| 22 | Prova adaptativa escrita/objetiva | Implementado | Capacidade integrada; jornada real A2 pendente | Final fixa I8 não comprova diagnóstico adaptativo no browser |
| 23 | Relatório por competências | Implementado | Parcial: depende de diagnóstico instalado validado | Amostra insuficiente não vira domínio certificado |
| 24 | Feedback pós-avaliação | Implementado | Parcial: erro básico sim; `review.spaced` bloqueado | Feedback não implica agendamento de revisão instalada |
| 25 | Avaliação oral conversacional oficial | Adiado / em análise | Não integrado/não aprovado | Apenas decisão futura; sem score oficial |
| 26 | AI Bridge | Pendente | Não implementado | Exportação/importação de prática com outras IAs |
| 27 | Ritmo de conversa por nível | Parcial | Conversa por IA instalada bloqueada | Falta calibração por nível, voz e dispositivo |
| 28 | Controle de correção nas conversas | Parcial | Conversa por IA instalada bloqueada | Há modos configuráveis no original; faltam evals de consistência |
| 29 | Perfil regional | Parcial | Configuração/variantes integradas; qualidade de voz variável | Disponibilidade de locales é operacional e específica |
| 30 | O que preciso melhorar? | Implementado | Parcial: somente caminhos instalados elegíveis | Recomendações devem mostrar bloqueios/alternativas reais |
| 31 | Regra geral de IA | Parcial | Operações de IA bloqueadas no instalado | Provider/guards existentes não provam qualidade, custos ou readiness |
| 32 | Telemetria pedagógica | Implementado | Parcial: eventos básicos, sinais avançados limitados | Não confundir analytics de runtime com provas de aprendizagem |
| 33 | Regras para todas as features | Em andamento (processo) | Não é capacidade pedagógica instalada | Do Chat ao Commit adotado; cada feature ainda requer gates |

### Leitura dos estados

- **Motor implementado:** atendimento ao escopo descrito na auditoria funcional datada; não equivale à visão final, integração instalada ou qualidade editorial/acústica.
- **Motor parcial:** existe um fluxo utilizável com lacunas concretas.
- **Bloqueada no instalado:** não anunciar como elegível apenas porque a capacidade está no registro do motor. A aplicação deve usar o gate de disponibilidade.
- **Pendente/adiado:** não afirmar existência da versão definitiva. Status de processo (item 33) é transversal, não uma atividade.

## Aula Particular Interativa — decomposição de maturidade

A Aula Particular **não é um único botão de “implementada”**. O objetivo descrito no [roadmap especializado](../../DESTRAVA_ROADMAP_AULA_PARTICULAR_INTERATIVA.md) é uma professora capaz de apresentar, escutar, interromper, explicar de outra maneira, praticar, adaptar e registrar aprendizagem.

| Dimensão | Estado comprovado na `main` | O que ainda separa da visão |
| --- | --- | --- |
| Definição de aula/segmentos e runtime | **MVP implementado** | Cobertura editorial ampliada e condições reais de uso |
| Timeline, quadro, slides e player | **MVP implementado** | Mídia própria sincronizada, alinhamento e experiência final |
| Intervenções e professor contextual em texto | **Base implementada** | Qualidade de explicação, turnos orais, follow-up, personalização e evals |
| Checkpoints e evidências por segmento | **B1 integrado e homologado localmente** | Não confundir submissão de fala/áudio com nota acústica; validação em dispositivos reais |
| Idioma de apoio/alvo e voz controlada | **B2 autorizado, ainda sem entrega verificada** | Troca correta de vozes, pausa/cancelamento, callbacks, fallback e browser |
| Adaptação pedagógica profunda | **Parcial (reforço determinístico)** | AdaptationEngine contextual por evidência e políticas verificáveis |
| Perguntas por voz e feedback acústico da aula | **Fluxo final não homologado** | STT, TTS por trecho, turn-taking, retomada, pontuação só quando confiável |
| Mídia final, avatar e realtime | **Não implementado no objetivo final** | Conteúdo próprio/licenciado, alinhamento; avatar/realtime são **opcionais**, não requisito de MVP |
| Pipeline avançado de autoria / Lesson Studio | **Não implementado** | Script, quadro, cues, revisão, preview e editor integrados ao Foundry/Admin |
| Memória longitudinal, relatório pós-aula | **Parcial / futuro** | Integrar resultados a mastery, mistakes, review e recomendações com proveniência |
| Aula Particular em curso externo instalado | **Não integrada no perfil I8** | Ativos/segmentos/versionSession/guard e progresso no instalado |
| Experiência visual e acessibilidade da sala | **MVP / homologação parcial** | Dispositivo físico, microfone, leitores de tela, voz e revisão de UX |

**Conclusão:** o MVP técnico existe. O B2 resolve narração bilíngue, **não** a Aula Particular ideal. A evolução depende de qualidade pedagógica, voz, adaptação e integração do runtime; avatar não é prioridade automática.

## 4. Rotina de manutenção da matriz

- Atualizar somente com commit/PR/candidato, teste realmente executado e ambiente. Fonte do runtime instalado: `src/domain/installed-study/compatibility.ts` e perfil gerado `contracts/package-v1/installed-runtime.json`; não editar o perfil gerado manualmente para simular integração.
- Quando A2/B2 terminarem, atualizar suas linhas afetadas, a decomposição da Aula Particular e [Progresso](../PROGRESSO_PRODUTO.md).
- Recursos dependentes de IA exigem **evals**, observabilidade/custo e teste sem fabricação de score; recursos de fala exigem testes de áudio/voz/acústica além da tela.
- Distinguir disponibilidade de configuração (`unknown` / `unavailable`), compatibilidade curricular, permissões e implementação.
- Pilotos ES/EN são experimentais; o Foundry precisa homologar o conteúdo independentemente do código do motor.

## 5. Fontes e escopo da verificação

- [Roadmap dos 33 recursos — auditoria 04/10](../../DESTRAVA_ROADMAP_RECURSOS_APRENDIZADO.md)
- [Registro técnico e matriz funcional do I8](../../DESTRAVA_RUNTIME_INCREMENTO_8.md)
- [Perfil I8 de capacidade instalada](../../contracts/package-v1/installed-runtime.json)
- [Fase 4 Ciclo 1 — A1/B1](../../DESTRAVA_FASE4_CICLO1.md)
- [MVP da Aula Particular](../../DESTRAVA_IMPLEMENTACAO_AULA_PARTICULAR_INTERATIVA_MVP.md)
- [Roadmap amplo da Aula Particular](../../DESTRAVA_ROADMAP_AULA_PARTICULAR_INTERATIVA.md)
- [Especificação A2/B2](../features/fase4-ciclo2/spec.md)

Esta PR realizou **inspeção documental e leitura de GitHub**, não testes de produto, não auditoria visual autenticada, não QA real com dispositivo, nem homologação de servidor, Fly, Supabase remoto ou qualidade pedagógica. Novos dados prevalecem sobre este snapshot quando forem verificados e incorporados por PR.
