# Memória longitudinal de conversação — domínio 1.0.0

Este módulo puro transforma análises persistidas em memória por pessoa e idioma, índice experimental, confiança e contexto compacto para o professor livre. Não acessa banco, rede, áudio, credenciais, créditos ou providers. Não cria nota oficial de curso, domínio curricular, certificação CEFR, diagnóstico de pronúncia ou avaliação de fluência acústica. Crédito/premium, persistência, consentimento, avaliação IA e interface pertencem à integração do Lead.

## Contrato público

`src/content/conversation-assessment-contract.ts` depende somente de Zod e exporta `conversationSessionAnalysisSchema`, `conversationRubric`, versões de schema/rubrica `1.0.0`, nomes de dimensões e tipos de análise, observação e referência. É exportável por `z.toJSONSchema`, sem importar domínio, UI ou banco.

A rubrica define `range`, `accuracy`, `interaction`, `coherence`, `autonomy`. Cada dimensão tem `score` inteiro de 0 a 4 ou null, `evidence` e `note`. Zero exige evidência de dificuldade; silêncio e falta de evidência usam null. Accuracy é interpretável somente a partir de transcrição, sem inferir qualidade acústica. Há no máximo oito referências por dimensão, quarenta observações por sessão e cinco textos de avanço/próxima prática.

Uma referência informa `turnId`, `quote`, `language: target|support|unknown` e `support: independent|assisted|model_repeat|uncertain`. Uma observação acrescenta `key`, `kind: word|phrase|concept`, `label`, `outcome: difficulty|independent_success|supported_success|uncertain` e `note`. Os campos são dados do avaliador e nunca instruções para ferramentas ou sistema.

O servidor determina `sessionId` e `languageCode`; o avaliador deve devolvê-los exatamente no escopo correto. O domínio compara identidade e idioma-base. A versão inicial compartilha memória entre variantes e sufixos de catálogo do mesmo idioma (`en-US` e `en-GB`, por exemplo). O servidor deve fornecer o código real do idioma alvo; um ID arbitrário de curso não é um idioma.

## API pura

- `validateConversationAnalysis(raw, session)` retorna `{analysis, issues}`. A sessão contém `id`, `userId`, `languageCode`, `topic`, `startedAt`, `endedAt`, `turns: readonly LiveTurn[]`, `analysis`, e opcionalmente `uncertainTurnIds` e `modelPhrases`.
- `buildConversationMemoryProfile({userId, languageCode, sessions, now, preferences?})` reconstrói perfil somente dos registros dessa pessoa/idioma. `now` explícito permite reprodução; não há relógio oculto.
- `conversationMemoryPrompt(profile, maxChars=3000)` retorna no máximo 3000 caracteres, incluindo avanços, oportunidades de retomada e preferências atuais. Não modifica as preferências nem substitui interesses por rótulos de incapacidade.
- `conversationMemoryLanguage(code)` normaliza o idioma-base. A integração continua responsável pela autorização do usuário.

A reconstrução precisa receber o conjunto persistido completo de sessões/análises do idioma para preservar itens antigos sem novas observações. A trajetória retornada limita-se às sessenta últimas análises válidas, mas a agregação dos itens usa todo o conjunto de entrada. O servidor não deve confundir esse limite de apresentação com limite da fonte histórica. Cada item mantém no máximo três exemplos e cada exemplo conserva `sessionId`, `turnId`, citação, modalidade e resultado.

## Fundamentação e limites

Uma citação deve existir em um turno real do estudante. A comparação normaliza NFC, caixa, espaços e anotações não verbais conhecidas. Falas do professor, citações inexistentes e IDs duplicados ambíguos não fundamentam resultado. Somente `inputMode: speech` explícito alimenta índice/confiança oral; texto e modalidade ausente não contam como fala. Referências classificadas como idioma de apoio ou desconhecido são excluídas.

Sinais externos de transcrição incerta transformam observações em `uncertain`, sem penalidade nem sucesso artificial. Repetição de `modelPhrases` ou da fala-modelo imediatamente anterior não conta como sucesso nem como amostra oral independente. O detector é conservador e limitado a repetições textuais detectáveis; não prova autonomia semântica. Paráfrases, qualidade linguística e identificação de idioma ainda exigem um avaliador real. O domínio consegue refutar citações falsas, mas não pode comprovar que uma classificação `target` está linguisticamente correta sem avaliação externa.

