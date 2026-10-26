# Responsividade — celular e tablet

Data: 26/10/2026. Baseline: `008d5d7982e936283772e5f746102f0e85c85a89`.
Candidato local: **MOBILE-C4**, onze fontes fixados em `.tmp/mobile-20261026/candidate-c4.json`.
Este documento registra a análise e a validação local. A identidade e a conferência da imagem publicada são registradas separadamente nos recibos desta entrega.

## O que precisava melhorar

A ausência de rolagem lateral da página não assegurava boa usabilidade. Em390px, a atividade inicial começava a910px do topo: o cabeçalho e a lista vertical de partes ocupavam a primeira tela. O primeiro campo do login aparecia a773px. Áudio/repetição tinham alvos de35px; menu31px; fechar ajuda39px. Campos de login herdavam14px. O menu fechado permanecia no foco, e duas navegações laterais comprimiam a aula em paisagem.

## Correções reutilizáveis

- Percurso compacto por largura disponível; partes internas em faixa horizontal com indicador de posição, títulos acessíveis e centralização da parte atual. Selecionar uma parte não conclui a atividade.
- Menu modal até1024px, com fundo inerte, controle de foco, Tab/Escape e retorno ao acionador. O mesmo menu continua disponível no desktop.
- Áudio, repetição, velocidade, menu, fechar ajuda e controles principais com área mínima44×44px nos layouts compactos.
- Login compacto, campos16px e formulários de MFA/onboarding incluídos. A barra inferior sai de cena enquanto um campo de texto está focado; o conteúdo mantém espaço para os controles.
- Ajuda com altura dinâmica, corpo rolável e rodapé alcançável; áudio nativo limitado à largura disponível. Molduras aninhadas da prova foram reduzidas no celular.
- Controles declaram `touch-action: manipulation`. O ensaio isolado reproduziu a seleção rápida consumida sem essa regra e a chegada à parte esperada com ela. Não se atribui toda a causa do gesto apenas aos snapshots.
- Carregamento do acesso aparece como conferência do percurso, evitando apresentar aprovação ainda não carregada como bloqueio já decidido.

São capacidades gerais da interface. Não há tratamento por curso/atividade, mudança curricular, alteração dos contratos, banco, Auth, avaliação ou corte de80%. Nenhum serviço de IA foi habilitado.

## Evidências e limites

| Verificação | Evidência |
| --- | --- |
| Matriz inicial | 16 rotas×6 dimensões =96 combinações; sem overflow da página ou exceções runtime. As rotas dependentes de acesso podiam ainda estar carregando; esse levantamento não certifica seu conteúdo funcional. |
| Dimensões | 360×740,390×844,430×932,844×390,768×1024 e1024×768. Chrome com métricas de dispositivo e toque. |
| Layout compacto medido | No C3, antes do único delta de toque do C4: primeira atividade a687px em390px, partes130px; login a325px. Medições completas em `local-c3-audit.json`; fonte e posição são computadas, não estimadas por screenshot. |
| Interação C4 | 15/15 PASS: menu/foco/Tab/Escape/breakpoint, áudio real, alvos44px, última parte, escrita, ajuda/draft, paisagem e montagem por toque; zero exceções runtime. |
| Código | Build C4 exit0; TypeScript e ESLint focalizados exit0 no C3, cujo único delta posterior foi a regra CSS de toque. |
| Independência | QA conferiu pinos/recibos; Revisor aprovou fontes congeladas. Lead operou serviços e navegador. Mesma máquina/filesystem, sem alegação de sandbox técnico por papel. |

A primeira falha do roteiro procurava escrita numa lição que não a contém. A segunda pressupunha rascunho vazio, embora a conta QA já tivesse texto. O C3 preserva seu FAIL por timeout na seleção rápida de partes. Os probes e o C4 verde ficam separados; nenhuma falha foi convertida em aprovação histórica.

Evidências ignoradas: `.tmp/mobile-20261026/` — baseline, candidatos, auditorias, screenshots, probes, resultados e identidade do app local. Cookies e credenciais ficam em arquivos privados e não acompanham esta documentação.

**Limites práticos:** a viewport reduzida com campo focado simula espaço para o teclado; não é teclado nativo de iPhone/Android. Não houve aparelho físico/Safari, fones Bluetooth, teste acústico humano integral ou chamadas pagas. O viewport mantém a proteção padrão do navegador para recortes de tela; pinch zoom não foi desabilitado. A aula guiada com explicações ao vivo por IA continua uma entrega distinta, dependente da escolha de chave solicitada ao proprietário.

Local: `http://127.0.0.1:3100`. Destino de publicação autorizado: `https://frecuencias-a1-natanael.fly.dev`.