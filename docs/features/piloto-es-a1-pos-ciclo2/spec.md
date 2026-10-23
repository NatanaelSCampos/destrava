# Próximo ciclo candidato — atualização do laboratório pessoal ES-A1 após A2/B2

**Estado (23/10/2026): AUDITORIAS DO ACERVO E P0 TÉCNICO CONCLUÍDAS POR LEITURA; DECISÃO EDITORIAL APROVADA; IMPLEMENTAÇÃO, BANCO E PUBLICAÇÃO NÃO AUTORIZADOS.**

Decisão de produto: o curso pessoal de espanhol A1 com **duas unidades já usadas para estudos** deve refletir o **melhor conjunto funcional e honesto do motor em seu caminho de execução**. Ver política permanente: [Curso laboratório ES-A1](../../produto/CURSO_LABORATORIO_ES_A1.md).

**Base do relatório estático:** `main` `6bdd26c336ce50d59569a74581044fe3ddc89284`, PRs #6 e #5 integradas. O Codex auditou por leitura o piloto pessoal `espanhol-a1-pessoal` (`0.1.0`, contrato `1.5`) e recomendou **evoluir o acervo com reorganização profunda**, preservando o conteúdo útil. O proprietário **aprovou esta alternativa A** em conversa posterior. Ver [relatório de auditoria](RELATORIO_AUDITORIA.md). **Não houve teste de navegador, SQL, Fly nem edição de arquivos** nessa auditoria; esta aprovação não autoriza implementar, mesclar, migrar ou publicar.

## 1. Descoberta estática realizada e reconfirmação obrigatória

- **O Codex já inspecionou estaticamente** os worktrees e os arquivos das duas unidades: 20 worktrees/249 pendências preservados conforme o relatório (arquivos ignorados não integralmente inventariados). **Reconfirmar o inventário real ao iniciar uma etapa operacional**, sem tocar nos rascunhos dos especialistas. A `main` contém fixtures, não a versão completa do curso pessoal.
- **O caminho de entrega encontrado no código foi compilado/embutido**; a versão usada na conta/Fly **não foi confirmada**. Confirmar ambiente e artefato antes de qualquer publicação. A2 testa sessões/diagnóstico **instalados**, B2 narração na Aula Particular **compilada**; não promover de um caminho ao outro por inferência.
- **Inventário estático concluído** no [relatório](RELATORIO_AUDITORIA.md). Antes de implementar, validar o estado técnico do destino e as dependências realmente disponíveis; não inferir disponibilidade operacional de IA, gravação, SRS ou voz a partir do conteúdo.
- Manter matriz de recursos com `motor`, `caminho`, `configuração`, `no-curso`, `evidência`, `limitação`, `motivo` e `ação`. **O relatório fornece a fotografia estática inicial**, não a confirmação do que está em produção; revisá-la a cada marco sem preenchimento por inferência.
- **Decisão de produto aprovada — ESLAB-D01:** evoluir o acervo existente, preservar exemplos bons, reescrever itens problemáticos e **reorganizar profundamente a jornada**, primeiro U2 e depois U1. Não reescrever o banco inteiro por padrão nem impor compatibilidade editorial artificial.
- Proteger trabalhos pendentes de ES/EN; nenhum `reset --hard`, `git clean`, `stash` automático, exclusão silenciosa ou substituição massiva sem manifesto e autorização.

## 1.1. Evidências quantitativas e lacunas do acervo real

O [relatório estático](RELATORIO_AUDITORIA.md) identifica **703 atividades / 119 lições**: U1 277 atividades e 48 lições; U2 426 atividades e 71 lições. São **255 múltiplas escolhas, 61 lacunas, 21 ordenações, 47 escritas, 45 falas, 44 listenings, 24 verdadeiro/falso, 20 respostas curtas, 159 flashcards e 25 explicações**; há ainda 21 roteiros de Aula Particular, 64 avaliações fixas, 45 conceitos, 159 itens de léxico, duas missões e um roleplay.

A **U2 coloca 78 múltiplas escolhas antes da primeira lacuna**; escrita aparece na lição 19, listening na 22, resposta curta na 47, cartões a partir da 50 e aulas particulares nas lições 59–70. A maior deficiência é a **sequência pedagógica**, não a inexistência de formatos.

