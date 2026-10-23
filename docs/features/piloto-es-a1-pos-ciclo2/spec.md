# Próximo ciclo candidato — atualização do laboratório pessoal ES-A1 após A2/B2

**Estado: proposta de especificação futura — NÃO IMPLEMENTAR AGORA.**

Decisão de produto: o curso pessoal de espanhol A1 com **duas unidades já usadas para estudos** deve refletir o **melhor conjunto funcional e honesto do motor em seu caminho de execução**. Ver política permanente: [Curso laboratório ES-A1](../../produto/CURSO_LABORATORIO_ES_A1.md).

**Gatilho:** receber relatório/candidato final da execução A2/B2, conferir o que passou por QA/Revisor, consultar a `main` e **então** auditar os pilotos pessoais reais. Não adotar automaticamente uma PR funcional ainda não integrada; trabalhar com candidato versionado no ambiente de teste somente após autorização apropriada.

## 1. Escopo de descoberta obrigatório

- Inspecionar os worktrees, commits, mudanças rastreadas/não rastreadas e os **arquivos reais das duas unidades pessoais**. No GitHub, a `main` contém fixtures e não representa automaticamente a versão completa do curso do aluno.
- Descobrir se o curso em uso é **compilado, instalado ou ambos**; registrar a versão efetivamente estudada e o caminho de cada recurso. A2 testa sessões/diagnóstico **instalados**; B2 melhora narração da Aula Particular, inicialmente no caminho **compilado**. Não prometer que um instala automaticamente o outro.
- Fazer inventário de capacidades (motor/configuração/integração), da variedade de exercícios por unidade, de regras de explicação, feedback por erro, IA/fala, dicionário, revisão, tempo e diagnóstico.
- Em matriz local versionável, para cada recurso pedagogicamente aplicável registrar `motor`, `caminho`, `configuração`, `no-curso`, `evidência`, `limitação`, `motivo` e `ação`. **Não preencher por inferência**. Recursos ausentes devem ter justificativa verificável.
- Identificar conteúdos preserváveis e lacunas antes de optar por reestruturação total. Pode ser preferível **refazer as duas unidades** se isso melhorar a aprendizagem e reduzir remendos, sem impor compatibilidade editorial desnecessária com os rascunhos.
- Proteger trabalhos pendentes de ES/EN; nenhum `reset --hard`, `git clean`, `stash` automático, exclusão silenciosa ou substituição massiva sem manifesto e autorização.

## 2. Resultado pedagógico esperado

As duas unidades devem constituir uma **experiência de aprendizagem A1**, com objetivos, sequência, exemplos e prática variados **segundo a necessidade didática**, sem encher o curso de modalidades sem sentido. Usar os mecanismos já implementados se forem compatíveis e disponíveis; quando um recurso importante não puder ser incluído, registrar razão técnica/pedagógica e qual é o próximo passo.

### Explicação recuperável

- Durante toda prática objetiva, botão/cartão `Rever explicação`/`Ver exemplos` abre o conceito relacionado, pode ser fechado e reaberto sem perder o que o aluno já digitou/marcou.
- No celular, o controle continua acessível sem esconder resposta, ação primária ou foco do teclado.
- A explicação pedagógica vem de conteúdo editorial público, não do gabarito privado nem de uma API que permita extraí-lo antes da resposta.

### Feedback útil por erro

- Corrigir pelo avaliador canônico existente, com a mesma autoridade/versão/variante; não criar segundo algoritmo de correção para apresentar a interface.
- Após submissão, apresentar `certo/errado`, resposta esperada quando apropriado, **razão contextual da alternativa errada**, contraste e convite a tentar novamente ou aplicar regra.
- Para `muchos` em contexto `muchas casas`, explicar gênero/número e contrastar com `muchos libros`. **Não generalizar detecção por string** para outros idiomas; a autoria deve fornecer metadados/exemplos/regras compatíveis com o contrato.
- Onde o motor dispõe apenas de `activity.explanation` geral, investigar reuso. Se o feedback por escolha exigir novo contrato público/schema/mecanismo de privacidade, **STOP e nova aprovação**. Não vazar `answer`/aceitas/explanation privada para `PublicActivity`.
- Sem explicação editorial específica, mostrar uma alternativa útil e honesta baseada em regra validada ou indicar limite, sem inventar motivo gramatical e sem reduzir a experiência ao aviso genérico "revise a lição" como solução final.
- IA pode esclarecer opcionalmente **após a correção**, com segurança, quota e avaliação de qualidade próprios; sua resposta não altera nota/evidência. Nenhuma chamada paga fica autorizada nesta spec.

### Variação e progressão real

