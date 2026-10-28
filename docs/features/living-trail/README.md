# Trilha Viva — caminho contínuo e aulas sobre a trilha

Atualização: 28/10/2026. Baseline preservada: `731045e47a96fc1231baacd4deda675a569b987b`. Esta evolução mantém o currículo e o progresso. O HTML enviado foi inspecionado e suas interações exercitadas; seus resultados simulados não foram transportados.

## Experiência

A entrada apresenta um próximo passo real, revisão quando existe evidência e um marco adiante. A trilha reúne todo o curso em um caminho vertical sinuoso: nós com ícones, cores, estados acessíveis, cenários e agrupamentos narrativos. O aluno não precisa escolher unidades. Seus nomes e pré-requisitos continuam internos ao currículo.

Cada ponto abre a página real correspondente num card modal sobre a trilha. Não existe iframe, cópia de atividade, segundo provider ou progresso paralelo. URL, recarregar e histórico continuam funcionando. Fechar ou usar Escape retorna ao nó correto; o leitor pode revisitar atividades concluídas. As aulas guiadas e avaliações conservam seus executores e guardas originais.

Dentro de um momento, a microprogressão usa somente suas etapas e suas atividades. A conclusão volta à trilha; o botão anterior respeita seu início. A navegação local guarda apenas localização, separada por usuário, curso, versão, origem e instalação. Não guarda respostas ou notas nesse checkpoint.

## Regras e preservação

Participação é projetada pelas regras oficiais. No espanhol atual, 65 de 81 práticas liberam a prova de 18 questões; 64 não bastam. A aprovação exige 80% e libera o trecho seguinte. Uma reprovação permite nova tentativa sem liberar o próximo trecho. Os resultados canônicos e o histórico permanecem a fonte de verdade.

Não houve reset, migração de banco ou modificação dos pacotes curriculares, identidades, versões, hashes, gabaritos e mídias. O acesso protegido continua nos guardas do Motor e do servidor. Uma URL ou estado visual não concede acesso.

## Contrato e Foundry

O [contrato de apresentação 1.0.0](FOUNDRY_CONTRACT.md) e seu [schema público](../../contracts/journey-presentation-1.0.0.schema.json) permitem declarar títulos, objetivos, personagens, cenários, ícones, tons, ilustrações e referências a etapas reais. São capacidades reutilizáveis; nenhuma condição de interface depende do idioma ou de um ID específico de curso.

A composição ES contém 24 momentos, preservando todas as referências curriculares. Sem composição válida, o Motor gera apresentação padrão a partir do currículo — inclusive inglês. Cursos instalados usam esse fallback; transporte e fixação de sidecars instalados não foram implementados neste incremento. A aprovação editorial dos metadados não reaprova nem altera o conteúdo do curso.

O novo run local do Foundry é `runs/trilha-viva-20261027`. O Foundry não possui Git inicializado; o Motor contém os arquivos necessários à execução, sem dependência operacional dessa pasta.

## Decisões de desenho

O caminho sinuoso atende à direção visual mais recente do proprietário. O conteúdo abre em uma experiência curta sobre o mapa, preservando a identidade visual construída anteriormente. Animação discreta identifica a continuação e respeita redução de movimento. A informação secundária permanece acessível sem competir com a ação principal.

As referências consultadas orientam escolhas, sem provar eficácia do Destrava: [organização da trilha Duolingo](https://blog.duolingo.com/new-duolingo-home-screen-design/), [divulgação progressiva NN/g](https://www.nngroup.com/articles/progressive-disclosure/), [revisão Busuu](https://help.busuu.com/hc/en-us/articles/16941990776593-How-can-I-review-my-vocabulary) e [revisão Babbel](https://support.babbel.com/hc/en-us/articles/360037496932-Memorizing-vocabulary). Revisão disponível depende da fila real, não do ícone escolhido pelo autor.

## Validação e limites

As evidências desta execução ficam em `.tmp/trilha-viva-20261027/`; os pareceres independentes ficam no run QA correspondente. Consultar [validação](VALIDACAO.md) para comandos, resultados, revisão e capturas do candidato final.

A aplicação foi executada com `npm.cmd run dev`; ocorreu um ciclo de Fast Refresh que impediu homologação nesse modo. O caminho de homologação usa compilação de produção local na porta 3100. Não se apresenta o problema de desenvolvimento como falha da aplicação publicada.

A suíte independente inicial registrou 40 casos aprovados e 15 falhas de expectativa: 14 contavam cartões de apoio como questões avaliativas e uma comparava CRLF/LF como alteração curricular. As falhas originais foram preservadas. A revisão automática rejeitou a correção desse teste na worktree QA; não se afirma que sua suíte completa ficou verde. Referências, JSON e blobs curriculares foram comparados separadamente.

Sete gates amplos já falhavam na baseline: políticas, semântica de avaliações, interação, multilingual, instalações, runtime e jornada. Suas falhas e limites de cobertura estão registrados; não se alteraram critérios para obter aprovação. Os testes específicos e jornadas reais precisam ser considerados em conjunto com essas limitações.
