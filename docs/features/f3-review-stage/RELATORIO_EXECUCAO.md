# Revisão inicial — cena coerente e três tarefas na mesma etapa

25/10/2026. **Pronto para revisão do proprietário no compilado local.**

## Pedido e entrega

O proprietário identificou mistura entre a revisão de localização e a cena de reparo de conversa do tema novo. A primeira etapa de U1 / “Não entendi essa parte” agora revisa somente o conhecimento de U1L1 e contém três partes:

1. atp-u1-l2-reactivate: escolher a mensagem que informa o lugar. Cena de encontro no bairro, pessoa na praça, pergunta recebida com tradução e WAV existentes. Opções, gabarito e feedback originais preservados.
2. atp-u1-l2-reactivate-order: montar a resposta sobre estar na biblioteca com quatro peças fixas.
3. atp-u1-l2-reactivate-question: recuperar a pergunta curta sobre onde está a outra pessoa, sem mostrá-la na própria atividade antes da tentativa.

O apoio atp-u1-l2-location-help inclui agora a pergunta conhecida, com tradução, explicação e WAV já ensinados. O apoio é consulta voluntária; não se chama tentativa apoiada ou recuperação imediata de prova de retenção independente.

“Próxima parte” permanece na etapa1; a terceira oferece “Continuar percurso” e segue para a etapa2. O percurso conserva15 etapas; a etapa13 conserva suas três partes anteriores. U1L2 passa de17 para19 atividades normais. A cena e as orientações de cada parte correspondem à tarefa atual.

A autoria utilizou a capacidade geral lesson.stages já disponível ao Foundry. **Nenhum fonte do Motor mudou neste pedido.** Não há lógica por ID, espanhol fixado no componente, nova regra de correção ou novo contrato. A aplicação desta rodada é focalizada na primeira revisão; não anuncia expansão automática de todas as etapas.

## Identidades

- HEAD 548a729a33b80fa7dfb8681855cd1e2a71c5174b, branch test/release-f2-clean, workspace D:\Documents\destrava-worktrees\destrava-release-clean.
- Baseline Motor F3-WRITING-LAYOUT-C2 e pacote Foundry StagePartsC2, edição1.5.0.
- Pacote novo FOUNDRY-REVIEW-STAGE-C1, edição1.6.0, Course1.9/Language1.1/envelope1.0.0;95 arquivos, digest 08a53babf3d806ebe170c506cb175186eab3d2f89c7c2a73f86caa15d452e861.
- Integrado final F3-REVIEW-STAGE-C1R1;1333 pinos;digest e6b028dc21090f081a3efcc5541b95164628582c9d400f6519fd5ba232193dbc. C1R1 acrescenta somente o executor de continuação; produto/pacote/build permanecem os mesmos deC1.
- Build CxX1UhG__AFXoUOROBKLx, appPID102180, 127.0.0.1:3100.

## Validação e QA

CLI oficial validate-external-package.ts --dry-run: exit0, prepared/technicallyValid/compatible. Importação preparada pelo consumidor oficial;85 destinos alterados, sendo quatro fontes ativos e81 cópias dos mesmos WAVs sob o prefixo da edição1.6. Fontes/áudios de edições anteriores retidos. compile-content.ts e validate-content.ts: exit0, quatro pacotes compilados/válidos. Somente o pack gerado deste curso mudou. Build Next final: exit0, incluindo TypeScript. Quatro executores locais tiveram checagem de sintaxe antes de operar.

Autor /root/u12_motor:703 controles próprios, sem autoaprovação. Perfil IMPLEMENTADOR_V1 aplicado explicitamente, escrita exclusiva no novo run Foundry; nenhum acesso operacional ao Motor.

**QA independente /root/u12_qa: GO editorial/estático.** Perfil QA_V1 lido e reaplicado;1401/1401 controles Node/tsx via stdin, exit0. Quatro recortes Language/Curriculum/Pedagogical/Platform favoráveis.95 arquivos autorais e95 baseline conferidos antes/depois;249 fontes Motor iguais à baseline vigente. Verificou os14 spans, cinco usos de WAV/transcrição,24 permutações da ordenação, partição, preservação integral dos demais itens e ausência da resposta no objeto público da pergunta. A ordenação é delimitada pelas peças fixas e não afirma que outras ordens gerais do espanhol são inválidas. Nenhuma escrita, serviço, SQL, browser ou audição pelo QA. Evidência por stdin/parecer, sem inventar arquivo TAP.

