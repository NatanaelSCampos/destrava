# F3 UX/Pedagogia — reconstrução do início da Unidade 1

Data: 25/10/2026. **IMPLEMENTAÇÃO E TESTES LOCAIS CONCLUÍDOS — ENCERRAMENTO INDEPENDENTE PENDENTE.** Candidato disponível para experimento local. QA/Revisor favoráveis antes da operação; o limite de uso dos agentes impediu o parecer sobre os resultados finais. Não se registra READY_FOR_OWNER_REVIEW formal nem aceite pedagógico do proprietário.

## 1. Identidade e escopo

Motor: `D:/Documents/destrava-worktrees/destrava-release-clean`, branch `test/release-f2-clean`, HEAD `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, acompanhado dos digests locais. Foundry independente: `D:/Documents/Destrva Foundry`. Sem commit, push, PR, merge ou publicação.

O relato do proprietário reabriu o aceite didático da edição 1.0.0: conseguir concluir telas não demonstrou conseguir estudar satisfatoriamente. A autorização posterior dispensou migrar seu progresso; preservamos contas, dados e artefatos existentes, sem reset.

Curso `espanol-a-tu-paso-a1`, edição sucessora **1.1.0**. Autoria alterada somente em `atp-u1-l1`, `atp-u1-l2` e abertura/continuidade mínima de `atp-u1-guided`. “Chegando ao encontro” era a cena `atp-u1-l1-scene`; “Diga a mensagem” era `atp-u1-l1-voice`.

Pacote Foundry ATP-UX-U1-C3: digest de 23 arquivos `72d6d3062af855856fe82d2feb143aeb01e5535cc239d26d4ac520e736144f02`; manifesto `2fe6192a55e9b6b0a917e61e7c7e98708079920c1e53c450216236b82c560c9a`. Fingerprint do pacote `aacef68f8ae7b0cceff9e20b24c36b8360971a9f16a9f1a2591c8d7e4351d3bd`; SHA físico do pack compilado `4c8d68b24e19a93ca113118f2b75d313493f1d4415606f029e61871687b45770`.

## 2. Sequência antes/depois

| Antes, edição 1.0.0 | Sucessora 1.1.0 |
| --- | --- |
| Exposição densa e convite oral prematuro | Uma ideia por etapa; cena e áudio antes de prática e produção opcional |
| Explicações repetidas em vários formatos | Apoios expansíveis no momento útil, sem apagar o rascunho |
| Voz espanhola de frases não comprovada | Seis arquivos de frases, controles próprios e proveniência |
| Flashcard sem tarefa mental clara | Situação concreta, tentativa mental antes de revelar verso/áudio |
| Feedback em bloco | Resultado curto; explicação e contraste de alternativas após avaliação |
| Repetir imediatamente até acertar | Um exemplo autoral alternativo após três outras atividades de aprendizagem |
| Ocultar aba podia pausar e desmontar a aula | Relógio/mídia suspendem automaticamente; percurso permanece; pausa manual é separada |

A primeira lição tem dez etapas: informar o lugar, ouvir/reconhecer, construir, perguntar, combinar e aplicar. A segunda tem onze: retomar o contexto, dizer que não entendeu, pedir repetição, praticar e combinar. A produção oral é posterior à exposição e opcional; não recebe nota de pronúncia. A abertura guiada usa diálogo curto e prática independente, sem repetir uma parede de texto.

Participação, acerto fechado, escrita/fala não avaliadas e competência linguística continuam distintos. A recuperação é finita: uma variante por regra, depois de 2–4 outras atividades (três nesta edição), sem SRS, nota nova ou conclusão automática. Navegar, consultar ajuda ou repetir a mesma conclusão não avança o intervalo.

## 3. Capacidades e fronteira Motor–Foundry

A extensão **CoursePackage 1.6 foi autorizada expressamente**. Adiciona apresentação de conceito/diálogo, esquema contextual, interlocutores, apoio, áudio no verso de flashcards, feedback privado por alternativa e recuperação declarativa. Pacotes 1.3/1.4/1.5 mantêm seus contratos; as capacidades novas são negociadas explicitamente.

O Foundry declara conteúdo, exemplos, mídias, critérios e variantes. O Motor valida e executa componentes genéricos. Não há HTML/JavaScript/DSL oculto no pacote, dependência operacional do Foundry sobre banco/UI ou regra exclusiva do espanhol.

A projeção pública continua retirando gabaritos e feedback privado antes da tentativa. O avaliador canônico entrega o feedback correspondente após corrigir. Nenhum novo schema, SQL, Auth, ACL, role, owner, autoridade de correção ou permissão de produção foi introduzido.

O repositório passou a incluir recuperações no mapa de atividades para eventos e erros normalizados. Isso não altera os elencos normais usados nos denominadores de participação, conclusão e notas.

## 4. Referência visual e evidências

Referência: HTML fornecido pelo proprietário, SHA `55656db40f728c2cbfafd2d2db6e5268dbc6805156ee452733ec5abea75f5990`.

| Elemento da referência | Implementação real |
| --- | --- |
| Fundo claro e cartões arredondados | Superfícies claras, bordas suaves, espaçamento e hierarquia curta |
| Percurso lateral e etapa atual | Navegação interna por pequenas etapas; navegação não equivale a aprovação |
| Progresso vermelho e estados mint | Progresso de percurso, seleção, foco e feedback distintos |
| Coluna de propósito/repertório | Objetivo visível e expressões já apresentadas; consultar não prova dominar |
| Alternativas e explicação | Área clicável, teclado, feedback posterior e apoio expansível |
| Diálogos com identidade | Balões estáveis por interlocutor e áudio por fala |
| Mobile | Cartão sem overflow em 360/390; ajuda por teclado; menu global preservado |

Screenshots C8 mostram diálogo desktop, recuperação e prática 360/390. As capturas com créditos abertos demonstram a área de atribuição; ela é recolhível. A comparação é visual e funcional com o HTML, sem alegação de igualdade de pixels ou redesign do menu.

## 5. Áudio e limites de escuta

Geração local gratuita/offline com Piper 2023.11.14-2, voz `es_ES-carlfm-x_low`, modelo treinado do zero. Fontes: [model card](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/es/es_ES/carlfm/x_low/MODEL_CARD) e [dataset/autoria](https://github.com/carlfm01/my-speech-datasets). Repositório MIT; dataset declarado domínio público. Proveniência e atribuição acompanham as mídias.

Frases: Estoy en la biblioteca; Estoy en la plaza; ¿Dónde estás?; No entiendo; ¿Puedes repetir, por favor?; No entiendo. ¿Puedes repetir, por favor? São arquivos WAV reais, voz sintética es-ES; não são gravações de conversa natural.

O proprietário ouviu três amostras e respondeu **“Voz clara para o primeiro teste”**. Esse aceite é preliminar e limitado às amostras. O agente não tem ferramenta de audição e não alegou ouvir ou avaliar pronúncia. Reprodução, duração, repetição, velocidade 0,8 e créditos são verificações técnicas distintas.

Gravação de teste usa sinal sintético, sem microfone físico ou dados pessoais. Escrita/fala livres continuam NOT_ASSESSED. Qualidade acústica integral, fala humana, retenção e eficácia de aprendizagem dependem do estudo real.

## 6. Persistência e pausa

O relógio separa atividade visível de tempo oculto/inativo. A mudança automática suspende mídia/contagem sem impor “Retomar sessão”. Pausa manual permanece explícita e persistida. A atividade fica montada; ocultar uma aba não apaga texto.

Rascunhos de respostas curtas/escrita/ordenação têm escopo de owner, curso, edição e atividade. Gravação/texto usam armazenamento local com hidratação antes de editar/capturar; ocultar a aba encerra tracks próprios e não reinicia microfone automaticamente. Falha de quota não é apresentada como salvamento concluído.

A sincronização compilada registra a base confirmada e a intenção transmitida antes do envio. Após reload, restaura uma pendência somente se a leitura remota corresponde à base ou ao snapshot transmitido. Toda repetição incerta, inclusive payload idêntico, relê o remoto; divergência não é sobrescrita automaticamente. Isso não adiciona CAS de servidor nem promete resolver escrita concorrente ocorrida depois dessa leitura.

## 7. Testes, falhas e revisão

### Candidato final e resultados

**F3-UX-U1-C9C**, 762 pinos, digest `339e89f655d61886441dd539a85f18dcfa97bd01b78e99e325df7e3bf8bd3899`. Build `z_BuKLtw1S-6T4wnLeAye`, app próprio PID118140. O produto/build é o mesmo C9B; C9C modifica apenas coordenação/oráculos do harness.

| Verificação | Resultado efetivo e alcance |
| --- | --- |
| Ensino/contratos e navegação | 27 +2 PASS anteriores, fontes preservadas |
| Recorder/store/pausa M4 | 29 PASS anteriores, fontes preservadas |
| M6B + prova de documento novo | Root23 PASS:17 sincronização +6 navegação; TypeScript/lint/arquitetura exit0 |
| Projeção real do repositório | Quatro novos +dois unit-progress PASS; TypeScript/lint exit0 |
| Coordenação CDP | Root11 PASS; syntax/lint exit0; todo erro continua fatal |
| Build + assets | Next16.3.8 exit0, stderr vazio;76 assets próprios copiados/conferidos |
| C8, dez grupos individuais | Ensino, ajuda/drafts/reload, feedback, recuperação integral, flashcard e mobile passaram; global FAIL preservado |
| C9C, continuação | Dois grupos PASS/exit0: quatro tentativas intactas;19 eventos normalizados exatos, dois ligados à recuperação; documento novo e mobile360/390 |
| C9C, ciclo de vida | Cinco grupos PASS/exit0: seis WAVs distintos, gravação/texto locais após ocultar/recarregar, guiada sem pausa por aba, atividade/relógio preservados, pausa manual com ACK remoto e reload |
| Entrada do proprietário | PASS no build final, login normal da mesma conta1.1, campos iniciais canônicos/onboarding0, sem respostas ou preferências escolhidas |
| Auditoria final do Lead | READ ONLY/ROLLBACK: SID exato, histórico21 integralmente igual ao F2-ACL, gatefalse/NULL, verificadorACL8; quatro tentativas e dois eventos ligados à recuperação |
| Serviços |21 contêineres retidos:10 ativos/11 parados; cinco volumes; sete listeners127.0.0.1 incluindo app; CDP9447 fechado |

Os dois grupos C9C e os cinco de ciclo de vida tiveram zero bloqueios inesperados/erros e barreira final saudável com pendingCount0. A auditoria posterior conta24 eventos, pois o ciclo de vida acrescentou eventos legítimos de sessão aos19 da continuação.

Ocultação real final:2406ms, relógio00:00→00:00. Sessão manual `a9657aad-5eb6-4b25-a5bf-1a9ea25c8a6e`: pausa confirmada remotamente antes do reload; mesma identidade/cursor/duração depois. A gravação foi sintética, sem microfone físico ou envio/nota linguística.

**O reload C9C ocorre depois do ACK do agregado e de todos os eventos normalizados.** O ensaio pendente62ms pertence ao C8, com M6B idêntico. A mudança de produto C9 limita-se ao mapa de projeção. Não somar grupos sobrepostos como uma suíte única.

### Falhas posteriores e coordenação

C9 estático recebeu NO-GO porque a prova final podia anteceder ACKs CDP pendentes. C9B adicionou drain/saúde/pending0; seu ensaio real permaneceu FAIL por três InvalidInterceptionId em prefetches tardios, sem bloqueio de escrita. A causa completa não foi comprovada e esses erros não foram ignorados.

C9C usa a opção local eventTurn250ms da barreira existente. Nova interceptação reinicia a janela; prazo global5s. A coordenação aguarda handlers/ACKs CDP observados, sem ignorar erro por rota/header. O driver espera separadamente a confirmação normalizada antes do reload. O flashcard já concluído no C9B foi respeitado, sem nova nota/tentativa artificial.

### Pareceres independentes e pendência formal

QA editorial foi favorável ao recorte C3. QA técnico e Revisor foram favoráveis **pré-operação ao C9C**,762/762 pinos. Entre os controles próprios do QA: oito do repositório real com I/O simulado, seis da integração handler/barreira, seis do fechamento e três da janela. São grupos de rodadas distintas, não cobertura cumulativa única. Revisor leu fontes congelados sem testes/SQL/Docker.

**O parecer independente sobre os resultados reais C9C e o smoke final do proprietário não foi executado.** Ambos os agentes atingiram o limite de uso ao receber a tarefa de encerramento. A auditoria e o smoke finais foram feitos pelo Lead. Não se rebatizam como QA independente.

Classificação: **IMPLEMENTAÇÃO E TESTES LOCAIS CONCLUÍDOS — ENCERRAMENTO INDEPENDENTE PENDENTE**. A experiência está disponível para experimento; sem READY_FOR_OWNER_REVIEW formal ou aprovação pedagógica. Falta somente examinar estes artefatos finais e eventual leitura independente proporcional; não é necessário repetir autoria, ambiente ou bootstrap.

### Recibos

- `.tmp/f3/ux-u1-c9/candidate-c9c.json`, `evidence-c9c/result.json`, `lifecycle/result.json` e screenshots.
- `.tmp/f3/ux-u1-c9/build/`: build exit0, logs e76 assets.
- `.tmp/f3/ux-u1-owner-final/{candidate.json,result.json,entry.png}`: entrada inicial, sem dados privados no relatório.
- `.tmp/f3-ux-u1/delivery/final-audit/`: SQL READ ONLY/ROLLBACK e listeners atribuídos ao Lead.
- Manifesto/patch completo e preservação em `.tmp/f3-ux-u1/delivery/`.


Falhas preservadas:
- C2 catálogo: colisão de posição no lote de atividades; referências existentes preservadas e reconciliação C4 restrita a metadados, sem reset.
- C4 rascunho: URL não acompanhava a etapa; corrigida integração nativa do histórico e regressões.
- C5/C7: prova de reload insuficiente. Page.navigate ACK não garantia novo documento; QA encontrou recuperação ausente no banco. Seus PASS individuais não viraram aceite integral.
- M6 original: retry idêntico sem leitura poderia sobrescrever outro estado. Negativo reproduziu a segunda escrita; M6B exige leitura em todo intent incerto.
- C8: dez grupos individuais passaram, com prova de recuperação integral local/remota e exercise_attempts. Resultado global FAIL: dois POSTs de eventos foram corretamente recusados porque a projeção omitia a recuperação; três falhas de continuação CDP permaneceram sem prova de cancelamento. Nenhuma allowlist foi ampliada para mascará-las.
- O teste novo de projeção inicialmente tinha fixture incompleta; corrigida antes da contraprova. Antes do fix real: dois controles falharam, dois passaram. Depois: quatro passaram.

Inatividade real C6D: 333.094ms, relógio 04:59 congelado e atividade preservada. Reutilizada apenas essa evidência temporal e troca de aba com fontes inalteradas; antigas alegações de reload sem prova de novo documento não substituem o ensaio final.

QA editorial revisou integralmente o recorte como iniciante: linguagem, currículo, pedagogia e integridade do conteúdo. Uma responsabilidade QA separada da autoria examinou essas quatro dimensões; não se apresentam quatro pessoas nem julgamento humano de escuta. Perfis QA_V1/Revisor_V1 explicitamente carregados; Lead único operador compartilhado, Implementador em worktree própria. Independência de responsabilidade/análise em máquina/filesystem compartilhados, sem alegação de sandbox exclusivo.

## 8. Preservação e ambiente

Mesmo projeto `destrava-release-clean`, API 127.0.0.1:55421, PostgreSQL externo 127.0.0.1:55422, app 127.0.0.1:3100. Mesmo DBID, volume e SID 7699958133051768869; 21 migrações preservadas, sem reinstalação.

Rede original, cinco volumes e 21 contêineres retidos; somente dez substitutos operacionais. Gate instalado deve permanecer false/nonce NULL. O F1 estático operational:false não substitui as inspeções operacionais reais F2-R.

A edição 1.0.0 foi arquivada com build, fontes, pack e mídia: 1.854 arquivos/38.895.345 bytes conferidos. A conta antiga permanece preservada. O servidor atual oferece 1.1.0; não se promete que as duas edições estejam simultaneamente disponíveis na mesma URL.

Verificação semântica: doze lições fora do recorte mantêm currículo idêntico. Três URLs de áudio foram rebased para a versão nova, com WAVs byte a byte iguais. Menu global preservado. Prefixos documentais e pendências anteriores serão conferidos no manifesto; diferenças físicas de EOL são identificadas separadamente.

Os seis grants internos Storage continuam sob a ressalva local F2-ACL, sem modificação interna forçada. Nenhum ambiente antigo, curso pessoal, remoto, Fly, API paga ou produção foi operado. Sem reset, limpeza de fixtures/volumes, migração ou operação Git automática.

## 9. Estudo do proprietário e próximos limites

Conta 1.1.0 separada de QA; o smoke de entrada compara todos os campos ao estado inicial canônico e deixa onboarding/preferências para o proprietário. Entrada vazia não equivale a persistência remota de onboarding já concluído. Credenciais ficam somente no arquivo local ignorado indicado no guia; não são impressas ou anexadas ao patch.

O próximo aceite é o proprietário conseguir estudar, compreender e usar os exemplos. Duas sessões curtas bastam para colher fricção inicial; não exigir que ele identifique o componente responsável. Ocorrências começam como UNKNOWN/SHARED e recebem reprodução e correção versionada.

Aplicar o padrão ao restante da Unidade 1/Unidade 2 depende desse retorno prático. Nenhuma nova unidade, curso, publicação, imagem Linux de produção ou deploy decorre desta entrega.


## 10. Correção da referência visual — 25/10/2026

Após o retorno do proprietário, a primeira lição recebeu cena ilustrada, cards e ícones, conversa compacta com significados visíveis e remoção do ruído técnico repetido. As oito telas do HTML e as dez etapas reais foram percorridas. A conferência final do Lead passou nove grupos, incluindo áudio, recarga com rascunho e mobile 360/390. Build, TypeScript e lint passaram. Pacote 1.1.0 e banco preservados. Não houve novo parecer independente; a classificação histórica acima não foi reescrita.

Detalhes, candidato e acesso: [Correção visual do HTML](CORRECAO_VISUAL_HTML.md).


## 11. Retorno do proprietário — conversa e ajuda (25/10/2026)

A edição 1.2.0 corrige explicação inicial, resposta em conversa, aplicação guiada, ajuda em modal e voz opcional. Os ensaios locais e limites estão em [Conversa e ajuda](CONVERSA_E_AJUDA.md). O candidato anterior permanece histórico. Não há novo parecer editorial independente nesta retomada.


## 12. Correção de referência e sincronização — 25/10/2026

O retorno seguinte do proprietário revelou referência ausente no catálogo da atividade nova. O cadastro local foi reconciliado sem apagar progresso; regressões e ensaio de falha/retry confirmaram a projeção normalizada e a recarga. A entrega visual anterior não cobria essa garantia. Detalhes e limite de operação na conta do proprietário: [Correção da sincronização](CORRECAO_SINCRONIZACAO.md).

## 13. Termos distintos e retomada em conversa — 25/10/2026

**Correção validada localmente no caminho compilado.** Edição **Español a tu paso 1.3.0**, CoursePackage **1.7**, candidato **F3-INLINE-RECALL-C7**, digest `481ee5f8e8f74acdb2fd88f18605d3b2a3346d7e2f2f660fcfa90e4bf3d76377`. HEAD continua `548a729a33b80fa7dfb8681855cd1e2a71c5174b`, branch `test/release-f2-clean`, mesma worktree release-clean; sem commit.

### Mudança entregue

- O Foundry declara trechos e seus idiomas por texto/ocorrência/item exatos. A interface distingue expressões da explicação em português por fonte, peso, cor, fundo e lang, sem esconder traduções.
- A edição declara **327 trechos em 95 atividades**, distribuídos nas duas unidades. Foram revisados contexto, frases completas, palavras iguais nos dois idiomas e exclusão de URLs/créditos.
- Os **nove cartões de retomada** usam contexto ilustrado, ação concreta, tentativa escrita, comparação em diálogo, traduções e áudio declarado quando disponível. “Você lembra a pergunta?” tornou-se “Encontre a outra pessoa”.
- A primeira lição foi conferida no navegador. Ajuda abre em popup e mantém o texto; recarregar conserva o rascunho. O modelo é montado após comparar; conferir continua sendo autocheck, sem nota linguística inventada.
- Removidos prompt genérico e título interno quando repetiam o contexto/título do card. Não há condição por espanhol, courseId ou lessonId no recurso do Motor.

O padrão portátil e seus exemplos estão em [Termos e retomada](TERMOS_E_RETOMADA.md). O Foundry recebeu a atualização do padrão, do briefing e os contratos exportados em `runs/f3-inline-recall-001/`; pacote final `external-package-c4`. A composição deve ser declarada nas próximas autorias, sem copiar alterações de UI por lição.

### Contrato e integridade

A extensão opcional 1.7 acrescenta annotations e recallScene. Contratos anteriores continuam aceitos e recusam os campos novos. presentation.inline é requisito obrigatório inferido; flashcard 2.0 conserva o schema anterior, e 3.0 admite a conversa. As anotações privadas de soluções/feedback/transcrição oculta não atravessam a projeção pública. O avaliador retorna somente a apresentação pertinente após a tentativa, preservando direção, precedência e formas variantes.

Corrigido também o parser de evidências instaladas que recusava feedback autoral já existente. Isso foi verificado por teste puro, sem ativar instalação. **presentation.inline continua indisponível no perfil instalado**; installed-runtime.json foi regenerado para registrar a recusa. Esta entrega qualifica a experiência compilada e não anuncia paridade instalada.

### Verificações efetivas

| Camada | Resultado e alcance |
| --- | --- |
| Validador oficial / importação / compilação | Pacote C4 tecnicamente válido e compatível com o catálogo do Motor; quatro cursos compilados. Isso não substitui aprovação editorial autenticada ou qualificação instalada |
| Contratos e renderização do Lead | **48 testes pertinentes PASS**: 45 de contratos/legado e três SSR; incluindo privacidade, índices vazios, Unicode/escaping, metadados pós-grade e validação contra texto normalizado |
| Arquitetura | Exit 0; fronteiras e capacidades verificadas, 12 módulos locais sem ciclos |
| TypeScript / ESLint | Exit 0; noEmit sem incremental e TypeScript do build; lint dos fontes alterados e deltas finais sem erros/avisos. Saídas de testes por ferramenta não são inventadas como logs TAP de arquivo |
| Build final | Exit 0, ID `zTsJE3kS1TT1MaiaWB51b`; pack SHA256 `1ab1f8f1ebb1097f35e6a2d79a7ce1b26bd2bd6e27513a837d802ae530e86b4b`. Nove mídias declaradas iguais entre public e standalone |
| Navegador C7 real | **8/8 grupos PASS**: referências/versão, termos distintos, card antes da comparação, popup sem perder tentativa, rascunho após reload sem revelar modelo automaticamente, dois interlocutores/áudio/autocheck, 360/390 sem overflow e feedback/persistência normalizada/reload |
| Rede / runtime | Zero exceções JS, zero HTTP inesperado >=400 e zero bloqueio inesperado. Barreira Fetch final sem pendências |
| Catálogo / persistência | **131 referências presentes**, zero ausentes. Metadata do curso atualizada por CAS 1.2.0→1.3.0. Tentativa nova confirmada em exercise_attempts e atividade em user_activity_progress, com recarga; não apenas cópia JSON local |

A conta de QA existente foi a única usada no navegador; o proprietário não foi impersonado. Nenhum histórico pessoal foi apagado ou regravado. Não houve novo cadastro de atividade, schema, migração, alteração de Auth/ACL ou reset. Um aviso de cópia local preservada apareceu no perfil de QA reutilizado durante a jornada; não foi tratado como erro de rede nem apagado para obter verde.

### Parecer independente

**QA /root/inline_contract_review: PASS no escopo puro.** Perfil QA_V1 explícito, somente leitura/stdout. Executou 23 controles de contratos/privacidade/capacidades, 20 de versões/unidade sintética, 165 casos SSR, nove grupos de grade com 242 tentativas em 82 atividades objetivas e dois controles de privacidade/Unicode. Contagens de grupos diferentes não são somadas como testes únicos. Conferiu 327 spans/95 atividades/nove cenas do pacote C4; nenhum bloqueante aberto no recorte. Não operou navegador, banco ou áudio real.

**Revisor /root/recall_final_review: favorável ao C7 no escopo compilado.** Perfil Revisor_V1 explícito, somente leitura, sem testes ou serviços. Conferiu os **970 pinos** e os deltas finais. Achados de privacidade/compatibilidade, índices, trim e codificação foram corrigidos e revistos. Não atesta eficácia pedagógica nem publicação.

Lead único escritor e operador de serviços. Especialistas não subdelegaram. A independência foi de responsabilidade/análise e, no QA, execução pura distinta; máquina/filesystem compartilhados, sem alegação de sandbox técnico exclusivo.

### Tentativas preservadas e limites

Candidatos Foundry C1–C3 foram corrigidos após marcações inadequadas ou incompletas; C4 usa revisão contextual explícita. QA/Revisor também identificaram parágrafos vazios e metadados privados que precisavam voltar após grade; regressões foram acrescentadas.

O preflight anterior recusou o hash antigo do briefing atualizado e não chegou ao banco/browser. A primeira espera HTTP curta não observou prontidão; o servidor depois respondeu 200 com PID/listener próprios confirmados. O ensaio C5 percorreu três grupos e falhou ao fechar ajuda porque o driver omitia o VirtualKeyCode da tecla Escape; C6 usa a mesma chamada do helper já homologado e passou os oito grupos. C7 removeu duas repetições visuais, recebeu novo build e passou novamente os oito grupos. FAILs e resultados continuam separados; não foram rebatizados.

Outras lições tiveram validação/SSR; **não houve jornada browser integral das duas unidades**. Áudio foi reproduzido no navegador e os arquivos conferidos; isso não é nova avaliação acústica humana. O aceite prático é do proprietário. Um build Windows local não homologa imagem Linux ou publicação.

### Acesso e estado final

Use o mesmo acesso privado já fornecido, sem reproduzir credenciais no relatório:

`http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1/lesson/uma-mensagem-para-voce`

Servidor próprio PID **60780**, build acima, somente 127.0.0.1:3100. Mesmos 21 contêineres retidos, dez substitutos ativos para o estudo e demais parados; cinco volumes preservados. Conferência final: sete listeners do perfil em loopback e CDP9447 fechado. O gate instalado não foi alterado. Nenhuma migração foi invocada; as 21 permanecem preservadas.

Evidências em `.tmp/f3/inline-recall-001/`: candidatos, before, importações, builds, pareceres por mensagem, resultados C5/C6/C7 separados, screenshots finais em evidence-final, mídias, listeners e closure. Manifesto/patch de entrega identificam os caminhos finais e os hashes dos relatórios; o patch é contra HEAD nos caminhos selecionados e contém alterações anteriores nesses mesmos caminhos, não um diff isolado entre commits desta tarefa.

Sem ambiente novo, produção/remotos, API paga, deploy, commit/push/PR/merge ou geração de nova unidade por consequência desta correção.
