# Destrava

**Aprenda. Pratique. Destrave.**

O **Destrava** é uma plataforma multilíngua de aprendizado orientada por prática, adaptação e contexto real.

O projeto começou com espanhol A1, mas a direção atual é mais ampla: construir um **motor de aprendizagem reutilizável entre idiomas**, no qual novos cursos e novas línguas entram principalmente como conteúdo e configuração, sem recriar a aplicação para cada idioma.

A proposta não é ser apenas um curso digital. O Destrava combina conteúdo estruturado, revisão inteligente, conversação, pronúncia, IA e um perfil de domínio que aprende com o próprio uso do aluno.

---

## Visão do produto

O Destrava deve responder continuamente a uma pergunta:

> **O que esta pessoa precisa praticar agora?**

Para isso, o sistema reúne evidências de várias partes da experiência:

- exercícios;
- revisão espaçada;
- vocabulário;
- dicionário;
- pronúncia;
- speaking;
- escrita;
- conversas;
- role-plays;
- missões;
- avaliações;
- microlições;
- histórico de erros;
- comportamento de estudo.

Esses dados alimentam um perfil central de aprendizado e um motor de recomendações.

```text
Aprender
   ↓
Praticar
   ↓
Observar desempenho
   ↓
Detectar dificuldades
   ↓
Personalizar
   ↓
Revisar
   ↓
Avaliar
   ↓
Aprender novamente
```

---

# Princípios do Destrava

## 1. Multilíngua por arquitetura

O motor não deve conhecer espanhol, inglês ou qualquer outro idioma diretamente.

A arquitetura em evolução segue quatro camadas:

```text
Destrava Core
    ↓
LanguagePackage
    ↓
CoursePackage
    ↓
UserLearningState
```

### Destrava Core

Responsável pelas regras reutilizáveis da plataforma:

- atividades;
- progresso;
- domínio;
- revisão;
- recomendações;
- tutor;
- conversação;
- avaliações;
- telemetria;
- UI;
- integração com speech e IA.

### LanguagePackage

Descreve **como um idioma funciona** dentro do Destrava.

Exemplos:

- sistema de escrita;
- variantes;
- capabilities;
- speech;
- normalização;
- alfabeto;
- números;
- particularidades;
- módulos específicos do idioma.

### CoursePackage

Descreve **como um curso ensina um idioma**.

Exemplos:

- idioma de origem;
- idioma-alvo;
- nível;
- unidades;
- lições;
- conceitos;
- vocabulário;
- atividades;
- missões;
- role-plays;
- avaliações.

### UserLearningState

Guarda o estado de uma pessoa em um curso específico:

- progresso;
- domínio;
- erros;
- revisões;
- vocabulário;
- histórico;
- preferências;
- speaking;
- escrita;
- sessões.

A meta arquitetural é simples:

> **Adicionar um novo idioma suportado pelos recursos existentes não deve exigir alteração no Core.**

E:

> **Adicionar uma nova unidade deve ser principalmente um trabalho de conteúdo.**

---

# Motor adaptativo de aprendizado

O Destrava mantém um perfil estimado por:

- habilidade;
- tópico;
- conceito;
- palavra;
- estrutura;
- som;
- histórico de tentativas.

Entre as habilidades acompanhadas estão:

- reading;
- writing;
- listening;
- speaking;
- vocabulary;
- grammar;
- pronunciation;
- fluency;
- comprehension.

Resultados recentes têm mais peso, e ausência de evidência não é tratada como nota zero.

O `LearningRecommendationEngine` utiliza esse perfil para priorizar:

- revisões vencidas;
- erros recorrentes;
- dificuldades de pronúncia;
- baixa fluência;
- vocabulário difícil;
- conteúdo atual da trilha;
- atividades ainda não dominadas.

---

# Estudo personalizado

## Aula de hoje

A sessão pode combinar automaticamente:

- revisão;
- vocabulário;
- conteúdo da trilha;
- exercícios;
- speaking;
- pronúncia;
- reforço de dificuldades.

