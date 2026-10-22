# Destrava Engenharia Multiagente

Este é o procedimento canônico de coordenação do projeto. A equipe usa as ferramentas nativas do Codex, quatro papéis, worktrees para escrita paralela e integração central pelo Lead. A arquitetura pedagógica e os contratos permanecem nos documentos existentes.

## Papéis e perfis

| Papel | Perfil | Responsabilidade |
| --- | --- | --- |
| Lead | `.codex/agents/lead.toml` | Planejamento, dependências, delegação, integração e comunicação com o usuário. |
| Implementador | `.codex/agents/implementador.toml` | Desenvolvimento delimitado e testes pertinentes. |
| QA | `.codex/agents/qa.toml` | Testes derivados dos requisitos, cenários negativos e verificação do candidato. |
| Revisor | `.codex/agents/revisor.toml` | Revisão independente de arquitetura, segurança e integridade; sem escritas. |

Não criar especialistas adicionais ou subdelegar sem necessidade aprovada. Os modelos herdam a configuração do Lead; esta implantação não introduz mudanças de modelo ou API paga.

O formato de perfil por projeto segue a [documentação oficial de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents): `name`, `description` e `developer_instructions`. A configuração do Revisor solicita `sandbox_mode = "read-only"`. Overrides do runtime podem prevalecer sobre configurações do arquivo; não inferir permissões do nome do papel.

## Carregamento de perfis

O Lead deve verificar a interface de delegação disponível em cada sessão. Quando houver `agent_type`, solicite o papel nativo e registre o argumento utilizado. Esse argumento não comprova por si só qual arquivo TOML foi carregado, o cwd efetivo ou as permissões de sandbox.

Quando a seleção não estiver disponível ou o carregamento não puder ser comprovado, o Lead lê o perfil canônico e inclui suas instruções no briefing do subagente, usando `fork_turns="none"` para delimitar contexto. O especialista confirma marcador, papel e restrições antes de escrever. Esse modo é **carregamento explícito pelo Lead**, não prova de seleção automática do TOML pelo runtime. Não criar um servidor ou orquestrador próprio para simular suporte ausente.

Na retomada do I8, a interface passou a expor `agent_type`; foram solicitados `qa` e `revisor`, com contexto inicial vazio e as instruções canônicas também fornecidas explicitamente. As ferramentas não ofereceram isolamento adicional por cwd ou override de sandbox nessa chamada; workdir, ownership e fiscalização de hashes continuaram obrigatórios. Essa evidência atualiza o diagnóstico histórico do piloto inicial, sem atribuir retroativamente essas opções às chamadas anteriores.

A política de leitura do Revisor, quando não houver garantia técnica de sandbox, é homologada por candidato congelado, comandos sem escrita e comparação de hashes/status antes e depois. Isso detecta alterações e fiscaliza o procedimento; não equivale a uma barreira de segurança contra um agente malicioso.

## Briefing obrigatório

Cada delegação inclui:

1. Identificação e objetivo da tarefa.
2. Critérios de aceitação definidos antes da implementação.
3. Baseline e identificação/hash do candidato.
4. Worktree e `workdir` absoluto para todos os comandos.
5. Documentos/contratos relevantes e perfil aplicado.
6. Arquivos que podem ser examinados ou alterados.
7. Restrições, autorizações e dependências.
8. Testes esperados, ambiente e coordenação de recursos.
9. Formato da entrega e destino das evidências.

Forneça somente o contexto necessário, mas nunca omita restrições. Use links/caminhos para documentação canônica, em vez de copiar contratos completos para cada perfil.

## Entrega obrigatória

O especialista responde ao Lead em dez campos: `taskId`, `baseline`, `files`, `decisions`, `tests`, `results`, `limitations`, `artifacts`, `blockers`, `recommendations`. Informe exit codes e candidato examinado. Os artefatos devem incluir arquivos novos e hashes; resultado verbal sem evidência não basta.

Comunicação usa `spawn_agent`, `send_message`, `followup_task`, `list_agents`, `wait_agent` e `interrupt_agent`. O Lead consolida resultados e divergências. Mensagens entre especialistas só alteram escopo após decisão do Lead.

