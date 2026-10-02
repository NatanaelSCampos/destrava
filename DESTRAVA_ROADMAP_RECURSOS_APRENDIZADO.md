# Destrava — Roadmap de Recursos de Aprendizado com IA

> Documento de implementação para uso por agentes de desenvolvimento.
>
> Objetivo: evoluir o **Destrava** como uma plataforma multilíngua de aprendizado, prática, revisão e avaliação, reaproveitando ao máximo a arquitetura e os recursos já existentes.

---

## 0. Contexto atual do produto

O Destrava não deve ser tratado como uma ferramenta exclusiva para aprender espanhol.

A arquitetura deve ser **multilíngua**, permitindo que a mesma estrutura, componentes, motores de aprendizado, sistemas de revisão, avaliações e recursos de IA sejam reutilizados para espanhol, inglês, francês, italiano ou outros idiomas.

### Recursos que já existem ou estão em andamento

Antes de implementar qualquer item deste documento, o agente deve verificar o repositório e confirmar o que já existe.

Já sabemos que o projeto possui, ao menos:

- estrutura de curso/unidades;
- primeira unidade completa;
- exercícios;
- sistema de progresso;
- prática de pronúncia usando Azure Speech;
- possibilidade de o usuário repetir uma palavra ou frase e receber avaliação;
- tela de dicionário;
- área de números;
- área de particularidades do idioma;
- estrutura que está migrando de "curso de espanhol" para "ferramenta multilíngua".

### Regra obrigatória antes de qualquer desenvolvimento

Para **cada recurso deste documento**, antes de criar qualquer código novo:

1. procurar no projeto por funcionalidades semelhantes;
2. identificar componentes, serviços, hooks, tabelas, rotas e estados reutilizáveis;
3. verificar se o recurso já existe parcialmente;
4. preferir **adaptar, generalizar ou melhorar** o que já existe;
5. evitar criar telas, serviços, tabelas ou componentes duplicados;
6. manter compatibilidade com o modelo multilíngua;
7. documentar o que foi reaproveitado;
8. somente criar uma nova estrutura quando a atual realmente não comportar o recurso.

### Princípio arquitetural

Não criar recursos isolados.

Os dados gerados por cada ferramenta devem alimentar um **perfil central de aprendizado do usuário**.

Exemplos:

- erro em exercício;
- palavra pesquisada no dicionário;
- palavra marcada como difícil;
- pronúncia ruim;
- dificuldade detectada em speaking;
- resultado de uma revisão;
- resultado de uma prova;
- palavra esquecida em flashcard;
- tempo estudado;
- atividade repetida muitas vezes.

Tudo isso deve contribuir para decidir:

> **O que este usuário precisa praticar agora?**

---

# Status

- **APROVADO** → pode ser planejado e desenvolvido.
- **EM ANÁLISE** → não desenvolver a versão final ainda; pode preparar arquitetura, interfaces e provas de conceito sem integrar definitivamente ao fluxo principal.

## Implementação no produto — auditoria de 2026-10-01

O status acima indica **decisão de produto**. A coluna abaixo indica **o que existe no código**. **IMPLEMENTADO** indica que o fluxo principal atende ao item; **PARCIAL** significa que há uma base funcional, mas ainda faltam requisitos descritos no próprio item; **PENDENTE** significa que o fluxo proposto ainda não foi criado; **ADIADO** indica que a decisão final continua em análise.

