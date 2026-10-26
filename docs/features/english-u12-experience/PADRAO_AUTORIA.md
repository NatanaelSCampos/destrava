# Padrão de autoria reutilizável — experiência de lição

Contrato público: CoursePackage 1.11. Referência executada: inglês 1.0.0; as decisões abaixo também servem a outros idiomas e cursos.

## Compor a experiência

1. Declare a situação e a ação do aluno em `scene`/prompt. O contexto precisa corresponder à atividade atual, inclusive quando ela retoma outra lição.
2. Organize `stages` por objetivos. Cada uma pode reunir várias atividades; o Motor mostra parte atual, progresso, retorno e avanço interno antes de trocar de etapa.
3. Apresente modelos e traduções antes de pedir produção. `teaching` permite frases, diálogos, pequenos contrastes e apoio em parágrafos separados. Associe uma explicação ao exemplo que ela explica.
4. Use cenas pertinentes. `home`, `interior`, `neighborhood` e `profile` são ilustrações genéricas, sem vocabulário ou regra de correção embutidos. São decorativas: a resposta depende do estímulo autorado.
5. Os ícones adicionais `home`, `bed`, `sofa`, `key`, `phone`, `mail`, `book` e `briefcase` podem compor itens de qualquer cena. Valores novos exigem schema 1.11; versões anteriores continuam com seus enums originais.
6. Declare a língua dos campos e anotações literais `target` nos termos estrangeiros misturados ao português. O Motor não tenta adivinhar idioma nem interpretar marcação arbitrária.
7. Nas retomadas, use `recallScene` com intenção inequívoca, ação, tentativa anterior ao exemplo e modelo de conversa com pelo menos duas falas. A confirmação precisa completar e avançar realmente.
8. `supportActivityIds` liga cada atividade às explicações apropriadas. A ajuda abre em modal e deve conservar rascunhos. Feedback por alternativa fica em cartões visíveis após responder, com explicação contextual.
9. Variações corretas pertencem à política declarada do item. Não altere a normalização global para aceitar uma frase específica. Separe acerto objetivo, tarefa entregue e competência demonstrada.
10. Escrita e fala livres sem avaliador contextual são aplicação sem nota linguística. Uma referência oral opcional só deve existir quando cumprir toda a tarefa; se não cumprir, omita-a e use os apoios pertinentes.

## Áudio e limites

Use arquivos reais com transcrição, proveniência, direitos, tamanho e hash verificados. Todo `audioMediaId` deve resolver para o texto que acompanha. Síntese/decodificação/reprodução não substituem audição qualitativa.

O envelope permite até 1.024 entradas e 768 recursos binários. Permanecem os limites de 32 MiB totais, 1 MiB por JSON e 16 MiB por recurso. Minificar um documento não autoriza ultrapassar limites de profundidade, nós, tipos, caminhos ou integridade. Modelos e executáveis de síntese não pertencem ao pacote publicado.

## Encerramento de unidade

Declare banco próprio e `lessonId` na avaliação. `exam.entry` define as práticas objetivas elegíveis e o limiar de entrada; o servidor exige recibos válidos. O inglês usa 80% dessas práticas e 80% de acerto na prova; a unidade seguinte depende da aprovação da anterior. O Motor registra tentativas, resultado e repetição e não entrega gabarito ou ajuda durante a execução.

## Evidência de entrega

Fixe identidade/versão/hash; valide com o importador oficial; faça QA editorial independente; teste percurso compilado, celular, gravação/rascunhos e persistência. Pacote preparado não equivale a instalação ou aprovação de publicação. A prova de produção usa o commit e a imagem efetivamente publicados.