## Isolamento e recursos

Worktrees ficam fora da árvore TypeScript/ESLint do checkout principal. Cada uma usa branch própria a partir de baseline explícita. Não compartilhar `node_modules`, caches, `.next` ou arquivos de ambiente por links para fazer isolamento aparente.

A raiz de escrita autorizada inicialmente é o checkout principal. Operações no diretório irmão precisam de aprovação pelo mecanismo das ferramentas; não contornar sandbox. Worktrees separam arquivos/index, mas compartilham metadados Git e os mesmos serviços da máquina. Os agentes também possuem acesso ao mesmo filesystem: a separação não constitui confinamento de credenciais.

O Lead administra branches, integração e limpeza. Não usar `git reset --hard`, remoção forçada ou exclusão recursiva para resolver conflitos. Antes de qualquer remoção, verificar o destino absoluto e preservar entregas pendentes.

Testes puros podem rodar em worktrees. Banco, navegador, build e operações que escrevem conteúdo gerado requerem coordenação. A integração local existente valida workspace dos containers e usa portas fixas; utilize o checkout principal, sequencialmente, até outra configuração ser comprovada. Não copiar `.env.remote.backup.local`, credenciais privadas ou configurar produção nas worktrees.

## Integração e aprovação

1. Lead define interfaces, invariantes e propriedade dos arquivos.
2. Implementador desenvolve; QA prepara testes e Revisor analisa riscos em paralelo quando independentes.
3. Lead congela entregas, confirma baseline e recebe patches completos.
4. Aplicar somente caminhos autorizados após inspeção e `git apply --check`; incluir arquivos novos sem exigir commits dos especialistas.
5. Identificar o candidato pelo hash dos bytes dos arquivos; QA e Revisor usam esse mesmo estado.
6. QA executa testes; Revisor retorna achados sem corrigi-los. Falhas concretas voltam ao Implementador.
7. Novas alterações invalidam evidências afetadas; reexecutar/revisar o candidato novo.
8. Lead apresenta evidências, limites e validação manual pendente. Commits e operações sensíveis seguem a autorização do usuário.

Reutilize os verificadores do `package.json`: contratos, capacidades, arquitetura, conteúdo, avaliações, políticas, representação textual, variantes, apresentação, sincronização e pacotes. TypeScript/ESLint são gates locais; build e banco usam os comandos protegidos. Não confundir validação técnica com aprovação editorial ou publicação.

## Homologação desta implantação

Baseline do Incremento 6: `0e2c988521e288b675ebd03aeac7a683cf0753f0`, commit de 43 arquivos, pai `2e0ace4`. Os arquivos locais `next-env.d.ts` e `espanholPlataform.code-workspace` foram preservados e excluídos do commit. Os perfis e esta implantação não pertencem a esse checkpoint e não têm autorização de commit adicional.

O experimento usou uma fixture/verificador em `scripts/multiagent-smoke/`, sem imports do motor, banco, rede ou regras pedagógicas. Critérios: sumarização determinística de IDs/flags sintéticos, rejeição de entradas inválidas e ausência de mutação. Implementador escreveu o módulo; QA derivou testes antes de acessar a implementação; Lead integrou; Revisor examinou candidatos congelados.

### Resultado em 2026-10-10

**Homologação operacional aprovada no modo de carregamento explícito de perfis.** Lead criou e coordenou três especialistas com `fork_turns="none"`; cada um leu seu TOML e confirmou o marcador, papel, diretório e restrições por comunicação nativa. Seleção automática dos TOMLs individuais e sandbox read-only por papel não foram comprovados; essas funcionalidades não são requisito presumido para este modo homologado.

O app-server instalado, `codex-cli 0.162.0-alpha.17.2`, respondeu a `initialize` e `config/read` com `--strict-config`, confirmando a camada `.codex` do projeto ativa, `agents.enabled=true` e limite de três subagentes. A consulta de metadados fez zero turnos de modelo. Não alterou configuração global. Isso confirma leitura das configurações do projeto, não a aplicação automática de perfis nesta conversa já aberta.