| Item | Implementação | Evidência atual e principal lacuna |
| --- | --- | --- |
| 1. Perfil de domínio | **PARCIAL** | Habilidades, tópicos, conceitos e itens usam tentativas, escrita, fala e revisões de palavras e estruturas; ainda falta estado separado por curso/idioma. |
| 2. Motor adaptativo | **PARCIAL** | Prioriza revisões, erros, pronúncia/fluência e trilha; ainda faltam sinais de uso do dicionário, conversas e avaliações mais amplas. |
| 3. Treinar minhas dificuldades | **PARCIAL** | Sessão focada usa erros, palavras difíceis e fala avaliada, com comparação ao terminar; microconversa e exercícios gerados por IA ficam para outra etapa. |
| 4. Sessões rápidas | **IMPLEMENTADO** | Home e aula oferecem 5/15/30 minutos ou sessão completa; plano dinâmico e fila de cartões respeitam o orçamento estimado. |
| 5. Caderno de erros | **PARCIAL** | **Meus erros** recebe exercícios objetivos, correções de escrita e dificuldades avaliadas de fala; guarda uma correção consolidada por atividade e ainda falta vínculo explícito com curso/idioma. |
| 6. Revisão espaçada unificada | **PARCIAL** | `ReviewScheduler` agenda palavras, estruturas curadas, erros e frases no mesmo fluxo; estruturas têm calendário próprio no JSON do aluno. Pronúncia ainda não tem agendamento granular, e a projeção relacional das estruturas fica para migração futura. |
| 7. Dicionário contextual | **PARCIAL** | **Vocabulário** mostra sentidos curados, ocorrências, buscas recentes, áudio e revisão automática; há nota regional para termos curados e `llamarse`, mas ainda faltam cobertura ampla e busca por variantes. |
| 8. Números ativos | **PARCIAL** | **Fundamentos → Números** oferece catálogo com áudio e exemplos; a prática inclui ditado, ver e falar, ouvir e repetir, com dinheiro, datas, horários, telefone, números grandes e ordinais. As tentativas alimentam o perfil e as recomendações; o banco de exemplos ainda é curado e limitado. |
| 9. Particularidades contextualizadas | **PARCIAL** | **Fundamentos → Variações regionais** compara exemplos de Espanha, México e Argentina com áudio e checagem curta; o professor IA recebe a preferência. Faltam mais categorias, exemplos e integração ao perfil de domínio. |
| 10. Shadowing | **PARCIAL** | **Praticar fala** permite repetir, avaliar, ver palavras fracas e comparar tentativas; ritmo/prosódia específicos e modo contínuo ainda dependem de evolução. |
| 11. Fale sem ler | **IMPLEMENTADO** | Fluxo em três etapas: imitar com texto, reproduzir só com áudio e criar uma fala própria; as duas primeiras usam avaliação Azure e a fala livre é salva sem nota automática. |
| 12. Flashcards ligados ao domínio | **PARCIAL** | Cartões alternam palavra→significado, significado→palavra, áudio→palavra e lacuna quando há exemplo literal; estruturas curadas pedem produção de exemplo. Imagem→termo e lacunas de formas flexionadas ainda faltam. |
| 13. Explicar imagem | **PENDENTE** | Não existe atividade com imagem e avaliação da descrição falada. |
| 14. Missões comunicativas | **PARCIAL** | Duas missões A1 acompanham objetivos indicados pela IA e guardam o histórico; faltam mais cenários e validação pedagógica dos objetivos. |
| 15. Role-play com IA | **PARCIAL** | Conversas em texto com personagens de colega e atendente, áudio das respostas e controle de ritmo; faltam mais cenários e fala espontânea do aluno. |
| 16. Conversação livre adaptativa | **PARCIAL** | Conversa livre com assunto escolhido, turnos persistidos, contexto curto do aluno e correção configurável; a interação ainda é digitada. |
| 17. Tutor persistente | **PARCIAL** | O professor recebe contexto da aula; conversas agora usam meta, região, vocabulário conhecido e dificuldades recentes. Falta memória pedagógica longitudinal. |
| 18. Microlição a partir dos erros | **PARCIAL** | **Meus erros** e **Estatísticas** abrem uma microlição com explicação do erro e questão objetiva gerada por IA. A resposta é registrada no perfil; ainda falta uma sequência adaptativa de várias questões. |
| 19. Memória ativa de comportamento | **PARCIAL** | Buscas exatas e áudios de vocabulário geram eventos e incluem o termo na revisão após três usos do mesmo tipo; abandono e sinais conversacionais ainda faltam. |
| 20. Evolução por tentativa | **PARCIAL** | Histórico e **Praticar fala** mostram tentativas de shadowing e pronúncia; produção própria sem nota e futuras avaliações conversacionais não geram séries numéricas. |
| 21. Três modos de conversa | **PARCIAL** | Prática livre e role-play têm fluxos separados. A avaliação oral oficial segue em análise no item 25. |
| 22. Prova adaptativa escrita/objetiva | **PENDENTE** | Existe teste final fixo; ele não ajusta a dificuldade durante a prova. |
| 23. Relatório por competências | **PARCIAL** | O resultado mostra nota objetiva e competências avaliadas; faltam metas configuráveis e cobertura completa de escrita e fala. |
| 24. Feedback pós-avaliação | **PARCIAL** | Tentativas e erros do teste alimentam perfil e revisão; falta um plano pós-prova explícito por competência. |
| 25. Avaliação oral conversacional | **ADIADO** | A versão oficial continua **EM ANÁLISE** no próprio roadmap. |
| 26. AI Bridge | **PENDENTE** | Não há fluxo de exportação/importação de prática com outras IAs. |
| 27. Ritmo de conversa por nível | **PARCIAL** | O aluno escolhe iniciante/intermediário/natural; a IA ajusta a extensão da resposta e o áudio muda de velocidade. Falta calibragem empírica por nível. |
| 28. Controle de correção em conversas | **PARCIAL** | Correção a cada resposta, apenas erros importantes, no final ou desligada; ainda falta avaliação da consistência das correções. |
| 29. Perfil regional | **PARCIAL** | A preferência por aluno (geral, Espanha, México, Argentina) é salva no estado, orienta exemplos, TTS do navegador e professor IA. A avaliação Azure usa es-ES/es-MX quando disponíveis; es-AR não existe para essa avaliação. Falta cobertura regional maior no curso. |
| 30. O que preciso melhorar? | **PARCIAL** | **Estatísticas** mostra prioridades, prática direta, explicação do erro e microlição quando há erro registrado; recomendações de números abrem o treino específico. Explicações e microlições de outras fontes ainda dependem de conteúdo próprio. |
| 31. Regra geral de IA | **PARCIAL** | Há provedor no servidor, contexto curto e resposta validada; o tutor ainda depende do curso espanhol e faltam as demais operações sugeridas. |
| 32. Telemetria pedagógica | **PARCIAL** | Tentativas, revisões, sessões, buscas, áudio, números, microlições, estruturas e eventos de conversa são registrados; ainda faltam sinais conversacionais no motor adaptativo. |
| 33. Regras para todas as features | **EM ANDAMENTO** | A auditoria e o registro foram aplicados a esta entrega; cada novo recurso ainda precisa passar pelas etapas de proposta, validação e documentação. |

---

# Ordem recomendada de desenvolvimento

A sequência abaixo foi organizada para que os recursos mais avançados reutilizem dados e serviços dos anteriores.

---

# 1. Perfil de domínio do aluno

**Status: APROVADO**

## Objetivo

Criar uma camada central que represente o que o usuário sabe, o que ainda está aprendendo e onde estão suas dificuldades.

Não limitar o progresso a:

> Unidade 3 — 70% concluída.

O sistema deve saber **quais competências** estão fortes ou fracas.

## Estrutura esperada

O perfil deve conseguir registrar domínio em níveis diferentes.

### Por habilidade

- vocabulário;
- gramática;
- listening;
- speaking;
- writing;
- reading;
- pronúncia;
- fluência;
- compreensão.

### Por tópico

Exemplo em espanhol:

- números;
- nacionalidades;
- profissões;
- família;
- casa;
- comida.

### Por conceito

Exemplo:

- ser;
- estar;
- tener;
- hay;
- interrogativos;
- artigos.

### Por item

Exemplo:

- palavra `trabajar`;
- expressão `me llamo`;
- som específico;
- estrutura `tener + edad`.

## Exemplo de visualização

```text
ESPANHOL A1

Apresentação       94
Números            82
Família            65
Casa               74

GRAMÁTICA

Ser                91
Tener              63
Hay                 76

FALA

Pronúncia          84
Fluência           67
Compreensão        81
```

## Regras

- não calcular tudo apenas por quantidade de páginas concluídas;
- erros recentes devem pesar mais;
- acertos repetidos aumentam domínio;
- domínio pode diminuir após muito tempo sem revisão;
- speaking e pronúncia devem usar dados reais quando disponíveis;
- permitir múltiplos idiomas por usuário.

## Antes de implementar

Verificar se já existem:

- `skill_progress`;
- `unit_progress`;
- `lesson_progress`;
- métricas de pronúncia;
- sistema de mastery;
- tabelas de revisão;
- histórico de tentativas.

Se existirem, consolidar ou estender.

---

# 2. Motor adaptativo de aprendizado

**Status: APROVADO**

## Objetivo

Criar um serviço que escolha as próximas atividades do usuário com base no perfil de domínio.

O sistema deve responder:

> O que é mais útil este usuário estudar agora?

## Entradas possíveis

- revisão vencida;
- erros recorrentes;
- baixa pronúncia;
- baixa fluência;
- palavras difíceis;
- palavras consultadas repetidamente;
- conteúdo atual da trilha;
- último estudo;
- tempo disponível;
- desempenho em avaliações;
- frequência de estudo.

## Saída

Lista priorizada de atividades.

Exemplo:

```json
[
  {
    "type": "review",
    "topic": "tener",
    "priority": 100
  },
  {
    "type": "pronunciation",
    "item": "trabajo",
    "priority": 85
  },
  {
    "type": "lesson",
    "lessonId": "...",
    "priority": 70
  }
]
```

