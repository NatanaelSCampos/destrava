# Auditoria do laboratório ES-A1

> **RELATÓRIO ESTÁTICO DO CODEX — FONTE DE AUDITORIA, NÃO HOMOLOGAÇÃO OPERACIONAL.**
>
> Documento recebido do proprietário em 23/10/2026 e registrado como evidência de descoberta. O conteúdo técnico e as contagens abaixo são do relatório do Codex sobre worktrees locais; **não foram reproduzidos nesta PR** em SQL, navegador, dispositivo, Fly ou banco remoto. Dados de GitHub/contratos devem ser conferidos com a baseline atual antes de implementar.
>
> **Normalização editorial desta cópia pública:** caminhos absolutos de usuário/Windows e hyperlinks para arquivos locais foram substituídos por caminhos lógicos relativos às worktrees. Não equivale a publicar os arquivos pessoais no repositório. Nenhuma alteração em código, curso, banco ou worktree decorre deste registro.
>
> **Decisão do proprietário posterior ao relatório:** adotar a **alternativa A** — evoluir o acervo existente com reorganização curricular profunda, primeiro na U2 e depois na U1; condicionada à reconciliação técnica e autorizações próprias. Ver [spec](spec.md), [plano](plan.md) e [tarefas](tasks.md).


**Recomendação: evoluir as duas unidades existentes, reaproveitando o acervo e reorganizando profundamente a jornada.**

O curso tem bastante material e variedade. Os principais problemas são a distribuição da prática, a recuperação das explicações, o feedback e a distância entre o motor atual e a versão dos pilotos.

**Esta execução foi exclusivamente estática. Nenhum arquivo, conteúdo, banco ou branch foi alterado.**

## 1. Baseline e curso verdadeiro

A `main` foi confirmada no início e no encerramento em **`6bdd26c336ce50d59569a74581044fe3ddc89284`**.

Foram lidos os sete documentos obrigatórios nessa referência. Comparando-a ao candidato local `e780e56`, há somente alterações em sete documentos: o código A2/B2 permanece igual.

### Worktrees relevantes

Os caminhos abaixo estão em `diretório local de worktrees/`:

| Worktree | Branch | HEAD | Pendências |
|---|---|---|---:|
| `personal-es-a1` | `feat/personal-es-a1-u1-u2-v2` | `8cf0557` | 0 |
| `personal-es-a1-content` | `agents/personal-es-a1-content` | `bccb67e` | 61 |
| `personal-es-a1-qa` | `agents/personal-es-a1-qa` | `bccb67e` | 4 |
| `personal-en-a1` | `feat/personal-en-a1-u1-u2-v1` | `b0ce81f` | 1 |
| `personal-en-a1-content` | `agents/personal-en-a1-content` | `8cf0557` | 61 |
| `personal-en-a1-qa` | `agents/personal-en-a1-qa` | `8cf0557` | 4 |

Também foram preservados:

- Checkout principal: `checkout principal local`, HEAD `93ef6f2`, seis pendências.
- Motor A2/B2: `worktree local A2-B2`, HEAD `e780e56`, apenas `next-env.d.ts` previamente modificado.
- Demais worktrees históricos.

**Conferência final: os 20 worktrees, suas 249 pendências, arquivos rastreados e referências locais mantiveram os mesmos estados e hashes.** Arquivos ignorados não foram integralmente inventariados.

### Qual é o curso

O curso pessoal é **`espanhol-a1-pessoal`**, título **“Espanhol A1 · estudo pessoal”**, contrato `1.5`, conteúdo `0.1.0`.

O caminho entregue identificável pelos arquivos é **compilado/embutido**. Não encontrei evidência estática que permita afirmar que seu estudo pessoal esteja usando uma instalação externa.

A worktree inglesa também contém o espanhol: seus **30 arquivos de curso e pacote compilado são semanticamente iguais** aos da worktree ES. As diferenças de bytes observadas são de formatação/finais de linha.

Não consultei o Fly nem a seleção atual da sua conta; portanto, a versão atualmente executada remotamente continua **não comprovada nesta auditoria**.

### Fontes reais localizadas