## Navegador e tentativas

EnsaioC1 do Lead: nove capturas1600/390/360px, três tipos, cena pertinente, apenas a parte ativa montada, nenhuma conclusão por visita. Correções reais de escolha/ordenação/pergunta e três IDs confirmados por leitura RLS do próprio owner. A primeira etapa continuou incompleta após a ordenação enquanto faltava a terceira parte. Rascunho da pergunta restaurado após navegação; footer1→2→3→etapa2 aprovado.

**O ensaioC1 terminou exit1**, preservado em result.json. Depois desses quatro grupos passarem, a checagem auxiliar de retorno à etapa13 lançou erro de avaliação: o predicado consultava o progressbar sem aguardar a montagem e sem tratar seletor ausente. Não se declarou a suíte original PASS.

ContinuaçãoC1R1: exit0/PASS, readiness baseada primeiro no ID da atividade e seletores opcionais. Sem nova submissão de respostas. Confirmou os três registros persistidos, navegação1→2→3→etapa2, as três partes antigas da etapa13 e igualdade da lista de conclusões antes/depois. Produto e build não mudaram. Os dois resultados são distintos; o segundo não é uma nova primeira gravação. Zero erro JS ou bloqueio inesperado em ambos; barreiras CDP drenadas e navegadores próprios encerrados. Capturas examinadas pelo Lead.

Falhas auxiliares preservadas: o primeiro inventário confundiu o nome externo units/u1.json com o destino do consumidor units/001.json e parou após uma cópia documental, sem alterar fontes ativos. A retomada exigiu bytes iguais no snapshot parcial. O primeiro harness QA comparou o CSS com uma baseline histórica anterior à tarefa de layout; foi corrigido para a baseline vigente, sem mudar as asserções editoriais.

## Ambiente e preservação

Dos1144 pinos de entrada,1139 permanecem iguais; somente cinco fontes/pack autorizados mudaram. Todas as21 migrações SQL permanecem iguais. F1/C4 e identidade dos serviços existentes conferidos em metadados reais. Nenhum novo ambiente, Supabase start, migração, seed, reset, limpeza ou exclusão.

Somente dois registros de referência dos novos exercícios foram inseridos no catálogo deste curso, após conferir a relação lição/unidade/curso. CAS da metadata content_version1.5.0→1.6.0. Sem alteração de schema/ACL/gate ou reset de progresso. Conta sintética QA existente autenticada localmente; nenhuma conta nova. Submissões do ensaio pertencem a essa conta; respostas do proprietário não foram preenchidas. Não houve SQL manual nem nova auditoria do histórico/schema nesta tarefa.

App anterior encerrado após conferir PID/comando/listener do próprio checkout. App e dez serviços existentes mantidos para estudo; recursos históricos preservados. Papéis de autoria/QA/Lead em máquina/filesystem compartilhados, sem alegação de sandbox técnico exclusivo. Sem novo Revisor separado neste recorte; o QA independente cobre o delta editorial/contratual.

## Limites e acesso

Revisão de conhecimento já ensinado, com reconhecimento, montagem e recuperação imediata; não comprova domínio, retenção futura ou eficácia causal. Sem síntese nova, avaliação acústica, qualificação instalada/Linux/produção, remoto/Fly, API paga, commit, push, PR, merge ou deploy. Estimativas anteriores de tempo não foram recalibradas.

URL: http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1/lesson/nao-entendi-essa-parte?activity=atp-u1-l2-reactivate

Artefatos locais ignorados em .tmp/f3/review-stage-001/: snapshots, candidatos, CLI, importação, catálogo, build/app, capturas, FAIL inicial, continuaçãoPASS, preservação, manifesto e patch com arquivos novos. Autoria e handoff independentes em D:/Documents/Destrva Foundry/runs/f3-review-stage-001/.
