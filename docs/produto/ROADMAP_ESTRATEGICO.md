# Destrava — Roadmap estratégico do Learning Engine até o lançamento

> **Estado: ROADMAP ESTRATÉGICO (PR #4), política do laboratório (PR #5), auditoria ES-A1 (PR #7) e P0 documental (PR #8) integrados.** Baseline verificada em 23/10/2026: `main` `df17c5d8adeb337ac886876183194e946b446a8a`. O COM-0 foi realizado **somente por leitura do banco local**, com resultado `parcial/divergente`; ainda não houve composição do motor/piloto ou remodelagem da U2.

## 1. Objetivo e princípio

Transformar o Destrava em uma plataforma de aprendizagem multilíngue que **executa cursos independentes com segurança, evidência pedagógica confiável e personalização útil**, sem reescrever o motor para cada idioma.

O objetivo não é acumular funcionalidades declaradas; é fechar a distância entre implementação, integração no percurso real do aluno, qualidade e operação.

Três frentes relacionadas, mas distintas:

- **Destrava Learning Engine (este repositório):** contratos, importação/instalação, runtime, práticas, avaliações, recomendações, evidências, IA e interfaces.
- **Destrava Language Foundry (projeto independente):** pesquisa, desenho curricular, autoria, revisão linguística/pedagógica, proveniência e exportação de pacotes declarativos versionados. Não usa os tipos internos, banco ou UI do motor como contrato de produção.
- **Destrava Admin (futuro):** revisão, preview no executor real com progresso isolado, confiança/autorização, aprovação, ativação, publicação e rollback auditável.

O pacote público faz a fronteira: **o Foundry produz e atesta qualidade editorial; o motor valida requisitos técnicos e executa; o Admin governa a entrada operacional**. Metadados editoriais autodeclarados não substituem confiança e homologação.

## 2. Ponto atual — evidência versus autorização

- **Integrado à `main`:** Incrementos 1–8, Fase 4 Ciclo 1 (A1: disponibilidade contextual; B1: evidências independentes por segmento), correção R1P2 e metodologia Do Chat ao Commit. Há testes e homologações **locais** com limites, não certificação universal de produção.
- **Fase 4 Ciclo 2 — A2 + B2:** integrado à `main` pela PR #6, com QA/Revisor GO e jornadas locais verificadas nos limites do [relatório](../features/fase4-ciclo2/RELATORIO_IMPLEMENTACAO.md). Diagnóstico/pausa em curso instalado; narração bilíngue em aula compilada com voz simulada. Sem deploy ou certificação de dispositivos/voz física.
- **Cursos externos instalados:** caminho básico do aluno interoperável, com capacidades avançadas parcialmente integradas ou bloqueadas. Relatório do I8 e perfil de runtime distinguem `existe no motor` de `executa no instalado`.
- **Produção:** merges Git não realizam deploy nem migração de banco. Pilotos pessoais ES/EN e release Fly de cinco pacotes não equivalem à `main` com três fixtures compiladas. A homologação remota e a integração editorial são demandas separadas.

Estado dos 33 itens e das 44 capacidades: [Matriz de maturidade](MATRIZ_MATURIDADE_RECURSOS.md). Estado operacional breve: [Progresso do produto](../PROGRESSO_PRODUTO.md).

**Dogfooding contínuo do produto:** o curso pessoal ES-A1 (duas unidades) é o [laboratório vivo do Destrava](CURSO_LABORATORIO_ES_A1.md). Após marcos relevantes, auditar o recurso no caminho real do aluno, atualizar o curso quando útil/disponível, testar pedagogia e registrar limitações. O laboratório pessoal **já existe**; não confundi-lo com o piloto com alunos reais de M9. Não exigir segundo curso para preservar dados experimentais.

**Laboratório ES-A1 (23/10/2026):** [auditoria do acervo](../features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md), [direção editorial](../features/piloto-es-a1-pos-ciclo2/spec.md), [P0](../features/piloto-es-a1-pos-ciclo2/RELATORIO_P0.md), **[COM-0](../features/es-a1-composicao/RELATORIO_COM0.md)** e [plano técnico](../features/es-a1-composicao/plan.md). O acervo compilado conta 703 atividades, com distribuição pedagógica deficiente; a decisão é evoluir a U2 antes de U1. **P0 e COM-0 estão concluídos** nos limites relatados. O COM-0 encontrou schema local `parcial/divergente`, objeto reset com proveniência não rastreada e `TRUNCATE` excessivo; a sequência proposta agora é **COM-1 desenho estático → integração/QA por autorização → fatia U2 → restante U2/U1**. Sem autorização de implementação, migração ou publicação.

## 3. Fluxograma de evolução

~~~mermaid
flowchart TD
  BASE["Fundação integrada na main<br/>Incrementos 1-8 + F4 C1"]
  C2["F4 Ciclo 2 · INTEGRADO LOCALMENTE<br/>A2 sessões/diagnóstico<br/>B2 narração bilíngue"]
  GATE{"QA + Revisor<br/>Critérios e candidato aprovados?"}
  MERGE["PR funcional aprovada<br/>Merge na main — sem deploy implícito"]
  MAT["Atualizar matriz de maturidade<br/>e lacunas por ambiente"]
  LAB["LAB CONTÍNUO · ES-A1<br/>duas unidades reais, recursos atuais,<br/>limites explícitos e feedback"]
  CORE["Fechar integração pedagógica instalada<br/>SRS, erros, domínio e recomendações"]
  AI["Integrar IA e speech nos instalados<br/>Tutoria, escrita, conversação, STT"]
  CLASS["Aula Particular amadurecida<br/>Voz, intervenção, adaptação,<br/>mídia e memória longitudinal"]
  CLASSINST["Aula Particular nos cursos instalados<br/>contratos/segurança/evidências"]
  FOUNDRY["Language Foundry<br/>produção e revisão editorial"]
  ADMIN["Admin<br/>preview, confiança, publicação e rollback"]
  UX["Reformulação visual completa<br/>Design system + UX/UI"]
  RELEASE["Homologação pré-lançamento<br/>acessibilidade, performance,<br/>segurança, IA e ambiente real"]
  PILOT["Piloto controlado com alunos reais"]

  BASE --> C2 --> GATE
  GATE -->|AJUSTES| C2
  GATE -->|GO e autorização| MERGE --> MAT
  MAT --> LAB
  MAT --> CORE --> AI
  MAT --> CLASS
  CLASS --> CLASSINST
  AI --> CLASSINST
  CORE -. "atualizar quando compatível" .-> LAB
  AI -. "atualizar quando compatível" .-> LAB
  CLASS -. "atualizar quando compatível" .-> LAB
  MAT --> FOUNDRY
  FOUNDRY --> ADMIN
  CLASSINST --> ADMIN
  ADMIN --> UX --> RELEASE --> PILOT
~~~

**O diagrama indica dependências predominantes, não um cronograma rígido.** Foundry, avaliação de IA, design system base e ajustes de usabilidade podem avançar em paralelo. Uma integração mínima segura da Aula Particular pode ser homologada antes de toda a visão avançada, desde que o recorte seja explicitado. Nenhum bloco futuro autoriza trabalho sem spec, aceite e aprovação próprios.

O bloco **LAB CONTÍNUO ES-A1** representa uso pessoal **a partir do motor atual**, não um novo ambiente nem um marco que só começa no lançamento. A cada recurso integrado e compatível, revisar a cobertura do curso e detectar lacunas editoriais. Bloqueios como a Aula Particular em curso instalado devem permanecer honestos; experiência pessoal de curso compilado e execução instalada são verificadas separadamente. **A2/B2 já foram integrados na PR #6**; a auditoria/revisão real das duas unidades é a próxima proposta [spec ES-A1](../features/piloto-es-a1-pos-ciclo2/spec.md), ainda não autorizada para execução.

## 4. Marcos, objetivos e critérios de saída

| Marco | Trabalho principal | Condição para considerar atendido | Status |
| --- | --- | --- | --- |
| **M0 — Fundação** | Contratos, capacidades, versões, importação, instalação, progresso e avaliação no fluxo básico | Incrementos 1–8 + F4 C1 na main com limites locais documentados | **Integrado no recorte comprovado** |
| **M1 — Jornada confiável (A2/B2)** | Pausar/retomar e diagnosticar em cursos instalados; apoio/alvo e controle de TTS na Aula Particular compilada | A2-01…08 e B2-01…07 com evidências locais, QA/Revisor GO, PR #6 integrada | **Integrado na main e homologado localmente; produção/dispositivos físicos pendentes** |
| **M2 — Matriz viva** | Catalogar cada recurso com implementação, integração, homologação e operação | Matriz atualizada após cada entrega, com código/hash, ambiente e lacunas | **Matriz documental integrada na PR #4; extensão ES-A1 em revisão na PR #5** |
| **M3 — Núcleo pedagógico instalado** | Evidências, revisão espaçada, domínio, erros e recomendações completas no instalado | Correção e persistência privada verificadas por curso/versão, sem recomendar ação inexistente | **Futuro a especificar** |
| **M4 — IA e fala instaladas** | Tutor/feedback de escrita, conversação, missões, gravação, STT e pronúncia | Guards/versionamento/cotas, autorização, evals, teste local e provedores verificados separadamente | **Futuro a especificar** |
| **M5 — Aula Particular aprofundada** | Intervenções, voz por turno, adaptação pedagógica, mídia própria, memória e acompanhamento pós-aula | Aula realmente ensina e responde com evidência; não confundir evento com domínio; validação pedagógica e audiovisual | **Visão parcialmente implementada; ciclos futuros** |
| **M6 — Aula instalada** | Reusar a Aula Particular em pacotes externos versionados | Segmentos/ativos/versionamento, guards, checkpoints e progresso compatíveis no caminho instalado | **Não integrada no perfil I8** |
| **M7 — Foundry + Admin operacional** | Autoria e revisão independente, preview, confiança no produtor, publicação/ativação/rollback | Aprovação humana auditável e contrato interoperável; sem autoridade editorial no motor | **Futuro; Foundry é projeto separado** |
| **M8 — Experiência visual** | Design system, consistência visual, layout, hierarquia, responsividade e jornadas do aluno | Auditoria autenticada de telas, testes com usuários e acessibilidade; sem comprometer fluxos estabilizados | **Reformulação global planejada para pré-lançamento** |
| **M9 — Preparação e piloto** | Segurança/privacidade, banco/release, observabilidade, QA em dispositivos, custos, conteúdo aprovado e piloto | Gates operacionais e editoriais, autorização de deploy e acompanhamento de aprendizagem/erros reais | **Futuro** |

**Ordem após M1:** antes de abrir uma nova spec, rever a matriz real e escolher uma fatia vertical de maior impacto. M3–M6 podem ser divididos/reordenados por dependências comprovadas; evitar um projeto infinito de “completar tudo” antes de testar o produto.

## 5. Decisão sobre visual e experiência do site

O proprietário relatou **apresentação visual desorganizada**. Esta é uma observação de produto; **não houve auditoria visual autenticada** nesta revisão documental.

Duas classes, com agendas distintas:

1. **UX/funcionalidade obrigatória, contínua:** navegação, CTA disponível, formulários utilizáveis, mensagens de erro/estado, foco/teclado, responsividade mínima, acessibilidade essencial e overflow que atrapalhe o aluno. Corrigir dentro do ciclo onde a falha for demonstrada, sem esperar M8.
2. **Redesign global e acabamento (M8):** identidade visual, tipografia, cores, espaçamento, componentes compartilhados, ritmo das páginas, ilustrações, transições e refinamento geral. Executar uma **auditoria visual por tela primeiro**, criar/ajustar design system enxuto e então reformular de maneira coerente, quando fluxos pedagógicos principais estiverem mais estáveis e **antes** do piloto real.

**Não redesenhar quinze telas independentemente.** A implementação visual deve usar componentes/tokens reutilizáveis e critérios de aceitação por jornada. Acessibilidade crítica, legibilidade, performance percebida e navegação não são “polimento final”.

## 6. Aula Particular não está pronta apenas porque seu MVP existe

Hoje há contrato, máquina de estados, timeline, quadro, intervenções, professor contextual em texto, sessão e evidências B1. O roadmap de Aula Particular é maior: interação por voz, adaptação pedagógica, mídia final/autoria, memória, relatórios, qualidade da IA, integração instalada e eventualmente avatar. O B2 resolve **narração bilíngue controlada**, não todas essas metas. Avatar/realtime e Course Factory não são pré-condições automáticas para um primeiro piloto.

Consultar [Matriz de maturidade — Aula Particular](MATRIZ_MATURIDADE_RECURSOS.md#aula-particular-interativa--decomposição-de-maturidade) e [roadmap específico](../../DESTRAVA_ROADMAP_AULA_PARTICULAR_INTERATIVA.md).

## 7. Gates transversais de cada ciclo

- **Descoberta:** comparar problema com código/contratos existentes; distinguir bug, lacuna de integração e recurso genuinamente novo.
- **Spec no GitHub:** objetivo, invariantes, casos negativos, riscos, aceite, STOP, alternativas; PR documental aprovada antes do handoff.
- **Execução:** Lead coordena implementadores em worktrees isoladas, QA independente e Revisor em candidato congelado. Nenhum agente toma decisão de produto relevante em silêncio.
- **Qualidade:** testes por impacto + invariantes de auth/MFA/RLS, isolamento conta/curso/versão, concorrência/CAS, erros/retries; identificar SQL real local, VM, browser emulado, dispositivo físico e provedores reais separadamente.
- **IA:** evals pedagógicos com conjuntos versionados e revisão humana em cenários sensíveis; traces, custos, limites, latência e privacidade. Não inferir nota oficial por produção livre ou áudio entregue.
- **Operação:** merge Git, migração remota, deploy, publicação editorial e lançamento são autorizações **independentes**.
- **Atualização:** registrar código/candidato, escopo, evidências, gaps e status por ambiente na matriz e [Progresso](../PROGRESSO_PRODUTO.md); não reescrever relatórios históricos.

## 8. O que permanece fora desta PR

Esta PR **somente registra a direção estratégica e o inventário**. Não implementa A2/B2, não altera UI, contrato, runtime ou migração, não promove recurso instalado, não concilia pilotos pessoais, não cria o Admin, não mexe no Foundry e **não autoriza merge desta própria PR**, deploy, reset, operações pagas ou ações remotas.
