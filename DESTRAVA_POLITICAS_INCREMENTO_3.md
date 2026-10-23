# Fase 2 — Incremento 3: políticas de conclusão e domínio

> Atualização: o [checkpoint integrado](DESTRAVA_CHECKPOINT_INTEGRACAO_1_2_3.md)
> aplicou os schemas localmente e comprovou projeções e interface contra o banco
> real. O perfil atual do app é local; os estados pendentes de homologação abaixo
> descrevem a entrega original. Nenhuma migração remota foi executada.

## Investigação antes da implementação

O fluxo foi confirmado no código local após o Incremento 2.

| Regra atual | Classificação | Decisão |
| --- | --- | --- |
| `completedActivityIds` registra realização, inclusive tentativa errada | Estrutura de evidência/participação | Preservar; não equivale a aprovação. |
| `progress.ts` conclui quando todas as atividades visíveis foram realizadas | Acoplamento curricular | Substituir por requisitos explícitos da unidade. |
| Domínio exige conclusão, exercícios/revisão ≥80, escrita, fala e final | Políticas configuráveis | Declarar requisitos de conclusão e domínio separadamente. |
| Feature flags dispensam requisitos de domínio; projeção remove atividades | Acoplamento indevido | Informar indisponibilidade de requisito, sem removê-lo da política. |
| Ausência de exercício/revisão gera score zero | Ambiguidade de evidência | Usar null quando não há medição. |
| Final usa `assessmentRefs.final`, identidade/versão/finalidade canônicas | Estrutura correta do Incremento 2 | Preservar e reutilizar. |
| Revisão usa intervalos e atualização de masteryScore | Mecanismo geral | Preservar algoritmo; política decide quais resultados exige. |
| Recomendações usam limiares, afinidade, erros e revisões vencidas | Heurísticas | Preservar; não são aprovação curricular. Priorizar pendências explícitas. |
| `currentUnit` procura unidade não concluída; todas são navegáveis | Seleção de percurso, sem pré-requisitos | Usar novo resultado, sem criar desbloqueio curricular. |
| UI tem checklist de notas/escrita/fala fixas | Acoplamento de apresentação | Renderizar critérios/estados da política, sem redesign. |
| Repositório projeta conclusão/domínio calculados em `unit_progress` | Projeção derivada | Reutilizar o mesmo cálculo, registrar versão e estados. |
| `lesson_progress` agrega realização das atividades | Participação legada | Documentar como participação; não inventar políticas formais de lição. |
| `skillFloors` chega às recomendações via `learningOptions` | Heurística personalizável | Não reinterpretar como limiar obrigatório de domínio. |

## Invariantes definidos

1. Participação, conclusão, desempenho e domínio são conceitos distintos.
2. Obrigações são declaradas por referências, nunca inferidas de tipo visual,
   ordem, idioma ou formato de ID.
3. Conclusão e domínio são calculados por conjuntos independentes de critérios.
   Exigir conclusão para domínio é uma regra explícita da política.
4. Ausência de medição tem nota null. Reprovação exige medição suficiente.
5. Requisito obrigatório indisponível permanece visível e bloqueado.
6. Referências inválidas, critérios desconhecidos e combinações incompatíveis
   são rejeitados na autoria; conteúdo não contém código executável.
7. Política vazia significa não exigido; não demonstra domínio automaticamente.
8. Correção de avaliações, autenticação, revisão e integridade de sincronização
   continuam preservadas. Snapshots não certificam resultados.
9. Projeções derivadas usam o mesmo avaliador de políticas da interface e
   registram a versão do conteúdo. Evidências continuam sendo a origem.

## Modelo escolhido

`unit.learningPolicy` declara `completion.requirements` e
`mastery.requirements`. A composição é somente AND; contagem mínima em listas
permite exigir uma quantidade de práticas sem criar linguagem de expressões.
O curso usa schema 1.3. O motor interpreta um conjunto fechado de critérios;
o Foundry fornece referências e parâmetros.

Migrações/seed remotos, deploy, APIs pagas e commits não fazem parte da execução.
Homologação integrada depende de um banco de desenvolvimento isolado e da
instalação autorizada dos schemas preparados nos incrementos 2 e 3.

## Contrato implementado e exemplos

Cada requisito tem ID e rótulo, com parâmetros tipados. Não há expressões,
JavaScript, plugins ou operadores recursivos. A validação de pacote verifica
escopo de unidade/lição ativa, finalidade de avaliação, habilidades compatíveis,
tipos de prática e cardinalidades realizáveis. IDs repetidos e chaves
desconhecidas nas políticas/requisitos são rejeitados.

