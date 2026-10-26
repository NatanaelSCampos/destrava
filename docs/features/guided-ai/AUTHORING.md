# Aula guiada com quadro sincronizado — autoria reutilizável

Atualização: 26/10/2026. Motor consumidor: release-clean. Contrato CoursePackage **1.12**, envelope público existente. As versões antigas continuam aceitas.

## O que o Foundry declara

- Uma lição com identidade própria, `interactiveLessonRef`, atividades e objetivos do currículo.
- Segmentos curtos com áudio estático real, `mediaId`, duração medida, transcrição e idioma de cada fala.
- Cues temporais de `board.show`, `board.clear` e `board.highlight`. Cada cartão pode declarar ilustração, ícone, rótulo e idioma. Exemplos têm tradução; comparações declaram os dois idiomas.
- `autoAdvancePresentations: true` quando a explicação deve continuar ao fim real do áudio. Isso entra na atividade seguinte e aguarda o aprendiz; não aprova exercícios.
- Checkpoints com gabarito privado e avaliação oficial. Apoio da IA não está disponível no checkpoint.

## O que o Motor executa

O relógio do áudio seleciona o quadro. Voltar reconstrói os cards anteriores e remove o futuro. Uma dúvida pausa o áudio, salva o instante e usa o trecho e os exemplos canônicos como contexto. O modelo devolve texto estruturado; somente o servidor cria ações visuais permitidas. A IA não emite notas, recibos ou comandos de progressão.

A resposta ocupa o quadro, e o aprendiz pode perguntar novamente ou retomar o mesmo instante. A pergunta seguinte recebe a troca anterior como contexto não confiável, sem fingir memória ilimitada. A língua da pergunta final da IA é declarada; ausência ou incerteza não autoriza narração presumida. A voz de respostas usa os recursos compatíveis do navegador, com alternativa em texto.

## Primeiro exemplar

- Curso: `espanol-a-tu-paso-a1`; conteúdo 1.7.0 ampliado, identificado pelo hash do candidato efetivo.
- Aula: `atp-u1-live-demo` — **Um encontro sem desencontro**.
- Oito arquivos MP3; soma medida **624.072 ms**. Dez segmentos incluindo duas práticas; 62 falas e 94 cards.
- Roteiro original deste run, derivado dos fatos já ensinados na Unidade 1. Não amplia alegação de nível.
- Narração gerada uma vez com voz sintética. Transcrição automática mede alinhamento; não substitui revisão humana de escuta. Um trecho omitido pelo ASR foi conferido com recorte e nova transcrição.
- Fontes efetivas: `content/courses/espanol-a-tu-paso-a1/interactive-lessons/003.json`, `units/001.json` e `media.json` no Motor. Os contratos exportados ficam em `contracts/package-v1/`.

## Cuidados de autoria

Primeiro apresentar e explicar, depois praticar. Usar uma ideia por card e manter o modelo relevante visível durante a explicação. Não mostrar a solução do checkpoint no contexto enviado à IA. Pausa, busca e navegação não são evidência de aprendizagem. Concluir a aula não significa domínio do idioma.

O roteiro de áudio é preparado; as respostas às dúvidas são geradas no momento. Não se declara conversação de voz contínua, reconhecimento de microfone ou correção de pronúncia nesta entrega. Falhas de serviço e limites mantêm a aula pausada e permitem retomada.
## Idiomas no mesmo cartão

Textos e exemplos podem declarar `runs`: partes com `text` e `language`, cuja concatenação deve ser exatamente o texto. São de uma a doze partes, total máximo de 650 caracteres. Português permanece legível; expressões no idioma estudado recebem destaque próprio. Um terceiro idioma conserva seu `lang` sem ser apresentado como o idioma do curso. Não inferir voz quando a língua for desconhecida.

As respostas dinâmicas usam partes com papéis `source`, `target` ou `unknown`. O servidor converte esses papéis para os idiomas declarados pelo pacote. A narração alterna idioma por parte, sem ler espanhol inteiro com voz portuguesa. Essa declaração não certifica automaticamente a classificação linguística feita pelo modelo.
