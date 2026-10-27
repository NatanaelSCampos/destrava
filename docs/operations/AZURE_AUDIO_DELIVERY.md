# Entrega Azure, aulas guiadas e reportes

Data: 27/10/2026. Baseline Git: 42a767072da6932bf47bfa0dd09c752ba13c8b96.
Consumidor: D:/Documents/destrava-worktrees/destrava-release-clean.
Destino autorizado: https://frecuencias-a1-natanael.fly.dev e GitHub NatanaelSCampos/destrava, branch main.

## Áudio

Foram produzidos 5.300 MP3 Azure Neural, com recibo individual de voz, locale, hash, duração e tamanho. São 2.650 textos/locale em duas vozes, deduplicados por hash. Os 1.252 caminhos ativos antigos receberam o áudio Azure feminino e alternativas masculina/feminina; oito ativos de demonstração misturados que não eram usados foram retirados do manifesto ativo. Arquivos históricos fora do catálogo ativo não são anunciados como conteúdo novo.

Configurações permite escolher voz feminina ou masculina por idioma, neste dispositivo. A escolha acompanha o idioma entre variantes; cada gravação mantém sua variante. Inglês: Ava/Andrew (EUA), Sonia/Ryan (Reino Unido). Espanhol: Ximena/Tristan (Espanha), Dalia/Jorge (México). Professor em português: Francisca/Antonio (Brasil). Não há fallback para síntese do navegador.

A geração usou a API comum de síntese SSML, com limitação de ritmo, bookmarks e cortes de PCM. Não usou o serviço Batch restrito a planos pagos. Foram 73 tentativas e 97.282 caracteres, incluindo uma repetição explicitamente registrada; 72 trabalhos concluídos. Em 42 finais de trabalho, o fim físico do PCM substituiu o último bookmark ausente; limites internos continuaram obrigatórios. Não houve estimativa de cortes internos.

