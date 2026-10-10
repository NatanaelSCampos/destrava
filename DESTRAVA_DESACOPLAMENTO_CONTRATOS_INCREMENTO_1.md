# Fase 2.2 — incremento 1: desacoplamento dos contratos

## Investigação e invariantes

Antes desta mudança, `src/content/contracts.ts` importava `learningGoalSchema`
e `learningSkillSchema` de `src/domain/study/learning-preferences.ts`. O módulo
de preferências também contém rótulos de UI, defaults e cálculos de afinidade.
`src/content/language-resources.ts` importava os tipos do mesmo domínio.
Settings, onboarding e recomendação usam seus exports atuais.

Invariantes definidos antes da extração:

1. Objetivos aceitos, na mesma ordem: `general`, `travel`, `work`, `study`,
   `conversation`.
2. Habilidades de preferência aceitas, na mesma ordem: `speaking`, `listening`,
   `reading`, `writing`. Elas não são a taxonomia mais ampla do perfil/avaliação.
3. Sem coerção, trim, novos defaults ou alteração da validação dos enums.
4. Tipos `LearningGoal` e `LearningSkill` permanecem equivalentes; exports antigos
   de schemas/tipos e `learningSkills` continuam disponíveis no domínio.
5. Uma única definição dos schemas, compartilhada pelos consumidores.
6. Contratos de conteúdo e módulo neutro não dependem do domínio, UI,
   persistência, infraestrutura ou implementações de provedores.
7. Nenhuma mudança em regras pedagógicas, pesos, avaliações ou persistência.

## Escopo da verificação arquitetural

O grafo parte de `src/content/contracts.ts` e acompanha imports/reexports locais,
incluindo dependências de tipos. Schemas podem depender de módulos de conteúdo
autocontidos e de Zod. Dependências locais fora dessa fronteira, dependências
externas não permitidas, ciclos e carregamentos com nome calculado são rejeitados.

O teste usa a API de sintaxe/resolução do TypeScript já instalado; não executa
os módulos analisados e não depende de serviços externos. Ele protege a direção
das dependências, sem constituir uma sandbox geral de execução JavaScript.

## Antes e depois

Antes:

```text
content/contracts → domain/study/learning-preferences → Zod
```

Depois:

```text
content/contracts ─────────────────┐
domain/study/learning-preferences ──┼→ content/contract-vocabulary → Zod
content/language-resources (types) ─┘
```

`learning-preferences.ts` reexporta os mesmos objetos de schema e tipos para
preservar seus consumidores. Rótulos, cálculos de pesos, defaults e validações
específicas de preferências continuam no domínio e não foram modificados.

## Verificação e aprendizado

- A nova verificação foi executada antes da extração: falhou especificamente
  no import de `contracts.ts` para `learning-preferences.ts`, demonstrando o
  acoplamento que precisava detectar.
- `npm.cmd run architecture:check` inclui a verificação transitiva dos contratos,
  usando a resolução de módulos e aliases do TypeScript do projeto.
- `npm.cmd run contracts:verify` compara opções e erros com snapshots dos enums
  originais, verifica identidade dos reexports e testa consumidores e regressões
  arquiteturais com fontes virtuais em memória.
- As provas de equivalência de tipos no verificador só compilam quando os tipos
  continuam idênticos; a execução de TypeScript valida essas provas.

O exercício aplica fonte de verdade única, direção das dependências e testes
que reproduzem a violação antes de corrigir. O contrato pode futuramente ser
distribuído sem trazer regras e defaults de onboarding do motor. Exportação
portável, formato V1 e importação de cursos continuam pendentes de outros incrementos.

## Resultados em 2026-10-09

- Valores, ordem das opções, validação de entradas válidas/inválidas e mensagens
  de erro permaneceram equivalentes aos enums originais.
- Identidade dos objetos reexportados e compatibilidade dos tipos foram verificadas.
- 24 cenários negativos do verificador arquitetural foram rejeitados, incluindo
  imports diretos/transitivos/de tipos, reexports, provedores, infraestrutura,
  ciclos, nomes calculados e acesso ao ambiente. Fontes válidas com comentários
  e textos semelhantes a imports foram aceitas sem falsos positivos nesses casos.
- Grafo real do contrato: dois módulos locais, somente Zod como dependência
  externa permitida, sem ciclos locais.
- Os 11 scripts locais passaram: novo verificador de contratos, arquitetura,
  conteúdo, pedagogia, motor, diagnóstico adaptativo, multilíngua, onboarding,
  aula interativa, tempo e sincronização.
- TypeScript (`--noEmit --incremental false`), ESLint (`--no-cache --max-warnings 0`)
  e `git diff --check` passaram.
- Permaneceram os dois avisos pedagógicos anteriores sobre respostas duplicadas;
  nenhum conteúdo ou regra foi corrigido fora do escopo.

Não foram executados testes de serviços externos ou uma revisão manual da UI.
O servidor local existente continua na porta 3000. Nenhuma nova dependência,
migração, chamada paga, commit ou deploy. O incremento 2 não foi iniciado.