- Propor por objetivo sequência de **compreender → reconhecer → recuperar → aplicar → revisar**, distribuída entre tipos que de fato funcionem no caminho do curso (múltipla escolha, lacuna, ordenação, resposta curta, listening, escrita, fala, revisão, quando disponíveis).
- Registrar formatos existentes na unidade e quais adicionados com propósito. Não exigir que cada lição tenha todos os formatos.
- Onde a revisão privada/SRS, speaking, IA ou Aula Particular instalada estiver bloqueada, **não simular** essas integrações. Se recurso estiver implementado no curso compilado e operacional, avaliar inclusão no piloto nesse caminho sem afirmar homologação instalada.
- Confirmar variantes, pronúncia de TTS e instruções no idioma de apoio/alvo, exemplos e respostas alternativas editorialmente corretos.
- Avaliações, notas e progresso precisam ser compatíveis com propósito e evidência; não criar domínio por clique, fala entregue ou explicação vista.

## 3. Aceites propostos (todas as provas após autorização própria)

| ID | Evidência esperada |
| --- | --- |
| **ESLAB-01** | Inventário com versão real das duas unidades, caminho compilado/instalado e discrepâncias com a `main`; sem perda de alterações locais preexistentes |
| **ESLAB-02** | Cada recurso aplicável: presente/exercitável, parcial com limite explícito, bloqueado com causa, ou não pertinente com justificativa; ausência silenciosa vira pendência |
| **ESLAB-03** | Explicação acessível durante atividade, antes/depois da tentativa, sem reset de resposta, sem vazar gabarito pré-submissão |
| **ESLAB-04** | Erro típico de escolha `muchos` / `muchas` recebe explicação contextual correta e contraste; testar outros distractors e idioma sintético sem inferência linguística |
| **ESLAB-05** | Duas unidades com objetivos, progressão e variedade apropriada; revisão editorial humana e verificadores do conteúdo, sem atalhos em contratos |
| **ESLAB-06** | QA compara correção privada, feedback, tentativas, erro/revisão e disponibilidade por ambiente; não usa nota inventada nem IA paga para afirmar PASS |
| **ESLAB-07** | Uso no próprio curso pessoal: aluno estuda uma sequência real, relata dúvidas e observa persistência, explicações e progresso; não exigir cópia de estudo separada |
| **ESLAB-08** | Relatório com commit/candidato, recursos habilitados, limites conhecidos, provas, cobertura por unidade, experiência no navegador e autorização operacional pendente |
| **ESLAB-09** | Alterações de conteúdo e integração somente nos arquivos aprovados; pilotos EN preservados, sem movimento automático de outros worktrees |
| **ESLAB-10** | Sem deploy, migração, reset, operação paga ou merge por inferência; retorno de STOP para mudanças públicas ou de segurança |

## 4. Sequência após o fechamento técnico de A2/B2

1. **Descoberta + decisão editorial:** auditar curso real, inventariar capacidades e lacunas; propor estrutura nova das duas unidades se for o melhor caminho.
2. **Spec/planejamento aprovados:** detalhar paths, owners, critérios e alterações necessárias. Reusar o que já existe antes de criar contrato novo.
3. **Codex:** implementar conteúdo e ajustes pequenos e genéricos do motor **somente após autorização futura**, sem sobrepor agentes do Ciclo 2; QA/Revisor no mesmo candidato.
4. **Laboratório com o proprietário:** uma única experiência de estudo, sem segunda versão pessoal para preservação. Problemas relatados viram regressão verificável quando aplicável.
5. **Promoção:** PR/merge e eventual publicação remota só mediante autorizações separadas. Atualizar [matriz](../../produto/MATRIZ_MATURIDADE_RECURSOS.md) e [progresso](../../PROGRESSO_PRODUTO.md) após confirmar a realidade.

## 5. Limites

- O modelo de dados exato das duas unidades pessoais **não foi auditado neste documento**: repositório GitHub não expõe alterações ainda locais dos worktrees. Não alegar contagens/tipos por unidade pessoal a partir de fixtures do motor.
- Este ciclo não autoriza implementação imediata e não determina que todos os recursos estejam em todas as atividades.
- O Language Foundry é responsável por qualidade/editorial de pacotes definitivos; o piloto pessoal pode validar pedagogia, mas não certifica automaticamente um curso público.
- A aceitação de eventual perda de progresso **não autoriza** reset ou escrita em base remota sem confirmação de destino/escopo e autorização expressa da operação.
- O primeiro marco é condicionado ao relatório A2/B2 e à avaliação de seus resultados; não executar em paralelo no mesmo código por conveniência.
