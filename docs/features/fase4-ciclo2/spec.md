# Fase 4 — Ciclo 2 (A2 + B2)

**Estado: PROPOSTA REGISTRADA / NÃO AUTORIZADA PARA EXECUÇÃO**

**Origem:** seção "G. Próximo ciclo recomendado" de [DESTRAVA_FASE4_CICLO1.md](../../../DESTRAVA_FASE4_CICLO1.md). Não substituir os critérios reais dessa auditoria por suposições desta proposta.

## Objetivo

Evoluir duas frentes complementares sobre os contratos e capacidades existentes, sem transformar recursos ainda parciais em "prontos" e sem interferir nos pilotos ES/EN ou no release Fly.io.

### A2 — Motor: sessões instaladas e diagnóstico

Homologar no fluxo **real** do aluno um curso externo instalado e autorizado para teste, incluindo:

- iniciar, pausar, retomar, finalizar e recarregar;
- persistir tentativas/evidências e recuperar sem duplicações;
- preservar a versão fixada enquanto uma sessão está em andamento;
- lidar com falha de leitura/rede sem sobrescrever o estado íntegro;
- troca de curso sem vazamento de estado;
- exercício, diagnóstico e feedback coerentes com capacidades disponíveis;
- desktop e mobile, com limites de testes declarados.

**Aceite proposto:** fluxos acima comprovados contra ambiente local isolado e navegador; autenticacão/autorização preservadas; nenhum fallback silencioso para catálogo compilado; nenhum dado de outra conta alterado. IA, voz e Aula Particular de cursos instalados NÃO passam a ser obrigatoriamente suportados nesta entrega.

### B2 — Aula Particular: política bilíngue e narração controlada

Aproveitar o controlador da Aula Particular e as evidências independentes do B1 para:

- diferenciar narração de apoio/explicação (**PT-BR** quando língua de apoio assim configurada) e fala de alvo/prática (**idioma estudado**);
- marcar/propagar idioma efetivo de cada segmento de narração;
- permitir pausa, cancelamento e retomada de maneira previsível;
- selecionar voz compatível quando disponível; se não houver, sinalizar fallback textual ou limitação sem fingir pronúncia correta;
- testar PT-BR + ES, PT-BR + EN e idioma sintético para demonstrar ausência de hardcode;
- preservar integridade de checkpoints e não atribuir nota oficial por mera entrega de áudio.

**Aceite proposto:** vozes/mocks e navegador demonstram separação de idiomas, controle de sessão e fallback; ausência de provedor não produz aprovação fictícia. Não prometer avaliação acústica, shadowing contínuo, diálogo em tempo real nem expansão automática da Aula Particular para cursos externos.

## Coordenação

- Lead define interfaces e dependências compartilhadas **antes** da escrita paralela.
- A2 e B2 podem usar worktrees separadas se não alterarem os mesmos contratos; QA deriva casos negativos dos critérios, Revisor audita candidato integrado.
- Rodar testes puros por frente e integração Supabase/navegador sequencialmente, no checkout controlado.
- Registrar o candidato por hash, comandos/ambiente, resultados e limitações.

## Fora de escopo

- Deploy, migração remota, exclusões de progresso e operações pagas.
- Admin de cursos, edição de conteúdo do Foundry ou nova arquitetura de plugins.
- Reescrita ampla do motor, novos modelos, nova infraestrutura de voz e mudança geral das políticas de aprendizagem.

## Preparação antes da execução

Após aprovação desta spec, inspecionar os consumidores reais e produzir \`plan.md\` e \`tasks.md\` com arquivos, testes, isolamento, STOP e métricas. **Não implementar A2/B2 por ter recebido este documento.**
