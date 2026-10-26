# Publicação das duas unidades de inglês

Data: 26/10/2026. Curso `ingles-a1-pessoal`, edição 1.0.0, candidato editorial C6. A entrega de conteúdo e os limites estão em [RELATORIO.md](RELATORIO.md).

## Versão publicada e sucessor de desempenho

A versão Git `9de84e4af370ad16a731c3d362ee7409932ba16a` foi enviada ao GitHub main e publicada no Fly, release 51, imagem `sha256:7f89ebcef6d0682dd80a0bbbe9dc5b009739cc1ffc5376431209328b9d52d51a`. O catálogo remoto recebeu somente a atualização delimitada EN, com backup e compensação preparados. A projeção espanhola manteve seu digest.

O teste público normal em 390 px passou: cena ilustrada, áudio estático e correção de escolha. A correção levou 35.511 ms, motivando o sucessor PERF-C1. Antes dele, um harness de 12 correções concorrentes expirou; houve indisponibilidade temporária, sem demonstração de OOM ou causa integral. Esse FAIL foi preservado e não conta como homologação.

PERF-C1 indexa as localizações uma vez por chamada de projeção pública e reutiliza configurações de disponibilidade por variante nessa chamada. Não compartilha estado ou DTO entre chamadas. Mantém negociação, validação, sanitização, variantes obrigatórias e fronteiras de recuperação. O conteúdo C6, os áudios, a persistência e a política de avaliação não mudaram.

## Verificação focalizada

- 76 testes aprovados, incluindo oito novos: escopos exatos/descendentes, índices 1/10, recuperação, variantes, ambiente explícito, configuração entre chamadas, privacidade, requisitos inválidos e contagem de travessias independente do número de requisitos.
- TypeScript, ESLint focal, arquitetura, contratos e capacidades: exit 0. Apresentação: 12 grupos e 12.000 asserções, exit 0.
- Quatro projeções completas antes/depois com bytes e SHA-256 idênticos: EN sem preferência, en-US, en-GB e ES es-MX. EN sem preferência: 912,04 → 43,84 ms; ES: 117,86 → 14,66 ms. Medição local da projeção, sem equivalência automática ao tempo HTTP.
- Build local PERF-C1: exit 0, ID `6XXfkDpOscvWLu7FbZ3_W`. Jornada real em navegador de 390 px: cena, áudio e correção aprovada, 312 ms para correção. Não equivale a teste de aparelho físico ou audição qualitativa.
- Revisor independente: GO técnico nos dois arquivos congelados. QA independente deriva negativos adicionais; seu parecer e os recibos posteriores de publicação são preservados nos artefatos da entrega.

O teste amplo `verify-variants.tsx` força schema 1.4 sobre o curso EN real agora 1.11 e falha na validação de recursos novos, antes dos asserts de variantes. Não foi contado como PASS nem alterado para obter verde. Um primeiro teste focal usou exemplos de dados/versão que não atingiam os diagnósticos pretendidos; foram substituídos por `media.audio src:42` e versão `999.0.0`, mantendo os critérios do produto. Uma chamada sem escalada não iniciou o runtime Node; a execução autorizada de apresentação passou.

## Evidências e limites

Artefatos privados ignorados em `.tmp/english-u12-20261026/`: `publication.json` identifica release 51; `perf-c1/` identifica o sucessor efetivamente enviado ao Fly, com commit, imagem, saúde e testes públicos posteriores. Não usar um recibo anterior para afirmar a saúde do sucessor. Logs de falha permanecem preservados.

URL: https://frecuencias-a1-natanael.fly.dev. A autenticação permanece exigida. O catálogo publicado mantém o espanhol atual e este inglês. Não foram publicadas ferramentas de síntese, modelos, credenciais ou artefatos privados.

Aulas guiadas EN permanecem roteirizadas. Conversa livre com professor IA, quadro dinâmico e explicações geradas ao vivo pertencem à demanda separada, dependente da configuração autorizada do serviço. Voz sintética offline não foi certificada por audição humana nesta execução. Custos adicionais de estado/histórico e carregamento no layout de login permanecem oportunidades de otimização, sem alteração de autoridade ou gates nesta correção.