## Arquitetura

Criar um serviço isolado, por exemplo:

```text
LearningRecommendationEngine
```

Evitar lógica espalhada em componentes React.

---

# 3. “Treinar minhas dificuldades”

**Status: APROVADO**

## Objetivo

Adicionar uma ação rápida que monte uma sessão personalizada usando apenas os pontos de maior dificuldade do usuário.

## Exemplo

O sistema detecta:

```text
ser x estar      6 erros
tener            4 erros
números          3 erros
pronúncia de RR  8 dificuldades
```

O usuário clica:

> **Treinar minhas dificuldades**

O sistema gera:

```text
2 min  revisão
5      exercícios direcionados
3      frases faladas
1      microconversa
```

## Requisitos

- usar o motor adaptativo;
- não gerar exercícios aleatórios sem relação com o histórico;
- registrar se houve melhora depois da sessão;
- atualizar domínio ao final;
- funcionar para qualquer idioma.

---

# 4. Sessões rápidas por tempo disponível

**Status: APROVADO**

## Objetivo

Permitir ao usuário estudar sem precisar decidir o que fazer.

Na home:

> **Quanto tempo você tem?**

- 5 minutos;
- 15 minutos;
- 30 minutos;
- sessão completa.

## Montagem da sessão

Usar:

- revisão pendente;
- erros;
- unidade atual;
- speaking;
- pronúncia;
- vocabulário.

## Exemplo — 15 minutos

```text
3 min revisão
4 min vocabulário
4 min conteúdo atual
2 min speaking
2 min revisão final
```

## Regra

A composição deve ser dinâmica.

Não hardcodar a mesma sessão para todos.

---

# 5. Caderno automático de erros

**Status: APROVADO**

## Objetivo

Registrar erros importantes e reutilizá-los em revisões futuras.

## Exemplo

```text
❌ Soy 31 años.
✅ Tengo 31 años.

Motivo:
Para indicar idade em espanhol usamos "tener".
```

## Campos sugeridos

```text
user_id
language_id
course_id
unit_id
activity_id
category
topic
original_answer
correct_answer
explanation
times_missed
times_correct
last_missed_at
last_correct_at
mastery_score
next_review_at
```

## Categorias

- grammar;
- vocabulary;
- spelling;
- listening;
- writing;
- speaking;
- pronunciation.

## Regra

Antes de criar nova tabela, verificar se tentativas ou feedback já armazenam esses dados.

---

# 6. Revisão espaçada unificada

**Status: APROVADO**

## Objetivo

Criar um único mecanismo de revisão para:

- vocabulário;
- erros;
- expressões;
- estruturas gramaticais;
- frases;
- pronúncia;
- conteúdo aprendido.

## Fluxo inicial aceitável

```text
errou       → amanhã
acertou 1x  → 3 dias
acertou 2x  → 7 dias
acertou 3x  → 15 dias
acertou 4x  → 30 dias
```

## Arquitetura

Criar serviço desacoplado:

```text
ReviewScheduler
```

A implementação deve poder evoluir sem alterar as telas.

---

# 7. Dicionário contextual inteligente

**Status: APROVADO**

## Objetivo

Evoluir o dicionário existente para uma ferramenta ligada ao aprendizado do usuário.

Não mostrar apenas tradução.

## Exemplo

```text
QUEDAR

1. combinar
¿Quedamos a las ocho?

2. permanecer
Me quedo en casa.

3. estar localizado
¿Dónde queda el hotel?
```

## Informações adicionais

Mostrar quando disponível:

- traduções por contexto;
- exemplos;
- nível estimado;
- classe gramatical;
- áudio;
- diferenças regionais;
- conteúdos do curso onde apareceu.

## Integração com progresso

Mostrar:

```text
Já apareceu:
Unidade 3 — Exercício 5

Você errou:
2 vezes

Última revisão:
há 4 dias
```

## Comportamento inteligente

Se o usuário pesquisar a mesma palavra várias vezes:

> Você pesquisou "trabajar" várias vezes. Deseja praticar?

A palavra pode entrar automaticamente na fila de revisão conforme regras definidas.

---

# 8. Área de números como ferramenta ativa

**Status: APROVADO**

## Objetivo

A área de números não deve funcionar apenas como tabela de consulta.

Transformá-la em ferramenta de prática.

## Modos

- ouvir um número e digitar;
- ver número e falar;
- ouvir e repetir;
- ditado;
- dinheiro;
- datas;
- horários;
- telefone;
- números grandes;
- números ordinais quando aplicável.

## Integração

Usar Azure Speech nas atividades faladas.

Registrar dificuldades específicas.

Exemplo:

```text
47 → dificuldade recorrente
70/17 → confusão frequente
```

Essas informações devem alimentar o perfil de domínio.

---

# 9. Particularidades da língua contextualizadas

**Status: APROVADO**

## Objetivo

Evoluir a seção já existente de particularidades para que ela participe do aprendizado.

## Exemplos

Espanhol:

```text
España
ordenador

México
computadora

Argentina
computadora
```

## Categorias

- diferenças regionais;
- vocabulário;
- pronúncia;
- formas de tratamento;
- formalidade;
- construções frequentes;
- falsos cognatos;
- erros comuns de falantes de português.

## Integração com IA

Se uma conversa estiver configurada para:

```text
Região: México
```

a IA deve preferir variantes adequadas a esse contexto quando aplicável.

---

# 10. Modo Shadowing

**Status: APROVADO**

## Objetivo

Permitir que o aluno imite frases e receba feedback detalhado.

## Fluxo

Sistema toca:

> Me llamo María y vivo en Madrid.

Usuário repete.

O sistema avalia com Azure Speech.

## Métricas

Quando disponíveis:

- pronúncia;
- accuracy;
- fluência;
- ritmo;
- prosódia;
- palavras problemáticas.

## Evolução visual

```text
Tentativa 1  72
Tentativa 2  81
Tentativa 3  89
```

## Requisitos

- permitir repetir;
- destacar palavras fracas;
- mostrar evolução;
- salvar histórico;
- atualizar domínio de pronúncia.

---

# 11. “Fale sem ler”

**Status: APROVADO**

## Objetivo

Transformar repetição em produção ativa.

## Fluxo em três etapas

### Etapa 1 — Imitar

Texto visível:

> Me llamo Carlos y trabajo en una tienda.

Usuário repete olhando.

### Etapa 2 — Memória

Ocultar a frase.

Tocar apenas o áudio.

Usuário tenta reproduzir.

### Etapa 3 — Produção própria

> Agora diga a mesma ideia falando sobre você.

O aluno precisa criar sua própria frase.

## Objetivo pedagógico

```text
imitação
↓
memória
↓
produção
```

## Requisitos

Reutilizar:

- player de áudio;
- Azure Speech;
- avaliação de speaking;
- histórico de tentativas.

