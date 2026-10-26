# Navegação das lições 05–08 dentro do curso

25/10/2026. **Corrigido e verificado no compilado local.**

## Pedido e resultado

As lições da unidade abriam áreas globais:05 em /live-classes,06–08 em /assessment. Os links da trilha agora sempre apontam à lição dentro de /course/<curso>/unit/<unidade>/lesson/<lição>. A guiada05 usa a subrota /guided dentro desse contexto;06/07/08 montam seus executores de avaliação na própria lição. Sidebar e navegação móvel continuam em Meu curso. Retorno à unidade e anterior/próxima usam o mesmo percurso.

A guiada continua guiada e os bancos continuam avaliações. Não foram convertidos em atividades comuns. O Foundry não precisou alterar pacote, currículo, critérios, gabaritos ou mídia; a edição1.6.0 permanece igual.

## Implementação

- UnitPage usa courseLessonPath para todos os links da trilha.
- LessonPage não manda bancos para a área global; resolve assessmentId somente entre avaliações declaradas naquela lição. Referência de outra lição do mesmo curso e ID desconhecido são recusados. Bancos retornam antes do renderer normal.
- AssessmentSession reutiliza fixed/adaptive existentes e a mesma learningActionAvailability, inclusive source installed/compiled, requisitos e disponibilidade.
- InteractiveLessonEntry é o binding servidor compartilhado da rota global e da subrota do curso. A subrota exige curso, unidade ativa, lição ativa, interactiveLessonRef e definition.lessonId correspondentes; IDs indisponíveis/cursos instalados continuam bloqueados. Também verifica disponibilidade operacional, pois o guard de paths globais não cobre a subrota.
- Na área global, uma referência guiada explícita inválida não seleciona outra definição como fallback. A entrada sem referência conserva seleção inicial. Rotas globais válidas continuam disponíveis para acesso intencional.
- InteractiveClassroom recebe somente unitHref opcional para três links de retorno, sem mudar sessão, owner, versão, CAS, áudio, recibos ou submissão.
- AssessmentResult aceita onStart opcional. FixedAssessmentRunner passa begin, para Executar/Refazer abrirem a tentativa localmente. Demais consumidores sem callback preservam o link anterior.

## Identidade

HEAD 548a729a33b80fa7dfb8681855cd1e2a71c5174b; branch test/release-f2-clean; workspace D:\Documents\destrava-worktrees\destrava-release-clean. Baseline F3-REVIEW-STAGE-C1R1,1333 pinos,digest e6b028dc21090f081a3efcc5541b95164628582c9d400f6519fd5ba232193dbc. Código final **F3-COURSE-NAV-CODE-C2**,12 arquivos,digest e22160835c401949ea2955fc2db86f163392cc03acb2945375fec5c2683579d6. Integrado **F3-COURSE-NAV-C2R4**,1359 pinos,digest a245f94771f7300842f7e170cbdab10acdcbd700f4f4f45a820ec6d60b15a37d. Build OYiaHHmLC5vsot9ujPUrp, appPID95412, exclusivamente127.0.0.1:3100.

Sete fontes existentes alterados, quatro fontes novos e um teste novo. Os1326 demais pinos de entrada permanecem iguais. Hash do pack1.6.0 preservado: fc9569aa996f9fae55a56418e22b4afd71178c03e7b3852697cd10478498ca3d. APIs, domínio, schema, gabaritos, capabilities, guards, SQL e fontes de conteúdo não mudaram.

## Verificações

- TypeScript --noEmit --incremental false noC1: exit0. Ambos buildsC1/C2: exit0 e TypeScript próprio; somenteC2 foi servido.
- ESLint dos nove fontes iniciais, dois da correção e teste novo: exit0, zero avisos.
- node --import tsx --test scripts/course-lesson-navigation.test.mjs:14/14 PASS, incluindo bindings positivos e negações de curso/unidade/lição/definição/inactive/unavailable.
- check-architecture.ts: exit0,15 módulos de conteúdo sem ciclos, fronteiras e registro de capacidades verificados.
- Browser finalC2R4: PASS, oito capturas1600/390px, cliques reais05–08 mantendo Meu curso, retornos à mesma unidade, entradas diretas e próxima lição05→06. Fixed06/07: Executar no cartão de resultado abre a primeira atividade localmente. Bancos não mostram atividades/ajuda antes do início. Referências de avaliação estrangeiras/unknown e /guided de lição comum negadas. Globais intencionais continuam funcionando. Zero erro JS/bloqueio inesperado/overflow; barreira CDP drenada.
- Visitas e início local sem respostas não adicionaram conclusão nem resultado de avaliação. Não houve envio/conclusão de avaliação ou jornada guiada completa real nesta tarefa. O callback Refazer após resultado foi coberto no VM independente, não por uma nova avaliação inteira no navegador.

