# Destrava — Contratos Multilíngua v1

> Especificação oficial para desacoplar o motor do Destrava dos idiomas e tornar a entrada de novos idiomas/cursos um processo de conteúdo, não de desenvolvimento do Core.

## 1. Objetivo

O Destrava deve funcionar assim:

```text
                    DESTRAVA CORE
                         │
                         │ executa contratos
                         ▼
              ┌─────────────────────┐
              │  LanguagePackage    │
              └─────────────────────┘
                         │
                         │ idioma-alvo
                         ▼
              ┌─────────────────────┐
              │   CoursePackage     │
              └─────────────────────┘
                         │
                         ▼
                 Experiência do aluno
```

### Regra principal

> Adicionar um novo idioma que use recursos já suportados não deve exigir alteração no Destrava Core.

E:

> Adicionar uma nova unidade a um curso existente deve ser, essencialmente, adicionar conteúdo válido e publicar.

---

# 2. Contrato 1 — `LanguagePackage`

## 2.1 Responsabilidade

O `LanguagePackage` descreve **como um idioma funciona dentro do Destrava**.

Ele NÃO define:

- unidade 1;
- unidade 2;
- currículo;
- ordem das aulas;
- prova final;
- sequência pedagógica.

Ele define:

- identidade do idioma;
- sistema de escrita;
- variantes;
- capacidades;
- configuração de speech;
- normalização;
- módulos específicos;
- estratégias linguísticas.

### Exemplo mental

```text
LanguagePackage = "o que o Destrava precisa saber para operar este idioma"
```

---

## 2.2 Estrutura canônica

```ts
type LanguagePackage = {
  schemaVersion: string;
  contentVersion: string;

  id: string;

  identity: {
    name: string;
    nativeName: string;
    iso639_1?: string;
    iso639_3?: string;
  };

  writingSystem: {
    direction: "ltr" | "rtl";
    scripts: string[];
    caseSensitive: boolean;
  };

  variants: LanguageVariant[];

  capabilities: LanguageCapabilities;

  speech: SpeechConfiguration;

  normalization: NormalizationRules;

  modules: Record<string, LanguageModule>;

  strategies?: LanguageStrategies;
};
```

---

## 2.3 Exemplo — espanhol

```json
{
  "schemaVersion": "1.0",
  "contentVersion": "1.0.0",

  "id": "es",

  "identity": {
    "name": "Spanish",
    "nativeName": "Español",
    "iso639_1": "es"
  },

  "writingSystem": {
    "direction": "ltr",
    "scripts": ["Latin"],
    "caseSensitive": false
  },

  "variants": [
    {
      "id": "general",
      "name": "Español general",
      "default": true
    },
    {
      "id": "es-ES",
      "name": "España"
    },
    {
      "id": "es-MX",
      "name": "México"
    },
    {
      "id": "es-AR",
      "name": "Argentina"
    }
  ],

  "capabilities": {
    "speechRecognition": true,
    "textToSpeech": true,
    "pronunciationAssessment": true,
    "regionalVariants": true,
    "romanization": false,
    "tones": false,
    "grammaticalGender": true
  },

  "speech": {
    "defaultVariant": "general",

    "providers": {
      "azure": {
        "general": {
          "recognitionLocale": "es-ES",
          "assessmentLocale": "es-ES"
        },
        "es-ES": {
          "recognitionLocale": "es-ES",
          "assessmentLocale": "es-ES"
        },
        "es-MX": {
          "recognitionLocale": "es-MX",
          "assessmentLocale": "es-MX"
        },
        "es-AR": {
          "recognitionLocale": "es-AR",
          "assessmentLocale": null
        }
      }
    }
  },

  "normalization": {
    "trimWhitespace": true,
    "collapseWhitespace": true,
    "caseInsensitive": true,
    "ignoreTerminalPunctuation": true,
    "ignoreDiacritics": false
  },

  "modules": {
    "alphabet": {
      "enabled": true,
      "source": "fundamentals/alphabet.json"
    },

    "numbers": {
      "enabled": true,
      "source": "fundamentals/numbers.json"
    },

    "regionalVariants": {
      "enabled": true,
      "source": "fundamentals/regional-variants.json"
    },

    "tones": {
      "enabled": false
    }
  },

  "strategies": {
    "textTokenizer": "latin-word-v1",
    "answerNormalizer": "default-latin-v1",
    "numberParser": "spanish-numbers-v1"
  }
}
```