---

# 12. Flashcards ligados ao domínio

**Status: APROVADO**

## Objetivo

Criar flashcards integrados ao sistema de revisão.

## Tipos

- palavra → significado;
- significado → palavra;
- áudio → palavra;
- frase com lacuna;
- imagem → termo;
- estrutura → exemplo.

## Ações

- conheço;
- não conheço;
- difícil.

## Regra

A resposta deve alimentar:

- domínio;
- fila de revisão;
- vocabulário;
- recomendação de atividades.

Não criar um sistema isolado de flashcards.

---

# 13. Explicar uma imagem

**Status: APROVADO**

## Objetivo

Estimular produção espontânea sem fornecer previamente a frase.

## Fluxo

Mostrar uma imagem adequada ao nível.

Perguntar:

> ¿Qué ves?

Exemplo de respostas esperadas no A1:

```text
Hay cuatro personas.
Hay una mesa.
La casa es grande.
```

## Evolução

Em níveis maiores:

- descrever ações;
- inferir contexto;
- contar história;
- comparar imagens;
- opinar.

## Avaliação

A IA pode analisar:

- cumprimento da tarefa;
- vocabulário;
- gramática;
- complexidade apropriada ao nível.

Pronúncia continua sendo avaliada pelo motor de speech quando aplicável.

---

# 14. Missões comunicativas

**Status: APROVADO**

## Objetivo

Transformar objetivos pedagógicos em pequenas situações reais.

Não apresentar ao usuário uma lista mecânica de questões.

## Exemplo

### Missão: conheça um novo colega

Objetivos internos:

- dizer nome;
- dizer onde mora;
- dizer profissão;
- perguntar o nome da outra pessoa.

O usuário vê apenas a situação.

Ao final:

```text
Objetivos cumpridos: 3/4
```

## Arquitetura

Criar definição configurável:

```json
{
  "scenario": "meet_new_colleague",
  "level": "A1",
  "objectives": [
    "say_name",
    "say_city",
    "say_profession",
    "ask_name"
  ]
}
```

---

# 15. Role-play com IA

**Status: APROVADO**

## Objetivo

Criar conversas contextualizadas com personagens.

## Exemplos

- conhecer novo colega;
- check-in em hotel;
- restaurante;
- supermercado;
- aeroporto;
- pedir informação;
- entrevista;
- comprar roupa;
- pedir ajuda;
- falar com professor.

## Diferença para conversa livre

No role-play a IA possui:

- personagem;
- objetivo;
- cenário;
- dificuldade;
- conteúdo esperado.

## Regras

A IA deve permanecer no papel.

O sistema deve adaptar:

- vocabulário;
- velocidade;
- complexidade;
- quantidade de ajuda;

ao nível do usuário.

---

# 16. Conversação livre com tutor adaptativo

**Status: APROVADO**

## Objetivo

Permitir prática de conversação sem avaliação formal.

Exemplo:

> Quero conversar sobre futebol.

## Tutor deve conhecer

```text
Idioma
Nível
Unidade atual
Vocabulário conhecido
Principais dificuldades
Meta do aluno
Preferência regional
```

## Comportamento

- adaptar frases ao nível;
- evitar vocabulário excessivamente avançado;
- permitir erro;
- corrigir de forma leve;
- permitir pedir explicação;
- registrar dificuldades relevantes.

## Modos de correção

Configuração sugerida:

- corrigir imediatamente;
- corrigir apenas erros importantes;
- corrigir no final;
- não corrigir.

---

# 17. Tutor persistente do Destrava

**Status: APROVADO**

## Objetivo

Ter um tutor contextual, não um chatbot genérico.

## Exemplo de contexto

```text
Idioma: espanhol
Nível: A1
Unidade: 2
Vocabulário conhecido: 186
Maior dificuldade: verbos
Pronúncia: boa
Speaking: abaixo da média
Meta: conversação
```

## Exemplos de comandos

- "Tenho 15 minutos."
- "Não entendi esta questão."
- "Explique de outro jeito."
- "Me dê outro exemplo."
- "Quero treinar minha pronúncia."
- "Quero revisar o que errei esta semana."

## Arquitetura

Criar camada de contexto:

```text
TutorContextBuilder
```

Nunca enviar ao modelo todo o histórico do usuário.

Selecionar apenas o contexto relevante.

---

# 18. Lição automática gerada a partir dos erros

**Status: APROVADO**

## Objetivo

Gerar microlições personalizadas a partir das dificuldades reais.

## Exemplo

Erros detectados:

```text
ser x estar
tener
interrogativos
```

O sistema gera uma microlição:

1. explicação curta;
2. dois exemplos;
3. três exercícios;
4. uma atividade falada;
5. miniavaliação.

## Regras

- não gerar aula longa;
- focar no problema detectado;
- reutilizar conteúdo existente quando possível;
- não criar conteúdo duplicado se já existir uma revisão adequada;
- registrar se houve melhora após a microlição.

---

# 19. Memória ativa baseada no comportamento

**Status: APROVADO**

## Objetivo

Transformar ações espontâneas do usuário em sinais de aprendizado.

## Exemplos de sinais

- pesquisou mesma palavra várias vezes;
- ouviu mesma palavra várias vezes;
- repetiu uma frase muitas vezes;
- errou mesmo conceito em diferentes atividades;
- abriu explicação várias vezes;
- abandonou determinada atividade;
- marcou palavra como difícil.

## Uso dos sinais

Esses comportamentos podem:

- aumentar prioridade de revisão;
- incluir item em "Treinar dificuldades";
- sugerir microlição;
- alterar mastery score.

---

# 20. Histórico de evolução por tentativa

**Status: APROVADO**

## Objetivo

Mostrar evolução real, especialmente em speaking e pronúncia.

## Exemplo

```text
"trabajo"

01/10  62
03/10  74
07/10  86
```

## Aplicar em

- palavras;
- frases;
- shadowing;
- speaking;
- avaliações;
- testes.

## Importante

O histórico não deve ser apenas decorativo.

Ele também deve alimentar o motor adaptativo.

---

# 21. Três modos distintos de conversa

**Status: APROVADO**

Criar separação clara entre:

## 21.1 Prática livre

Sem nota.

Objetivo:

- ganhar confiança;
- conversar;
- experimentar.

---

## 21.2 Role-play

Cenário e missão específicos.

Objetivo:

- praticar situações reais;
- trabalhar vocabulário contextual.

---

## 21.3 Avaliação oral

Conversa controlada para verificar domínio.

**A implementação final desta terceira modalidade permanece EM ANÁLISE e está detalhada no item 25.**

---

# 22. Prova adaptativa escrita/objetiva

**Status: APROVADO**

## Objetivo

As avaliações não precisam ser estáticas.

