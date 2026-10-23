import type { DiagnosticQuestion } from "./types";

const options = (labels: string[]) =>
  labels.map((label, index) => ({
    key: (["a", "b", "c", "d"] as const)[index],
    label,
  }));

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    key: "business_stage",
    category: "business_stage",
    title: "Qual dessas situações melhor descreve seu negócio hoje?",
    options: options([
      "Estou começando e quero conquistar minhas primeiras clientes.",
      "Já atendo, mas minha agenda ainda é instável.",
      "Tenho clientes frequentes, mas quero aumentar meu faturamento.",
      "Tenho uma boa demanda e quero crescer com mais organização.",
    ]),
  },
  {
    key: "acquisition",
    category: "acquisition",
    title: "De onde vem a maior parte das suas novas clientes?",
    options: options([
      "Indicações de outras clientes.",
      "Instagram e redes sociais, sem anúncios.",
      "Anúncios pagos no Instagram ou Google.",
      "Não tenho uma forma constante de atrair clientes.",
    ]),
  },
  {
    key: "demand",
    category: "demand",
    title: "Como está sua agenda na maioria das semanas?",
    options: options([
      "Tenho muitos horários vagos.",
      "Algumas semanas são boas, outras são bem paradas.",
      "Tenho um movimento constante, mas ainda posso atender mais.",
      "Minha agenda está quase sempre cheia.",
    ]),
  },
  {
    key: "service",
    category: "service",
    title: "Quando alguém pede informações ou valores, o que costuma acontecer?",
    options: options([
      "Muitas pessoas perguntam, mas poucas agendam.",
      "Algumas agendam, mas muitas param de responder.",
      "A maioria das interessadas acaba agendando.",
      "Não sei quantas interessadas realmente agendam.",
    ]),
  },
  {
    key: "follow_up",
    category: "follow_up",
    title: "O que você faz quando uma possível cliente demonstra interesse, mas não agenda?",
    options: options([
      "Normalmente espero ela entrar em contato novamente.",
      "Às vezes mando outra mensagem, quando lembro.",
      "Faço contato novamente de forma organizada.",
      "Tenho um processo ou sistema para acompanhar essas pessoas.",
    ]),
  },
  {
    key: "primary_need",
    category: "primary_need",
    title: "Se pudesse melhorar uma coisa no seu negócio nos próximos 3 meses, qual seria?",
    options: options([
      "Atrair mais clientes novas.",
      "Conseguir mais agendamentos com os contatos que já recebo.",
      "Organizar meu atendimento para não perder oportunidades.",
      "Aumentar meu faturamento e crescer com mais previsibilidade.",
    ]),
  },
];
