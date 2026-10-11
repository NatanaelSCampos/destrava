# Destrava

**Aprenda. Pratique. Destrave.**

O desenvolvimento usa coordenação nativa com Lead, Implementador, QA e Revisor, worktrees isoladas para escrita e integração central. Consulte [o procedimento multiagente](DESTRAVA_MULTIAGENTE.md) para perfis, evidências de homologação e limites de permissões.

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

# Arquitetura multilíngua

A arquitetura original cresceu a partir do primeiro curso de espanhol.

O runtime usa contratos executáveis para:

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

O registro compilado contém o curso espanhol, o curso sintético **xx-Test** e um pacote mínimo de inglês A1 para validar a arquitetura. A seleção do curso fica no cookie `destrava-active-course`; o estado pedagógico é separado por usuário e `courseId`. O pacote de língua define variantes, normalização, módulos e recursos de voz. O pacote de curso define currículo, léxico, missões e avaliações. O motor recebe esses pacotes pelo registro de cursos, sem importar conteúdo específico de um idioma.

Veja [DESTRAVA_ARQUITETURA_MULTILINGUA.md](DESTRAVA_ARQUITETURA_MULTILINGUA.md) para os contratos, o processo de autoria e as limitações verificadas.

O escopo, os resultados e o teste manual do pacote de inglês estão em [DESTRAVA_VALIDACAO_MULTILINGUA_EN.md](DESTRAVA_VALIDACAO_MULTILINGUA_EN.md).

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

Para entrar localmente, abra `/login` e use sua conta do Supabase remoto. Se o Turnstile mostrar o erro `110200`, o hostname local não está autorizado no widget. Use o login por Google ou configure um ambiente de desenvolvimento separado para testar o CAPTCHA com senha. A Cloudflare recomenda não autorizar `localhost` em widgets de produção. O login por Google pode ser habilitado apenas no ambiente local com `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true` em `.env.local`; reinicie `npm.cmd run dev` depois de alterar a variável.

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

Os locales de reconhecimento e avaliação são resolvidos pelo `LanguagePackage` e pela variante escolhida. A reprodução no navegador usa um locale TTS declarado por um provedor no pacote; idiomas sem essa capacidade ocultam os controles de áudio.

---

# Aula Particular Interativa

A opção **Aula particular** abre `/live-classes`. A primeira aula interativa está ligada à lição de espanhol sobre `tener` para falar de idade. Ela reúne apresentação em slides com quadro sincronizado, explicações alternativas, exercício corrigido, prática de fala e retomada da sessão. O motor aceita mídia de vídeo ou áudio declarada no pacote; a demonstração atual usa a imagem e o roteiro do protótipo fornecido.

Para criar outra aula, adicione uma definição em `content/courses/<course-id>/interactive-lessons/` e associe-a com `interactiveLessonRef` na lição correspondente. As referências e capacidades do idioma são validadas pelo pipeline normal. Veja [a implementação do MVP](DESTRAVA_IMPLEMENTACAO_AULA_PARTICULAR_INTERATIVA_MVP.md) para decisões, testes e limitações.

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

## Checkpoint integrado dos Incrementos 1–3

O ambiente atual da aplicação é **local**, com Supabase em
`http://127.0.0.1:54321` e Next em `http://127.0.0.1:3000`.
As credenciais remotas foram preservadas em `.env.remote.backup.local`, ignorado
pelo Git. `.env.integration.local` contém somente o perfil de integração local,
sem chaves de OpenAI/Azure, Google OAuth ou Turnstile.

```powershell
npm.cmd run checkpoint:prepare
npm.cmd run checkpoint:migrate
npm.cmd run checkpoint:seed
npm.cmd run dev:local
# Em outro terminal, com a aplicação local em execução:
npm.cmd run checkpoint:verify
npm.cmd run build:local
```

Os comandos verificam projeto, daemon Docker, diretório, portas e destino
loopback; migrações usam `--local` explicitamente. Não use `supabase db push`
genérico para estes testes: o CLI continua vinculado ao projeto remoto.
O verificador cria e remove suas próprias contas sintéticas e testa APIs reais,
RLS, MFA, recuperação, persistência e navegador desktop/mobile. Requer Docker,
o CLI instalado pelo projeto e Chrome ou Edge instalado.

TOTP está habilitado em `supabase/config.toml`. Após mudar configurações locais,
`checkpoint:restart` reinicia apenas este stack e preserva volumes; depois use
`checkpoint:prepare` e reinicie `dev:local` para recarregar o ambiente.
As migrações dos incrementos 2 e 3 foram aplicadas **somente localmente**.
Contas de produção não existem neste banco; para revisão manual, cadastre uma
conta local pela tela de login.