| Critério | Evidência e comportamento |
| --- | --- |
| `participation` | IDs explícitos de atividades realizadas. `minimumCount` omitido exige todas as referências; presente exige aquela quantidade. Não usa nota. |
| `submission` | Entregas de escrita/fala nos IDs declarados, contadas por atividade distinta. Entrega vazia não satisfaz; não implica qualidade linguística. |
| `objective_score` | Última tentativa medida por atividade distinta, com `minimumSamples` e `minimumScore`. `skill` opcional restringe a habilidade declarada nas atividades. |
| `assessment` | Resultado canônico atual do ID e finalidade declarados. Sem `minimumScore`, exige `passed` da avaliação; com esse campo, exige seu piso numérico explicitamente. |
| `review_score` | Média de `masteryScore` dos alvos de vocabulário/erros declarados, com número mínimo de alvos e revisões por alvo. Inicialização não é evidência. |
| `unit_completed` | Critério permitido somente para domínio: exige que a política de conclusão tenha sido cumprida ou explicitamente não exigida. Dependência de conclusão em si mesma é rejeitada. |

Valores de `minimumScore` estão em **0–100**. A `passingPolicy` das avaliações
mantém a escala **0–1** do Incremento 2. A comparação objetiva usa a média sem
arredondar; a interface arredonda apenas a exibição.

Exemplo real da fixture xx-Test:

```json
{
  "learningPolicy": {
    "completion": {
      "requirements": [{
        "id": "required-activities",
        "label": "Realizar as atividades obrigatórias",
        "kind": "participation",
        "activityIds": [
          "xx.act.intro", "xx.act.choice", "xx.act.rule", "xx.act.fill", "xx.act.short"
        ]
      }]
    },
    "mastery": {
      "requirements": [{
        "id": "reading",
        "label": "Leitura objetiva de pelo menos 80%",
        "kind": "objective_score",
        "skill": "reading",
        "activityIds": ["xx.act.choice", "xx.act.short"],
        "minimumScore": 80,
        "minimumSamples": 2
      }]
    }
  }
}
```

`xx.act.flash` e `xx.act.quiz` continuam disponíveis, mas não bloqueiam a
conclusão. Não há exigência de escrita livre, fala ou somativa nesse pacote.
Completar as cinco referências pode concluir a unidade, enquanto ainda falta
desempenho suficiente para domínio de leitura. Seu domínio pode ser demonstrado
antes da conclusão, pois essa política não declarou `unit_completed`.

A fixture ES explicita os critérios anteriormente fixos: participação, domínio
com conclusão, exercícios ≥80, revisão ≥80, entrega escrita, uma entrega oral
e aprovação da somativa `nos-presentamos-final`. EN exige participação para
conclusão e duas evidências objetivas de escuta ≥80 para domínio. São políticas
experimentais de teste; não foram qualificadas editorialmente como currículos.

## Estados e transições

| Estado | Significado |
| --- | --- |
| `not_required` | Grupo explicitamente vazio. Libera conclusão; não demonstra domínio automaticamente. |
| `pending` | Falta participação/entrega referenciada, com capacidade disponível. |
| `not_assessed` | Ainda não há avaliação ou quantidade suficiente de evidência medida. Score null. |
| `not_met` | Medição suficiente existe e não atende ao critério. Zero pode ser uma medição válida. |
| `unavailable` | Requisito não executável por atividade/revisão indisponível, contexto de curso incompatível ou política ausente no runtime legado. Não libera conclusão/domínio. |
| `satisfied` | Todos os critérios declarados foram cumpridos. |

Uma habilidade ausente do currículo tem estado `not_applicable` em
`skillProgress`, sem reprovação. Habilidade declarada, mas sem prática disponível,
é `unavailable`; prática sem medida é `not_assessed`.

As decisões são calculadas, não um estado mutável salvo na origem. Nova
evidência permite sair de pendente/não avaliado para cumprido ou não atingido.
Uma nova tentativa pior, revisão incorreta, mudança de versão/política ou
indisponibilidade pode retirar uma condição antes satisfeita. Recursos
obrigatórios indisponíveis são verificados conservadoramente, inclusive quando
há participação anterior no cache.

Na composição AND, indisponibilidade tem prioridade na mensagem agregada,
seguida por critério não atingido, não avaliado e pendente. O detalhe mantém
todos os estados, sem apagar evidências de outros requisitos.

## Participação, conclusão, desempenho e domínio

- `completedActivityIds` permanece evidência de **participação**. Uma resposta
  incorreta ainda pode registrar que a pessoa realizou aquela prática.
- `unitProgress.percentage` mostra requisitos de **conclusão**; o percentual
  separado `participationPercentage` mostra atividades realizadas.
- Notas objetivas/revisão/avaliação são **desempenho medido**, com null quando
  faltam medições. Não são um booleano de domínio.
