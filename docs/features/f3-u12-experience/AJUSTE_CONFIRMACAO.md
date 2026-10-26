# Correção da confirmação nas retomadas

25/10/2026 — disponível no compilado local.

Reprodução: o botão “Conferi minha resposta” chamava a conclusão, mas mantinha texto, estado habilitado e atividade atual sem confirmação visível. A conta sintética já tinha concluído essa etapa, reproduzindo também a experiência de refazer o curso.

Correção genérica no Motor: FlashcardPractice confirma visualmente a ação e impede repetição no mesmo cartão. ActivityRenderer emite um callback opcional após registrar a conclusão. LessonExperience usa esse callback para selecionar e focar a próxima etapa. Fora desse percurso, o cartão permanece com “Resposta conferida” e mensagem de confirmação. Revelar o exemplo continua sendo necessário; ocultá-lo volta a impedir a confirmação antes do clique.

## Verificação

- Reprodução anterior preservada em `.tmp/f3/flashcard-confirm-001/repro-result.json`.
- TypeScript sem incremental e ESLint dos três componentes: exit0, executados pelo Lead.
- Build exit0; build `9u-8nQ9CKsrbVSl0Zbq3b`, appPID90892 em http://127.0.0.1:3100.
- Navegador real: oito cartões das duas unidades PASS. Cada um avançou para a atividade exata, atualizou a URL e moveu o foco. Voltar ao cartão e confirmar novamente também avançou. U1 em1500px e U2 em390px, sem overflow. Zero erro JS ou bloqueio inesperado.
- Leitura autenticada RLS confirmou as oito conclusões existentes. Não se apresenta a leitura de conclusões preexistentes como teste de primeira gravação no banco. A rotina de persistência não foi alterada.
- O retorno visual sem avanço fora de LessonExperience foi conferido no código/tipos; o ensaio de navegador cobriu o percurso normal das duas unidades.
- Inspeção F1/C4 e listeners PASS; navegador de teste encerrado, aplicação mantida para estudo.

HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, candidato `F3-FLASHCARD-CONFIRM-C1`. Apenas três componentes existentes mudaram. Pacote1.4.0, contratos, gabaritos, fontes de sincronização e21 migrações preservados. Sem reset, exclusão de histórico, alteração de schema/Auth/ACL, acesso remoto ou publicação.

Artefatos, capturas, manifesto e patch incremental em `.tmp/f3/flashcard-confirm-001/`. Verificação executada pelo Lead; não se atribui novo parecer independente aos especialistas da entrega anterior.