Veja [o relatório e a proposta de checkpoint Git](DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md).

Execute antes de considerar uma entrega concluída:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run content:validate
npm.cmd run content:pedagogy
npm.cmd run content:compile
npm.cmd run content:preview -- --course pt-BR.xx-Test.a1.general
npm.cmd run learning:verify
npm.cmd run policies:verify
npm.cmd run assessment:verify
npm.cmd run assessment:semantics:verify
npm.cmd run multilingual:verify
npm.cmd run interactive:verify
npm.cmd run architecture:check
npm.cmd run contracts:verify
npm.cmd run session:verify
npm.cmd run sync:verify
npm.cmd run build
```

`predev` e `prebuild` compilam os pacotes automaticamente. Após aplicar as migrações e executar `npm.cmd run db:seed`, use `npm.cmd run db:verify:remote` para conferir o conteúdo no Supabase remoto. A revisão pedagógica emite avisos que exigem decisão editorial, mesmo quando a validação estrutural passa.

### Avaliações — Fase 2, Incremento 2

O schema de curso 1.3 preserva as finalidades, métodos e referências de avaliação
introduzidos no Incremento 2 e acrescenta políticas de conclusão/domínio.
O diagnóstico inicial vem de `course.assessmentRefs.diagnostic`; a final da
unidade vem de `unit.assessmentRefs.final`. Quiz e nomes de IDs não definem
esses papéis. Resultados sem evidência suficiente têm nota null.

Para revisar a seleção local, use `http://localhost:3000/assessment` ou
`http://localhost:3000/assessment?assessmentId=nos-presentamos-final` no curso
espanhol. A gravação completa autenticada depende do conteúdo instalado no banco.
`20261010000100_assessment_semantics.sql` e o seed correspondente estão
preparados, **não aplicados remotamente**. Não execute instalação remota como
parte da validação local sem autorização. Veja [a entrega do incremento](DESTRAVA_AVALIACOES_INCREMENTO_2.md)
para arquivos, testes sintéticos, alterações nas fixtures e limites de persistência.

### Políticas — Fase 2, Incremento 3

Cada unidade declara `learningPolicy.completion` e `learningPolicy.mastery`.
Participação não equivale a aprovação; atividades opcionais não bloqueiam a
conclusão. Critérios medidos sem evidência suficiente têm nota null. Um recurso
obrigatório indisponível permanece no cálculo e aparece na interface.

Revise os critérios em `http://localhost:3000/progress` e na página da unidade.
`policies:verify` usa dados sintéticos e repositório simulado. A migração
`20261010000200_learning_policies.sql` foi aplicada no Supabase local durante o
checkpoint integrado; continua sem aplicação remota nesta entrega. O app usa
o perfil local protegido. Veja [a entrega original](DESTRAVA_POLITICAS_INCREMENTO_3.md)
e [a homologação integrada](DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md).

Para conferir também a sessão interativa autenticada no Supabase remoto, execute `npm.cmd run interactive:verify:remote`. O script cria e remove uma conta descartável, sem enviar e-mail.

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

### Capacidades — Fase 2, Incremento 4

O motor possui registro estático de capacidades, versões exatas, schemas compartilhados e negociação de requisitos. Características do idioma, cobertura/configuração de voz, suporte do motor e políticas permanecem separados. Atividades obrigatórias indisponíveis ficam visíveis; não geram nota ou conclusão.

```powershell
npm.cmd run capabilities:verify
npm.cmd run capabilities:catalog
npm.cmd run architecture:check
```

O catálogo portável é [engine-capabilities-v1.json](contracts/engine-capabilities-v1.json). Consulte [inventário, decisões, testes e explicação didática](DESTRAVA_CAPACIDADES_INCREMENTO_4.md). O perfil de língua é schema 1.1; o curso permanece no schema experimental 1.3. Não foi implementado importador completo, API do Foundry ou Incremento 5. As mudanças desta etapa estão somente no ambiente local.

### Texto — Incremento 5A

Ordenação usa identidades por ocorrência, junção literal declarada e prova canônica privada. Escrita pode declarar medida e limites; `minWords` mantém o comportamento legado. O catálogo 1.1.0 publica schemas por versão para `activity.ordering`/`activity.writing` e as capacidades `text.reconstruction`/`text.measurement`.