- Unidade 1 (`piloto ES local/content/courses/espanhol-a1-pessoal/units/u01.json`)
- Unidade 2 (`piloto ES local/content/courses/espanhol-a1-pessoal/units/u02.json`)
- Banco editorial original (`piloto ES local/content/experimental/personal-es-a1/editorial/BANCO_ORIGINAL_EXPANDIDO_U1_U2.json`)
- Explicações bilíngues (`piloto ES local/content/experimental/personal-es-a1/editorial/EXPLICACOES_PEDAGOGICAS_PTBR_ES.json`)
- Correções editoriais rastreadas (`piloto ES local/content/experimental/personal-es-a1/overrides.json`)
- Avaliações (`piloto ES local/content/courses/espanhol-a1-pessoal/assessments.json`)

Os rascunhos de conteúdo foram confrontados com o curso integrado. Três correções posteriores de atividades já estão no integrado; não foram reapresentadas como defeitos atuais.

## 2. Inventário das duas unidades

| Tipo | U1 | U2 | Total |
|---|---:|---:|---:|
| Explicações | 10 | 15 | 25 |
| Múltipla escolha | 92 | 163 | 255 |
| Lacunas | 22 | 39 | 61 |
| Ordenação | 7 | 14 | 21 |
| Escrita | 20 | 27 | 47 |
| Fala | 19 | 26 | 45 |
| Listening | 19 | 25 | 44 |
| Verdadeiro/falso | 10 | 14 | 24 |
| Resposta curta | 8 | 12 | 20 |
| Flashcards | 69 | 90 | 159 |
| Introduções de avaliação | 1 | 1 | 2 |
| **Atividades** | **277** | **426** | **703** |
| **Lições** | **48** | **71** | **119** |
| **Aulas particulares** | **9** | **12** | **21** |

Outros dados:

- **45 conceitos**, atualmente com identificação e nome, sem descrição/exemplos próprios.
- **159 entradas de vocabulário**, duas missões e um roleplay.
- **64 avaliações fixas:** 61 formativas, duas finais e um diagnóstico.
- Finais com **17 e 27 itens**; diagnóstico U1 com oito.
- Nenhuma avaliação adaptativa declarada no curso.
- `media.json` vazio: existem roteiros/TTS, **não arquivos de áudio entregues**.
- Conclusão das unidades: final com 70%; domínio declarado: conclusão e 80%. Escrita/fala permanecem formativas.

## 3. Matriz de cobertura

“Utilizado” abaixo significa **presença e integração identificadas estaticamente**. Não equivale a comprovação operacional atual.

| Recurso | Classificação no laboratório | Evidência, lacuna e ação |
|---|---|---|
| Exercícios objetivos variados | **Disponível e utilizado** | Seis formatos objetivos; reorganizar a distribuição. |
| Explicações bilíngues | **Parcial** | Há 25 explicações, mas não um painel recuperável durante a tentativa. |
| Feedback específico | **Parcial** | Existe explicação por atividade; muitos textos são genéricos e não distinguem distratores. |
| Flashcards e dicionário | **Disponível e utilizado** | 159 cartas/entradas; enriquecer exemplos contextualizados. |
| Revisão espaçada | **Parcial** | Fluxo compilado possui revisão de palavras/erros. Não há estruturas editoriais em `practice.reviewStructures`; operação da conta não consultada. |
| Caderno de erros | **Parcial** | Mecanismo existente; utilidade limitada pelo feedback e pelas relações pedagógicas cadastradas. |
| Perfil, dificuldades, recomendações e telemetria | **Parcial** | Motor disponível; faltam objetivos específicos e comprovação no percurso pessoal atual. |
| Pausa/retomada A2 | **Disponível mas ausente do curso atual** | Melhorias estão no motor recente; pilotos permanecem em código anterior. |
| Avaliações e relatório por competências | **Parcial** | Finais e diagnóstico fixos presentes; sem diagnóstico U2/adaptativo e com cobertura limitada de produção. |
| Listening | **Parcial** | 44 atividades TTS; depende de voz compatível. Roteiro chega ao navegador. |
| Escrita formativa | **Disponível e utilizado** | 47 atividades; `minWords: 1` registra participação, sem avaliar qualidade. |
| Gravação, reconhecimento e pronúncia | **Não comprovado operacionalmente** | Há 45 atividades de fala; navegador, permissões e serviços não exercitados. |
| Shadowing / falar sem ler | **Disponível mas ausente do curso** | As 45 atividades não possuem `referenceText`; a página de prática seleciona atividades com esse campo. |
| Aula Particular | **Parcial** | 21 roteiros presentes, porém runtime anterior às evidências B1 e controles B2. |
| Narração B2 | **Disponível mas ausente do piloto** | Idiomas já anotados nos roteiros; falta integrar o controlador novo. |
| Tutor, microlições e feedback de escrita por IA | **Não comprovado operacionalmente** | Implementações compiladas existem; configuração, cota, saúde e qualidade não auditadas. |
| Missões, roleplay e conversa livre | **Parcial** | Duas missões e um roleplay cadastrados; execução com IA não comprovada. |
| Números, alfabeto e variantes regionais | **Disponível e utilizado como apoio global** | Módulos linguísticos presentes; ligar aos objetivos das unidades. Voz continua condicional. |
| Descrição de imagens | **Disponível mas ausente do curso** | Nenhuma imagem/cena cadastrada. Pode ser útil para moradia/localização, com material autorizado. |
| IA, fala avançada, SRS e Aula Particular em curso instalado | **Bloqueado nesse caminho** | Perfil instalado não integra essas capacidades. Isso não bloqueia seu uso compilado quando permitido. |
| Avaliação oral oficial e AI Bridge | **Bloqueado / não implementado** | Não anunciar notas orais oficiais ou integração inexistente. |
| Avatar/realtime | **Não pertinente ao objetivo imediato** | Não são necessários para ensinar estas duas unidades. |

