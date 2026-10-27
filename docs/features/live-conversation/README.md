# Conversa por voz — primeira versão operacional

Atualização: 27/10/2026. Destino: https://frecuencias-a1-natanael.fly.dev/conversation. A publicação e seu SHA são conferidos pelo recibo de entrega da execução; este guia descreve o recurso, sem substituir essa conferência.

## Usar

1. Escolha espanhol ou inglês e abra **Conversar → Por voz**.
2. Escolha uma ou mais etapas liberadas pela prática do curso. Os cards seguem a hierarquia unidade → etapas; cada etapa é um tema completo. A caixa da unidade seleciona todas as etapas disponíveis dela, inclusive as que não aparecem no filtro. A busca e o filtro não apagam a seleção. Use “Ajustar conversa” quando terminar de escolher; marcar uma caixa não desloca a tela. Cada unidade mostra seis etapas por vez, com expansão. É possível combinar unidades (até 64 etapas, sujeito ao tamanho seguro do contexto). Só a conclusão visual de uma exposição não libera um assunto: é necessária participação com recibo válido do servidor.
3. Escolha nível, correção durante a conversa ou ao final e voz. Avançado sugere correção ao final; a escolha explícita prevalece.
4. Toque em **Começar conversa**, autorize o microfone e diga olá. No iniciante, o professor usa português, oferece um exemplo curto e pede uma tentativa. No avançado, conduz no idioma estudado.
5. Fale no seu ritmo, inclusive para interromper. **Pausar** desliga microfone e reprodução locais; **Retomar** espera confirmação do servidor. Há pedido por escrito e botão **Um instante**.
6. **Encerrar** desliga o microfone imediatamente e aguarda encerramento confirmado e resumo. O histórico permite consultar a conversa e tentar preparar um resumo que falhou.
7. **Por mensagens** preserva a experiência anterior e seus links para sessões/cenários.

## Recursos e fronteiras

- Voz nativa **GPT-Live 1**, WebRTC e comunicação simultânea nos dois sentidos. A esfera acompanha a energia do áudio realmente recebido; transcrição começa fechada.
- Apoio linguístico delegado e resumo estruturado usam **GPT-6.1 Sol**, com cotas existentes e saídas limitadas. Modelos e instruções são definidos no servidor.
- Voz feminina Marin e masculina Cedar. A preferência de gênero dos ajustes pode ser usada. As vozes Azure dos áudios gravados continuam disponíveis nas lições; a conversa ao vivo usa o transporte nativo de voz para reduzir etapas entre escuta e resposta.
- Tema, exemplos públicos e objetivos vêm do pacote compilado. A elegibilidade combina recibos assinados de participação, identidade da edição e acesso às unidades. Provas e unidades bloqueadas ficam fora do contexto.
- Recurso genérico para cursos compilados: nenhuma expressão espanhola ou inglesa foi codificada no fluxo. Não exige extensão do CoursePackage. O caminho de cursos instalados ainda é recusado explicitamente.
- Anotações não verbais conhecidas da transcrição ficam fora da análise e das citações de melhoria; o registro original continua privado no histórico. Frase-modelo e explicação ocupam campos separados.
- Não atribui nota de pronúncia, certificado, nível demonstrado, aprovação de prova ou progresso de atividade. O resumo usa as falas registradas; sugestões sem citação correspondente do estudante são descartadas.

## Dados e operação

Tabela nova e privada: `live_conversation_sessions`. Histórico, transcrição e resumo pertencem ao usuário autenticado com a proteção MFA existente. Campos de provedor e reservas não são expostos. Nenhum áudio bruto é salvo pelo Destrava; criação no provedor usa `store:false`. Isso não equivale a uma declaração geral de retenção zero pelo fornecedor.

A captura do botão Reportar oculta transcrição e relatório por `data-report-private`. O texto digitado já recebe a máscara existente de campos de formulário.

Limites implementados nesta versão:

- Até 8 minutos por conversa, incluindo pausas; a pausa não é apresentada como suspensão de cobrança.
- 3 inícios por usuário por hora e 12 no conjunto do projeto em 24 horas.
- Reserva comum de IA preservada, até 4 análises delegadas por conversa e até 3 tentativas de gerar o resumo.
- Heartbeat a cada 15 segundos; ausência por mais de 50 segundos inicia encerramento. Trocar de página/curso ou sair também desliga os dispositivos.
- Sessão sem confirmação de encerramento mantém a linha aberta, bloqueia novo início e permanece elegível a recuperação. `session.closed` é a confirmação; fechar o socket ou retornar HTTP de hangup não é apresentado como prova equivalente.
- Reserva idempotente compara proprietário e conteúdo canônico; abertura faz CAS contra encerramento concorrente. Conclusão do resumo verifica o token do claim.
- A coordenação ativa é em memória de **um processo**, adequada à máquina única atual do Fly. Escalar para vários processos pede coordenação durável e recuperação independente do processo. Timer/heartbeat não constituem teto financeiro absoluto sob falha de máquina/provedor; mantenha também os limites do projeto OpenAI.

A chamada é paga pela chave já autorizada. O aluno usa HTTPS e precisa permitir microfone. Fones ajudam a reduzir retorno do alto-falante. Bloqueio de tela, suspensão do navegador ou perda de rede podem encerrar a conversa.

## Verificação

`npm run conversation:live:verify` executa os testes sintéticos do cliente e a suíte independente. Há ensaio SQL revertido, revisão independente e chamada real local com microfone sintético nos artefatos privados da execução. Navegador em largura móvel não substitui escuta humana nem teste em iPhone/Safari físico.

Referências primárias: [GPT-Live 1](https://developers.openai.com/api/docs/models/gpt-live-1), [Live](https://developers.openai.com/api/docs/guides/live), [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live).

## Sele??o combinada de temas

A hierarquia usa as unidades e etapas reais do pacote: uma etapa corresponde a um tema completo j? eleg?vel para conversa. A sele??o da unidade inclui apenas suas etapas dispon?veis, inclusive fora da p?gina ou busca atual; n?o libera conte?do ainda n?o estudado. O contador e os chips mostram a sele??o e permitem retirar etapas. As caixas t?m estado parcial quando s? parte da unidade est? marcada.

O navegador envia apenas os IDs escolhidos. O servidor reconfirma todos os temas e comp?e um contexto can?nico, com identidade est?vel, nomes de todas as etapas selecionadas e amostra distribu?da de exemplos. O hist?rico guarda essa sele??o no contexto privado existente; a IA recebe orienta??o para conectar os assuntos de modo natural, sem prometer cobrir todos em oito minutos. Uma etapa indispon?vel invalida o pedido inteiro, antes de reservar cota ou criar chamada. Sele??es que excedem o tamanho seguro do contexto s?o recusadas com orienta??o para escolher menos etapas; n?o s?o truncadas silenciosamente. Nenhuma migra??o, altera??o de progresso ou novo contrato Foundry ? necess?ria.
