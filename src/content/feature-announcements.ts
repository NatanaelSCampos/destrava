export type FeatureAnnouncement = {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
  href: string;
  linkLabel: string;
};

// Add one entry with a new id for each released feature or meaningful improvement.
// The claim RPC ensures every entry appears at most once per learner, on any device.
export const featureAnnouncements: FeatureAnnouncement[] = [
  {
    id: "2026-10-numeros-regioes-missoes-diagnostico",
    title: "Mais prática para cada passo",
    summary: "Números, variações regionais, missões e diagnóstico receberam novos exemplos e verificações.",
    highlights: [
      "Pratique números em situações de dinheiro, datas, horários e telefone.",
      "Compare formas de falar por região; suas respostas agora entram no perfil de aprendizado.",
      "O diagnóstico usa mais perguntas por habilidade e deixa claro quando ainda faltam respostas para avaliar.",
    ],
    href: "/basics",
    linkLabel: "Explorar fundamentos",
  },
  {
    id: "2026-10-onboarding-pedagogico-v1",
    title: "Seu plano agora acompanha seus objetivos",
    summary: "Ao começar um novo curso, escolha objetivo, prioridades e tempo. As aulas e missões se ajustam ao seu percurso.",
    highlights: [
      "O diagnóstico curto ajuda a encontrar o melhor ponto de partida e continua opcional.",
      "Em Configurações → Meu aprendizado, ajuste suas escolhas sem perder o progresso.",
      "Cada curso guarda preferências independentes.",
    ],
    href: "/settings",
    linkLabel: "Ver meu aprendizado",
  },
  {
    id: "2026-10-ingles-a1-validacao",
    title: "Experimente os primeiros passos em inglês",
    summary: "Um curso curto de inglês A1 já está disponível para você conhecer a nova jornada multilíngua.",
    highlights: [
      "No menu Curso atual, selecione Inglês A1 · Primeiros encontros.",
      "Pratique apresentação, escuta e fala; explore alfabeto, números e vocabulário.",
      "Seu progresso em inglês fica separado do progresso em espanhol.",
    ],
    href: "/dashboard",
    linkLabel: "Escolher curso",
  },
  {
    id: "2026-10-perfil-e-revisao-por-idioma",
    title: "Seu treino agora conecta erros, fala e vocabulário",
    summary: "A aula focada inclui uma conversa curta e a revisão mostra pontos específicos de pronúncia.",
    highlights: [
      "Em Treinar dificuldades, pratique uma missão de três respostas dentro da sessão.",
      "Em Revisar, encontre palavras que a avaliação de fala indicou para repetir.",
      "No dicionário, busque por significado e variantes regionais; Meus erros mostra tentativas anteriores.",
    ],
    href: "/study?mode=difficulties",
    linkLabel: "Abrir treino focado",
  },
  {
    id: "2026-10-microlicoes-em-etapas",
    title: "Microlições para treinar um erro até o fim",
    summary: "Seu erro agora vira uma sequência curta de explicação, exercícios e fala.",
    highlights: [
      "Resolva três questões sobre o mesmo ponto e confira o resultado na etapa final.",
      "Pratique uma frase em voz alta; o microfone mostra a transcrição sem dar nota de pronúncia.",
      "Em Estatísticas, abra explicações específicas para números, conversas e imagens.",
    ],
    href: "/progress",
    linkLabel: "Ver o que melhorar",
  },
  {
    id: "2026-10-tempo-de-estudo-ativo",
    title: "Seu tempo de estudo ficou mais preciso",
    summary: "A sessão agora pausa fora da aula ou após cinco minutos sem interação.",
    highlights: [
      "Encerre uma sessão quando quiser, mesmo antes de concluir todas as atividades.",
      "Registros antigos com tempo muito alto deixam de inflar suas estatísticas.",
      "No Histórico, informe os minutos realmente estudados para corrigir esses registros.",
    ],
    href: "/history",
    linkLabel: "Ver meu histórico",
  },
  {
    id: "2026-10-jornada-mobile",
    title: "Estudar pelo celular ficou mais simples",
    summary: "Os principais caminhos estão sempre à mão e cada tela mostra primeiro o próximo passo.",
    highlights: [
      "Use a barra inferior para abrir Aula, Revisar e Conversar rapidamente.",
      "Na conversa, escolha entre missão guiada e assunto livre em áreas separadas.",
      "O diagnóstico destaca a prática recomendada e resume os resultados no celular.",
    ],
    href: "/dashboard",
    linkLabel: "Explorar melhorias",
  },
  {
    id: "2026-10-vozes-espanhol",
    title: "Escolha a voz do seu áudio de estudo",
    summary: "Agora você pode ouvir e escolher uma voz espanhola disponível no seu dispositivo.",
    highlights: [
      "Em Configurações, escolha uma voz para a variante de espanhol que você estuda.",
      "Ouça uma frase de exemplo antes de continuar seus estudos.",
      "O alfabeto explica por que C e Z podem soar diferentes entre regiões.",
    ],
    href: "/settings",
    linkLabel: "Escolher voz",
  },
  {
    id: "2026-10-conversa-adaptativa",
    title: "Converse por voz e receba práticas mais pessoais",
    summary: "As conversas agora ajudam a escolher o que praticar depois.",
    highlights: [
      "Fale nas missões e na conversa livre; confira a transcrição antes de enviar.",
      "Explore novas situações de viagem, compras e restaurante.",
      "O professor considera seus ajustes recentes e sugere práticas específicas.",
    ],
    href: "/conversation",
    linkLabel: "Experimentar conversa",
  },
  {
    id: "2026-10-revisao-apresentacao",
    title: "A revisão da apresentação ficou mais clara",
    summary: "O antigo mapa mental virou um roteiro para praticar em voz alta.",
    highlights: [
      "Siga três passos curtos para revisar e testar o que lembra.",
      "Veja cada assunto em um cartão, ouça o exemplo e crie sua frase.",
      "Ao final, diga três frases e faça uma pergunta sem olhar os modelos.",
    ],
    href: "/course/frecuencias-a1/unit/1/lesson/revision?activity=review-1",
    linkLabel: "Abrir revisão",
  },
  {
    id: "2026-10-lacunas-frase-completa",
    title: "Mais liberdade para responder às lacunas",
    summary: "Agora você pode escrever o trecho que falta ou a frase completa.",
    highlights: [
      "O campo explica o que deve ser digitado.",
      "Uma frase completa correta também é aceita nos exercícios de lacuna.",
      "Se errar, você verá o trecho esperado e a frase correta.",
    ],
    href: "/course/frecuencias-a1/unit/1/lesson/vocabulario?activity=vocab-3",
    linkLabel: "Experimentar uma lacuna",
  },
  {
    id: "2026-10-guias-por-tela",
    title: "Conheça cada tela passo a passo",
    summary: "Um guia curto apresenta cada área na primeira visita.",
    highlights: [
      "Avance pelo botão Próximo para conhecer uma parte de cada vez.",
      "Você pode pular o guia e voltar a ele pelo botão Ver guia no topo da tela.",
      "Cada tela é apresentada uma vez na sua conta.",
    ],
    href: "/study",
    linkLabel: "Abrir aula de hoje",
  },
];
