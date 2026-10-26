# Comparação das alternativas em cards

25/10/2026 — disponível no compilado local.

O dropdown “Comparar as alternativas” foi substituído por uma seção visível após a correção. Cada alternativa tem card, identificação, explicação e marcação da escolha enviada. O componente genérico de exercícios atende aos cursos que declaram esse feedback, sem condicionais de idioma ou conteúdo. Os textos e a apresentação dos termos em espanhol permanecem os do pacote/resultado autoritativo.

## Verificação

- TypeScript sem incremental e ESLint do componente: exit0, executados pelo Lead.
- Build exit0; build `wrJEWVWqu2K7KnnaW8oE1`, appPID80408 em http://127.0.0.1:3100.
- Navegador real: acerto e erro em duas atividades, uma de cada unidade; quatro casos PASS em1600/360/390px, 12 capturas. Cards automaticamente visíveis, escolha marcada, conteúdo integral das explicações igual ao pacote, marcações linguísticas declaradas preservadas e sem overflow.
- Antes de responder e após “Tentar novamente”, a comparação não aparece. Nenhum gabarito novo foi exposto antes da correção. Zero erro JS ou bloqueio inesperado no ensaio final.
- Inspeção F1/C4 e listeners PASS; CDP fechado e servidor mantido para estudo.

O primeiro driver iniciou antes da prontidão do app e falhou sem navegador; a prontidão foi depois comprovada por HTTP200. Uma rodada parcial passou na atividade da U1 e falhou por exigir marcações espanholas mesmo em explicações da U2 inteiramente em português. O verificador passou a comparar o número exato de marcações declaradas por atividade. Tentativas e capturas retidas separadamente; os dois arquivos de produto não mudaram depois do build.

## Identidade e escopo

HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, candidato `F3-ALTERNATIVE-CARDS-C2`. Somente `exercise-card.tsx` e `src/app/activities.css` mudaram. Conteúdo1.4.0, contratos, correção, sincronização e21 SQL preservados. Ensaios usam a conta sintética existente; nenhuma limpeza de histórico, novo ambiente, schema/Auth/ACL, remoto ou publicação.

Artefatos, patch incremental e manifesto em `.tmp/f3/alternative-cards-001/`. Checagem executada pelo Lead; os pareceres independentes anteriores não são apresentados como revisão desta alteração visual.