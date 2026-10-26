# U1 e U2 — experiência comum de aprendizagem

## Escopo e referência

A primeira lição aprovada da edição 1.3.0 e o protótipo HTML fornecido pelo proprietário são as referências visuais. A edição 1.4.0 amplia o mesmo cuidado às oito lições, duas aulas guiadas, diagnóstico, finais, recuperações e ajudas. O aceite exige execução no caminho compilado local; autoria e SSR são evidências distintas.

## Capacidades reutilizáveis do Motor

CoursePackage 1.8 é opcional e preserva os consumidores antigos:

- `payload.scene`: contexto e título na língua de orientação; fala recebida separada em `cue` com texto alvo, tradução, interlocutor e áudio.
- Ilustrações declaradas: mensagem, encontro, relógio, café, cardápio e retirada. Relógios só desenham horário quando hora/minuto são informados; o Motor não inventa respostas.
- Até quatro cartões de itens, com ícone, nome alvo, tradução e valor literal. Dez ícones de objetos/funções.
- `reviewMode: "recall"`: tentativa antes dos exemplos; exemplos só são montados após revelação explícita. Rascunhos ficam separados por cartão e não recebem nota de competência.
- `cards[].audioMediaIds`: alinhamento exato com os exemplos, áudio local com autoria e direitos. Modelos de flashcards aceitam as mesmas famílias de ilustrações.
- Explicações usam spans linguísticos exatos, nunca detecção por palavras ou HTML livre. Campos de alternativas e respostas declaram seu idioma; orientação portuguesa não é enviada à voz espanhola.
- Ajuda em diálogo modal preserva o rascunho. Conteúdo de apoio de avaliação permanece fora da sequência de perguntas e é consultado após o resultado.
- Apresentação privada da explicação retorna com a resposta autoritativa da avaliação. Gabaritos, feedback e seus spans continuam ausentes da projeção anterior à tentativa.

A capacidade `presentation.scene` é exigida quando usada. Interações novas exigem versões explícitas; versões antigas recusam os campos novos. O caminho instalado continua sem qualificação dessa capacidade. O destino desta entrega é compilado.

Nenhuma decisão depende de courseId, termos espanhóis, números do material ou árvore de arquivos do Foundry. Autoria curricular e escolha dos exemplos pertencem ao pacote.

## Responsabilidades

O Foundry fornece cenas, conceitos, linhas, áudios, exemplos, equivalências, ajudas e feedback. O Motor representa os dados e preserva correção técnica, rascunhos, persistência e autoridade. O Lead integra e verifica a experiência inteira. QA editorial/técnico e Revisor examinam candidatos identificados por hashes; autores não aprovam o próprio trabalho.

## Critérios de saída

1. Todas as atividades, inclusive recuperações diferidas, têm contexto apropriado.
2. Conteúdo cobrado nos finais foi ensinado; diagnóstico não antecipa seus modelos.
3. Toda frase ensinada tem controle de áudio correspondente; mídia e texto mantêm proveniência.
4. Explicações e resultados distinguem alvo e orientação; contexto real não é substituído por instrução fingindo ser fala.
5. Ajuda, teclado, reload, revisão, áudio e persistência passam em navegador; 360/390 e desktop sem overflow.
6. Escrita, prática oral e recuperação consultada não recebem avaliação linguística inexistente.
7. Banco, gate, migrações e ambientes anteriores permanecem preservados. Nenhum acesso remoto, custo, publicação ou operação Git de entrega.

Contagens, candidatos, comandos e resultados reais serão registrados no relatório da execução. Este documento especifica critérios; não constitui aprovação funcional.
