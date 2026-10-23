# Política de produto — Curso ES-A1 como laboratório vivo do Destrava

**Decisão de produto do proprietário: 23/10/2026; política integrada pela PR #5 em `6bdd26c`.** A auditoria estática posterior fundamenta a escolha editorial **ESLAB-D01: evoluir o acervo atual e reorganizar U2 antes de U1**. Nenhuma implementação, migração ou publicação é autorizada por esta política. Ver [roadmap](ROADMAP_ESTRATEGICO.md), [matriz de maturidade](MATRIZ_MATURIDADE_RECURSOS.md), [auditoria](../features/piloto-es-a1-pos-ciclo2/RELATORIO_AUDITORIA.md) e [plano](../features/piloto-es-a1-pos-ciclo2/plan.md).

## 1. Princípio permanente

O **curso pessoal de espanhol A1, com duas unidades em estudo pelo proprietário**, é o **laboratório vivo (dogfooding)** da experiência do Destrava. Deve responder continuamente: **"Se precisássemos entregar o produto hoje, qual seria a melhor experiência real, honesta e funcional que conseguiríamos oferecer?"**

Não é catálogo de demonstrações desconectadas, nem amostra congelada de uma versão antiga. É um curso para aprender espanhol de verdade e revelar lacunas do produto que testes de código não mostram.

O laboratório **não é sinônimo de homologação do motor em todos os idiomas, aprovação editorial do Foundry, disponibilidade universal em pacotes externos ou prontidão comercial da plataforma**. Sua evidência complementa, não substitui, os testes generalistas com cursos/idiomas sintéticos.

## 2. Regra de inclusão e de limitações

Ao considerar um recurso, usar estas condições na ordem:

1. **Implementado no motor + integrado no caminho real usado pelo curso + configurado e disponível + pedagogicamente pertinente:** deve estar **acessível e efetivamente exercitável no laboratório**, ou entrar em lacuna prioritária de conteúdo/integração, com causa documentada. Não omitir recurso disponível só por inércia editorial.
2. **Parcialmente implementado:** incluir **a parte verdadeiramente funcional**, com limites claros; não insinuar avaliação, adaptação, fluência ou precisão não comprovadas.
3. **Motor implementado, mas não integrado ao caminho do curso:** registrar **bloqueio técnico explícito**, razão, dependência e próximo marco; não habilitar por feature flag, DTO ou rota alternativa como atalho.
4. **Dependência operacional ou permissão ausente:** apresentar indisponibilidade honesta; não dizer que "funciona" só por existir código/configuração.
5. **Não pertinente a estas duas unidades:** justificar a não inclusão **nesta lição**, sem inventar exercícios artificiais; se for útil como recurso global, dar acesso contextual a partir do curso quando a integração permitir.
6. **Não implementado / não aprovado:** não fingir recurso, nota ou progresso. A Aula Particular Interativa em **curso externo instalado** é exemplo atual de integração bloqueada. Se houver uma Aula Particular de curso **compilado** com roteiro válido, avaliar separadamente seu recorte disponível; não confundir os caminhos.

Registrar as seis dimensões por recurso: **motor, caminho (compilado/instalado), disponibilidade operacional, cobertura no ES-A1, qualidade/aceite pedagógico e motivo da limitação**. A [matriz de maturidade](MATRIZ_MATURIDADE_RECURSOS.md) dá a referência geral; o inventário do laboratório será produzido após inspecionar os arquivos locais reais.

## 3. Uma única experiência de estudo, sem ambiente pessoal duplicado

- **Usar o próprio curso pessoal de duas unidades para estudar e testar**, sem manter outro curso/ambiente pessoal estável só para preservar histórico experimental.
- Worktrees de **desenvolvimento, QA e integração isolados continuam obrigatórios** quando necessários para proteger escrita e infraestrutura compartilhada. Isso **não é** um segundo curso pessoal para uso.
- O proprietário aceita reconstruir progresso experimental ou repetir diagnóstico, se necessário. **Não criar uma migração elaborada só para preservar seu histórico**. Antes de qualquer exclusão/reset/migração efetiva, porém, pedir autorização **para a operação concreta**, verificar destino e não comprometer outros usuários/ambientes.
- Um relato do aluno ou diagnóstico pode reconstruir **uma estimativa explícita** de nível e tópicos estudados; a IA nunca deve fabricar notas, timestamps, tentativas ou evidências canônicas que já não existam.
- Conciliar primeiro o conteúdo dos worktrees pessoais ES/EN: a `main` do motor contém fixtures, **não equivale automaticamente à versão completa das duas unidades pessoais**. Não descartar mudanças editoriais não comitadas; preservar o piloto EN salvo autorização contrária.
- Publicação no Fly/Supabase remoto, custos e migrações requerem aprovação própria; merge funcional não atualiza a versão em que o proprietário estuda por si só.

## 4. Ciclo de atualização contínua

