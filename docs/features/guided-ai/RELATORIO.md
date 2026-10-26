# Aula guiada — quadro sincronizado e dúvidas por IA

Data: 26/10/2026. Baseline: `b7ed98aae747722e311e399579475dd5835e021d`. Checkout: `D:/Documents/destrava-worktrees/destrava-release-clean`; branch `test/release-f2-clean`.

## Entrega

Aula **Um encontro sem desencontro**, do curso **Español a tu paso**, Unidade 1. Identidade: `atp-u1-live-demo`; definição `atp-u1-live-demo-board`. Oito MP3 medidos somam **10min24,072s**. São dez segmentos, 62 falas, 94 cartões temporais e duas práticas com correção oficial. Conteúdo 1.7.0 ampliado e fixado pelo hash efetivo; a duração não é uma estimativa de leitura.

Destino autorizado: [abrir a aula no Fly.io](https://frecuencias-a1-natanael.fly.dev/live-classes?lesson=atp-u1-live-demo), com Español a tu paso selecionado. Local: http://127.0.0.1:3100/live-classes?lesson=atp-u1-live-demo. Este relatório registra o candidato local; o recibo de publicação e o teste no Fly ficam no manifesto de entrega da execução.

## Levantamento e evolução

| Antes | Implementado |
| --- | --- |
| Guia com progressão pouco fluida e quadro limitado | Continuação pelo término real de cada apresentação; o quadro muda pelo relógio do áudio |
| Voltar podia deixar explicações fora do momento | Reconstrução determinística do quadro ao buscar e voltar dez segundos |
| Dúvida sem contexto confiável do instante | Pausa do áudio, salvamento do instante e contexto canônico do mesmo segmento/revisão |
| Explicação dinâmica pouco visual | Resposta em cartões no quadro, exemplo ilustrado e idiomas separados |
| Celular com risco de largura excessiva | Colunas flexíveis, navegação interna rolável, foco na resposta e controles de pelo menos 44px |
| Recurso difícil de reutilizar pelo Foundry | CoursePackage 1.12, campos opcionais, exportações oficiais e [guia de autoria](AUTHORING.md) |

O roteiro principal e o áudio são preparados. As dúvidas digitadas e o botão **Não entendi** produzem respostas reais da IA no momento, usando a chave existente e os limites autorizados. O aprendiz retoma o instante capturado; o modelo não avança atividades nem aprova o aluno. A resposta pode ser narrada com as vozes disponíveis no navegador, por idioma; texto continua disponível.

## Experiência e autoria

A aula trabalha avisar onde se está, perguntar à outra pessoa e pedir repetição ou menor velocidade. Os exemplos apresentam modelos antes da produção e distinguem essas intenções. O Foundry escreveu roteiro original com os fatos já ensinados na Unidade 1; esta aula não é uma nova alegação de nível nem uma pesquisa adicional dos livros. As melhorias anteriores de conteúdo ES/EN, provas e regras de 80% foram preservadas.

Os campos reutilizáveis abrangem ilustração, ícone, rótulo e partes de texto por idioma, além da progressão opcional entre apresentações. Compatibilidade com pacotes anteriores foi mantida. O Motor executa o pacote e valida a resposta estruturada. O Foundry continua independente, sem dependência operacional do banco ou da interface.

## Integridade e custos

- O servidor confere usuário, curso, edição, hash, sessão, revisão, segmento e instante persistidos antes da reserva de cota.
- Só envia à IA o trecho público pertinente e uma troca anterior limitada. Gabaritos e respostas privadas de outras atividades não entram no contexto.
- Somente o servidor constrói ações `board.clear` e `board.show`; a IA não emite nota, recibo, desbloqueio ou comando de progressão.
- Respostas antigas de outra identidade/revisão são rejeitadas. Cancelamentos e limites mantêm a aula pausada.
- Limite existente de 20 chamadas por hora preservado. Modelo textual existente, saída limitada e sem repetição automática. Voz principal foi gerada uma vez; reproduzir MP3 não chama TTS.
- Foram usadas oito gerações TTS, uma transcrição completa e um recorte corretivo, além das perguntas de teste autorizadas. Os endpoints de áudio não retornaram uso em tokens; zero nos campos legados do registro não representa custo zero. Valor monetário final não foi medido.
- Não houve migração, reset, seed, alteração de Auth/RLS/ACL ou exclusão de dados. Projeção aditiva do catálogo: uma lição, duas atividades, seis opções e dois gabaritos, tanto local como remoto. As linhas existentes foram conferidas antes/depois.

## Evidências e validação

Candidato de código **C6**, 37 caminhos, SHA-256 do manifesto: **8cbcbbd7d0b19d5fce922135e1c4de9a6db8776692cc840d9f1f27642b64c0a0**. Os oito áudios fazem parte desse manifesto. A publicação usa o commit posterior que também inclui documentação e capturas.

| Verificação | Resultado |
| --- | --- |
| Testes de contexto, privacidade, idiomas, timeline, contratos e mídia | 24/24 PASS |
| Apresentação por idioma; narração B2 | 11 e 18 verificações PASS |
| Contratos, capacidades e arquitetura | Exit0 |
| TypeScript, ESLint dos componentes finais e build de produção C6 | Exit0; buildId CZkL3HBd4D4ORSrMe68xR |
| Exportação pública e compilação de pacotes | 18 artefatos; cinco pacotes-fonte, dois publicados |
| Jornada real local C6 | PASS: duas respostas OpenAI HTTP200, partes por idioma, pausa, volta e retomada exata |
| Telas 360/390/1440px e 390×450px | Sem overflow horizontal; controles ≥44px e toque CDP; foco da resposta no quadro |
| Fluxo completo de dez segmentos | Oito términos reais de mídia após busca, dois checkpoints HTTP200; fechamento salvo confirmado após reload |

QA independente fechou os negativos de partes vazias e idioma terceiro: sete grupos/218 asserções focais, além de 29 verificações do recibo C5. O delta de prompt C6 teve um grupo/63 asserções e 37 hashes conferidos. O parecer técnico é favorável; a amostra dinâmica não recebeu PASS linguístico.

QA e Revisor receberam perfis explícitos e examinaram o candidato congelado. O Implementador trabalhou em worktree própria; o Lead integrou hashes e operou navegador, serviços e rede sequencialmente. A independência é de responsabilidade e análise; os papéis compartilham máquina/filesystem e não constituem sandboxes técnicos distintos.

O fluxo de dez segmentos teve um FAIL no harness por esperar um título de conclusão diferente. O registro exit1 foi preservado; uma conferência somente de leitura confirmou a conclusão e persistência reais. Não foi declarado verde retroativo. Um harness legado de UX/pausa também continuou com oito falhas por imports desatualizados; não representa uma suíte geral aprovada. A jornada de pausa atual foi exercitada diretamente no navegador.

Evidências privadas ignoradas: `.tmp/guided-ai-20261026/`, incluindo candidatos C1–C6, gates, alinhamento, catálogo, jornada local, fluxo/fechamento, pareceres e recibos de publicação. Nenhum token, cookie, chave ou resposta pessoal integra estas capturas/documentos.

## Limites observados

- Ainda não é conversação contínua por microfone nem uma aula inteiramente improvisada. O áudio principal é preparado; as dúvidas são dinâmicas.
- Não foi feita avaliação humana de escuta desta narração nem teste em aparelho físico. A transcrição verifica alinhamento, não qualidade acústica ou pronúncia.
- A passagem pelos oito áudios usou busca para testar seus términos. Não equivale a ouvir os 10min24s ininterruptos.
- **Qualidade das dúvidas dinâmicas ainda pendente de aperfeiçoamento:** na amostra C5, a IA repetiu a forma portuguesa como se fosse espanhola e não separou um pronome citado. O prompt foi corrigido em C6, mas outra amostra ainda trouxe esse tipo de imprecisão, atribuiu espanhol a um trecho português e omitiu espaços entre partes. A validação estrutural não detecta esses erros semânticos. Os dois HTTP200 não representam aprovação linguística das respostas. Esta entrega é um ensaio técnico para o proprietário, com esse limite explícito; não é homologação de professor autônomo.
- O áudio de respostas depende das vozes e permissões do navegador. O texto permanece como alternativa.

## Capturas

[Quadro no desktop](screenshots/quadro-desktop.png) · [Quadro no celular](screenshots/quadro-celular.png) · [Dúvida no celular](screenshots/duvida-celular.png)