Se o aluno demonstrar domínio com facilidade:

- aumentar ligeiramente a dificuldade;
- testar aplicação em contexto.

Se demonstrar dificuldade:

- reduzir complexidade;
- confirmar domínio básico.

## Importante

Não penalizar o usuário por conteúdos que estejam oficialmente fora do nível/unidade.

Questões acima do nível podem servir apenas para medir teto.

---

# 23. Relatório de avaliação por competências

**Status: APROVADO**

## Objetivo

Evitar que uma avaliação termine apenas em:

> Nota: 81%

Mostrar dimensões.

Exemplo:

```text
Compreensão        89
Gramática          76
Vocabulário        84
Fluência           71
Pronúncia          88
Objetivos          5/6
```

## Resultado

Pode existir:

```text
Aprovado
Não aprovado
Revisão recomendada
```

## Regra de aprovação

Exemplo:

- nota geral >= 75;
- nenhuma competência crítica < 60;
- objetivos obrigatórios cumpridos;
- atividade concluída.

Esses thresholds devem ser configuráveis.

---

# 24. Feedback pós-avaliação alimentando o curso

**Status: APROVADO**

## Objetivo

Toda avaliação deve gerar ações futuras.

Exemplo:

Aluno aprovado com dificuldade em:

- `tener`;
- interrogativos;
- fluência.

O sistema cria:

- revisão de `tener`;
- exercício de perguntas;
- atividade de speaking.

## Regra

Passar em uma prova não significa eliminar dificuldades do perfil.

---

# 25. Avaliação oral conversacional com IA

**Status: EM ANÁLISE**

> Não implementar a versão definitiva sem nova decisão de produto.

## Objetivo

Usar uma conversa real como avaliação para avanço de unidade ou comprovação de domínio.

## Conceito

O usuário clica:

> Fazer prova oral

Uma conversa é iniciada.

O sistema precisa avaliar de forma natural se o usuário domina os objetivos da unidade.

### Exemplo — Unidade 1

Objetivos:

- dizer nome;
- dizer idade;
- dizer nacionalidade;
- dizer profissão;
- dizer onde mora;
- informar idiomas;
- compreender perguntas pessoais;
- fazer pelo menos uma pergunta.

---

## 25.1 Separar examinador e avaliador

Não usar um único prompt para:

- conversar;
- ensinar;
- corrigir;
- avaliar;
- gerar nota;
- produzir relatório.

### Agente 1 — Examinador

Responsável apenas por conduzir a conversa.

Deve saber:

- idioma;
- nível;
- unidade;
- duração;
- objetivos;
- conteúdo já aprendido;
- vocabulário permitido;
- grau de ajuda permitido.

### Agente 2 — Avaliador

Recebe depois:

- objetivos;
- rubrica;
- transcript;
- métricas de speech;
- quantidade de ajuda solicitada.

Retorna structured output.

---

## 25.2 Não corrigir durante a prova

Durante avaliação formal:

- não explicar gramática;
- não revelar respostas;
- não corrigir imediatamente;
- não ensinar;
- não revelar os critérios;
- não transformar conversa em aula.

Se o usuário disser:

> Soy 31 años.

O examinador continua a conversa.

O erro entra no relatório final.

---

## 25.3 Objetivos, não perguntas fixas

Não criar roteiro do tipo:

```text
1. Como se chama?
2. Onde mora?
3. Qual sua profissão?
```

Criar objetivos obrigatórios.

Exemplo:

```json
{
  "requiredGoals": [
    "obtain_name",
    "obtain_age",
    "obtain_nationality",
    "obtain_profession",
    "obtain_city",
    "user_asks_question"
  ]
}
```

A IA deve alcançar esses objetivos naturalmente.

Isso evita que a prova possa ser decorada.

---

## 25.4 Eventos ocultos

O agente pode introduzir situações naturais para testar determinadas competências.

Exemplo:

Para números:

> Tengo treinta y dos años. ¿Y tú?

Para profissão:

> Yo trabajo en un hospital. ¿Dónde trabajas tú?

Para idiomas:

> Hablo español e inglés. ¿Qué idiomas hablas?

---

## 25.5 Prova adaptativa

Se o usuário responder com facilidade, aumentar ligeiramente a complexidade.

Exemplo:

Usuário:

> Vivo en São Paulo, pero trabajo para una empresa de Curitiba.

Agente:

> ¿Y te gusta vivir en São Paulo? ¿Por qué?

Isso serve para medir teto.

Não penalizar caso esteja fora do conteúdo oficial.

Se o usuário estiver com dificuldade, simplificar.

---

## 25.6 Avaliação técnica da fala

Separar responsabilidades.

### Azure Speech

Usar para:

- pronunciation;
- accuracy;
- fluency;
- prosody;
- fonemas/palavras problemáticas.

### LLM

Usar para:

- gramática;
- vocabulário;
- compreensão;
- cumprimento de objetivos;
- adequação das respostas;
- capacidade de manter interação.

Não pedir ao LLM para substituir uma avaliação acústica especializada quando houver dados do Azure.

---

## 25.7 Estrutura sugerida

```text
ExamDefinition
ExamSession
ExamEvaluation
ExamReport
```

### ExamDefinition

```text
language
level
unit
duration
requiredObjectives[]
conversationRules
allowedVocabulary
expectedGrammar
rubric
```

### ExamSession

```text
id
user
started_at
finished_at
transcript
audio references
hints
interruptions
events
```

### ExamEvaluation

```text
grammar
vocabulary
comprehension
fluency
pronunciation
objectives
overall_score
passed
recommended_review
```

---

## 25.8 Forma de executar a conversa — opções em análise

### Opção A — Conversa nativa dentro do Destrava

Possível arquitetura:

```text
OpenAI Realtime / modelo de voz
        +
Azure Speech para avaliação de pronúncia
```

Vantagens:

- experiência centralizada;
- transcript;
- controle;
- histórico;
- integração direta com progresso;
- resultado confiável.

Desafio principal:

- experiência de voz precisa ser fluida;
- interrupções;
- pausas;
- turn-taking;
- latência.

### Opção B — Usar IA externa do próprio usuário

Exemplo:

- ChatGPT;
- Claude;
- Gemini.

Destrava gera um prompt de avaliação.

Usuário realiza conversa no ambiente externo.

Depois importa o resultado.

Vantagens:

- usar experiência de voz já madura;
- menos infraestrutura inicial.

Desvantagens:

- menor controle;
- resultado manipulável;
- dificuldade para validar pronúncia;
- integração de retorno menos robusta.

### Opção C — Estratégia híbrida

Possível produto:

- prova oficial nativa;
- prática externa opcional.

Essa possibilidade segue em análise.

---

## 25.9 Não usar URL com nota como fonte confiável

Evitar:

```text
/result?grammar=80&passed=true
```