O usuário não precisa decidir manualmente cada atividade.

## Sessões rápidas

A home permite iniciar sessões de:

- 5 minutos;
- 15 minutos;
- 30 minutos;
- sessão completa.

O plano respeita o tempo disponível e prioriza o que tem maior valor naquele momento.

## Treinar minhas dificuldades

Cria uma sessão específica com base em evidências reais do aluno:

- erros;
- palavras difíceis;
- conceitos fracos;
- dificuldades de fala;
- revisões pendentes.

---

# Perfil de aprendizado

O Destrava não representa o aprendizado apenas como:

> Unidade 2 — 70%

O objetivo é mostrar domínio real.

Exemplo:

```text
Gramática
Ser                 91
Tener               63

Vocabulário
Apresentação        94
Números             82

Fala
Pronúncia           84
Fluência            67
Compreensão         81
```

Esse perfil também alimenta:

- recomendações;
- revisão;
- microlições;
- sessões rápidas;
- painel **O que preciso melhorar?**.

---

# Revisão e memória

## Revisão espaçada

O mesmo sistema pode revisar:

- palavras;
- expressões;
- estruturas;
- erros;
- frases;
- conceitos;
- pronúncia.

## Caderno de erros

Erros importantes são registrados e podem voltar como revisão ou microlição.

Exemplo:

```text
❌ Soy 31 años.
✅ Tengo 31 años.
```

O sistema acompanha recorrência, último erro, acertos posteriores e domínio.

## Memória ativa

O comportamento do usuário também pode gerar sinais.

Exemplos:

- pesquisar a mesma palavra várias vezes;
- reproduzir um termo repetidamente;
- abrir a mesma explicação;
- repetir uma frase;
- abandonar determinada atividade;
- marcar uma palavra como difícil.

Esses sinais ajudam o motor a decidir o que priorizar.

---

# Vocabulário e dicionário

A área de vocabulário não funciona apenas como lista.

Os termos podem reunir:

- significado;
- classe gramatical;
- exemplos;
- tradução;
- áudio;
- nível;
- ocorrências no curso;
- variantes regionais;
- histórico de uso;
- status de aprendizado.

Uma mesma entrada de léxico deve abastecer:

```text
Dicionário
Flashcards
Revisão
Aulas
Tutor
Perfil de domínio
```

---

# Flashcards

A fila de revisão suporta diferentes formatos:

- palavra → significado;
- significado → palavra;
- áudio → palavra;
- frase com lacuna;
- imagem → termo;
- estrutura → exemplo.

As respostas alimentam o domínio e o agendamento de revisão.

---

# Fundamentos

A área **Fundamentos** reúne módulos específicos de cada idioma.

Atualmente há recursos como:

- alfabeto;
- números;
- variações regionais.

A arquitetura multilíngua permite que outros idiomas habilitem módulos diferentes.

Exemplos futuros:

- tons;
- caracteres;
- romanização;
- sistemas de escrita;
- partículas;
- particularidades fonéticas.

Um módulo não precisa existir para todos os idiomas.

---

# Números

A área de números trabalha consulta e prática.

Pode incluir:

- números básicos;
- dinheiro;
- datas;
- horários;
- telefone;
- números grandes;
- ordinais.

Modos de prática:

- ouvir e escrever;
- ver e falar;
- ouvir e repetir;
- ditado.

Tentativas alimentam o perfil e podem gerar recomendações.

---

# Speaking e pronúncia

O Destrava utiliza **Azure Speech** para atividades de avaliação técnica da fala.

Quando disponível, o sistema pode analisar:

- accuracy;
- fluency;
- completeness;
- palavras problemáticas;
- pronúncia.

## Praticar fala

A área reúne atividades como:

### Shadowing

O usuário ouve uma frase, repete e acompanha sua evolução por tentativa.

### Fale sem ler

Fluxo em três etapas:

```text
Imitação
   ↓
Memória
   ↓
Produção própria
```

### Repetição