---

## 2.4 `variants`

Uma variante NÃO é um curso novo.

Exemplos:

```text
es
├── general
├── es-ES
├── es-MX
└── es-AR
```

A variante pode afetar:

- vocabulário;
- exemplos;
- speech;
- TTS;
- pronúncia;
- particularidades;
- prompts de IA.

Ela não deve duplicar o curso inteiro.

---

## 2.5 `capabilities`

As capacidades dizem o que faz sentido para aquele idioma.

Exemplo:

```json
{
  "speechRecognition": true,
  "pronunciationAssessment": true,
  "regionalVariants": true,
  "romanization": false,
  "tones": false
}
```

### Regra de implementação

O Core deve perguntar:

```ts
language.capabilities.regionalVariants
```

e NÃO:

```ts
language.id === "es"
```

---

## 2.6 `modules`

`modules` controla ferramentas específicas do idioma.

Exemplo espanhol:

```text
alphabet
numbers
regionalVariants
```

Exemplo mandarim:

```text
numbers
tones
characters
romanization
```

Um módulo pode existir para apenas um idioma.

Isso não transforma o módulo em código hardcoded daquele idioma.

---

## 2.7 `speech`

O idioma informa como os providers devem ser usados.

Separar sempre:

```text
ProductCapability
LanguageCapability
ProviderCapability
```

Exemplo:

```text
Destrava suporta avaliação de pronúncia
        ↓
Espanhol suporta avaliação de pronúncia
        ↓
Azure suporta es-MX para essa avaliação
```

Se a última camada não estiver disponível, a feature deve:

- usar fallback documentado; ou
- ficar indisponível naquele contexto.

Nunca inventar suporte do provider.

---

## 2.8 `normalization`

Controla comparação de respostas.

Exemplo:

```text
"Hola."
"hola"
```

podem ser consideradas equivalentes.

Mas:

```text
"espanol"
"español"
```

não devem ser iguais quando o acento gráfico/caractere for relevante.

Atividades específicas podem sobrescrever a regra global.

---

## 2.9 `strategies`

Para particularidades que não cabem apenas em configuração.

Exemplo:

```text
latin-word-v1
cjk-character-v1
spanish-numbers-v1
english-numbers-v1
```

O `LanguagePackage` referencia uma estratégia registrada.

Não inserir código executável dentro do JSON.

---

# 3. Contrato 2 — `CoursePackage`

## 3.1 Responsabilidade

O `CoursePackage` descreve **o que ensinar, para quem, em qual ordem e com quais atividades**.

### Exemplo mental

```text
LanguagePackage = como o idioma funciona
CoursePackage   = como este curso ensina esse idioma
```

---

## 3.2 Relação entre idioma, origem e curso

```text
Language
   Spanish
      │
      ├── pt-BR → es / A1 / General
      ├── pt-BR → es / A2 / General
      ├── pt-BR → es / B1 / Trabalho
      └── en-US → es / A1 / General
```

Ensinar espanhol para um brasileiro pode usar exemplos e explicações diferentes de ensinar espanhol para um falante de inglês.

Por isso o curso deve conhecer:

```text
sourceLanguage
targetLanguage
```

---

## 3.3 Estrutura canônica

```ts
type CoursePackage = {
  schemaVersion: string;
  contentVersion: string;

  id: string;

  sourceLanguage: string;
  targetLanguage: string;

  defaultVariant?: string;

  framework: {
    name: string;
    entryLevel?: string;
    exitLevel: string;
  };

  track: string;

  title: string;
  description?: string;

  learningGoals: string[];

  units: Unit[];

  concepts: Concept[];

  lexicon: LexiconEntry[];

  missions?: Mission[];

  roleplays?: Roleplay[];

  assessments?: Assessment[];

  media?: MediaAsset[];

  provenance?: Provenance;
};
```

---

## 3.4 Exemplo