Há **517 campos de explicação**, sendo **101 mensagens** do tipo "Confira o contexto", e o caso real `En mi calle hay ___ tiendas` com `mucha/muchas/muchos` ilustra feedback que não esclarece concordância. Os **119 objetivos de lição repetem o título**; avaliações finais reutilizam itens de prática, com sobreposição do diagnóstico U1 e final. O acervo contém bons contrastes e correções que justificam preservação seletiva.

**Confiança:** contagens e observações foram relatadas por Codex em investigação estática de worktrees locais. Não foram reproduzidas no GitHub ou em navegador por esta atualização documental. O curso completo não está integrado à `main`.

## 1.2. Dois STOPs técnicos antes da composição motor/piloto

- **ESLAB-B01 — colisão de identificador de migração:** o piloto local e o motor têm arquivos diferentes sob `20261022000100` (`learning_reset_generation.sql` versus `interactive_segment_evidence.sql`). **Não** renomear arquivos, marcar versões como aplicadas, migrar, resetar ou tocar banco antes de um plano de reconciliação com histórico/schema do destino autorizado.
- **ESLAB-B02 — geração/autoridade B1:** o piloto protege abas de geração antiga; o novo escritor de evidências por segmento usa outro protocolo de lock/autoridade. Precisamos provar que não ocorrem replay, cross-generation write ou aprovação cruzada após composição. Não copiar componentes antigos nem promover flags globais de conclusão como recibos B1.

Ambos são **riscos relatados pela leitura**, não provas de incidente em banco. A tarefa imediata recomendada é uma **reconciliação técnica exclusivamente de leitura** e proposta de plano, definida em [plan.md](plan.md); implementação depende de nova autorização e gates de QA.

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

## 4. Sequência aprovada de priorização — execução ainda não autorizada

O proprietário aprovou **A (evoluir acervo)**, em vez de reescrever tudo. A prioridade é **U2 primeiro**, validando uma fatia completa antes de aplicar o padrão ao restante. A ordem aprovada é: (P0 **concluído somente por leitura**) [reconciliação técnica](RELATORIO_P0.md) → (**COM-0 pendente de autorização**) inspeção de schema/integração segura; só depois (P1) mapa curricular/revisão editorial e um percurso vertical U2; (P2) evoluir toda U2; (P3) reorganizar U1; (P4) QA real, dogfooding e eventual publicação separada.

Ver [plano](plan.md) e [tarefas](tasks.md).

1. **Descoberta + decisão editorial:** auditar curso real, inventariar capacidades e lacunas; propor estrutura nova das duas unidades se for o melhor caminho.
2. **Spec/planejamento aprovados:** detalhar paths, owners, critérios e alterações necessárias. Reusar o que já existe antes de criar contrato novo.
3. **Codex:** implementar conteúdo e ajustes pequenos e genéricos do motor **somente após autorização futura**, sem sobrepor agentes do Ciclo 2; QA/Revisor no mesmo candidato.
4. **Laboratório com o proprietário:** uma única experiência de estudo, sem segunda versão pessoal para preservação. Problemas relatados viram regressão verificável quando aplicável.
5. **Promoção:** PR/merge e eventual publicação remota só mediante autorizações separadas. Atualizar [matriz](../../produto/MATRIZ_MATURIDADE_RECURSOS.md) e [progresso](../../PROGRESSO_PRODUTO.md) após confirmar a realidade.

## 5. Limites

- O acervo pessoal foi **inspecionado estaticamente pelo Codex**, conforme [relatório](RELATORIO_AUDITORIA.md); o GitHub não contém necessariamente os arquivos locais. A versão em execução na sua conta e o schema remoto não foram auditados. Não declarar esses estados como homologados.
- Este ciclo não autoriza implementação imediata e não determina que todos os recursos estejam em todas as atividades.
- O Language Foundry é responsável por qualidade/editorial de pacotes definitivos; o piloto pessoal pode validar pedagogia, mas não certifica automaticamente um curso público.
- A aceitação de eventual perda de progresso **não autoriza** reset ou escrita em base remota sem confirmação de destino/escopo e autorização expressa da operação.
- A2/B2 e a auditoria estática já foram concluídos nos escopos relatados. **o P0 foi concluído por leitura, com [relatório P0](RELATORIO_P0.md) e parecer PLANO SUFICIENTE; o próximo gate é COM-0, **somente leitura de schema/histórico com autorização própria**, conforme a [spec de composição](../es-a1-composicao/spec.md)**; etapas editoriais/funcionais subsequentes aguardam autorização delimitada.