O plano F0 publicado oferece 500 mil caracteres Neural/mês, compartilhados entre vozes. Isso permite oferecer duas vozes desses idiomas sem exigir voz HD. Não foi possível verificar o SKU e saldo do recurso configurado, nem outros consumos do mês; os números desta geração não comprovam faturamento zero. Fontes oficiais: [preços](https://azure.microsoft.com/en-us/pricing/details/speech/), [quotas](https://learn.microsoft.com/en-us/azure/ai-services/speech-services-quotas-and-limits), [síntese e bookmarks](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis).

Áudios estáticos não fazem nova chamada paga ao estudar. Textos inéditos de explicações da IA passam pelo servidor autenticado/MFA, origem validada, limite de texto, cache privado e limites existentes de requisições AI. Essa síntese dinâmica compartilha a cota de requisições da IA; uma resposta com várias falas pode consumir mais de uma reserva. Um orçamento Azure independente é melhoria futura. Não se alteraram os limites existentes sem contabilização.

Validação automática comprova arquivos, hashes, endpoints e reprodução observada. Não substitui audição humana integral das novas vozes, avaliação acústica ou teste em um aparelho físico.

## Aulas guiadas

Cinco aulas canônicas: duas EN e três ES. O catálogo /live-classes mostra os cards do curso selecionado e abre a aula dentro da unidade, respeitando seus bloqueios. Não há cópia independente do progresso.

Narração em português e exemplos no idioma alvo têm clipes separados e pausas de 650 ms. A apresentação segue o progresso real do áudio, com pausa, retomada e retorno; a transcrição começa fechada. Os controles ficam antes do quadro no celular. Quadros usam ilustrações, cartões, destaques e traduções consultáveis. Explicações adicionais usam o contexto atual da aula e a API de IA existente.

A demonstração espanhola longa tem cerca de 643 segundos de apresentação gravada, mais interações. As outras quatro têm introduções de aproximadamente 33–39 segundos e suas práticas próprias; não são apresentadas como cinco minutos de narração cada uma.

As definições e seus pacotes mudaram de hash. Foram arquivadas sessões incompatíveis com recibos binários em backup privado e realizada transição CAS, sem revalidar provas antigas sob o novo hash. Local: 10 sessões/16 recibos. Remoto planejado: 3 sessões/1 recibo, conferidos novamente antes de aplicar em manutenção. A autorização do proprietário permite refazer histórico de testes. A existência do backup não equivale a um ensaio de restauração. O reset delimitado não escreve tabelas comuns de respostas, provas ou estado do curso.

## Celular

Conversa permanece na navegação inferior e o acesso ao tutor fica visível no cabeçalho com alvo de toque. A captura de reporte usa modal nativo, acessível também de dentro da ajuda. Foram conferidas larguras emuladas de 360/390 px; isso não equivale a homologar todos os navegadores móveis ou permissões de microfone em aparelho físico.

## Reportes

Botão flutuante captura a tela atual, permite revisar/remover a captura e anexar até três imagens/texto. Respostas, campos pessoais e áreas de conversa/segurança são mascarados antes da captura automática. A pessoa autoriza publicar o conteúdo revisado no repositório público. Imagens anexadas manualmente também exigem revisão do proprietário.

O contexto inclui caminho sem query, curso/versão, atividade e parte quando disponíveis; não inclui cookies, tokens ou dumps. Fila privada no Supabase, acesso próprio apenas a recibos, escrita somente do serviço, idempotência, limites, leases e reconciliação de ambiguidades.

Actions sincroniza a cada 15 minutos (sujeito ao agendamento do GitHub), primeiro armazena evidências, depois cria/reconcilia Issue e confirma recebimento. Artifacts duram sete dias; imagens na fila sete dias e recibos noventa. Credencial específica da ponte no Fly/Actions; token pessoal do GitHub não instalado no servidor.

O reporte não abre automaticamente esta conversa nem dispara um agente para corrigir sem supervisão. Uma execução futura pode receber a Issue e ler [REPORTING_CONTEXT.md](REPORTING_CONTEXT.md), o código e as evidências. Texto de Issue é dado não confiável e não autoriza comandos ou acesso a segredos.

## Evidências desta rodada

Artefatos locais ignorados em .tmp/azure-course-audio-20261026:
- verificador completo de 5.300 arquivos e 1.252 espelhos; build final plXqQMVnxulEmO-7zNm18, exit 0;
- 36 controles puros de fluidez/narração; 88 regressões selecionadas de acesso/etapas/mídia/contratos; arquitetura, TypeScript e ESLint;
- QA independente: 31 controles cliente, 23 servidor em VM; delta de posse de áudio com sete asserts do Lead revisados em VM e quatro negativos independentes de contexto;
- browser local: áudio Azure real, preferência persistida, pausa/retomada do mesmo clipe, transcrição fechada, uma pergunta contextual real com resposta HTTP 200;
- reporte real salvo na fila local, consentimento durante captura, máscaras antes do canvas e controle alcançável dentro de modal;
- CSS do build final em 360/390 px sem overflow no modal; controles antes do quadro e backlink único;
- ensaio SQL de privilégios, consentimento, idempotência, limites, lease e ACK em transação com ROLLBACK; migração de reportes aplicada e registrada local/remota.

Falhas de preparação mantidas: execução de testes sem loader TS; rejeição de arquitetura de strings linguísticas em camada genérica (movidas para JSON de conteúdo); OOM em teste local com heap 256 MiB (o candidato final usa 512 MiB, como o limite efetivo da máquina Fly de 1 GiB); dois seletores de harness de browser incorretos. Os comprovantes parciais são identificados como parciais, não reclassificados como uma execução integral verde.

A publicação e a prova real GitHub Issue/Actions serão registradas no recibo final da entrega. Build local e fila local, isoladamente, não comprovam esse caminho externo.