## QA e Revisor

Perfis canônicos QA_V1/Revisor_V1 explicitamente reaplicados. Lead foi único escritor/operador de serviços e navegador. Especialistas somente leitura/puros; mesma máquina/filesystem, sem alegação de sandbox técnico de leitura.

QA /root/u12_qa C1:316 controles principais PASS, incluindo126 comportamentais;1158 de preservação PASS. Limitou-se a mocks de hooks/registry e projeção pública no VM, sem browser/SQL/serviços. O VM C1 tratava AssessmentResult como marcador e não percorreu seu link; essa lacuna foi registrada, não apagada.

Revisor /root/u12_revisor encontrou P2 emC1: Executar/Refazer do cartão de resultado ainda saíam para /assessment. C1 não recebeu GO completo. C2 acrescentou o callback local e conservou os dez pinos anteriores. QA C2:123 controles adicionais PASS, incluindo componentes reais Result+Fixed, clique único inicial/passed/failed/NOT_ASSESSED, consumidor sem callback, begin→MC→writing→envio→resultado→refazer, reset, payload único e falha sem finalização. Hooks/submissão simulados, sem alegar HTTP real. Revisor fechouP2 e deu GO estáticoC2;12/12 hashes antes/depois, sem testes/SQL/Docker/escrita. Não identificou mudança de autoridade ou privacidade.

## Tentativas e limites preservados

1. Primeiro ensaioC2 parou antes do browser porque a sessão da antiga conta sintética havia expirado. Renovado somente o login local dessa conta; sem alterar configuração Auth.
2. EnsaioC2R2 alcançou a rota correta05, mas o GET da sessão guiada retornou409/LESSON_VERSION_CONFLICT por histórico de edição anterior. O mesmo guard vale nas rotas global e do curso; nenhuma tolerância ou exclusão foi introduzida. A sessão antiga permanece retida.
3. Para observar a edição atual sem alterar história, foi criada uma única conta local sintética nova, retida em qa-fresh, com preferências iniciais de onboarding preparadas e zero respostas/conclusões. Nenhuma conta do proprietário ou anterior foi resetada. Esse setup não comprova o onboarding real.
4. C2R3 comprovou05 desktop/mobile e privacidade inicial06, mas o próprio teste tinha aspas inválidas em um seletor passado ao CDP. Mantida a asserção de zero links globais, trocando somente a expressão por comparação do pathname dos anchors.27 expressões estáticas foram analisadas antes doC2R4, que passou. Código de produto/build permanecemC2; os FAILs não foram rebatizados como PASS.
5. Tentativas auxiliares QA tiveram erros de montagem do comando, Unicode em stdin e sincronização entre realms/microtasks; corrigidas nos harnesses sem relaxar assertivas ou mudar produto.

Não se certifica retomada de sessão guiada de edição antiga, migração de progresso, eficácia pedagógica, qualidade acústica, caminho instalado positivo ou produção/Linux. O conflito histórico da conta QA continua separado da navegação corrigida.

## Operação e entrega

Mesmos recursos destrava-release-clean, ledger F2-R e configuração local. Inspeções reais F1/C4/identidade passaram antes de operar. Nenhum novo ambiente, Supabase start, migração, seed SQL, reset, remoção, alteração de ACL, gate ou configuração Auth. Uma conta exclusivamente sintética foi criada para o ensaio; somente seu estado inicial de preferências foi preparado, por RLS, sem evidência de aprendizagem inventada. Perfil antigo, dados e recursos preservados. Nenhuma chamada paga, remoto, Fly, commit, push, PR, merge, publicação ou deploy.

App anterior encerrado após conferir PID/comando/listener; app final e serviços existentes mantidos para estudo. Browser de QA encerrado. Artefatos ignorados em .tmp/f3/course-nav-001/: snapshots, candidatosC1/C2, recibos, testes, builds, credenciais QA privadas, FAILs separados, diagnóstico de versão, capturas, PASSfinal, preservação e patch completo com fontes novos. Credenciais não entram no patch/relatório.

Acesso: http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1 . Atualizar navegador para carregar o build novo.
