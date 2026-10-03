export type PageTourStep = {
  title: string;
  description: string;
  target: string;
};

export type PageTour = {
  id: string;
  name: string;
  steps: PageTourStep[];
};

const tours: Record<string, PageTour> = {
  dashboard: {
    id: "dashboard",
    name: "Visão geral",
    steps: [
      {
        title: "Seu ponto de partida",
        description: "Aqui você vê o que estudar hoje e acompanha seu ritmo no curso.",
        target: ".dashboard-page .page-heading",
      },
      {
        title: "Encontre as outras telas",
        description:
          "O menu lateral leva ao curso, à prática e ao seu progresso. No celular, abra o menu pelo ícone no topo.",
        target: ".sidebar-nav",
      },
      {
        title: "Abra o menu no celular",
        description: "Este botão abre as telas de estudo, revisão e acompanhamento.",
        target: ".menu-toggle",
      },
      {
        title: "Ajuste seu ritmo",
        description:
          "Se for seu primeiro acesso, escolha uma meta e quantos dias quer estudar. Você poderá mudar isso em Configurações.",
        target: ".onboarding-panel",
      },
      {
        title: "Comece a aula",
        description: "Este botão abre sua sessão de estudo. A trilha segue de onde você parou.",
        target: ".course-hero .hero-actions",
      },
      {
        title: "Escolha o tempo",
        description:
          "Tem poucos minutos? Escolha uma sessão curta; o roteiro se adapta ao tempo disponível.",
        target: ".quick-session-panel",
      },
      {
        title: "Seu foco agora",
        description:
          "Esta sugestão usa seu progresso e suas dificuldades para indicar a próxima prática.",
        target: ".rail-focus",
      },
    ],
  },
  course: {
    id: "course",
    name: "Meu curso",
    steps: [
      {
        title: "Sua trilha de espanhol",
        description:
          "O curso organiza o conteúdo em unidades. Você pode abrir qualquer etapa disponível.",
        target: ".course-page .page-heading",
      },
      {
        title: "Continue de onde parou",
        description: "Aqui você vê o avanço geral e pode abrir a aula do dia.",
        target: ".course-overview",
      },
      {
        title: "Escolha uma unidade",
        description:
          "Cada linha mostra uma unidade e seu progresso. Toque nela para ver as lições.",
        target: ".unit-list",
      },
    ],
  },
  unit: {
    id: "unit",
    name: "Unidade do curso",
    steps: [
      {
        title: "Uma unidade de cada vez",
        description: "Aqui estão o tema, os objetivos e o progresso desta unidade.",
        target: ".unit-hero",
      },
      {
        title: "Siga as lições",
        description:
          "Abra uma lição da lista. Você pode voltar às anteriores quando quiser revisar.",
        target: ".lesson-list",
      },
      {
        title: "O que você vai aprender",
        description:
          "Estes objetivos mostram o que você deverá conseguir fazer ao concluir a unidade.",
        target: ".objectives-panel",
      },
    ],
  },
  lesson: {
    id: "lesson",
    name: "Lição",
    steps: [
      {
        title: "Sua lição",
        description: "Cada lição reúne atividades curtas para você aprender e praticar um tema.",
        target: ".lesson-header",
      },
      {
        title: "Etapas da lição",
        description:
          "Esta lista mostra as atividades e o quanto você já concluiu. Você pode voltar a uma etapa.",
        target: ".lesson-sidebar",
      },
      {
        title: "Faça a atividade",
        description: "Leia a instrução, ouça os exemplos e responda quando houver um exercício.",
        target: ".activity-panel",
      },
      {
        title: "Avance no seu ritmo",
        description: "Use estes botões para ir à próxima atividade ou retornar à anterior.",
        target: ".lesson-controls",
      },
    ],
  },
  basics: {
    id: "basics",
    name: "Fundamentos",
    steps: [
      {
        title: "O essencial do idioma",
        description: "Este espaço reúne temas básicos para consultar sempre que precisar.",
        target: ".basics-page .page-heading",
      },
      {
        title: "Escolha um tema",
        description: "Alfabeto, números e variações regionais ficam separados nestes cartões.",
        target: ".basics-topic-grid",
      },
      {
        title: "Explore e escute",
        description:
          "Abra um tema, procure um item e use os botões de áudio para ouvir os exemplos.",
        target: ".basics-selected",
      },
    ],
  },
  alphabet: {
    id: "alphabet",
    name: "Alfabeto",
    steps: [
      {
        title: "Conheça as letras",
        description: "Veja o nome de cada letra em espanhol e compare com uma palavra de exemplo.",
        target: ".alphabet-page .page-heading",
      },
      {
        title: "Encontre uma letra",
        description: "Use a busca e os filtros para ir direto ao grupo que quer estudar.",
        target: ".alphabet-page .vocab-toolbar",
      },
      {
        title: "Ouça e repita",
        description: "Cada cartão tem áudio da letra, da palavra e do exemplo. Repita em voz alta.",
        target: ".alphabet-grid",
      },
    ],
  },
  numbers: {
    id: "numbers",
    name: "Praticar números",
    steps: [
      {
        title: "Números em uso",
        description: "Nesta tela você treina números com escuta, escrita e fala.",
        target: ".numbers-page .page-heading",
      },
      {
        title: "Ajuste a prática",
        description: "Escolha os números e o modo de treino antes de responder.",
        target: ".number-controls",
      },
      {
        title: "Faça uma tentativa",
        description: "Ouça ou leia o número e responda aqui. Você pode tentar outro em seguida.",
        target: ".number-work",
      },
      {
        title: "Veja sua evolução",
        description:
          "As tentativas recentes ficam neste histórico para você acompanhar o progresso.",
        target: ".number-history",
      },
    ],
  },
  "study-start": {
    id: "study-start",
    name: "Aula de hoje",
    steps: [
      {
        title: "Sua aula de hoje",
        description:
          "Esta tela monta uma sessão a partir do seu progresso, das revisões e do tempo que você tem. Você escolhe como estudar antes de começar.",
        target: ".study-page .page-heading",
      },
      {
        title: "Quanto tempo você tem?",
        description:
          "Escolha 5, 15 ou 30 minutos, ou a sessão completa. O roteiro abaixo muda conforme o tempo.",
        target: ".study-session-options > div:first-child",
      },
      {
        title: "Como prefere estudar?",
        description:
          "Continue a trilha para avançar no curso ou treine dificuldades que já apareceram nas suas tentativas.",
        target: ".study-session-options > div:nth-child(2)",
      },
      {
        title: "Inicie sua sessão",
        description:
          "Quando estiver pronto, clique em Começar sessão. Seu tempo e seu desempenho serão registrados ao encerrá-la.",
        target: ".study-start-card",
      },
      {
        title: "Veja o roteiro",
        description:
          "Aqui está a sequência de atividades e revisões desta sessão, com o tempo estimado de cada etapa.",
        target: ".study-plan-card",
      },
      {
        title: "Sua última sessão",
        description:
          "Depois da primeira aula, este espaço mostra o tempo estudado e o que melhorou nas suas tentativas.",
        target: ".study-session-result",
      },
    ],
  },
  "study-running": {
    id: "study-running",
    name: "Aula em andamento",
    steps: [
      {
        title: "A aula começou",
        description: "Aqui aparecem a atividade atual, a meta e o tempo da sessão.",
        target: ".study-running-head",
      },
      {
        title: "Acompanhe as etapas",
        description: "Esta barra mostra em qual etapa você está e quanto falta para concluir.",
        target: ".study-step-line",
      },
      {
        title: "Pratique aqui",
        description:
          "Leia a atividade, ouça os exemplos e responda. Seus resultados entram no seu histórico.",
        target: ".activity-panel",
      },
      {
        title: "Mude de etapa",
        description:
          "Use Voltar e Próxima etapa, ou escolha uma atividade diretamente no roteiro ao lado.",
        target: ".lesson-controls",
      },
      {
        title: "Seu roteiro",
        description:
          "Você pode rever uma etapa durante a sessão. Ao terminar, encerre a aula para registrar os resultados.",
        target: ".study-agenda",
      },
    ],
  },
  review: {
    id: "review",
    name: "Revisar",
    steps: [
      {
        title: "Revisão espaçada",
        description: "Aqui voltam palavras, estruturas e erros no momento de reforçar a memória.",
        target: ".review-page .page-heading",
      },
      {
        title: "O que está esperando",
        description: "Estes números separam itens pendentes dos cartões novos para aprender.",
        target: ".review-summary",
      },
      {
        title: "Escolha o tipo de revisão",
        description: "Alterne entre revisões pendentes e cartões novos antes de começar.",
        target: ".review-tabs",
      },
      {
        title: "Um cartão por vez",
        description: "Leia a frente, vire o cartão e indique se lembrou ou se ainda foi difícil.",
        target: ".review-queue",
      },
      {
        title: "Como revisar",
        description:
          "Tente lembrar antes de virar o cartão; depois indique se lembrou ou se ainda foi difícil.",
        target: ".review-how",
      },
    ],
  },
  speaking: {
    id: "speaking",
    name: "Praticar fala",
    steps: [
      {
        title: "Treine sua fala",
        description: "Ouça, repita e grave sua resposta para praticar pronúncia com calma.",
        target: ".speaking-practice-page .page-heading",
      },
      {
        title: "Escolha como praticar",
        description: "Você pode acompanhar o texto ou tentar falar sem vê-lo.",
        target: ".speaking-practice-options",
      },
      {
        title: "Siga as etapas",
        description:
          "O treino passa por escuta, repetição e resposta própria. Avance no seu ritmo.",
        target: ".speaking-stages",
      },
      {
        title: "Compare as tentativas",
        description: "Aqui ficam seus resultados recentes e os pontos que merecem outra tentativa.",
        target: ".speaking-practice-history",
      },
    ],
  },
  conversation: {
    id: "conversation",
    name: "Conversar",
    steps: [
      {
        title: "Converse em espanhol",
        description:
          "Use uma situação guiada ou uma conversa livre para praticar respostas naturais.",
        target: ".conversation-page .page-heading",
      },
      {
        title: "Escolha o modo",
        description: "Selecione uma missão com objetivo definido ou pratique livremente.",
        target: ".conversation-mode-tabs",
      },
      {
        title: "Escolha uma situação",
        description: "As cenas sugerem um contexto para você saber sobre o que conversar.",
        target: ".conversation-scenario-grid",
      },
      {
        title: "Veja conversas anteriores",
        description: "Você pode retomar uma conversa recente ou iniciar outra quando quiser.",
        target: ".conversation-history",
      },
      {
        title: "A conversa acontece aqui",
        description:
          "Leia a mensagem do professor e acompanhe as respostas e correções ao longo da conversa.",
        target: ".conversation-main",
      },
      {
        title: "Sua vez de responder",
        description: "Escreva ou grave sua resposta em espanhol para continuar o diálogo.",
        target: ".conversation-compose",
      },
    ],
  },
  describe: {
    id: "describe",
    name: "Explicar imagem",
    steps: [
      {
        title: "Descreva uma cena",
        description: "Observe a imagem e explique em espanhol o que está vendo.",
        target: ".describe-page .page-heading",
      },
      {
        title: "Escolha a imagem",
        description: "Troque de cena para praticar vocabulário em situações diferentes.",
        target: ".describe-scenes",
      },
      {
        title: "Fale ou escreva",
        description:
          "Grave sua descrição ou digite uma resposta. Depois envie para receber uma análise.",
        target: ".describe-main",
      },
      {
        title: "Leia o retorno",
        description: "Este espaço mostra o que você acertou e o que pode melhorar.",
        target: ".describe-feedback",
      },
    ],
  },
  assessment: {
    id: "assessment",
    name: "Diagnóstico",
    steps: [
      {
        title: "Descubra seu próximo passo",
        description:
          "O diagnóstico usa questões da unidade para mostrar o que você já domina e o que precisa praticar.",
        target: ".adaptive-page .page-heading",
      },
      {
        title: "Comece quando quiser",
        description: "Leia as orientações e inicie a avaliação. Você verá uma questão por vez.",
        target: ".adaptive-intro",
      },
      {
        title: "Uma questão por vez",
        description: "Responda e confira o retorno antes de seguir à próxima questão.",
        target: ".adaptive-question",
      },
      {
        title: "Receba um plano",
        description:
          "Ao terminar, o relatório mostra suas habilidades e sugere atividades para continuar.",
        target: ".adaptive-report",
      },
    ],
  },
  vocabulary: {
    id: "vocabulary",
    name: "Vocabulário",
    steps: [
      {
        title: "Suas palavras",
        description:
          "Aqui você encontra palavras do curso, exemplos e o estado de cada uma na sua memória.",
        target: ".vocabulary-page .page-heading",
      },
      {
        title: "Filtre o que procura",
        description: "Busque uma palavra ou mostre só as novas, difíceis ou já conhecidas.",
        target: ".vocab-toolbar",
      },
      {
        title: "Escute e acompanhe",
        description:
          "Em cada cartão, ouça a palavra e o exemplo; marque como difícil quando quiser revê-la.",
        target: ".vocab-grid",
      },
    ],
  },
  mistakes: {
    id: "mistakes",
    name: "Meus erros",
    steps: [
      {
        title: "Aprenda com os erros",
        description:
          "As respostas incorretas ficam aqui para você entender o motivo e tentar novamente.",
        target: ".mistakes-page .page-heading",
      },
      {
        title: "Veja os pontos de atenção",
        description: "O resumo mostra quantas correções estão pendentes e o que você já revisou.",
        target: ".mistake-summary",
      },
      {
        title: "Abra o contexto",
        description:
          "Cada cartão compara sua resposta com a esperada e oferece um caminho para praticar.",
        target: ".mistake-list",
      },
    ],
  },
  history: {
    id: "history",
    name: "Histórico",
    steps: [
      {
        title: "Seu caminho até aqui",
        description: "Consulte sessões concluídas, tempo estudado e resultados registrados.",
        target: ".history-page .page-heading",
      },
      {
        title: "Resumo do estudo",
        description: "Estes números mostram sua prática acumulada.",
        target: ".history-summary",
      },
      {
        title: "Sessões recentes",
        description: "Veja quando você estudou e o que aconteceu em cada sessão.",
        target: ".history-grid",
      },
      {
        title: "Evolução por tentativa",
        description: "Compare tentativas da mesma habilidade e volte à prática quando precisar.",
        target: ".practice-history-section",
      },
    ],
  },
  progress: {
    id: "progress",
    name: "Estatísticas",
    steps: [
      {
        title: "Veja seu progresso",
        description: "Esta página reúne avanço no curso, habilidades e sugestões de prática.",
        target: ".progress-page .page-heading",
      },
      {
        title: "Avanço na trilha",
        description: "Aqui aparecem o progresso geral e os sinais de domínio do conteúdo.",
        target: ".progress-top-grid",
      },
      {
        title: "O que melhorar agora",
        description:
          "Estas recomendações consideram seu histórico e levam direto à prática sugerida.",
        target: ".improvement-panel",
      },
      {
        title: "Habilidades e diagnóstico",
        description:
          "Compare as competências e abra o diagnóstico para verificar o que já aprendeu.",
        target: ".progress-bottom-grid",
      },
    ],
  },
  settings: {
    id: "settings",
    name: "Configurações",
    steps: [
      {
        title: "Ajuste seu espaço",
        description: "Mude a meta, a rotina e outras preferências de estudo quando quiser.",
        target: ".settings-page .page-heading",
      },
      {
        title: "Seu plano",
        description: "Estas escolhas ajudam o Destrava a montar sessões adequadas ao seu ritmo.",
        target: ".settings-grid .settings-panel",
      },
      {
        title: "Áudio de estudo",
        description:
          "Escolha uma voz espanhola deste dispositivo e ouça o exemplo. A lista pode ser diferente no celular e no computador.",
        target: ".audio-settings-panel",
      },
      {
        title: "Seus dados e sua conta",
        description: "Aqui você pode exportar dados e gerenciar as formas de acesso à conta.",
        target: ".settings-data",
      },
      {
        title: "Formas de entrar",
        description: "Veja as contas vinculadas e gerencie o acesso pelo Google.",
        target: ".account-identities",
      },
      {
        title: "Proteja sua conta",
        description:
          "Gerencie a autenticação em duas etapas e outras opções de segurança disponíveis.",
        target: ".account-security:not(.account-identities)",
      },
    ],
  },
  "micro-lesson": {
    id: "micro-lesson",
    name: "Microlição",
    steps: [
      {
        title: "Reveja um erro",
        description:
          "A microlição parte de uma tentativa anterior para explicar o ponto que causou dúvida.",
        target: ".micro-lesson-page .page-heading",
      },
      {
        title: "Entenda e pratique",
        description: "Compare as respostas, leia a explicação e tente a nova questão.",
        target: ".micro-lesson-main",
      },
      {
        title: "Acompanhe sua melhora",
        description: "Suas tentativas neste ponto ficam ao lado para comparar depois.",
        target: ".micro-lesson-side",
      },
    ],
  },
};

export function pageTourFor(pathname: string, runningStudySession: boolean): PageTour | null {
  if (/^\/course\/[^/]+\/unit\/[^/]+\/lesson\/[^/]+$/.test(pathname)) return tours.lesson;
  if (/^\/course\/[^/]+\/unit\/[^/]+$/.test(pathname)) return tours.unit;
  if (/^\/course\/[^/]+$/.test(pathname)) return tours.course;
  if (pathname === "/study") return tours[runningStudySession ? "study-running" : "study-start"];
  return tours[pathname.slice(1)] ?? null;
}