Dimensões sem citação oral utilizável ficam null. Autonomy exige evidência independente; evidência assistida não é autonomia. Sucesso declarado independente com apoio assistido é reclassificado como `supported_success`. Modelos repetidos e transcrições incertas viram `uncertain`. Sem observação, o estado anterior do item permanece.

IDs de sessão iguais não duplicam contribuição. Linhas idênticas são deduplicadas; versões conflitantes da mesma sessão são excluídas até reconciliação, sem escolher arbitrariamente uma nota mais favorável. A ordem de entrada não altera a agregação. O repositório deve resolver revisões intencionais antes de fornecer suas linhas canônicas. Turnos e registros originais não são modificados.

## Estados da memória

Cada combinação normalizada de `kind` e `key` recebe no máximo um resultado por sessão. Na mesma sessão, dificuldade prevalece conservadoramente sobre sucesso, seguido de sucesso independente, apoiado e incerteza. Exemplos continuam vinculados à fala real.

- `observed`: item observado sem evidência confiável de prática independente.
- `practising`: dificuldade ou prática apoiada pendente de recuperação independente.
- `improving`: sucesso independente observado, ainda com amostra insuficiente para consolidação.
- `consolidated`: três sucessos independentes orais em sessões distintas após a última dificuldade, em pelo menos dois dias UTC e dois temas.

Uma dificuldade posterior reativa um item consolidado para `practising`, preservando sucessos anteriores e contando a reativação. Apoio ou ausência de nova observação não apagam uma consolidação já demonstrada. Texto pode informar a memória linguística e o estado `improving`, mas não satisfaz o critério oral de consolidação. Esses estados são hipóteses de acompanhamento, sem equivalência a domínio universal.

## Índice e confiança separados

Por sessão, o índice exige pelo menos doze palavras citadas de fala confiável no idioma alvo, dois turnos do estudante e três dimensões observadas. É a média dos scores observados multiplicada por 25. Não preenche dimensões ausentes com zero e não usa duração da sessão. A amostra é conservadora: conta palavras de trechos citados, sem extrapolar uma citação curta para o turno inteiro. Trechos sobrepostos são unidos antes de contar. Segmentação usa `Intl.Segmenter`, com fallback Unicode.

O índice agregado pondera sessões pontuadas pela recência (meia-vida de trinta dias) e pela raiz da amostra, limitada a duzentas palavras por sessão. Notas antigas não desaparecem da trajetória. Falta de prática recente reduz a confiança, sem inventar queda automática do índice ou do estado de memória.

A confiança interna 0–100 usa palavras orais citadas (25 pontos até 600), turnos (15 até 30), sessões (15 até seis), dias (10 até quatro), temas (10 até quatro), consistência entre sessões pontuadas (15) e atualidade (10). O total também é atenuado pela raiz da atualidade. Não é probabilidade estatística calibrada. Uma sessão ou um único dia mantém o máximo em 29. Chegar a `consistent` exige ao menos quatro sessões, três dias, dois temas, 160 palavras orais, doze turnos, oitenta palavras independentes e três sessões pontuadas. Longos minutos de escuta/silêncio nunca substituem essas evidências.

Labels: `initial` (<30, Inicial), `forming` (30–64, Em formação), `consistent` (65–100, Consistente). Confiança alta pode acompanhar índice baixo, e índice alto pode ter confiança Inicial. A interface deve comunicar os dois separadamente e apresentar o caráter experimental.

## Integração e validação

O Lead persiste a análise junto à sessão original, valida sua origem e disponibiliza o conjunto completo por usuário/idioma. Não usar o resumo compacto como canal de instruções nem como substituto de preferências correntes. A UI pode expor exemplos e próximos passos, distinguindo hipótese observada, prática apoiada e autonomia. Premium e consumo de créditos não alteram o cálculo pedagógico.

Verificador: `node --import tsx --test scripts/conversation-memory.test.ts`. Os testes sintéticos cobrem idiomas/pessoas, ordem e duplicatas, versões conflitantes, falsa evidência, professor, texto/apoio, repetição de modelo, transcrição incerta, silêncio versus zero real, suporte versus autonomia, consolidação/reativação, preservação sem observação, recência, amostra oral versus minutos, trajetória e resumo limitado. Não constituem avaliação linguística independente do modelo que produzirá as análises.