```json
{
  "schemaVersion": "1.0",
  "contentVersion": "1.0.0",

  "id": "pt-BR.es.a1.general",

  "sourceLanguage": "pt-BR",
  "targetLanguage": "es",

  "defaultVariant": "general",

  "framework": {
    "name": "CEFR",
    "entryLevel": "A0",
    "exitLevel": "A1"
  },

  "track": "general",

  "title": "Espanhol A1",

  "learningGoals": [
    "basic_communication",
    "daily_life"
  ]
}
```

---

# 4. Estruturas internas do `CoursePackage`

## 4.1 `Unit`

Uma unidade agrupa objetivos e lições.

```ts
type Unit = {
  id: string;
  slug: string;
  order: number;

  title: string;

  objectives: string[];

  skills: SkillId[];

  introduces?: {
    concepts?: string[];
    vocabulary?: string[];
  };

  lessons: Lesson[];

  assessmentId?: string;
};
```

Exemplo:

```json
{
  "id": "pt-BR.es.a1.general.u01",
  "slug": "nos-presentamos",
  "order": 1,

  "title": "Nos presentamos",

  "objectives": [
    "introduce_self",
    "ask_name",
    "state_age",
    "state_nationality"
  ],

  "skills": [
    "speaking",
    "listening",
    "reading",
    "writing"
  ],

  "introduces": {
    "concepts": [
      "es.grammar.ser",
      "es.grammar.tener.age"
    ]
  },

  "lessons": []
}
```

---

## 4.2 `Lesson`

```ts
type Lesson = {
  id: string;
  title: string;
  order: number;

  objectives: string[];

  activities: Activity[];
};
```

A Lesson não sabe como renderizar cada atividade.

Ela apenas organiza atividades.

---

# 5. Contrato universal de atividade

O `ActivityContract` é uma estrutura interna obrigatória do `CoursePackage`.

Não é um terceiro pacote separado.

## 5.1 Base

```ts
type Activity = {
  id: string;

  type: ActivityType;

  skills: SkillId[];

  concepts?: string[];

  difficulty?: number;

  instructions?: LocalizedText;

  prompt?: string;

  payload: unknown;

  evaluation?: ActivityEvaluation;

  media?: string[];

  provenance?: Provenance;
};
```

---

## 5.2 Tipos suportados

O Core deve trabalhar com um registry de tipos.

Exemplos:

```text
content

multiple_choice
true_false
fill_blank
matching
ordering
short_answer
free_writing

listen_select
listen_write
dictation

speak_repeat
shadowing
speak_free

flashcard

describe_image

mission
roleplay
conversation

quiz
assessment
```

Um novo idioma reutiliza os tipos existentes.

Um novo tipo só deve entrar no Core quando representar uma nova interação de produto, e não apenas conteúdo diferente.

---

## 5.3 Exemplo — `fill_blank`

```json
{
  "id": "pt-BR.es.a1.general.u01.act001",

  "type": "fill_blank",

  "skills": [
    "grammar",
    "reading"
  ],

  "concepts": [
    "es.grammar.ser.nationality"
  ],

  "difficulty": 0.2,

  "instructions": {
    "pt-BR": "Complete a frase."
  },

  "prompt": "Yo ___ brasileño.",

  "payload": {
    "answers": [
      "soy"
    ]
  },

  "evaluation": {
    "strategy": "exact-normalized"
  }
}
```

---

## 5.4 Exemplo — `speak_repeat`

```json
{
  "id": "pt-BR.es.a1.general.u01.sp004",

  "type": "speak_repeat",

  "skills": [
    "speaking",
    "pronunciation"
  ],

  "concepts": [
    "es.introduction.name"
  ],

  "payload": {
    "text": "Me llamo Carlos.",

    "speechAssessment": {
      "enabled": true
    }
  }
}
```

---

## 5.5 Exemplo — `describe_image`

```json
{
  "id": "pt-BR.es.a1.general.u01.img001",

  "type": "describe_image",

  "skills": [
    "speaking",
    "vocabulary"
  ],

  "payload": {
    "imageId": "scene.family.001"
  },

  "evaluation": {
    "expectedConcepts": [
      "people",
      "quantity",
      "room"
    ]
  }
}
```