| Evidência | Resultado |
| --- | --- |
| Checkpoint | Commit `0e2c988`, exatamente os 43 arquivos revisados do Incremento 6; pai `2e0ace4`. |
| Perfis | Quatro arquivos reutilizáveis; marcadores `DESTRAVA_PROFILE_LEAD_V1`, `IMPLEMENTADOR_V1`, `QA_V1`, `REVISOR_V1` confirmados por leitura explícita. |
| Contexto | Três briefings delimitados, sem herdar o histórico inteiro; nenhuma subdelegação. |
| Worktrees | Implementador em `D:\Documents\destrava-worktrees\implementacao` / `agents/implementacao`; QA em `D:\Documents\destrava-worktrees\qa` / `agents/qa`; ambas na baseline `0e2c988`. |
| Lead | Checkout principal em `chore/multiagent-bootstrap`; somente o Lead integrou os patches. |
| Comunicação | Confirmações, resultados, correções de briefing, achado R1, novas tarefas e aprovações recebidos por `send_message`/`followup_task` e respostas finais. |
| Escrita | Especialistas alteraram somente seus arquivos autorizados e evidências; nenhuma credencial/ambiente privado foi copiado. |
| Integração | Patches incluíram arquivos novos e passaram por `git apply --check`; candidato final preservou bytes/SHA-256 entregues. |
| Testes | QA executou os dois testes integrados: **104 passaram**, zero falhas/skips/cancelamentos, exit 0. Lead repetiu a execução, também exit 0. |
| Revisão | Revisor examinou hashes do mesmo candidato, somente por leituras; nenhum achado aberto no candidato final. |
| Preservação | Os dois arquivos locais fora do checkpoint mantiveram seus hashes. A monitoração de 360 arquivos existentes não detectou alterações dos especialistas no checkout principal; mudanças documentais posteriores foram feitas pelo Lead. |
| Serviços | Nenhum teste de banco, migração, deploy, publicação ou API paga; `/login` local respondeu HTTP 200. |

### Candidato e reproduções

Identificação final: **MA-SMOKE-CANDIDATE-3**, baseline `0e2c988521e288b675ebd03aeac7a683cf0753f0`.

| Arquivo | SHA-256 dos bytes |
| --- | --- |
| `scripts/multiagent-smoke/summary.mjs` | `9c71d95f111a4fa49656ca5e98ca3e0b508e703b6c3adb02ad52d008c1824cec` |
| `scripts/multiagent-smoke/summary.test.mjs` | `9c6d99b426d8fc1ac4742ca4ee42ba5720568a029e86131d3aadb50041450ddd` |
| `scripts/multiagent-smoke/local-module-url.test.mjs` | `eebb29acfcc2a6b446669fc58bcd48f25bffac2524f30086da568ae12683357a` |

O digest `9be0321991afdfb03eceed9abecd807ab553a1c79872b4e3708738563b06f2e3` é calculado sobre `JSON.stringify(files)`, lista canônica de caminhos/hashes. O SHA dos bytes de `.tmp/multiagent/candidate3.json` é distinto: `cae55916288b290b69f2ad2458f8364d54ccb31feaaaac0d5a7722481aedd731`. QA conferiu ambos e os arquivos antes/depois da execução.

Para reproduzir sem banco, navegador ou dependências:

```powershell
node --test scripts/multiagent-smoke/summary.test.mjs scripts/multiagent-smoke/local-module-url.test.mjs
```

O QA executou também os caminhos absolutos dos dois testes integrados a partir de sua worktree, apontando `SUMMARY_FIXTURE_MODULE_URL` ao módulo do checkout principal. Os 92 casos do verificador cobrem limites, formato, tipos, propriedades próprias, IDs, Unicode, determinismo e ausência de mutação. Outros 12 casos avaliam somente o preâmbulo real do guard em `node:vm`, antes do import, sem importar as URLs testadas ou acessar rede.