A classificação respeita as separações da [matriz versionada](https://github.com/NatanaelSCampos/destrava/blob/6bdd26c336ce50d59569a74581044fe3ddc89284/docs/produto/MATRIZ_MATURIDADE_RECURSOS.md): implementação, integração, operação e qualidade pedagógica são dimensões diferentes.

## 4. Diagnóstico pedagógico

### A variedade existe, mas está concentrada em blocos

Múltipla escolha representa **36,3% de todas as atividades**, porém **60% das 425 objetivas**. Incluindo listening com alternativas e verdadeiro/falso, **76% das objetivas trabalham com opções apresentadas**.

Na U2:

- Há **78 múltiplas escolhas antes da primeira lacuna**.
- Escrita começa na lição 19; listening, na 22.
- Respostas curtas aparecem na lição 47.
- Cartões começam na 50; aulas particulares, nas 59–70.

Isso favorece uma experiência longa de reconhecimento antes da recuperação e aplicação. O problema principal é **a sequência**, além da quantidade.

### Rever a explicação pode apagar a tentativa local

A página troca a atividade com `key={active.id}`. Resposta e feedback ficam no estado local do componente. Sair do exercício para abrir a explicação e voltar remonta esse componente.

É uma conclusão estática do fluxo da lição (`piloto ES local/src/app/course/[courseSlug]/unit/[unitSlug]/lesson/[lessonSlug]/page.tsx:134`), não uma reprodução de navegador nesta execução.

**Proposta:** abrir ajuda junto ao exercício, mantendo-o montado. Preservar o rascunho local durante a consulta, sem gravar respostas não submetidas no servidor.

### O feedback frequentemente não ensina a causa

Foram encontrados 517 campos `payload.explanation`. Destes:

- **101** repetem “Confira o contexto…”.
- **44** orientam ouvir novamente/comparar a transcrição.
- **20 respostas curtas** compartilham orientação genérica.

O caso equivalente a `muchos/muchas` **existe realmente**:

> `En mi calle hay ___ tiendas.`  
> Alternativas: `mucha`, `muchas`, `muchos`.

O gabarito é `muchas`, mas o feedback apenas manda conferir o contexto. Item real (`piloto ES local/content/courses/espanhol-a1-pessoal/units/u02.json:6152`).

Após escolher `muchos`, um feedback útil seria:

> “`Tiendas` é feminino plural. Por isso usamos `muchas`. `Muchos` combina com masculino plural, como em `muchos edificios`.”

Isso deve vir da autoria editorial, depois da submissão, sem heurística por palavras ou IA como avaliador oficial.

### Há enunciados com respostas plausíveis não contempladas

Exemplo: `El metro ___ cerca` exige `está`, aceitando `esta`, mas não determina qual verbo usar. `Queda` também é uma possibilidade de localização. Recomendo delimitar a estrutura solicitada ou aceitar alternativas aprovadas. O uso locativo de *quedar* é registrado pela [RAE](https://www.rae.es/desen/quedar).

Também há atividades que fornecem a resposta no comando. Elas podem servir como prática guiada, mas não devem ser tratadas como prova de recuperação independente.

### Objetivos e avaliação precisam ficar mais específicos

- **119/119 objetivos de lição repetem o título.**
- As finais reutilizam integralmente itens da prática.
- Os oito itens diagnósticos reaparecem na final U1.
- Escrita/fala não compõem essas notas.

As notas podem descrever o desempenho nos itens objetivos; não comprovam, isoladamente, comunicação espontânea ou domínio oral.

### Há material bom para preservar

Foram encontrados contrastes úteis de `hay/estar/tener`, explicações de quantificadores e feedbacks específicos sobre `las manos` e lugares culturais.

Também há correções rastreadas que desambiguam enunciados e ordenações. O acervo não precisa ser descartado.

## 5. Experiência recomendada para as unidades

Cada objetivo deveria seguir um ciclo curto:

**Explicação e exemplo → reconhecimento → recuperação com menos pistas → aplicação contextual → revisão posterior.**

Não é necessário colocar todos os formatos em toda lição.

| Unidade | Percurso principal proposto |
|---|---|
| **U1 — Nos presentamos** | Cumprimentar e despedir-se; apresentar nome/origem/profissão; perguntar e responder dados pessoais; usar números/alfabeto em contatos; compreender uma apresentação; produzir uma apresentação curta. |
| **U2 — Mi casa, mi barrio** | Nomear moradia/cômodos; distinguir existência, localização e características; localizar objetos; trabalhar gênero/plural/quantidades; compreender preços e ordinais; interpretar anúncio/bairro; descrever e comparar uma moradia. |

Em cada bloco:

- Poucos exercícios representativos no percurso principal.
- Explicação reabrível sem abandonar a tentativa.
- Feedback editorial ligado ao erro.
- Cartões e revisão vinculados ao tema.
- Listening/TTS claramente condicional.
- Escrita como aplicação, com critérios de autoavaliação.
- Fala e Aula Particular opcionais quando disponíveis.
- Reforços restantes numa biblioteca opcional.

O curso continua sendo **o mesmo laboratório pessoal**. Não proponho criar outro curso para preservar histórico.

### Comparação das alternativas

| Alternativa | Benefício | Custo e risco relativos |
|---|---|---|
| **A. Evoluir o acervo existente** | Preserva bons exemplos, rastreabilidade, atividades e roteiros; concentra esforço na jornada e lacunas. | Menor custo; exige curadoria real, não apenas trocar títulos. |
| **B. Refazer integralmente as unidades** | Liberdade editorial completa. | Maior produção e revisão de novos gabaritos; não resolve por si só limites do motor. |

**Recomendo A**, com reorganização curricular substancial e substituição seletiva dos itens inadequados. Não encontrei evidência que justifique reescrever todo o banco.

## 6. Conteúdo versus motor

| Ajuste de conteúdo | Ajuste genérico do motor |
|---|---|
| Objetivos observáveis, sequência e seleção do essencial | Painel de explicação que conserve a tentativa |
| Descrições e exemplos dos conceitos | Preservar esses campos na projeção de runtime |
| Feedback correto por atividade e distrator | Seleção de feedback por alternativa, se aprovada |
| Enunciados, variantes aceitas e idiomas dos campos | Manter correção canônica e privacidade |
| Frases públicas para shadowing, estruturas de revisão e exemplos lexicais | Integrar A1/B1/A2/B2 sem restaurar fluxos antigos |

O contrato atual **já admite descrição e exemplos nos conceitos**. Entretanto, o adaptador atual conserva somente ID/rótulo. Portanto, preencher o conteúdo não basta: é preciso ajustar a projeção interna e a interface. Contrato (`worktree local A2-B2/src/content/contracts.ts:280`), adaptador (`worktree local A2-B2/src/content/runtime-package.ts:103`).

A explicação privada existente pode melhorar imediatamente o feedback **por atividade**. Um mecanismo específico por alternativa ainda precisa de especificação e aprovação delimitadas; não deve ser improvisado dentro do payload.

## 7. Dependências e riscos de integração

### Colisão de migrações — risco alto para composição futura

Existem duas mudanças independentes com o mesmo identificador:

- Piloto: `20261022000100_learning_reset_generation.sql`.
- Motor: `20261022000100_interactive_segment_evidence.sql`.

Um registro desse identificador não comprova ambas as alterações. É necessário inventariar schema e histórico do destino e aprovar uma reconciliação. **Não renomear ou marcar migrações automaticamente.** A documentação do [Supabase](https://supabase.com/docs/guides/deployment/database-migrations) distingue os arquivos locais do histórico aplicado.

### B1 e proteção de geração — risco alto de composição

O piloto possui proteção persistente contra abas de geração antiga. O novo escritor B1 usa autoridade privilegiada e outro protocolo de lock.

Copiar componentes ou preservar somente o proxy não demonstra segurança durante reset concorrente ou replay de comprovantes.

**STOP para implantação conjunta até um plano autorizado de reconciliação.** Não foi demonstrado incidente ou incompatibilidade em banco; nenhum banco foi consultado.

### Conclusão antiga da Aula Particular

O piloto ainda possui flags globais de aprovação. Elas não devem ser promovidas a comprovantes B1 nem reintroduzidas no runtime novo.

### Áudio ES e EN têm políticas diferentes

O ES declara explicitamente seus roteiros **públicos para TTS**. Isso limita seu uso como avaliação de escuta com roteiro oculto, mas não constitui vazamento privado confirmado.

O EN mantém 52 roteiros privados suspensos. Essa política deve permanecer preservada. Não recomendo suspender automaticamente as 44 escutas ES.

## 8. Plano futuro, em tarefas verificáveis

1. **Fixar a integração:** escolher baseline de trabalho e documentar a composição motor/pilotos, incluindo geração e migrações.
2. **Aprovar o mapa curricular:** objetivos, blocos essenciais, reforços opcionais e cobertura das avaliações.
3. **Preparar ajuda pública:** enriquecer conceitos e corrigir sua projeção interna.
4. **Implementar “Rever explicação”:** painel acessível, sem desmontar exercício nem publicar gabarito.
5. **Revisar feedback e gabaritos:** começar pelos erros de maior impacto e decidir o contrato de feedback por alternativa.
6. **Reorganizar primeiro a U2:** aplicar a sequência curta; depois repetir na U1.
7. **Integrar recursos compatíveis:** A2/B2/B1, revisão, shadowing e práticas contextuais, respeitando os gates.
8. **Homologar localmente:** testes independentes, conteúdo, privacidade, persistência e navegador.
9. **Estudo pelo proprietário:** observar dúvidas e ajustar a mesma experiência pessoal.
10. **Avaliar publicação separadamente:** somente com autorização operacional própria.

### Aceites sugeridos para a futura PR

- Ajuda abre/fecha sem perder resposta, foco ou feedback.
- Nenhum gabarito ou mapa privado chega antes da submissão.
- `muchos/muchas` e outros distratores recebem justificativas editoriais corretas.
- Outro idioma sintético usa o mesmo mecanismo.
- Respostas alternativas plausíveis são aceitas ou o enunciado delimita a estrutura.
- Cada bloco intercala reconhecimento, recuperação e aplicação.
- Avaliações têm cobertura explícita e não atribuem nota oficial a produção não avaliada.
- Falha de voz oferece texto e não é contabilizada como escuta comprovada.
- B1 mantém evidências independentes; geração antiga não restaura progresso.
- Inglês permanece intacto e nenhuma operação remota ocorre por inferência.

## 9. Pareceres e limites

**QA independente:** recomenda evolução do acervo, com reorganização da U2 e correções editoriais. Conferiu o corpus de 44 arquivos antes/depois.

**Revisor independente:** confirmou as lacunas de ajuda, feedback e integração B2; destacou os riscos B1/geração/migrações.

Os especialistas trabalharam somente por leitura. Não houve alegação de sandbox técnico independente.

**Não foram executados:** testes de produto, build, navegador, serviços, SQL, autenticação ou chamadas de IA/voz. Resultados históricos A2/B2 não foram apresentados como execuções novas.

Não estão certificados: versão remota vigente, seleção da sua conta, schema aplicado, voz física, qualidade acústica, acessibilidade em dispositivo real, eficácia de aprendizagem ou revisão linguística integral.

**Decisão final:** concluir a descoberta e recomendar **evolução curricular do curso existente**, condicionando a integração técnica aos riscos identificados. A implementação e a publicação aguardam autorização posterior.