```powershell
npm.cmd run text:verify
npm.cmd run text:verify:ui
```

Veja [diagnóstico, exemplos, propriedades e limitações](DESTRAVA_TEXTO_INCREMENTO_5A.md). Essa entrega preservou língua 1.1 e curso 1.3. O estado posterior de variantes está descrito abaixo.

### Variantes — Incremento 5B

O curso preserva seu padrão no runtime. A resolução central aplica a exigência da atividade, a preferência válida e o padrão do curso/idioma, com diagnósticos. Alternativas autorizadas são dados privados; normalização e IA não criam equivalências. Áudio de outra variante tem aviso e é bloqueado quando a atividade exige fidelidade. Avaliações recuperam a variante originalmente persistida.

```powershell
npm.cmd run variants:verify
npm.cmd run variants:verify:ui
npm.cmd run checkpoint:verify
```

[Entrega, contratos, testes e explicação didática](DESTRAVA_VARIANTES_INCREMENTO_5B.md). Curso 1.4 exige os novos campos contextuais; cursos 1.3 continuam aceitos. Catálogo 1.2.0 com 41 entradas. IA e voz foram testadas com mocks; persistência foi homologada no Supabase local com contas sintéticas. Revisão local em `http://127.0.0.1:3000/settings`. O estado posterior de 5C está descrito abaixo.

### Apresentação multilíngue — Incremento 5C

A interface permanece em português/LTR. Textos e entradas educacionais usam a direção do perfil e metadados por campo, com isolamento bidirecional e preservação dos valores lógicos. Enter não envia a resposta durante composição; tokens mantêm suas identidades/reconstrução do 5A. O quadro da aula particular separa exemplos, comparações, traduções e legendas.

```powershell
npm.cmd run presentation:verify
npm.cmd run presentation:verify:ui
```

[Diagnóstico, exemplos, testes, referências W3C e desafio de aprendizado](DESTRAVA_APRESENTACAO_INCREMENTO_5C.md). Curso 1.5 exige os metadados novos; 1.3/1.4 continuam aceitos. Catálogo 1.3.0 com 44 entradas. A apresentação RTL usa fixtures sintéticas; não foi instalado um curso real novo. Revisão normal em `http://127.0.0.1:3000`; IMEs, fontes e leitores de tela reais continuam pendentes.

### Pacotes externos — Fase 3, Incremento 6

A fronteira pública usa diretório declarativo, manifesto 1.0.0, documentos JSON e recursos locais com hash/tamanho. Os artefatos em [contracts/package-v1](contracts/package-v1/README.md) são gerados dos schemas existentes e podem ser usados por um produtor independente, sem imports privados, Supabase ou estrutura do runtime.

```powershell
npm.cmd run package:contracts
npm.cmd run package:verify
npm.cmd run package:validate -- C:\caminho\pacote --dry-run
```

A biblioteca/CLI valida estrutura, referências, capacidades e integridade e prepara um runtime temporário. A CLI de validação é sempre somente leitura; não instala ou ativa cursos. Aprovação declarada, confiança do produtor, disponibilidade operacional e publicação permanecem distintas. [Relatório A–G, testes, limites e aprendizado](DESTRAVA_IMPORTACAO_INCREMENTO_6.md); [experimento reproduzível](contracts/package-v1/README.md#produtor-simulado-e-experimento). Checkpoint do Incremento 6: `0e2c988`.

### Instalações versionadas — Incremento 7

O catálogo persistente mantém snapshots privados por instalação/hash, versões coexistentes, preparação e aprovação local separadas. Ativação e rollback usam revisão concorrente e recibo idempotente. Sessões e evidências preservam a versão original. A execução reutiliza os avaliadores e políticas existentes; o seletor normal de cursos continua compilado. IA, voz e aula interativa ainda não aceitam uma sessão instalada e rejeitam esse escopo explicitamente.

```powershell
npm.cmd run installations:verify
npm.cmd run installations:verify:local
npm.cmd run installations:local -- list <courseId>
```

Os dois últimos comandos exigem o perfil isolado `.env.integration.local` e comprovam o Docker/projeto/loopback. Aprovação e ativação reais continuam bloqueadas por padrão; o emissor de autoridade de teste existe somente em scripts locais, sem rota administrativa HTTP. Consulte [entrega, procedimento, evidências e limitações](DESTRAVA_INSTALACOES_INCREMENTO_7.md). A rota `/installed-courses/<sessionId>` permite inspecionar uma sessão própria e seu áudio com o player existente. Nenhuma publicação remota foi realizada.