A mesma imagem pode ser usada por outro curso/idioma.

---

# 6. `Concept`

Conceitos não devem existir apenas dentro de uma unidade.

```ts
type Concept = {
  id: string;
  language: string;

  type: string;

  name: string;

  description?: LocalizedText;

  prerequisites?: string[];

  examples?: Example[];
};
```

Exemplo:

```json
{
  "id": "es.grammar.tener.age",

  "language": "es",

  "type": "grammar",

  "name": "Tener para idade",

  "description": {
    "pt-BR": "Em espanhol, usamos tener para indicar idade."
  },

  "examples": [
    {
      "target": "Tengo treinta años.",

      "translations": {
        "pt-BR": "Tenho trinta anos."
      }
    }
  ]
}
```

---

# 7. `LexiconEntry`

Vocabulário deve possuir uma fonte única.

```ts
type LexiconEntry = {
  id: string;
  language: string;

  lemma: string;

  partOfSpeech?: string;

  meanings: LexiconMeaning[];

  examples?: Example[];

  level?: string;
};
```

Exemplo:

```json
{
  "id": "es.lex.trabajar",

  "language": "es",

  "lemma": "trabajar",

  "partOfSpeech": "verb",

  "meanings": [
    {
      "id": "work",

      "translations": {
        "pt-BR": [
          "trabalhar"
        ]
      }
    }
  ],

  "examples": [
    {
      "target": "Trabajo en una empresa.",

      "translations": {
        "pt-BR": "Trabalho em uma empresa."
      }
    }
  ],

  "level": "A1"
}
```

O mesmo item deve abastecer:

```text
Dicionário
Flashcards
Revisão
Aulas
Tutor
Perfil de domínio
```

Evitar duplicar a mesma palavra em várias estruturas.

---

# 8. `Mission`

```ts
type Mission = {
  id: string;

  level: string;

  scenario: string;

  objectives: string[];

  recommendedConcepts?: string[];
};
```

Exemplo:

```json
{
  "id": "es.a1.mission.meet-person",

  "level": "A1",

  "scenario": "meet_new_person",

  "objectives": [
    "introduce_self",
    "say_city",
    "say_profession",
    "ask_name"
  ]
}
```

---

# 9. `Roleplay`

```ts
type Roleplay = {
  id: string;

  scenario: string;

  level: string;

  character: {
    role: string;
  };

  objectives: string[];

  constraints?: {
    maxVocabularyLevel?: string;
    allowHints?: boolean;
  };
};
```

Exemplo:

```json
{
  "id": "es.a1.roleplay.restaurant.basic",

  "scenario": "restaurant",

  "level": "A1",

  "character": {
    "role": "waiter"
  },

  "objectives": [
    "greet",
    "order_food",
    "say_thanks"
  ],

  "constraints": {
    "maxVocabularyLevel": "A1",
    "allowHints": true
  }
}
```

---

# 10. `Assessment`

```ts
type Assessment = {
  id: string;

  type: string;

  unitId?: string;

  skillWeights: Partial<Record<SkillId, number>>;

  passingPolicy: {
    overall: number;
    minimumBySkill?: Partial<Record<SkillId, number>>;
  };

  activities: Activity[];
};
```

Exemplo:

```json
{
  "id": "pt-BR.es.a1.general.u01.exam",

  "type": "unit_assessment",

  "unitId": "pt-BR.es.a1.general.u01",

  "skillWeights": {
    "grammar": 0.25,
    "vocabulary": 0.25,
    "reading": 0.20,
    "listening": 0.15,
    "writing": 0.15
  },

  "passingPolicy": {
    "overall": 0.75
  },

  "activities": []
}
```

---

# 11. Skills universais

Essas skills pertencem ao Core:

```text
reading
writing
listening
speaking

vocabulary
grammar

pronunciation
fluency
comprehension
```

Um idioma pode acrescentar tags próprias:

```text
mandarin.tones
japanese.kanji
```

Mas não deve criar outra versão de `speaking`, `reading` etc.

---

# 12. `MediaAsset`

Mídia deve ser reutilizável.

```ts
type MediaAsset = {
  id: string;

  type: "image" | "audio" | "video";

  src: string;

  metadata?: Record<string, unknown>;
};
```