Evidências temporárias: `.tmp/multiagent/` no checkout principal contém baseline, inventários/hashes, candidatos, resultado nativo de configuração e TAP do Lead. A worktree QA contém `execution-candidate3-integrated.json` e `candidate3-integrated.tap`, com comando e hashes. Esses registros não contêm credenciais e permanecem ignorados pelo Git. Os testes/perfis/procedimento são arquivos da implantação, ainda sem commit.

### Falhas detectadas e tratadas

1. **R1, revisão independente:** um guard que aceitava qualquer protocolo `file:` permitia hostname UNC remoto no Windows. QA corrigiu a restrição de hostname e adicionou regressão. Candidato 1 não foi aprovado; candidatos posteriores foram reexecutados e revisados. Implementação e asserções originais permaneceram iguais.
2. **Identificação ambígua do Lead:** QA interrompeu um preflight ao distinguir digest do candidato de hash dos bytes do manifesto. O briefing e os manifestos seguintes passaram a definir ambos explicitamente; nenhuma falha foi tratada como teste aprovado.
3. **Terminações de linha:** a primeira aplicação do Git transformou LF/CRLF e mudou o hash. Lead preservou os bytes entregues e usou `core.autocrlf=false` por comando nos patches seguintes. Nenhuma configuração global foi alterada.
4. **Lint temporário:** a confirmação da baseline encontrou dois erros de CommonJS em um auxiliar descartável ignorado pelo Git. Esse auxiliar foi removido; o lint foi repetido com sucesso. Os 43 arquivos aprovados não foram alterados para resolver essa falha.
5. **Permissões Windows:** Git no usuário do sandbox recusou ownership das worktrees externas. Leituras/escritas necessárias usaram a aprovação da ferramenta; não foi configurado `safe.directory` global ou uma exceção ampla.

Foram repetidos 11 verificadores pertinentes do Incremento 6, TypeScript e ESLint antes do commit. Após integração houve TypeScript e ESLint global aprovados; a adição final passou por Node syntax check, ESLint direcionado e os 104 testes. O build já homologado no Incremento 6 não foi repetido: esta implantação adicionou configuração, documentação e fixture de ferramentas, sem mudança do runtime da aplicação. Não apresentar os testes de banco anteriores como evidência nova desta tarefa.

### Limites e estado Git

Não há confinamento de filesystem ou credenciais por worktree; todos os agentes compartilham a máquina e o sandbox herdado. O Revisor cumpriu procedimento de leitura, com hashes do candidato preservados, sem tentativa de escrita. Não foi demonstrado bloqueio técnico de escrita desse papel. Banco e navegador permanecem sequenciais e fora deste experimento.

Os arquivos administrativos foram copiados às worktrees porque ainda não estão em commit. São cópias da fonte canônica do checkout principal e devem ser sincronizados pelo Lead; especialistas não devem criar versões divergentes desses documentos/perfis.

Arquivos da implantação: `AGENTS.md`, link em `README.md`, este procedimento, `.codex/config.toml`, quatro perfis e três arquivos em `scripts/multiagent-smoke/`. O index fica vazio e todos esses arquivos permanecem sem commit. O único commit desta execução é o checkpoint autorizado do Incremento 6. A especificação completa e autorização do Incremento 7 continuam pendentes.

## Plano preliminar do Incremento 7

Este plano depende da especificação completa do usuário. Não autoriza implementação.

| Etapa | Responsável | Dependência e paralelismo |
| --- | --- | --- |
| Contratos de identidade/versão, transições e invariantes | Lead, com QA/Revisor | Primeiro, com análises independentes; estabilizar interfaces. |
| Staging e instalação versionada/imutável | Implementador | Interfaces definidas; QA prepara falhas/fixtures em paralelo. |
| Ativação e concorrência | Implementador | Instalação disponível; testes de clientes concorrentes coordenados pelo QA. |
| Rastreabilidade e rollback | Implementador | Modelo de transições/ativação; Revisor verifica integridade. |
| Integração no runtime/persistência | Lead | Entregas congeladas, escopo e patches verificados. |
| Homologação e decisão | QA e Revisor → Lead → usuário | Mesmo candidato; banco/navegador sequenciais. |