Problemas:

- usuário pode editar;
- resultado fica exposto;
- URL cresce;
- versão de schema difícil;
- validação fraca.

Quando prova for interna:

```text
/exams/{examId}/result
```

A URL contém apenas identificador.

Os dados ficam no banco.

---

# 26. AI Bridge — usar o Destrava com outras IAs

**Status: APROVADO PARA PRÁTICA; NÃO USAR COMO PROVA OFICIAL AINDA**

## Objetivo

Permitir que o Destrava gere prompts contextuais para uso em outras IAs.

Exemplos:

- ChatGPT;
- Claude;
- Gemini;
- outra.

## Possíveis atividades

- conversa livre;
- role-play;
- treino de entrevista;
- revisão de unidade;
- correção;
- prática oral.

## Contexto gerado pelo Destrava

```text
Idioma
Nível
Unidade
Conteúdo aprendido
Vocabulário
Gramática
Pontos fracos
Objetivo da sessão
```

## Importante

Para uso como prática:

- pode ser implementado;
- não considerar o resultado externo como nota oficial de avanço enquanto não houver mecanismo confiável de validação.

---

# 27. Ritmo de conversa por nível

**Status: APROVADO**

## Objetivo

Permitir que conversas de IA respeitem a capacidade do aluno.

Configuração sugerida:

```text
beginner
intermediate
natural
```

### Beginner

- esperar mais;
- frases curtas;
- ritmo reduzido;
- vocabulário controlado;
- tolerar pausas.

### Intermediate

- ritmo moderado;
- frases naturais;
- menor ajuda.

### Natural

- conversa próxima de um falante nativo.

## Aplicar em

- tutor;
- role-play;
- conversa livre;
- avaliação oral futura.

---

# 28. Controle de correção em conversas

**Status: APROVADO**

## Objetivo

O usuário pode escolher como quer ser corrigido.

Modos:

```text
instant
important_only
end_of_conversation
off
```

## Comportamento

### instant

Corrigir logo após o erro.

### important_only

Ignorar pequenos erros e corrigir apenas os que prejudicam entendimento.

### end_of_conversation

Não interromper a fluidez.

Mostrar resumo depois.

### off

Prática totalmente livre.

---

# 29. Perfil regional e variações do idioma

**Status: APROVADO**

## Objetivo

Permitir ao usuário estudar uma variante quando o idioma possuir diferenças relevantes.

Exemplo:

```text
Espanhol:
- neutro/geral;
- Espanha;
- México;
- Argentina;
- outros.

Inglês:
- americano;
- britânico;
- outros.
```

## Impactos

Quando aplicável:

- vocabulário;
- pronúncia;
- TTS;
- exemplos;
- particularidades;
- conversação.

Não duplicar todo o curso por região.

Usar overlays/configurações regionais.

---

# 30. Painel “O que preciso melhorar?”

**Status: APROVADO**

## Objetivo

Traduzir métricas técnicas em ações claras.

Em vez de apenas gráficos:

```text
Você precisa melhorar:
1. tener para idade
2. perguntas pessoais
3. fluência ao se apresentar
4. números entre 30 e 100
```

Botões:

- praticar agora;
- revisar;
- ver explicação;
- fazer microlição.

---

# 31. Regra geral de IA: usar IA como motor, não como conteúdo aleatório

**Status: APROVADO**

Toda implementação de IA deve seguir:

1. fornecer contexto mínimo suficiente;
2. usar dados reais de domínio do usuário;
3. preferir structured output;
4. validar resposta com schema;
5. não enviar histórico completo sem necessidade;
6. não gerar exercícios desconectados do currículo;
7. armazenar feedback relevante;
8. registrar custo quando possível;
9. permitir trocar de modelo/provedor;
10. não acoplar chamada de modelo a componentes de UI.

Sugestão de abstração:

```text
AIProvider
```

Métodos possíveis:

```text
generateAdaptiveLesson()
evaluateWriting()
evaluateConversation()
generateRoleplay()
explainMistake()
buildPracticeSession()
generateImagePrompt()
```

---

# 32. Telemetria pedagógica

**Status: APROVADO**

## Objetivo

Registrar eventos úteis para compreender aprendizagem.

Exemplos:

```text
lesson_started
lesson_completed
exercise_answered
exercise_correct
exercise_wrong
word_searched
word_repeated
pronunciation_attempted
pronunciation_improved
review_completed
flashcard_known
flashcard_missed
roleplay_started
roleplay_completed
tutor_used
micro_lesson_generated
```

## Regra

Separar telemetria pedagógica de analytics de marketing.

---

# 33. Regras de implementação para todas as features

**Status: APROVADO**

Para cada item deste roadmap:

## Etapa 1 — Auditoria

Antes de codificar, registrar:

```text
Feature:
Existe algo parecido?
Componentes reutilizáveis:
Serviços reutilizáveis:
Tabelas reutilizáveis:
Mudanças necessárias:
Nova estrutura necessária?
```

## Etapa 2 — Proposta

Explicar brevemente:

- como será implementado;
- o que será reaproveitado;
- impacto no banco;
- impacto no frontend;
- impacto em IA;
- impacto multilíngua.

## Etapa 3 — Implementação

Somente depois realizar mudanças.

## Etapa 4 — Validação

Verificar:

- desktop;
- mobile;
- acessibilidade;
- outro idioma;
- usuário sem histórico;
- usuário com histórico;
- loading;
- erros;
- empty states.

## Etapa 5 — Documentação

Atualizar este roadmap ou changelog indicando:

```text
IMPLEMENTADO
PARCIAL
ADIADO
SUBSTITUÍDO
```

e informar os principais arquivos envolvidos.

---

# 34. Critério de sucesso do Destrava

O objetivo de longo prazo não é apenas:

> disponibilizar aulas.

O produto deve formar um loop:

```text
APRENDER
   ↓
PRATICAR
   ↓
OBSERVAR O DESEMPENHO
   ↓
DETECTAR DIFICULDADES
   ↓
PERSONALIZAR
   ↓
REVISAR
   ↓
AVALIAR
   ↓
APRENDER NOVAMENTE
```

A principal inteligência do produto deve estar na capacidade de unir informações de diferentes ferramentas.

Exemplo:

```text
Dicionário
       ↘
Exercícios → Perfil de domínio → Motor adaptativo → Próxima atividade
       ↗
Pronúncia
       ↗
Conversas
       ↗
Avaliações
```

Se uma feature gerar dados úteis sobre aprendizado, esses dados não devem ficar presos àquela feature.

---

# 35. Prioridade resumida

## Fundação

1. Perfil de domínio
2. Motor adaptativo
3. Caderno de erros
4. Revisão espaçada
5. Telemetria pedagógica

## Personalização

