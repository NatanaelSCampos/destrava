# Revisão dos avisos do Supabase — 2026-10-03

## Escopo e evidência

- Foram lidos os sete arquivos em `supabase/migrations`, o fluxo de autenticação e os chamadores das funções RPC. O CSV anexado pelo usuário contém 34 avisos de **desempenho** sobre chaves estrangeiras sem índice; as capturas mostram 12 avisos e quatro informações de **segurança**.
- Consulta somente de leitura ao Supabase remoto: as tabelas `activity_answers`, `trusted_devices`, `trusted_sessions` e `user_feature_announcements` retornaram `42501` para a chave publicável sem usuário. Entre 40 atividades publicadas, nenhuma tinha `answer`, `accepted`, `fullAnswers`, `pairs` ou `explanation` no `payload`; uma tinha `transcript`.
- O exame dos privilégios de `authenticated` e da configuração remota de confirmação de e-mail foi feito a partir das migrações e do histórico de configuração, não de uma consulta administrativa ao catálogo remoto. Conferir estes dois pontos no painel antes de alterar políticas de produção.

## Decisões sobre os avisos

| Aviso | Avaliação | Ação |
| --- | --- | --- |
| `SECURITY DEFINER` executável por `authenticated` em funções de IA, MFA, dispositivo confiável e novidades | O acesso é intencional: o app usa RPC ou políticas RLS, e as funções verificam o usuário atual. Revogar todas as permissões quebraria login, MFA ou limite de IA. O `search_path` está vazio nessas funções. | Manter as permissões por enquanto. Revisar separadamente `complete_ai_request` e `claim_feature_announcements`, descritas abaixo. |
| `create_profile_for_new_user()` executável por `anon` e `authenticated` | É uma função de gatilho usada após criação de `auth.users`; não é um RPC de cadastro. O corpo insere somente `new.id` em `profiles`, mas foi criado com `search_path = public` e recebeu a permissão padrão de execução. | Endurecimento pontual recomendado: em migração própria, usar `search_path = ''` e revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated`, testando cadastro novo antes de aplicar em produção. Prioridade baixa frente ao risco de cadastro sem confirmação. |
| RLS ativado sem política em `activity_answers`, `trusted_devices`, `trusted_sessions` e `user_feature_announcements` | Intencional. `activity_answers` guarda respostas e está sem acesso direto; as outras três tabelas têm `REVOKE ALL` e são usadas por funções que verificam o usuário. A chave publicável anônima foi recusada no remoto. | Não criar políticas só para limpar o painel. |
| Proteção contra senhas vazadas desativada | A [documentação atual](https://supabase.com/docs/guides/auth/password-security) informa que esse recurso está disponível a partir do plano Pro. O projeto está no Free. | Não há opção equivalente para ligar no plano atual. Manter tamanho mínimo de senha, CAPTCHA e MFA; reconsiderar ao mudar de plano. |
| 34 chaves estrangeiras sem índice no CSV | São sugestões de desempenho, não falhas de acesso. Índices adicionais também aumentam custo de gravação; as consultas atuais usam sobretudo `user_id`, IDs e datas. | Medir consultas lentas e volume antes de criar índices. Priorizar somente colunas usadas em filtros, junções ou deleções em cascata que se tornarem lentas. |

## Achados fora do painel

1. **Prioridade alta — cadastro sem confirmação + vinculação automática Google.** A configuração local mantém `enable_confirmations = false` até haver domínio e SMTP. [Supabase confirma](https://supabase.com/docs/guides/auth/general-configuration) implicitamente o e-mail no banco nessa modalidade, e [vincula automaticamente identidades](https://supabase.com/docs/guides/auth/auth-identity-linking) com o mesmo e-mail. Isso cria um cenário de pré-cadastro com e-mail alheio antes de o titular entrar com Google. É uma inferência a partir das regras documentadas; não foi testado com contas de terceiros. A correção prioritária é ativar confirmação após configurar SMTP. Enquanto isso, avaliar desativar **novos cadastros por e-mail e senha**, preservando login de contas existentes e cadastro Google, caso isso seja compatível com a prévia escolhida pelo proprietário.
2. **Corrigido no script de importação — respostas completas.** `scripts/seed-supabase.ts` removia `answer` e `accepted` do `payload` público, mas não `fullAnswers`. Isso poderia expor respostas em uma futura importação. O script agora envia `fullAnswers` só para `activity_answers`. A consulta remota confirmou zero atividades atualmente expostas com esse campo; não há limpeza de dados remotos a fazer.
3. **Prioridade média — metadados de uso de IA.** `complete_ai_request` é executável por qualquer usuário autenticado e permite que ele altere `model`, tokens e custo **da própria reserva pendente**. Isso não aumenta o limite de chamadas nem cobra o provedor, mas torna os relatórios de consumo manipuláveis. Quando essas métricas forem usadas para cobrança ou auditoria, mover a conclusão para uma credencial exclusiva do servidor e revogar a execução do cliente, depois de atualizar o backend.
4. **Prioridade média — IDs arbitrários de novidades.** `claim_feature_announcements` aceita até 20 IDs por chamada, porém não confere uma lista de IDs publicados nem limita o total por usuário. Um cliente autenticado pode criar muitas linhas próprias. Antes de abrir o cadastro amplamente, usar uma lista permitida ou um teto transacional por conta.
5. **Limite de integridade das atividades.** Uma atividade de escuta publicada inclui `transcript` porque o cliente o usa para gerar áudio. O aluno tecnicamente pode inspecionar esse dado antes de responder. Isso não expõe credenciais ou dados de outros usuários; portanto, a nota desse exercício não deve ser tratada como prova inviolável. Esconder a transcrição exigiria mudar como o áudio é entregue.

## Referências

- [Supabase: funções, privilégios e `SECURITY DEFINER`](https://supabase.com/docs/guides/database/functions)
- [Supabase: RLS e tabelas sem políticas](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: conselheiros de segurança e desempenho](https://supabase.com/docs/guides/observability/advisors)
- [Supabase: confirmação de e-mail e identidade vinculada](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase: proteção de senha por plano](https://supabase.com/docs/guides/auth/password-security)
