# Destrava — decisões abertas

Não preencher lacunas de produto com suposições. Documentar as opções e devolver ao proprietário quando a decisão for necessária.

## Prioridade para adoção do processo

1. **Reconciliação com \`main\`:** quando integrar a branch de Fase 4, cuja baseline remota está adiante da \`main\`? Uma PR de reconciliação deve ter escopo e testes próprios.
2. **Aprovação da documentação:** qual regra adotar para indicar que a spec saiu de \`PROPOSTA\` para \`APROVADA PARA EXECUÇÃO\` (merge autorizado, revisão formal, registro de decisão)?
3. **Política de PR por tamanho/risco:** quando descrição e aceite na própria PR são suficientes, e quando exigir spec/plan/tasks separados? Proposta em [DO_CHAT_AO_COMMIT.md](DO_CHAT_AO_COMMIT.md).
4. **Fase 4 Ciclo 2:** escopo A2/B2 ainda não autorizado para implementação. Confirmar prioridades, limites de provedores/voz e homologações obrigatórias antes do plano técnico final.
5. **Release e pilotos:** como conciliar branches de motor e pilotos ES/EN sem incluir código experimental no lançamento errado? Não resolver por merge automático.

O Lead não deve executar A2/B2, atualizar produção, decidir estas questões nem realizar merge por interpretar a abertura desta documentação como autorização.