Critérios a detalhar: instalação repetível, versão imutável, identidade versus hash, ausência de instalação parcial, ativação concorrente com estado obsoleto, rollback sob falhas/operações em andamento, rastreabilidade e preservação de progresso por versão. Testes de concorrência devem usar múltiplos clientes controlados, não agentes disputando o banco de integração.

Riscos: sistemas de arquivos mutáveis, autoridade/confiança de produtores, transações de armazenamento e banco, conflitos de IDs/versões e compatibilidade de progresso. Contratos públicos, capacidades e política editorial continuam separados conforme [o direcionamento](DESTRAVA_DIRECIONAMENTO_ARQUITETURAL.md) e [o Incremento 6](DESTRAVA_IMPORTACAO_INCREMENTO_6.md).

## Métricas e aprendizado

### Checkpoint e primeiro piloto real

Em 2026-10-10, os 11 arquivos desta implantação foram revisados e commitados em `b34915d6cc9a0311fa10e36e400512bead109527`, mensagem `chore: bootstrap and verify multiagent development workflow`. O registro acima descreve a homologação anterior ao commit. Os dois arquivos locais fora do escopo permaneceram preservados; as worktrees foram alinhadas por fast-forward após backups verificados, sem reset/clean.

O primeiro piloto real é [o Incremento 7](DESTRAVA_INSTALACOES_INCREMENTO_7.md), autorizado em sua especificação própria. Lead trabalha em `feat/increment-7-versioned-installations`; Implementador e QA possuem escopos de escrita separados em worktrees com baseline `b34915d`. Revisor examina candidatos com hashes sem implementar correções. Perfil explícito e fiscalização continuam sendo garantias procedimentais; não houve comprovação de seleção automática de TOML ou sandbox restritivo por papel. Resultados, correções e métricas do piloto ficam no relatório da entrega.

Registre tempo de execução e coordenação, retrabalho, achados confirmados/descartados, conflitos, alterações fora do escopo, comandos/exit codes, candidato/hash e reprodução dos resultados. Tokens/custos só são registrados quando o cliente os disponibilizar; não estimar custo financeiro como evidência medida. Um piloto não demonstra ganho estatístico de produtividade.

Task Decomposition separa código, testes e revisão por contratos. Agent Orchestration usa a comunicação nativa e o Lead. Context Isolation limita briefing/histórico, sem prometer isolamento de filesystem. Agent Handoffs transferem patches e evidências completas. Parallel Execution é usada somente entre tarefas independentes; integração é sequencial. Independent Review confronta a entrega com critérios e riscos sem implementar sua própria correção. Git Worktrees separam escritas e branches. Human-in-the-Loop mantém autorização para checkpoint, ações sensíveis e início do próximo incremento.

Mais agentes adicionam consumo e coordenação. Uma correção pequena com poucos arquivos pode ser melhor executada pelo Lead; múltiplos especialistas são úteis quando testes, análise de riscos e implementação possuem trabalho independente suficiente.

### Segundo piloto real: Incremento 8

Baseline `bccb67e97a2eb4212ba574b6f9030ad706aaf541`, branch Lead `feat/increment-8-runtime-interoperability`. Worktrees Implementador/QA foram alinhadas por fast-forward depois de preservar entregas I7 com hashes. A equipe manteve quatro papéis e carregamento explícito, sem subdelegação, novo orquestrador ou alterações de configuração/permissões.

O [relatório do Incremento 8](DESTRAVA_RUNTIME_INCREMENTO_8.md#f-processo-multiagente-e-comparação) registra ownership, contratos de entrega, correções levantadas por QA/Revisor, candidatos e resultados. Lead integra UI e executa banco/browser/build sequencialmente; testes puros e investigação dos especialistas ocorrem independentemente. Resultados e limites pertencem ao candidato integrado, não apenas aos patches de cada worktree. Não houve autorização de commit, publicação ou próximo incremento.
