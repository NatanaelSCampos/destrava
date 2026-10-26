# F3 UX U1 — execução focalizada e decisão de contrato

Data: 24/10/2026. Baseline: 548a729a33b80fa7dfb8681855cd1e2a71c5174b, branch test/release-f2-clean. Motor: D:/Documents/destrava-worktrees/destrava-release-clean.

## Evidência que reabre o aceite

O proprietário estudou a edição 1.0.0 e relatou que não conseguiu aprender satisfatoriamente. Classificação: SHARED / OWNER_OBSERVATION / REOPENED. Os testes técnicos anteriores permanecem históricos; não demonstram adequação didática para iniciantes. A autorização posterior dispensa preservar ou migrar o progresso pessoal: o próximo teste começará do zero. Ela não autoriza reset do banco, exclusão de volumes ou alteração de outras contas.

Antes de alterações, .tmp/f3-ux-u1/before.json registra 438 caminhos e confirma os 65 pinos da entrega C9. Fonte, pacote e artefatos 1.0.0 permanecem preservados.

## Escopo autorizado

Lições atp-u1-l1 (Uma mensagem para você) e atp-u1-l2 (Não entendi essa parte); somente abertura da guiada atp-u1-guided / atp-u1-guided-board e dependências mínimas. “Chegando ao encontro” é o título de atp-u1-l1-scene; “Diga a mensagem” é atp-u1-l1-voice. Não existe guiada canônica com o primeiro título.

Separar pausa manual de ocultação/inatividade; manter atividade/respostas; congelar relógio e áudio automaticamente sem bloquear toda a aula. Autoria sucessora em novo run Foundry, com conteúdos curtos, exemplos sonoros antes de produção, recuperação e aplicação. Nenhuma ampliação para outras lições.

## Limite comprovado do contrato atual

CoursePackage 1.5 não executa áudio em cartões conceituais/flashcards. activity-media.ts aceita referências apenas para listening e um asset de áudio; registry e a negociação de capacidades também recusam outros usos. O campo comum media no parser não comprova execução nesses tipos. lesson_content executa body/highlights; flashcard front/back/example. Não há diálogo estruturado nem feedback por alternativa ou agenda autoral de recuperação diferida.

Não remover essas recusas nem guardar uma DSL/JSON em body ou metadata para ocultar uma extensão pública.

## Proposta mínima para decisão do proprietário — AINDA NÃO AUTORIZADA

Adicionar CoursePackage 1.6 opcional e capacidades versionadas, mantendo 1.3/1.4/1.5 inalterados:

1. Apresentação didática estruturada para lesson_content: conceito e diálogo, com frases, interpretação, interlocutor e referências de mídia locais validadas; apoio expansível e créditos próprios. Áudio gravado no verso de flashcards somente após revelação. Não habilitar áudio em tipos arbitrários.
2. Feedback autoral por alternativa: campos privados no pacote de autoria e retorno após tentativa pelo avaliador existente. Nenhuma resposta correta ou justificativa privada cruza a projeção pública antes da tentativa; correção e autoridade permanecem as mesmas.
3. Recuperação diferida opt-in por lição: objetivos/atividades de referência explícitos, intervalo de duas a quatro outras atividades e limite de uma recuperação por objetivo. Exemplo alternativo autoral; distinguir tentativa inicial e posterior nas evidências já existentes. Sem novo SRS, nova nota, loop ilimitado ou conclusão automática.
4. Validador oficial, negociação de capacidades, adaptação compilada e testes sintéticos neutros de idioma acompanham a mudança. Pacotes antigos não optam automaticamente. Se as evidências existentes não bastarem sem schema novo, interromper essa parte e trazer a decisão concreta.

Não inclui alteração de SQL, Auth, ACL, autoridade, contrato de segurança ou produção; não cria serviço, ambiente ou dependência paga.

## Critérios de aceite

- Iniciante recebe ensino suficiente antes de cada resposta exigida; nenhum convite oral prematuro.
- Áudio de frases espanholas com autoria/licença por gravação, conteúdo correspondente, variante declarada e reprodução real. Metadados, waveform e mocks não são escuta humana nem aprovação acústica.
- Consulta de ajuda mantém resposta; reload não confunde rascunho com envio ou aprovação.
- Aba curta/inatividade/manual/reload testados em navegador e relógio; tempo oculto não conta.
- Recuperação ocorre depois de outras atividades, não revela antecipadamente a resposta e é limitada.
- 360/390/desktop, foco e teclado; nenhum gabarito pré-tentativa ou nova requisição externa.
- Candidato sucessor com versão/hash próprios, QA editorial/técnico e Revisor independentes sobre os mesmos bytes. READY_FOR_OWNER_REVIEW somente sem P0 conhecido; aceite pedagógico final pelo proprietário.

## Referências de UX consultadas

- W3C, conteúdo claro e blocos curtos: https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/
- W3C, mídia em segmentos significativos: https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p05-chunked-media/
- W3C, transcrições: https://www.w3.org/WAI/media/av/transcripts/
- Nielsen Norman Group, divulgação progressiva: https://www.nngroup.com/articles/progressive-disclosure/

São princípios de projeto e acessibilidade; não prova de eficácia deste curso.

## Autorizações posteriores e referência concreta

O proprietário autorizou expressamente a extensão delimitada CoursePackage 1.6 na resposta desta conversa. A proposta acima registra o momento anterior à decisão; a implementação fica autorizada no recorte descrito, preservando avaliação, banco, Auth e permissões.

O adendo posterior adotou `destrava_cafe_experiencia.html` como referência principal de apresentação e interação. O Motor adapta cartões, diálogos, etapas, feedback, cores, espaçamento e controles em componentes genéricos; o Foundry compõe declarativamente. Não alterar o menu global. A aprovação de voz recebida é: **“Voz clara para o primeiro teste”**, limitada às três amostras oferecidas e distinta do aceite pedagógico da edição.
