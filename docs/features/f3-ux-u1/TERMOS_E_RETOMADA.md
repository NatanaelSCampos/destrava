# Termos e retomada em conversa

## Responsabilidade

CoursePackage 1.7 acrescenta dados opcionais. O Foundry identifica o idioma de cada trecho e compõe a situação, a ação e o diálogo. O Motor renderiza os mesmos recursos para qualquer curso; não procura palavras espanholas nem contém IDs deste curso.

## Explicação com dois idiomas

`presentation.annotations` identifica trechos exatos. `item` é o índice do parágrafo (body/support) ou da entrada (guidance/options/highlights/tokens/alternativas); campos de texto único usam zero. `occurrence` começa em um e identifica repetições no mesmo item. `role` target/source usa os idiomas do pacote.

```json
{
  "presentation": {
    "annotations": {
      "support": [
        { "text": "Estoy", "occurrence": 1, "item": 0, "role": "target" }
      ]
    }
  },
  "payload": {
    "teaching": {
      "kind": "concept",
      "lines": [{ "text": "Estoy en la biblioteca.", "translation": "Estou na biblioteca." }],
      "support": "Estoy = estou. Use para dizer onde você está."
    }
  }
}
```

O validador rejeita trechos ausentes, sobrepostos ou índices inválidos. Não há HTML, Markdown interpretado, detecção de idioma ou glossário do Motor. O texto se mantém íntegro e selecionável; expressões ganham tipografia, contraste e lang próprios.

Anotações de explanation, feedbackSummary, feedbackAlternative, answer e transcrição oculta ficam fora da projeção pública. O avaliador retorna a apresentação do feedback escolhido depois da tentativa. summary usa item 0 correto / 1 incorreto na autoria; alternativas seguem sua ordem canônica. Anotações públicas não podem citar soluções privadas.

## Retomada

Flashcard 3.0.0 aceita `payload.recallScene`: title, context, action, illustration=message e model (Teaching dialogue, duas ou mais falas com interlocutores). A primeira fala deve corresponder a back. Áudio usa apenas IDs declarados e atribuídos no pacote.

O card mostra contexto ilustrado, espaço de tentativa e comparação organizada. O modelo e seu áudio só são montados após comparar. Ajuda abre o diálogo existente e mantém o rascunho. Conferir é autocheck, sem nota linguística ou declaração automática de domínio. Pacotes antigos mantêm sua interação, agora agrupada em cards.

## Compatibilidade

- CoursePackage 1.3–1.6 continuam aceitos; rejeitam os recursos exclusivos de 1.7.
- presentation.bidi/text.input 1.0 conservam seu schema anterior.
- presentation.inline 1.0 é requisito obrigatório inferido quando o pacote declara a extensão.
- activity.flashcard 2.0 rejeita recallScene; 3.0 o admite.
- Exportação canônica: `node --import tsx scripts/export-package-contracts.ts`.

O produtor precisa usar o recurso nas próximas lições e validar o pacote; disponibilidade técnica não redesenha conteúdo antigo automaticamente. Cada edição nova requer referências do catálogo alinhadas e prova de persistência normalizada, sem depender somente do JSON local ou do build.

## Caminho qualificado nesta entrega

A execução desta tarefa é compilada. O perfil instalado mantém presentation.inline indisponível e rejeita pacotes que a exigem; sua allowlist e o gate instalado foram preservados. O perfil público installed-runtime.json registra essa recusa. O Foundry pode reutilizar os recursos nas próximas unidades compiladas; aceitar e ativar essas unidades no runtime instalado exige qualificação própria. Compatibilidade do pacote com o catálogo do Motor não significa prontidão do runtime instalado.