Uma palavra ou frase pode ser gravada e comparada com uma referência.

---

# Conversação com IA

O Destrava possui diferentes formas de prática conversacional.

## Conversação livre

O aluno escolhe um assunto e conversa sem avaliação formal.

Exemplo:

> Quero conversar sobre futebol.

A conversa considera contexto do aluno, nível, idioma, preferências e dificuldades.

## Role-play

Cenários orientados por personagem e objetivo.

Exemplos:

- restaurante;
- hotel;
- aeroporto;
- supermercado;
- entrevista;
- conhecer alguém;
- pedir informação.

## Missões comunicativas

O usuário recebe uma situação, enquanto o sistema acompanha objetivos internos.

Exemplo:

```text
Missão: conheça um novo colega

Objetivos:
- dizer nome;
- dizer cidade;
- dizer profissão;
- perguntar o nome da outra pessoa.
```

## Ritmo e correção

Conversas podem respeitar diferentes ritmos:

- iniciante;
- intermediário;
- natural.

E diferentes modos de correção:

- imediata;
- somente erros importantes;
- ao final;
- desligada.

---

# Tutor de IA

O tutor não deve ser um chatbot genérico.

Ele recebe contexto curto e relevante, como:

- idioma;
- curso;
- nível;
- unidade;
- vocabulário conhecido;
- principais dificuldades;
- erros recentes;
- preferência regional;
- objetivos de estudo.

Exemplos de uso:

- “Tenho 15 minutos.”
- “Não entendi esta questão.”
- “Explique de outro jeito.”
- “Quero revisar meus erros.”
- “Quero treinar minha pronúncia.”

O histórico completo não é enviado ao modelo a cada chamada.

---

# Microlições

Erros salvos podem gerar microlições direcionadas.

Estrutura típica:

1. explicação curta;
2. exemplos;
3. exercícios progressivos;
4. prática oral;
5. checagem final.

A ideia é transformar um erro real em prática imediata, sem gerar aulas longas ou desconectadas do currículo.

---

# Explicar imagem

O aluno pode descrever uma cena por texto ou voz.

A atividade trabalha:

- vocabulário;
- gramática;
- produção espontânea;
- speaking;
- adequação ao nível.

O feedback por IA pode avaliar conteúdo e linguagem, enquanto o speech engine é usado para métricas acústicas quando aplicável.

---

# Avaliações

O Destrava já possui avaliação objetiva/adaptativa e relatórios por competência em evolução.

Avaliações podem alimentar:

- caderno de erros;
- revisão;
- perfil de domínio;
- recomendações;
- próximas atividades.

A avaliação oral conversacional oficial ainda é um tema em análise.

A direção estudada separa:

```text
Agente examinador
      ↓
Conversa
      ↓
Agente avaliador
      ↓
Relatório
```

Pronúncia técnica deve continuar sendo responsabilidade de um motor de speech especializado.

---

# IA no Destrava

A IA deve atuar como motor de apoio ao aprendizado, e não como geradora aleatória de conteúdo.

Princípios:

- contexto curto;
- dados reais do aluno;
- structured output;
- schemas validados;
- controle de custo;
- conteúdo conectado ao currículo;
- provedores desacoplados;
- histórico mínimo necessário.

Operações esperadas incluem:

- explicar erros;
- corrigir escrita;
- gerar microlições;
- conduzir role-play;
- apoiar conversação;
- construir sessões;
- avaliar produções;
- apoiar criação e validação de conteúdo.

---

# Arquitetura multilíngua em refatoração

A arquitetura original cresceu a partir do primeiro curso de espanhol.

Está em andamento uma refatoração para formalizar:

```text
LanguagePackage
CoursePackage
ActivityContract
UserLearningState
```

Objetivos da refatoração:

- remover dependências diretas de espanhol do Core;
- resolver o curso ativo por `courseId`;
- isolar completamente o estado por curso;
- mover speech e fundamentos para `LanguagePackage`;
- normalizar atividades, conceitos, léxico e avaliações;
- permitir novos idiomas através de conteúdo;
- criar validação e compilação de pacotes.

