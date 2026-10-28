# Memória de conversação e análise oral por créditos

## Experiência

- **Minha evolução** acompanha palavras, frases e construções por pessoa e idioma. A memória preserva evidências de cada conversa e muda prioridades conforme dificuldades e usos independentes reaparecem.
- Índice experimental **0–100**, com dimensões de repertório, precisão linguística, interação, coerência e autonomia. Amostra insuficiente aparece como traço, nunca como zero.
- Confiança independente do índice: inicial, em formação e consistente. É uma heurística de força das evidências, não uma probabilidade estatisticamente calibrada. Minutos de chamada não aumentam essa confiança.
- Conversas novas alimentam a memória ao encerrar. Conversas anteriores podem ser incluídas por ação explícita na interface, uma sessão por vez, com limites de processamento e proteção contra duplicação. A autorização para envio de transcrições anteriores à OpenAI foi concedida pelo usuário nesta tarefa.
- O professor recebe contexto compacto, até 3.000 caracteres, respeitando nível e correção escolhidos. A memória não altera provas, progresso curricular ou desbloqueios.

## Fronteira de avaliação

O índice observa palavras transcritas da fala. Não mede pronúncia, pausas ou fluência acústica, nem equivale a CEFR. Citações precisam corresponder a `turnId` e palavras efetivamente registradas do aluno. Texto digitado pode ajudar a memória linguística, mas não comprova fala, confiança oral ou consolidação oral. Idioma e assistência são classificados pelo avaliador; o domínio não é um detector linguístico independente. Erros de transcrição continuam uma limitação.

## Análise oral premium

A aba explica o recurso, permite selecionar até dez conversas, estima consumo no servidor, mostra saldo e falta de créditos. Carteiras ausentes equivalem a zero. A compra permanece indisponível. A execução paga está bloqueada no servidor mesmo com saldo positivo, até a ativação e calibração do recurso. Não existe endpoint que conceda créditos ao aluno.

Conversas antigas não contêm áudio. Nelas a estimativa é uma **simulação pela duração**, identificada na tela; não habilita avaliação acústica. Para novas conversas, a pessoa pode autorizar guardar apenas o microfone local. A captura PCM/WAV mono 16kHz é opcional e não afeta a chamada se indisponível. O upload é privado, só após encerramento, com consentimento prévio, limite de bytes e duração calculada pelo arquivo. Não há bucket público nem link de download exposto. A disponibilidade expira em 30 dias; remoção física agendada precisa de operação periódica antes de ampliar a retenção em produção. A exclusão autenticada individual está implementada.

## Base de custo e créditos

Versão `oral-2026-10-28-v1`, modelo de referência `gpt-audio`.

Preços verificados em 28/10/2026 na documentação oficial: entrada de áudio **US$32/milhão de tokens**, entrada de texto **US$2,50/milhão**, saída de texto **US$10/milhão**. A avaliação proposta gera texto, não áudio de saída.

Fonte: [GPT-Audio](https://developers.openai.com/api/docs/models/gpt-audio). Formato de entrada: [Audio in Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions).

Premissas de engenharia configuradas: 12,5 tokens de áudio por segundo, 1.200 tokens de texto de entrada e teto de 1.800 de saída por sessão. A taxa de tokens por segundo é uma **premissa conservadora, não uma garantia do fornecedor**. Dez minutos em uma sessão: custo estimado US$0,261; reserva de orçamento com margem de 35% e US$0,01 por crédito: **36 créditos**. Duas sessões somando dez minutos: US$0,282 estimados / **39 créditos**, pois há processamento por sessão.

Isso é orçamento técnico, **não preço de venda**. Faltam precificação comercial, tributos/câmbio, compra e validação com amostras reais antes de ativar a execução. O ledger distingue custo estimado da cotação de custo real da operação. Reserva e devolução são atômicas e idempotentes por cotação, disponíveis apenas ao servidor. Nenhuma cobrança ou compra acontece nesta versão.

## Integração reutilizável

O contrato público `src/content/conversation-assessment-contract.ts` descreve rubrica versionada e evidências. O Foundry poderá declarar versões futuras sem consultar banco ou tipos de UI. O domínio puro é independente de ES/EN e não contém regras específicas de curso. A persistência usa pessoa/idioma/rubrica e revalida citações contra a transcrição original antes de agregar o histórico completo.

## Próxima ativação premium

1. Implementar e validar o adaptador acústico com gravações reais, marcadores temporais e limites de inferência.
2. Calibrar tokens efetivos, variabilidade e concordância com avaliação humana; atualizar versão de preços.
3. Revalidar gravações e fingerprint da cotação antes da reserva; verificar consentimento, validade e idioma.
4. Ligar o processador à reserva/devolução; registrar uso real e resultado. Ativar execução somente depois de testes de falha/concurrency com provedor.
5. Implementar compra, confirmação de pagamento e crédito idempotente no servidor. Não confiar em retorno do navegador.

A interface não apresenta relatório acústico simulado nem nota de pronúncia inexistente.