Após **cada marco relevante do motor** (e antes de declarar capacidade visível concluída):

1. Identificar commit/candidato do motor, o caminho realmente utilizado pelo ES-A1 e a versão exata das duas unidades.
2. Comparar a matriz de capacidades com o conteúdo/atividades e configurações do curso; classificar **disponível / disponível com limite / bloqueado / não pertinente / ainda não auditado**.
3. Perguntar **"O laboratório está representando o melhor Destrava que poderíamos entregar hoje?"**. Quando não, abrir um ajuste de conteúdo ou um pequeno ciclo de integração, com prioridade para falhas pedagógicas.
4. Validar regras editoriais de espanhol, respostas, variantes, conceitos, exemplos, feedback e objetivos. Reaproveitar tipos de atividade já executáveis antes de propor mecanismos novos; não encher a unidade de formatos não pertinentes.
5. Executar QA técnico e revisão pedagógica dos casos relevantes, com evidência por candidato. O proprietário estuda a **mesma experiência que receberia no uso normal** e registra dificuldades concretas.
6. Corrigir, versionar, atualizar a matriz e o relatório de limitações. Integração/push, deploy e eventual migração seguem permissões separadas.

Não impor ao piloto que bloqueie correções de segurança não relacionadas, nem exigir todas as capacidades futuras para tornar uma unidade utilizável. A regra é **proximidade contínua verificável**, não paridade fictícia.

## 5. Critérios pedagógicos permanentes

O padrão das duas unidades deve evoluir de "apresentação inicial + série uniforme de múltipla escolha" para experiências com progressão adequada a objetivos A1, usando quando pertinente **leitura contextual, exemplos, compreensão auditiva, lacunas, organização de frases, respostas livres, prática oral, revisão e aplicação comunicativa** — apenas nos caminhos em que cada formato opera corretamente.

**A explicação não pode desaparecer quando o aluno começa a praticar.** Durante cada exercício, permitir recuperar regra, exemplo e contexto pedagógico por controle acessível sem perder a resposta atual. A ajuda pública não deve antecipar inadvertidamente gabaritos privados.

**Errar deve ensinar alguma coisa:** sempre que houver correção objetiva e explicação editorial fundamentada, mostrar o resultado, por que a escolha não serve naquele contexto, o que serviria e um exemplo curto de contraste. Ex.: em `muchas casas`, `casas` é feminino plural; `muchos` é masculino plural e cabe em `muchos libros`. Explicações devem vir de metadados e exemplos aprovados, não de adivinhação pelo texto digitado.

A auditoria de 23/10/2026 identificou no motor `src/domain/activities/grader.ts` uma explicação única opcional por atividade, com fallback genérico; `src/components/activities/exercise-card.tsx` já tem um cartão de resultado, mas não seleção de explicação por alternativa errada. **Isso é lacuna real a especificar**, não algo já disponível para o piloto. Gabaritos/alternativas corretas permanecem sob autoridade privada. Se IA oferecer "explique de outro jeito", a resposta é **apoio opcional**, sem autoridade de avaliação e sem presumir serviço pago disponível.

O aprendizado real e o desempenho do aluno orientam melhorias editoriais e de UX; não substituem evals do motor, testes de isolamento, evidência de domínio ou revisão humana do conteúdo.

## 6. Primeiro marco de atualização, após A2/B2

**A2/B2 integrados e auditoria pessoal concluída estaticamente.** A `main` contém o Ciclo 2 e a política ES-A1 (PRs #6/#5). O Codex investigou o curso compilado pessoal e recomendou **evoluir**, não substituir integralmente, as duas unidades; o proprietário **aprovou essa estratégia editorial (ESLAB-D01)**. **P0 foi concluído por leitura**, com parecer PLANO SUFICIENTE no [relatório P0](../features/piloto-es-a1-pos-ciclo2/RELATORIO_P0.md). A composição real ainda não começou: o próximo gate **COM-0** é leitura de schema/histórico do ambiente identificado, **somente após autorização própria**. Ver [spec de composição](../features/es-a1-composicao/spec.md), [plano](../features/es-a1-composicao/plan.md) e [revisão pedagógica](../features/piloto-es-a1-pos-ciclo2/spec.md); nada disso concede permissão de banco, código ou publicação.

O proprietário **autoriza discutir e planejar a reformulação completa das duas unidades**, sem exigir preservar exatamente a ordem antiga. A reescrita efetiva, mudanças de contratos e operações de publicação continuam fora desta PR documental.

## 7. Autorizações e fronteiras

Este documento fixa uma **regra de produto** e uma agenda de revisão. Não concede autorização implícita para criar agentes, alterar o curso, migrar dados, resetar o histórico, modificar o Foundry, mudar contratos, implantar serviços ou publicar. Consultar [Do Chat ao Commit](../DO_CHAT_AO_COMMIT.md) e a autorização específica de cada tarefa.