A validação final dessa arquitetura inclui um idioma sintético de teste antes da entrada de um segundo idioma real.

---

# Conteúdo como pacote

A direção atual separa autoria de runtime.

```text
Material / especialista / IA
              ↓
       Conteúdo estruturado
              ↓
      validação técnica
              ↓
     validação pedagógica
              ↓
           preview
              ↓
          compile
              ↓
          publish
              ↓
          Destrava
```

A criação de currículo deve acontecer fora do runtime.

O runtime recebe conteúdo estruturado e decide **como aquele usuário deve praticá-lo**.

---

# Stack

Principais tecnologias usadas no projeto:

- Next.js;
- React;
- TypeScript;
- Supabase;
- PostgreSQL;
- OpenAI API;
- Azure Speech;
- autenticação Supabase;
- Fly.io.

---

# Executar localmente

Requisitos:

- Node.js 20.9 ou superior;
- npm.

```powershell
npm.cmd install
npm.cmd run dev
```

Abra:

```text
http://localhost:3000
```

---

# Banco e autenticação

O projeto utiliza Supabase para:

- autenticação;
- estado do aluno;
- progresso;
- erros;
- sessões;
- telemetria;
- armazenamento de áudio;
- limites de uso de IA.

Para vincular um projeto:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref SEU_PROJECT_REF
npx.cmd supabase db push
```

Variáveis principais:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Segredos nunca devem usar prefixo `NEXT_PUBLIC_`.

---

# OpenAI

A OpenAI é usada no servidor para recursos como:

- tutor;
- conversação;
- escrita;
- feedback;
- microlições;
- operações pedagógicas com IA.

Configure:

```text
OPENAI_API_KEY
```

Nunca publique essa chave no navegador ou no Git.

---

# Azure Speech

Para avaliação de fala:

```text
AZURE_SPEECH_ENDPOINT
AZURE_SPEECH_KEY
AZURE_SPEECH_LOCALE
```

A configuração de locale está migrando para o `LanguagePackage`, para que o Core não tome decisões específicas de idioma.

---

# Segurança

O projeto inclui mecanismos como:

- autenticação Supabase;
- MFA;
- dispositivos confiáveis;
- OAuth Google;
- CAPTCHA;
- passkeys experimentais;
- limites atômicos de chamadas de IA;
- bucket privado para áudios;
- proteção de segredos no servidor.

As decisões e revisões de segurança devem continuar versionadas em documentos próprios, em vez de transformar o README em documentação operacional completa.

---

# Deploy

A aplicação possui configuração para Fly.io.

Deploy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-fly.ps1
```

Detalhes operacionais de domínio, SMTP, OAuth, CAPTCHA e segurança devem ser consultados na documentação específica do projeto.

---

# Validação

Execute antes de considerar uma entrega concluída:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run content:validate
npm.cmd run learning:verify
npm.cmd run build
```

Novos comandos ligados ao pipeline multilíngua serão adicionados durante a refatoração, incluindo validação pedagógica e compilação de conteúdo.

---

# Documentos importantes

O projeto utiliza documentos de arquitetura e produto para orientar agentes de desenvolvimento.

Entre eles:

```text
DESTRAVA_ROADMAP_RECURSOS_APRENDIZADO.md
DESTRAVA_CONTRATOS_MULTILINGUA_V1.md
```

Antes de criar novas funcionalidades:

> **PROCURE PRIMEIRO. ADAPTE ANTES DE CRIAR. GENERALIZE ANTES DE DUPLICAR.**

---

# Direção do produto

O objetivo do Destrava não é ser:

> “um curso de espanhol com IA”.

A direção é:

> **uma plataforma multilíngua que entende como cada pessoa aprende, organiza o conteúdo de forma adaptativa e transforma estudo passivo em prática constante.**

O conteúdo muda.

O idioma muda.

O aluno muda.

**O motor continua o mesmo.**