Exemplo:

```json
{
  "id": "scene.family.001",

  "type": "image",

  "src": "/media/scenes/family-001.webp",

  "metadata": {
    "reusable": true
  }
}
```

---

# 13. `Provenance`

Conteúdo gerado por IA precisa ser rastreável.

```ts
type Provenance = {
  origin:
    | "human"
    | "ai_generated"
    | "adapted"
    | "imported";

  generator?: {
    name: string;
    version?: string;
  };

  sources?: {
    type: string;
    reference: string;
    page?: number;
  }[];

  review?: {
    status:
      | "draft"
      | "generated"
      | "review_pending"
      | "approved"
      | "published"
      | "deprecated";

    reviewedBy?: string;
  };
};
```

---

# 14. IDs

## Regra

IDs são permanentes.

Não mudar um ID porque:

- posição mudou;
- título mudou;
- unidade mudou;
- UI foi reorganizada.

Exemplos:

```text
es.grammar.tener.age

es.lex.trabajar

pt-BR.es.a1.general.u01

pt-BR.es.a1.general.u01.act032
```

Identidade não é posição.

---

# 15. Versionamento

Todos os packages possuem:

```json
{
  "schemaVersion": "1.0",
  "contentVersion": "1.4.0"
}
```

## `schemaVersion`

Mudou a estrutura técnica do contrato.

## `contentVersion`

Mudou o conteúdo.

Não confundir os dois.

---

# 16. Estrutura recomendada no repositório

```text
content/

  languages/

    es/
      manifest.json

      fundamentals/
        alphabet.json
        numbers.json
        regional-variants.json

      concepts/
        grammar.json

      lexicon/
        a1.json


    en/
      manifest.json

      fundamentals/
        alphabet.json
        numbers.json

      concepts/
        grammar.json

      lexicon/
        a1.json


  courses/

    pt-BR.es.a1.general/

      course.json

      units/
        u01.json
        u02.json

      missions/
        u01.json

      roleplays/
        u01.json

      assessments/
        u01.json
```

Esses são arquivos de autoria.

O runtime pode usar um package compilado.

---

# 17. Pipeline de conteúdo

```text
Material-fonte / especialista / IA
                ↓
      LanguagePackage / CoursePackage
                ↓
          content:validate
                ↓
         content:pedagogy
                ↓
              preview
                ↓
          content:compile
                ↓
             publish
                ↓
            Destrava
```

---

# 18. Validação técnica

Comando esperado:

```bash
npm run content:validate
```

Deve detectar, pelo menos:

- ID duplicado;
- referência inexistente;
- language inexistente;
- variant inválida;
- activity type inválido;
- concept inexistente;
- media inexistente;
- unit sem lessons;
- lesson sem activities;
- assessment inválido;
- provider config inválida;
- schema inválido.

---

# 19. Validação pedagógica

Comando sugerido:

```bash
npm run content:pedagogy
```

Verificar:

- nível CEFR adequado;
- vocabulário ainda não introduzido;
- conceito ainda não introduzido;
- resposta ambígua;
- resposta incorreta;
- tradução inadequada;
- activity não mede a skill declarada;
- exemplo avançado demais;
- role-play inadequado ao nível;
- progressão incoerente.

Pode combinar regras determinísticas + IA.

---

# 20. Content SDK

Criar uma camada interna, por exemplo:

```text
@destrava/content
```

Com schemas/validadores para:

```text
LanguagePackageSchema
CoursePackageSchema

UnitSchema
LessonSchema
ActivitySchema

ConceptSchema
LexiconEntrySchema

MissionSchema
RoleplaySchema
AssessmentSchema

MediaSchema
ProvenanceSchema
```

Recomendação: usar Zod se já estiver alinhado à stack existente.

---

# 21. Runtime

O runtime não deve consultar arquivos crus diretamente.

Fluxo recomendado:

```text
arquivos modulares
      ↓
validate
      ↓
compile
      ↓
CompiledLanguagePackage
CompiledCoursePackage
      ↓
Destrava Runtime
```

---

# 22. Estado do usuário

O estado de aprendizado NÃO pertence ao `LanguagePackage` nem ao `CoursePackage`.