- `isMastered` deriva exclusivamente da política de **domínio estimado**.
  O perfil contínuo de recomendações mantém sua heurística de suavização,
  recência e autoavaliação; esse score não substitui os critérios curriculares.

Progresso de conclusão dentro de um grupo é a média das frações cumpridas dos
requisitos. Participação/entrega pode avançar por contagem; um critério de nota
avança quando é satisfeito, sem dar crédito curricular por nota insuficiente.
O percentual do curso é a média das unidades ativas. Percentuais são indicadores
de percurso, não notas. Pré-requisitos/desbloqueio curricular não foram criados.

## Integração e fonte de verdade

- `learning-policies.ts` e `contract-vocabulary.ts` são módulos neutros. Os
  enums de finalidade/habilidade mantêm valores e exports públicos anteriores.
- `contracts.ts` valida referências e transporta `learningPolicy`; runtime
  preserva políticas e habilidades da unidade. A projeção pública preserva
  critérios e disponibilidade, removendo gabaritos das atividades.
- Atividades desabilitadas não removem referências da política. A projeção
  informa seus IDs; lições vazias permanecem identificáveis e têm mensagem de
  indisponibilidade, evitando conclusão fictícia e divisão por zero.
- `learning-policy-engine.ts` é puro. Não lê flags, ambiente, relógio ou
  configuração de provedores. Recebe a disponibilidade operacional já projetada.
- `progress.ts` deriva conclusão/domínio desse avaliador. `currentUnit`, o
  planejador e recomendações usam pendências declaradas. Uma prática opcional
  continua possível, sem impedir o avanço. Avaliação formal exige sua rota;
  exercícios avulsos não fabricam o resultado necessário.
- `PolicyChecklist` substitui os checklists fixos, com links para avaliações,
  notas e estados explícitos. Não houve redesign ou alteração de CSS.
- `projectUnitProgress` é usado pelo repositório e pelos testes. Registra
  versão, participação, conclusão, domínio e critérios derivados. O snapshot
  de evidências não ganha um segundo estado decisório de políticas.
- A recarga não usa `unit_progress` como autoridade. Seus campos são uma
  projeção que deve ser recalculada. `lesson_progress` continua como agregado
  de participação legado; não é uma política formal de conclusão de lição.

## Fixtures e arquivos

Os manifestos dos três cursos usam schema **1.3** e versão de conteúdo **1.2.0**.
As unidades recebem políticas explícitas; materiais, gabaritos, missões e
algoritmo adaptativo não foram alterados. Resultados formais de outra versão
continuam históricos. O teste que clona a unidade xx-Test reescreve suas
referências de política para os novos IDs; não mantém links para a unidade original.

Arquivos novos principais:

- `src/content/learning-policies.ts` — schemas de dados.
- `src/domain/study/learning-policy-engine.ts` — interpretação e estados.
- `src/components/activities/policy-checklist.tsx` — apresentação dos requisitos.
- `src/repositories/unit-progress-projection.ts` — projeção comum.
- `scripts/verify-learning-policies.tsx` — cenários sintéticos.
- `supabase/migrations/20261010000200_learning_policies.sql` — schema preparado.

Consumidores atualizados: contratos/vocabulário/runtime/projeção pública,
`progress.ts`, planejador/recomendações, páginas de curso/unidade/lição/progresso,
repositório, seed/verificador relacional, verificadores de avaliações,
multilíngua/aulas interativas, manifestos/unidades e packs compilados, README
e documentos de arquitetura.

## Banco e homologação pendente

Nenhuma migração ou seed foi executado. A inspeção foi somente de metadados.
Foi encontrado o stack `supabase_*_espanhol-plataform` no Docker e a porta local
54321. O contexto `desktop-linux` usa pipe local, sem overrides de host/contexto;
não foi tratado como um banco remoto. O banco local **não possui** finalidade/método/definição/curso nas
avaliações nem políticas e novos campos de progresso. O ambiente do app ainda
aponta para destino remoto; iniciar `dev` não isola a persistência por si só.

Dependências preparadas:

1. `20261010000100_assessment_semantics.sql`: metadados de avaliação, vínculo de
   curso, referências e nota nullable; necessário para instalação completa do
   Incremento 2 e para resultados adaptativos insuficientes.
2. `20261010000200_learning_policies.sql`: `units.learning_policy` e
   `unit_progress.content_version`, `participation_percent`, `policy_state`.
3. Seed canônico atualizado: publica explicitamente versões, políticas,
   avaliações e vínculos. Verificador relacional foi adaptado, mas não executado.

Plano concreto de homologação isolada, ainda não executado:

1. Confirmar daemon Docker local, containers/volumes próprios do projeto e
   destino de API exclusivamente `127.0.0.1:54321`. Preservar a instância atual
   ou usar stack descartável separado; não executar reset genérico.
2. Preparar ambiente de integração separado do `.env.local` atual, com chaves
   somente do stack local. Colocar uma verificação de host loopback antes de
   qualquer comando de escrita; não usar `db:seed` com o ambiente remoto atual.
3. Com autorização, aplicar as migrações pendentes nesse destino e instalar
   as fixtures. Conferir schema, refs, versões e políticas sem dados reais.
4. Criar contas descartáveis locais A/B, executar diagnóstica/somativa,
   atualizar a página e conferir nota/identidade/versionamento, RLS e isolamento.
5. Testar mudança de política, capacidade indisponível, cache antigo, falha de
   leitura/gravação e recarga, comparando snapshot e projeções relacionais.
6. Remover somente contas/recursos descartáveis criados para o teste. Registrar
   evidências antes de afirmar homologação de persistência.

Sem a segunda migração, a projeção normalizada pode falhar após salvar o
snapshot. A sincronização mantém pendência/erro para retry; isso não equivale
a gravação transacional de todas as projeções. A homologação real continua
pendente e testes simulados não a substituem.

## Verificação e limites

`policies:verify` passou em **24 cenários isolados**, incluindo os 18 casos
obrigatórios, revisão inicial, amostras distintas, histórico/curso incompatível,
planejamento e SSR do checklist. Repositório e persistência são simulados.

Regressão local executada com sucesso: `assessment:semantics:verify` (23 casos),
`assessment:verify` (1.024 caminhos ES, 1.024 EN, 8 xx-Test), `learning:verify`,
`multilingual:verify`, `onboarding:verify`, `interactive:verify`, `session:verify`,
`sync:verify` (13 cenários), `contracts:verify` (24 regressões de dependência),
`architecture:check` (três módulos neutros, Zod externo, sem ciclos),
`content:validate` e `content:compile` (três pacotes).
`content:pedagogy` passou com zero erros e dois avisos preexistentes de
alternativas equivalentes à resposta principal (`grammar-5`, `review-4`).
TypeScript e ESLint completos passaram, sem novas falhas/avisos.
`npm.cmd run build` passou com Next.js 16.3.8. `git diff --check` passou.

Verificação manual ainda pendente: jornada mobile, ciclo autenticado de
avaliação/gravação/reload, falhas reais de rede/provedor e comparação das
projeções no banco adequado. Aprovação local dos testes não é homologação.

Limites preservados:

- Somente políticas de unidade, AND e contagem mínima. Políticas formais de
  curso/lição e pré-requisitos curriculares ficam para outra etapa.
- Evidência disponível: objetivos, entregas, resultados formais e revisão de
  vocabulário/erros. Rubricas, qualidade de texto/fala e estimativas probabilísticas
  não são tratadas como aprovação oficial de uma política.
- Indisponibilidade projetada cobre flags/capacidades do idioma e atividade
  inativa. Falhas temporárias de rede/provedor, permissão do microfone e cotas
  ainda são tratadas por seus fluxos operacionais; não há novo monitor de saúde.
- As evidências nativas de exercícios/entregas não viraram um ledger imutável
  versionado. A RLS existente, concorrência entre dispositivos e atomicidade das
  projeções permanecem temas de integridade posteriores. Domínio é estimado.
- Validade estrutural não garante adequação pedagógica: pisos, amostras e
  requisitos precisam de revisão editorial no Foundry.

## Aprendizado de engenharia

**Design by Contract:** o produtor declara requisitos tipados; o consumidor
rejeita referências/combinações inválidas antes da execução. Não precisa conhecer
nomes de idiomas ou convenções de IDs do motor.

**Invariantes e máquinas de estado:** ausência, pendência, reprovação e recurso
indisponível têm representações explícitas. Booleans legados são derivados,
não usados para adivinhar o significado de null/zero/campo ausente.

**Política e mecanismo:** antes, `progress.ts` impunha escrita/fala e nota 80
como regra universal. Agora interpreta IDs, contagens e pisos do pacote; média,
seleção da última evidência e composição AND são mecanismos reutilizáveis.
O algoritmo da revisão continua no motor; o curso escolhe quando o utiliza.

**Arquitetura orientada a dados e regressão:** o mesmo código executa a unidade
experimental ES, o domínio auditivo EN e a fixture sem fala/escrita livre/final.
Os testes de fronteira 75/80, ausência de evidência, item opcional e capacidade
ausente comprovam a diferença entre resultado observado e decisão curricular.

Nenhum commit, deploy, migração/seed remoto, alteração de dados de aluno ou
consumo de API paga foi realizado. O Incremento 4 não foi iniciado.