6. Treinar minhas dificuldades
7. Sessões de 5/15/30 minutos
8. Memória ativa
9. Microlições geradas por erros
10. Painel "O que preciso melhorar?"

## Ferramentas de estudo

11. Dicionário contextual
12. Números ativos
13. Particularidades contextualizadas
14. Flashcards

## Speaking

15. Shadowing
16. Fale sem ler
17. Explicar imagem
18. Histórico de evolução
19. Ritmo por nível
20. Modos de correção

## IA conversacional

21. Tutor persistente
22. Conversação livre
23. Role-play
24. Missões comunicativas
25. AI Bridge

## Avaliação

26. Provas adaptativas
27. Relatórios por competência
28. Feedback pós-avaliação

## Em análise

29. Avaliação oral conversacional oficial
30. Arquitetura final de voz realtime para prova oficial

---

# 36. Instrução final para o agente

Não interpretar este arquivo como uma ordem para implementar tudo de uma vez.

Executar **uma feature por vez**, respeitando a ordem e dependências.

Antes de cada implementação:

> **PROCURE PRIMEIRO. ADAPTE ANTES DE CRIAR. GENERALIZE ANTES DE DUPLICAR.**

A arquitetura final deve continuar simples de manter, modular e multilíngua.

O Destrava deve parecer um único sistema inteligente de aprendizado, e não uma coleção de ferramentas independentes.

---

# Registro da entrega — perfil e recomendações (2026-10-01)

**Itens agrupados:** 1 (perfil de domínio), 2 (motor adaptativo) e 30 (painel “O que preciso melhorar?”).

**Status da entrega: PARCIAL** em relação ao escopo completo do roadmap. A primeira versão funcional está integrada à página inicial, à aula de hoje e à página de Estatísticas.

- **Implementado:** perfil estimado por habilidade, tópico, conceito e palavra/som, com ponderação por recência e perda gradual de confiança após longo tempo sem prática. Usa tentativas, avaliações de escrita e de pronúncia e revisão de vocabulário já persistidas.
- **Implementado:** motor de recomendações que prioriza revisões vencidas, erros recorrentes, baixa pronúncia ou fluência e atividades da trilha. Evita duplicar no plano uma dificuldade que já está na revisão vencida.
- **Implementado:** painel com justificativa e ação para cada prioridade; os links abrem a atividade exata. O mesmo motor organiza a aula de hoje e o foco exibido na página inicial.
- **Preparado para múltiplos idiomas:** cursos definem código do idioma e seus conceitos; as evidências são filtradas pelos IDs de atividade e lição do curso. IDs exclusivos são necessários ao adicionar outro idioma.
- **Ainda pendente:** seleção de vários cursos por usuário e isolamento completo do estado persistido por curso; sinais de buscas no dicionário, conversas de IA e provas orais; ações de explicação e microlição no painel. Esses dados/fluxos não existem hoje em formato confiável para compor o perfil.

**Reaproveitado:** `StudyState`, tentativas, `writing`, `speaking`, agendamentos de revisão, `dueReviewCounts`, planejador, páginas existentes e esquema de conteúdo. Não foi criada migração nem dependência de IA para calcular o perfil.

**Validação:** `npm.cmd run content:validate`, `npm.cmd run learning:verify`, `npm.cmd run typecheck`, `npm.cmd run lint` e `npm.cmd run build`.

---

# Registro da entrega — sessões e evolução (2026-10-01)

**Itens agrupados:** 3 (Treinar minhas dificuldades), 4 (sessões rápidas) e 20 (evolução por tentativa).

- **Implementado:** escolha de 5, 15, 30 minutos ou sessão completa na home e na aula, com planos baseados no mesmo motor de recomendações. A seleção de cartões é limitada ao plano e o tempo mostrado é estimado.
- **Implementado:** treino focado em dificuldades reais do curso, com estado vazio para quem ainda não tem evidência. O perfil já se atualiza quando as tentativas e revisões são registradas.
- **Implementado:** comparação ao terminar a sessão e histórico por tentativa para exercícios corrigidos, escrita avaliada, pronúncia, fluência e revisão de palavras. Uma primeira nota é identificada como primeira medida, sem alegar melhoria.
- **Ainda pendente nos itens 3 e 20:** microconversa e exercícios gerados por IA no treino focado; séries de shadowing e avaliação oral conversacional, que dependem de recursos futuros.

**Reaproveitado:** `StudyState`, `LearningRecommendationEngine`, `ReviewScheduler`, `ReviewQueue`, sessões e tentativas já persistidas. Metadados novos ficam no JSON do estado e no campo `performance` da sessão; não há migração de banco.

**Arquivos principais:** `src/domain/study/study-planner.ts`, `src/domain/study/practice-history.ts`, `src/app/study/page.tsx`, `src/app/history/page.tsx`, `src/app/dashboard/page.tsx`, `src/components/review/review-queue.tsx` e `src/components/study-provider.tsx`.

---

# Registro da entrega — revisão, dicionário e fala (2026-10-01)

**Itens agrupados:** 5, 6, 7, 10, 11, 12 e 19; ampliações dos itens 20 e 32.

- **Caderno e revisão:** feedback estruturado de escrita e avaliação Azure de fala atualizam o caderno existente. A fila usa o mesmo `ReviewScheduler` para palavras, correções e frases; cartões de vocabulário alternam direção e escuta. A resposta ao cartão de pronúncia mede recordação; a nova gravação na atividade mede a fala.
- **Dicionário e memória:** sentidos curados aparecem quando existem, junto das ocorrências no curso e do histórico de buscas. Três buscas exatas ou três reproduções do mesmo termo criam um item de vocabulário em aprendizado e o colocam na revisão. Os sinais ficam no estado e em `study_events.metadata`.
- **Prática oral:** nova página **Praticar fala** oferece shadowing com tentativas e palavras fracas e **Fale sem ler** em três etapas. Imitação e memória usam a frase fixa da atividade e a avaliação Azure já existente. Produção própria fica salva com áudio e transcrição, sem nota automática.
- **Limites atuais:** sentidos adicionais dependem de curadoria; ritmo/prosódia não são medidos separadamente; a correção escrita é consolidada por atividade; o estado ainda não é separado por curso/idioma. Não foi criada migração.

**Reaproveitado:** `StudyState`, `ReviewScheduler`, `ReviewQueue`, correção de escrita, gravação e API Azure, histórico e projeções Supabase existentes.

---

# Registro da entrega — números e microlições (2026-10-01)

**Itens agrupados:** 8 (números ativos), 18 (microlição a partir dos erros) e 30 (painel acionável), com ampliação dos itens 1, 2 e 32.