Ele deve ser separado:

```text
User
  ↓
Course
  ↓
UserLearningState
```

Exemplo conceitual:

```ts
type UserLearningState = {
  userId: string;
  courseId: string;

  progress: unknown;
  mastery: unknown;
  reviews: unknown;
  mistakes: unknown;
  preferences: unknown;
};
```

Nunca misturar dados de dois cursos.

---

# 23. Entrada de um novo idioma

Exemplo: inglês.

```text
1. Criar LanguagePackage en
2. Definir variants
3. Definir speech
4. Definir capabilities
5. Adicionar fundamentals
6. Criar CoursePackage pt-BR → en
7. Adicionar conceitos
8. Adicionar lexicon
9. Adicionar units/activities
10. Validar
11. Rodar QA pedagógico
12. Preview
13. Compile
14. Publish
```

### Critério

Se for necessário alterar:

```text
Dashboard
ReviewScheduler
LearningRecommendationEngine
Tutor
Flashcards
SpeakingRecorder
```

somente para cadastrar inglês, o desacoplamento está incompleto.

---

# 24. Entrada de uma nova unidade

Exemplo: Unidade 2 de espanhol.

Ideal:

```text
1. criar u02.json
2. adicionar conceitos/vocabulário necessários
3. adicionar atividades/missões/avaliação
4. validar
5. QA pedagógico
6. compile
7. publish
```

Sem alterar o Core.

---

# 25. Idioma sintético para teste

Criar um idioma interno:

```text
xx-Test
```

Com:

- poucas palavras;
- um fundamento;
- uma unidade;
- alguns exercícios;
- um role-play.

Objetivo:

> provar que um idioma novo entra sem alteração de Core.

Este idioma é apenas fixture/teste.

---

# 26. Regras contra acoplamento

Nas áreas de Core/learning/review não deve haver dependência direta de:

```text
Spanish
es-content
Frecuencias
tener
ser
es-ES
```

Exceções devem ser documentadas.

Criar testes/lint/check de arquitetura quando viável.

---

# 27. Definition of Done — multilíngua

A arquitetura só deve ser considerada desacoplada quando:

- [ ] usuário pode possuir dois cursos;
- [ ] progresso é isolado por curso;
- [ ] revisão é isolada por curso;
- [ ] erros são isolados por curso;
- [ ] domínio é isolado por curso;
- [ ] dicionário respeita idioma ativo;
- [ ] tutor respeita idioma/curso ativo;
- [ ] speech vem do `LanguagePackage`;
- [ ] fundamentos vêm do `LanguagePackage`;
- [ ] módulos indisponíveis não aparecem;
- [ ] idioma sintético funciona;
- [ ] inglês entra sem alterar Core;
- [ ] nova unidade entra sem alterar Core.

---

# 28. Regra para o agente de desenvolvimento

Antes de alterar a arquitetura existente:

1. auditar o repositório;
2. localizar hardcodes de espanhol;
3. localizar estados globais que deveriam ser por curso;
4. identificar schemas já existentes;
5. reaproveitar componentes e serviços atuais;
6. mapear o que já atende parcialmente estes contratos;
7. propor migração;
8. evitar refatoração total desnecessária;
9. manter compatibilidade com dados existentes quando possível;
10. somente depois implementar.

### Princípio

> PROCURE PRIMEIRO. ADAPTE ANTES DE CRIAR. GENERALIZE ANTES DE DUPLICAR.

---

# 29. Decisão arquitetural oficial v1

O Destrava passa a tratar conteúdo em quatro camadas:

```text
1. Destrava Core
   Motor reutilizável.

2. LanguagePackage
   Define como um idioma funciona.

3. CoursePackage
   Define como um curso ensina esse idioma.

4. UserLearningState
   Define como uma pessoa está evoluindo naquele curso.
```

O `ActivityContract` é a linguagem universal entre `CoursePackage` e `Destrava Core`.

```text
LanguagePackage ─────┐
                     │
                     ▼
CoursePackage → ActivityContract → Destrava Core
                     ▲
                     │
              UserLearningState
```

Este é o contrato-base para a evolução multilíngua do Destrava.
