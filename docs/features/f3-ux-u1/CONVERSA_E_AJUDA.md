# Primeira lição — conversa e ajuda

25/10/2026. Correção local da primeira lição, após novo retorno do proprietário. Edição de conteúdo **1.2.0**, contrato público **1.6 inalterado**. Mesmo ambiente release-clean.

## Mudanças entregues

- Explicação em cards visíveis, logo depois do primeiro exemplo e antes dos demais apoios: estoy, en la e yo. A instrução vaga sobre “partes inteiras” foi substituída. La isoladamente não foi traduzido como na.
- Resposta curta dentro de conversa ilustrada. A pergunta recebida e o campo da resposta têm papéis visuais distintos; a correção continua no avaliador existente.
- A escrita livre desta aplicação foi substituída por montagem guiada da resposta e da pergunta, com correção objetiva existente. Novo ID atp-u1-l1-build-conversation evita herdar a conclusão da escrita antiga. Montagem apoiada não comprova produção espontânea.
- Ajuda em modal nativo, com botão ilustrado, exemplos, áudio e explicação. Foco, Escape, botão de retorno e rascunho preservados.
- Voz opcional na mesma conversa, com três orientações curtas. O formulário de transcrição aparece depois de gravar, mantendo as condições reais de gravação e salvamento; não há professor ou nota fictícios.

## Verificação e evidências

Candidato final **F3-CONVERSATION-C2**, digest 37f92be21a1e9974154028e20be5fe6b4b50bf3951a6d9d545f31d258d3aa6c2. Baseline 548a729a33b80fa7dfb8681855cd1e2a71c5174b, branch test/release-f2-clean. Build Ery4CRPal686jIPcDYjm6.

Ensaio C1A: seis grupos PASS em navegador — explicação; modal/foco/rascunho com recarga; resposta errada e correta com correção real; montagem da conversa com correção real; gravação; mobile 360/390. A inspeção das capturas encontrou uma instrução residual de escuta na voz e um contexto de montagem que deveria manter a instrução comum. Ambos foram ajustados em C2.

Ensaio C2: dois grupos focalizados PASS nos bytes finais — contexto de montagem e instrução/controles de voz em desktop/mobile. Os demais componentes e conteúdos aprovados em C1A permanecem iguais. Não são apresentados oito grupos únicos de uma mesma execução. Zero erros de runtime e pedidos inesperados bloqueados nos dois ensaios.

TypeScript sem incremental, ESLint final dos oito fontes TSX, checker de arquitetura e build: exit 0. Validador oficial do pacote importado: tecnicamente válido e compatível. Validação de conteúdo dos quatro pacotes: exit 0. Build final sem stderr.

Testes do Lead com a conta sintética preexistente; a conta do proprietário não foi usada. Respostas de teste e dados foram retidos. A gravação técnica usa sinal sintético e MediaRecorder real; não prova captação física ou qualidade de pronúncia. Nenhum áudio foi enviado nessa verificação.

QA independente foi solicitado com perfil QA_V1 explícito, mas o agente encerrou por indisponibilidade de capacidade do modelo. Não existe novo parecer independente nem aprovação editorial autônoma desta edição. O estudo do proprietário continua sendo o aceite prático; os testes não demonstram eficácia de aprendizagem.

## Autoria e preservação

Autoria sucessora no Foundry: D:/Documents/Destrva Foundry/runs/f3-ux-u1-conversation-001. Pesquisa reconferida: [RAE/ASALE, estar](https://dle.rae.es/estar), [conjugação](https://www.rae.es/diccionario-estudiante/docs/conjugaciones-verbales.pdf) e [dónde](https://www.rae.es/dpd/d%C3%B3nde). As explicações são originais e restritas aos exemplos; não ensinam uma regra universal de temporariedade.

Pacote anterior e fontes preservados. Outros conteúdos da U1 e toda U2 são semanticamente iguais após normalizar somente a URL das mesmas mídias para a nova edição. Política mantém critérios e contagens: somente referência ao ID substituído foi atualizada. As 21 migrações permanecem byte a byte iguais. Sem SQL manual, reset, exclusão, alteração de Auth/ACL, API paga, remoto, deploy, commit ou publicação.

Retrabalho preservado: primeiro helper de importação usou await no topo em módulo CJS e falhou antes de importar; foi corrigido no executor. Checker apontou texto específico de idioma num rótulo de áudio anterior; o rótulo foi generalizado. Um gerador de harness final teve erro de aspas e não escreveu arquivos; sua correção precedeu o ensaio C2. Nenhum erro foi contado como teste verde.

## Acesso

[Abrir do início](http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1/lesson/uma-mensagem-para-voce?activity=atp-u1-l1-scene). [Conversa guiada](http://127.0.0.1:3100/course/espanol-a-tu-paso-a1/unit/1/lesson/uma-mensagem-para-voce?activity=atp-u1-l1-build-conversation). Servidor próprio mantido ativo em loopback; mesmas credenciais do proprietário.

Manifestos, patch completo incluindo o novo componente e os arquivos de mídia, preservação e capturas em .tmp/f3/conversation-001 e conversation-002. Conteúdo e captura de QA não contêm credenciais. Não houve publicação.