- **Números:** a nova página reúne ditado, leitura em voz alta e repetição. Os exemplos curados cobrem números básicos, dinheiro, datas, horários, telefone, números grandes e ordinais. A fala reutiliza a gravação e a avaliação Azure; cada tentativa guarda o número, modo, resposta e resultado no estado do aluno. Erros recentes geram recomendações e as notas alimentam o conceito **Números** do perfil.
- **Microlições:** o caderno de erros e as recomendações abrem a explicação do erro e permitem gerar uma questão objetiva por IA. A rota autenticada lê o erro salvo no Supabase, valida a atividade do curso e usa resposta estruturada. A tentativa é registrada, mas não altera a agenda de revisão nem conta como nota oficial.
- **Painel:** **O que preciso melhorar?** agora oferece explicação e acesso à microlição quando há erro no caderno, além de enviar dificuldades de números para o exemplo específico.
- **Limites:** o catálogo numérico atual é pequeno e específico do espanhol; outro idioma exige seu próprio catálogo e voz. A microlição cria uma questão por chamada, sem sequência adaptativa. Resultados de fala são indicadores de prática, não aprovação. Os novos históricos ficam no JSON de `user_study_state` e eventos, sem migração de banco.

**Reaproveitado:** `StudyState`, perfil de domínio, motor de recomendações, `SpeakingRecorder`, API Azure, `AIProvider`, guarda de requisições e caderno de erros.

---

# Registro da entrega — biblioteca de fundamentos (2026-10-01)

**Objetivo:** reunir conteúdos básicos do idioma em uma área extensível, começando por alfabeto e números.

- **Implementado:** menu **Fundamentos** com seleção de tema na mesma tela. O alfabeto existente foi extraído para um componente compartilhado; `/alphabet` continua acessível por links antigos. O catálogo de números ganhou busca, filtros por situação, forma por extenso, frase, tradução e áudio para cada item. Cada cartão abre o número correspondente na prática existente em `/numbers`.
- **Arquitetura:** a biblioteca mostra apenas temas disponíveis para o idioma do curso. O conteúdo inicial é espanhol; futuros idiomas podem trazer seus próprios catálogos e temas sem duplicar as práticas existentes.
- **Limite atual:** o catálogo de números contém 13 exemplos curados. A prática continua separada da consulta para preservar a tela de exercícios e seus históricos.

**Reaproveitado:** `spanishAlphabet`, `numberPrompts`, `SpeakButton`, filtros, busca e páginas existentes. Não há mudança de banco nem de API.

---

# Registro da entrega — variações regionais (2026-10-01)

**Itens agrupados:** 7 (dicionário contextual), 9 (particularidades contextualizadas) e 29 (perfil regional).

- **Implementado:** preferência Geral, Espanha, México ou Argentina em Configurações, persistida no `StudyState` por aluno e sincronizada no JSON já existente do Supabase. Não houve migração.
- **Implementado:** tema **Variações regionais** em Fundamentos, com comparações curadas, áudio de cada exemplo, fontes linguísticas e uma checagem curta por tema. O vocabulário mostra nota regional onde existe conteúdo curado.
- **Implementado:** áudio do navegador solicita a voz da região escolhida quando disponível; o professor IA recebe a preferência salva no servidor e evita tratar outras variantes corretas como erro. A avaliação Azure usa `es-ES` para Espanha e `es-MX` para México; Geral e Argentina mantêm o locale configurado no app, pois o serviço de avaliação não lista `es-AR`.
- **Limites:** o navegador pode não ter a voz regional solicitada; os exemplos são introdutórios e não representam todos os usos de cada país. A checagem ainda não alimenta o perfil de domínio. O curso A1 permanece com seu conteúdo base; os overlays regionais não o duplicam.

**Reaproveitado:** `StudyState`, `StudyProvider`, `SpeakButton`, página de Configurações, biblioteca de Fundamentos, `TutorContextBuilder`, API do professor e API Azure. O conteúdo regional é específico do espanhol e só aparece quando esse idioma está ativo.

---

# Registro da entrega — conversas e missões (2026-10-02)

**Itens agrupados:** 14, 15, 16, 21, 27 e 28; ampliação dos itens 17 e 32.

- **Implementado:** área **Conversar** com duas missões A1 e prática livre por assunto. Cada missão traz personagem, abertura e objetivos; a IA indica os objetivos cumpridos durante a conversa.
- **Implementado:** escolha de ritmo (iniciante, intermediário ou natural) e correção (a cada resposta, erros importantes, no final ou desligada). As respostas têm áudio e velocidade ajustada ao ritmo.
- **Persistência:** turnos, preferências da sessão, objetivos indicados e conclusão ficam no `StudyState`, com sincronização pelo JSON `user_study_state` existente. Conversas recentes podem ser retomadas; eventos de início, turno e conclusão entram na telemetria já existente. Não houve migração.
- **Segurança e custo:** rota autenticada usa o limite de IA por usuário, valida texto e opções, aceita somente cenários curados e limita histórico e tamanho da conversa. O contexto pedagógico é pequeno e lido do estado do próprio aluno no servidor.
- **Limites:** a produção do aluno é digitada; os objetivos da missão são indicadores de prática gerados por IA, sem nota oficial. O histórico conversacional ainda não alimenta o motor de recomendações e a calibração de correções/ritmo precisa ser observada em uso real.

**Reaproveitado:** `AIProvider`, Responses com saída estruturada, `guardAIRequest`, `StudyProvider`, armazenamento Supabase existente, `SpeakButton` e preferência regional.

---

# Registro da entrega — flashcards e revisão (2026-10-02)

**Itens agrupados:** 6 e 12, com ampliação do perfil de domínio (1), motor adaptativo (2) e telemetria (32).

- **Implementado:** quarto formato de cartão de vocabulário, com lacuna no exemplo quando a palavra aparece literalmente na frase. Cartões com pergunta em português só revelam o áudio da resposta depois da virada; o formato de escuta continua disponível antes da virada.
- **Implementado:** cartões curados de estrutura → exemplo para nome, idade, origem e residência. A fila de revisão e a aula de hoje usam o mesmo `ReviewScheduler` para estas estruturas; o painel conta estruturas vencidas e cartões novos.
- **Persistência e adaptação:** cada estrutura mantém calendário próprio e tentativas no JSON `user_study_state`. Acertos e erros entram no perfil por habilidade, lição, conceito e item. Estruturas vencidas entram nas recomendações e sessões planejadas. Eventos de estrutura usam a projeção de telemetria já existente.
- **Limites:** como a tabela relacional `review_schedules` exige vínculo com vocabulário ou erro, os calendários de estrutura ficam no estado JSON, sem migração. A lacuna literal não cobre flexões como `tener` → `tengo`; imagem → termo e agendamento granular de pronúncia ficam para etapas futuras.

**Reaproveitado:** `ReviewQueue`, `ReviewScheduler`, `StudyState`, `StudyProvider`, planejador, perfil de domínio e repositório Supabase existente.
