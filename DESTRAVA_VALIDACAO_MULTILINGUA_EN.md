# Validação multilíngua: inglês A1 mínimo

Data: 2026-10-03. Esta unidade é uma prova de arquitetura, não o curso definitivo de inglês.

## Resultado automatizado

- O registro compila três cursos: espanhol A1, inglês A1 mínimo e xx-Test.
- O inglês entra por `content/languages/en` e `content/courses/pt-BR.en.a1.general`: 1 unidade, 3 lições, 18 atividades, 16 entradas de léxico, 1 missão, 1 role-play, 1 avaliação e 1 cena compartilhada com o espanhol.
- O inglês cobre alfabeto, números, particularidades, dicionário, cartões, múltipla escolha, lacuna, ordenação, resposta curta, escuta, escrita e fala. Os modos de repetição e shadowing usam as atividades de fala existentes.
- `general` e `en-US` resolvem fala para `en-US`; `en-GB` resolve para `en-GB`. O áudio de texto usa a voz disponível no navegador. A Microsoft [lista ambas as variantes para reconhecimento e avaliação de pronúncia](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment). A qualidade da voz e o fluxo do microfone precisam de teste humano.
- Os testes de estado, perfil, recomendação, revisão, léxico e contexto do tutor mostram isolamento entre espanhol, inglês e xx-Test. O mesmo arquivo de imagem é usado com instruções diferentes por curso.
- `content:validate`: três pacotes válidos. `content:pedagogy`: 0 erros, 2 avisos preexistentes do espanhol (`grammar-5` e `review-4`: resposta alternativa redundante). `content:compile`: três pacotes. Lint, tipos, build, motor de aprendizagem, sessão e arquitetura passaram.
- O Supabase remoto contém 40 atividades espanholas, 18 inglesas e 7 de xx-Test, com contagens de unidades, lições e vocabulário conferidas.

## Correções genéricas observadas na validação

- A troca autenticada parava ao sincronizar uma revisão de vocabulário: o evento atribuía um ID de palavra à chave estrangeira de atividade. Eventos novos usam `itemId`; a projeção preserva referências históricas inválidas nos metadados sem violar a chave estrangeira.
- Elementos da interface que marcavam texto como `lang="es"` agora usam o idioma do curso ativo. Isso afeta exercícios, texto corrigido e conversas em qualquer curso.
- A verificação de arquitetura agora percorre também páginas e repositórios e procura referências específicas de espanhol ou inglês no código genérico.

## Teste manual com conta autenticada

1. Entre, selecione **Espanhol**, responda uma atividade com erro e abra progresso, erros e revisão. Atualize a página.
2. Troque para **Testês**, conclua uma atividade e confira fundamentos, histórico, perfil e recomendações. Saia e entre novamente; confira o estado de Testês.
3. Volte para **Espanhol** e confirme que progresso, erro e revisão anteriores reaparecem sem itens de Testês.
4. Troque para **Inglês A1 · Primeiros encontros**. Faça uma atividade errada com `be`, marque uma palavra para revisão, use dicionário, cartões, fundamentos, avaliação, tutor, missão e descrição da imagem do café. Confira que exemplos e recomendações são ingleses.
5. Em **Configurações**, escolha `general`, `en-US` e `en-GB` separadamente. Em cada variante, teste a voz do navegador, escuta, repetição, shadowing, reconhecimento e avaliação de pronúncia no microfone.
6. Atualize a página inglesa, saia e entre novamente. Volte para espanhol e depois inglês; confira progresso, erros, revisão, histórico e domínio de cada curso.

Até esse teste terminar, a troca autenticada completa e a qualidade real de fala/tutor não estão confirmadas em dispositivo de usuário. Nenhuma regra específica de inglês foi adicionada ao motor.
